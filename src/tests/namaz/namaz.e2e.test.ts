/**
 * Namaz Module — Master System Flow E2E Tests
 *
 * Covers the full Admin → User journey for the Namaz prayer guide feature:
 *
 *   0. Setup        — create SUPER_ADMIN + public user, issue JWT tokens
 *   1. Surah List   — public endpoint proxies 114 surahs from islamic.app
 *   2. Admin Config — SUPER_ADMIN configures per-rakat surahs for each Salah type
 *   3. User Guide   — authenticated user fetches the 14-step prayer guide
 *   4. Journey      — end-to-end: Admin sets config → User sees merged guide
 *
 * Uses the real Express app instance (src/app.ts) with MongoMemoryServer.
 * External HTTP calls to islamic.app are intercepted via vi.spyOn(axios, 'get').
 * Redis and Firebase are mocked to avoid infrastructure dependencies.
 *
 * API shape (api.islamic.app v1):
 *   GET /v1/chapters          → { data: { chapters: [...] } }
 *   GET /v1/chapters/{id}     → { data: { chapter: { name_simple, ... } } }
 *   GET /v1/verses/by_chapter/{id}?words=true&translations=22
 *                             → { data: { verses: [{ text_uthmani, translations, words }] } }
 *
 * Each upsertSalahConfig call for N rakats makes 2×N axios calls:
 *   one GET /v1/chapters/{id}  +  one GET /v1/verses/by_chapter/{id}  per rakat.
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { StatusCodes } from 'http-status-codes';
import axios from 'axios';

import { User } from '../../app/modules/user/user.model';
import { PrayerStepModel, SalahConfigModel } from '../../app/modules/namaz/namaz.model';
import { PRAYER_STEPS } from '../../scripts/seed-namaz';
import { jwtHelper } from '../../helpers/jwtHelper';
import config from '../../config';
import { Secret } from 'jsonwebtoken';
import { USER_ROLES, USER_STATUS } from '../../enums/user';
import { logApi } from '../../helpers/__tests__/testLogger';

vi.setConfig({ testTimeout: 30_000 });

// ── Infrastructure mocks ──────────────────────────────────────────────────────

vi.mock('../../shared/redisClient', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on:  vi.fn(),
  },
}));

vi.mock('../../app/modules/notification/pushNotificationHelper', () => ({
  pushNotificationHelper: {
    sendPushNotifications: vi.fn().mockResolvedValue(undefined),
    sendPushNotification:  vi.fn().mockResolvedValue(undefined),
  },
}));

import app from '../../app';

// ── Shared state ──────────────────────────────────────────────────────────────

let mongoServer: MongoMemoryServer;
let adminToken: string;
let userToken: string;

// ── Fake islamic.app v1 API responses ─────────────────────────────────────────

/**
 * Builds the two API responses needed for one rakat's surah fetch:
 *   call 1: GET /v1/chapters/{id}              → chapter metadata
 *   call 2: GET /v1/verses/by_chapter/{id}     → verses with words + translation
 */
function makeSurahMocks(surahName: string, arabicLine: string, translationLine: string, words: { arabic: string; transliteration: string; meaning: string }[]) {
  const chapterRes = {
    data: { chapter: { name_simple: surahName } },
  };
  const versesRes = {
    data: {
      verses: [{
        verse_number: 1,
        verse_key: "112:1",
        text_uthmani: arabicLine,
        translations: [{ text: translationLine }],
        audio: { url: "Alafasy/mp3/112001.mp3" },
        words: words.map(w => ({
          char_type_name: 'word',
          text_uthmani: w.arabic,
          transliteration: { text: w.transliteration },
          translation: { text: w.meaning },
        })),
      }],
    },
  };
  return [chapterRes, versesRes] as const;
}

const SURAH_112_WORDS = [
  { arabic: 'قُلْ', transliteration: 'qul', meaning: 'Say' },
  { arabic: 'هُوَ', transliteration: 'huwa', meaning: 'He' },
  { arabic: 'اللَّهُ', transliteration: 'l-lahu', meaning: 'Allah' },
  { arabic: 'أَحَدٌ', transliteration: 'ahadun', meaning: 'One' },
];

const SURAH_108_WORDS = [
  { arabic: 'إِنَّا', transliteration: 'inna', meaning: 'Indeed We' },
  { arabic: 'أَعْطَيْنَاكَ', transliteration: "a'taynaka", meaning: 'have given you' },
];

const [CHAPTER_112, VERSES_112] = makeSurahMocks(
  'Al-Ikhlas',
  'قُلْ هُوَ اللَّهُ أَحَدٌ',
  'Say: He is Allah, the One and Only;',
  SURAH_112_WORDS,
);

const [CHAPTER_108, VERSES_108] = makeSurahMocks(
  'Al-Kawthar',
  'إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ',
  'To thee have We granted the Fount (of Abundance)',
  SURAH_108_WORDS,
);

/** Surah list mock for GET /v1/chapters */
const SURAH_LIST_RESPONSE = {
  data: {
    data: {
      chapters: [
        { id: 1,   name_simple: 'Al-Fatihah', name_arabic: 'الفاتحة', verses_count: 7  },
        { id: 2,   name_simple: 'Al-Baqarah', name_arabic: 'البقرة',  verses_count: 286 },
        { id: 112, name_simple: 'Al-Ikhlas',  name_arabic: 'الإخلاص', verses_count: 4  },
        { id: 108, name_simple: 'Al-Kawthar', name_arabic: 'الكوثر',  verses_count: 3  },
        // ...114 total in production
      ],
    },
  },
};

/**
 * Helper: set up sequential axios mocks for N rakats.
 * Each rakat needs 2 calls: GET /v1/chapters/{id} then GET /v1/verses/by_chapter/{id}.
 * Returns the spy so callers can make additional assertions.
 * Call this BEFORE the PUT request, passing one [chapter, verses] pair per rakat.
 */
function mockAxiosForRakats(
  ...rakatMocks: (readonly [object, object])[]
) {
  // Build a map from name_simple to the mock pair
  const mockMap = new Map<string, readonly [object, object]>();
  for (const mock of rakatMocks) {
    const name = (mock[0] as any).data?.chapter?.name_simple;
    if (name) mockMap.set(name, mock);
  }

  const spy = vi.spyOn(axios, 'get');
  spy.mockImplementation((url: string) => {
    let mockPair = rakatMocks[0];
    
    // Quran.com API mappings: 112 = Al-Ikhlas, 108 = Al-Kawthar
    if (url.includes('/112')) {
      mockPair = mockMap.get('Al-Ikhlas') || rakatMocks[0];
    } else if (url.includes('/108')) {
      mockPair = mockMap.get('Al-Kawthar') || rakatMocks[0];
    }

    if (url.includes('/chapters/')) {
      return Promise.resolve(mockPair[0]);
    } else if (url.includes('/verses/')) {
      return Promise.resolve(mockPair[1]);
    }
    return Promise.resolve({ data: {} });
  });
  return spy;
}

// ── DB lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // SUPER_ADMIN
  const admin = await User.create({
    name: 'Namaz Admin',
    role: USER_ROLES.SUPER_ADMIN,
    email: 'namaz-admin@e2e.test',
    password: 'Admin1234!',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    dateOfBirth: new Date('1990-01-01'),
    profileImage: '/default-avatar.svg',
  });

  adminToken = jwtHelper.createToken(
    { id: admin._id, role: admin.role, tokenVersion: 0 },
    config.jwt.jwt_secret as Secret,
    '1d',
  );

  // BROTHER user
  const brother = await User.create({
    name: 'Namaz User',
    role: USER_ROLES.BROTHER,
    email: 'namaz-user@e2e.test',
    password: 'User1234!',
    isVerified: true,
    status: USER_STATUS.ACTIVE,
    dateOfBirth: new Date('1995-05-15'),
    revertDate: new Date(),
    profileImage: '/default-avatar.svg',
    verificationImage: 'https://example.com/verify.jpg',
    verificationVideo: 'https://example.com/verify.mp4',
  });

  userToken = jwtHelper.createToken(
    { id: brother._id, role: brother.role, tokenVersion: 0 },
    config.jwt.jwt_secret as Secret,
    '1d',
  );

  // Seed 14 fixed prayer steps
  for (const step of PRAYER_STEPS) {
    await PrayerStepModel.bulkWrite([{
      updateOne: { filter: { stepKey: step.stepKey }, update: { $set: step }, upsert: true },
    }]);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// MASTER FLOW
// ─────────────────────────────────────────────────────────────────────────────

describe('Namaz Module — Master System Flow E2E', () => {

  // ───────────────────────────────────────────────────────────────────────────
  describe('0. Surah Discovery Flow', () => {
  // ───────────────────────────────────────────────────────────────────────────

    it('Public user browses the surah list dropdown before praying', async () => {
      console.info(`
📖 BDD SCENARIO: 01. SURAH LIST DISCOVERY
Feature: Admin Surah Selection
  As a SUPER_ADMIN configuring the prayer guide
  I want to see all 114 surahs in a dropdown
  So that I can pick the right surah for each rakat

  Given the Admin navigates to the Namaz config panel
  When the frontend loads the surah selection dropdown
  Then it calls GET /api/v1/namaz/surah-list (public endpoint)
  And the backend proxies the full list from api.islamic.app/v1/chapters
  And returns the raw { data: { chapters: [...] } } envelope to the client
      `);

      vi.spyOn(axios, 'get').mockResolvedValueOnce(SURAH_LIST_RESPONSE);

      const res = await request(app).get('/api/v1/namaz/surah-list');
      logApi('GET', '/api/v1/namaz/surah-list', {}, res.body,
        'GET-SURAH-LIST', 'Admin fetches surah list to populate dropdown');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      // Response contains the chapters array from the islamic.app envelope
      expect(res.body.data.data.chapters.length).toBeGreaterThan(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Admin Config Flow — Single Rakat', () => {
  // ───────────────────────────────────────────────────────────────────────────

    it('SUPER_ADMIN configures Fajr with 1 rakat (Al-Ikhlas, surah 112)', async () => {
      console.info(`
📖 BDD SCENARIO: 02. ADMIN CONFIGURES FAJR — SINGLE RAKAT
Feature: Per-Rakat Surah Configuration
  As a SUPER_ADMIN
  I want to assign Al-Ikhlas (surah 112) to rakat 1 of Fajr
  So that the Fajr prayer guide shows the correct surah

  Given the Admin selects "Fajr" from the salah type picker
  And selects "Al-Ikhlas" (surah 112) for rakat 1
  When they submit PUT /api/v1/namaz/salah-config/Fajr
  Then the backend calls GET /v1/chapters/112 for surah name
  And calls GET /v1/verses/by_chapter/112 for text + translation + word-by-word
  And stores the surah with rakat metadata in SalahConfig
  And returns the saved config with 1 rakat entry
      `);

      await SalahConfigModel.deleteMany({});

      mockAxiosForRakats([CHAPTER_112, VERSES_112]);

      const body = { rakats: [{ rakat: 1, surahNumber: 112 }] };
      const res = await request(app)
        .put('/api/v1/namaz/salah-config/Fajr')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      logApi('PUT', '/api/v1/namaz/salah-config/:salahType', {
        params: { salahType: 'Fajr' }, body,
      }, res.body, 'ADMIN-CONFIG-FAJR', 'Admin assigns Al-Ikhlas to Fajr rakat 1');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salahType).toBe('Fajr');
      expect(res.body.data.rakats).toHaveLength(1);
      expect(res.body.data.rakats[0].rakat).toBe(1);
      expect(res.body.data.rakats[0].surahNumber).toBe(112);
      expect(res.body.data.rakats[0].surahName).toBe('Al-Ikhlas');
      expect(res.body.data.rakats[0].verses).toHaveLength(1);
      expect(res.body.data.rakats[0].verses[0].arabicText).toBe('قُلْ هُوَ اللَّهُ أَحَدٌ');
      expect(res.body.data.rakats[0].verses[0].transliteration.length).toBeGreaterThan(0);

      const saved = await SalahConfigModel.findOne({ salahType: 'Fajr' }).lean();
      expect(saved?.rakats).toHaveLength(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Admin Config Flow — Multiple Rakats', () => {
  // ───────────────────────────────────────────────────────────────────────────

    it('SUPER_ADMIN configures Dhuhr with 2 rakats (different surahs per rakat)', async () => {
      console.info(`
📖 BDD SCENARIO: 03. ADMIN CONFIGURES DHUHR — TWO RAKATS
Feature: Per-Rakat Surah Configuration
  As a SUPER_ADMIN
  I want to assign different surahs for each rakat of Dhuhr
  So that users recite different surahs in rakat 1 and rakat 2

  Given the Admin selects "Dhuhr" and adds two rakat entries
  When they submit PUT /api/v1/namaz/salah-config/Dhuhr
  Then the backend makes 2 × 2 = 4 API calls (chapter + verses per rakat)
  And stores both rakat entries sorted by rakat number
  And the response contains 2 rakat entries with correct surah data
      `);

      // rakat 1: Al-Ikhlas, rakat 2: Al-Kawthar
      mockAxiosForRakats([CHAPTER_112, VERSES_112], [CHAPTER_108, VERSES_108]);

      const body = {
        rakats: [
          { rakat: 1, surahNumber: 112 },
          { rakat: 2, surahNumber: 108 },
        ],
      };
      const res = await request(app)
        .put('/api/v1/namaz/salah-config/Dhuhr')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      logApi('PUT', '/api/v1/namaz/salah-config/:salahType', {
        params: { salahType: 'Dhuhr' }, body,
      }, res.body, 'ADMIN-CONFIG-DHUHR', 'Admin assigns 2 different surahs for Dhuhr');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.rakats).toHaveLength(2);
      expect(res.body.data.rakats[0].surahName).toBe('Al-Ikhlas');
      expect(res.body.data.rakats[1].surahName).toBe('Al-Kawthar');
      expect(res.body.data.rakats[0].rakat).toBe(1);
      expect(res.body.data.rakats[1].rakat).toBe(2);
    });

    it('SUPER_ADMIN updates Dhuhr config — replaces all rakats with new assignments', async () => {
      console.info(`
📖 BDD SCENARIO: 04. ADMIN UPDATES EXISTING CONFIG
Feature: Config Idempotency
  As a SUPER_ADMIN
  I want to change the surah assignments for Dhuhr
  So that the prayer guide reflects my latest decision

  Given a SalahConfig already exists for Dhuhr
  When the Admin submits a new PUT /api/v1/namaz/salah-config/Dhuhr
  Then the backend replaces ALL existing rakats with the new assignments
  And exactly ONE SalahConfig document remains for Dhuhr
      `);

      // Swap: rakat 1 → Al-Kawthar, rakat 2 → Al-Ikhlas
      mockAxiosForRakats([CHAPTER_108, VERSES_108], [CHAPTER_112, VERSES_112]);

      const body = {
        rakats: [
          { rakat: 1, surahNumber: 108 },
          { rakat: 2, surahNumber: 112 },
        ],
      };
      const res = await request(app)
        .put('/api/v1/namaz/salah-config/Dhuhr')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      logApi('PUT', '/api/v1/namaz/salah-config/:salahType', {
        params: { salahType: 'Dhuhr' }, body,
      }, res.body, 'ADMIN-UPDATE-DHUHR', 'Admin swaps surah assignments for Dhuhr');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.data.rakats[0].surahName).toBe('Al-Kawthar');
      expect(res.body.data.rakats[1].surahName).toBe('Al-Ikhlas');

      const count = await SalahConfigModel.countDocuments({ salahType: 'Dhuhr' });
      expect(count).toBe(1);
    });

    it('SUPER_ADMIN configures all five Salah types independently', async () => {
      console.info(`
📖 BDD SCENARIO: 05. ADMIN CONFIGURES ALL FIVE SALAH TYPES
Feature: Complete Prayer Guide Setup
  As a SUPER_ADMIN
  I want to configure surahs for all five daily prayers
  So that every prayer type has its own tailored guide

  Given the Admin sets configs for Fajr, Dhuhr, Asr, Maghrib, and Isha
  When all five PUT requests are submitted
  Then each salah type gets its own independent SalahConfig document
  And exactly 5 documents exist in the SalahConfig collection
      `);

      await SalahConfigModel.deleteMany({});

      const salahTypes = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

      for (const salahType of salahTypes) {
        if (salahType === 'Dhuhr') {
          mockAxiosForRakats([CHAPTER_108, VERSES_108], [CHAPTER_112, VERSES_112]);
          const body = {
            rakats: [
              { rakat: 1, surahNumber: 108 },
              { rakat: 2, surahNumber: 112 },
            ],
          };
          const res = await request(app)
            .put(`/api/v1/namaz/salah-config/${salahType}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
        } else {
          mockAxiosForRakats([CHAPTER_112, VERSES_112]);
          const body = { rakats: [{ rakat: 1, surahNumber: 112 }] };
          const res = await request(app)
            .put(`/api/v1/namaz/salah-config/${salahType}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send(body);
        }

        logApi('PUT', '/api/v1/namaz/salah-config/:salahType', {
          params: { salahType }, body,
        }, res.body, `ADMIN-CONFIG-${salahType}`, `Admin configures ${salahType}`);

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data.salahType).toBe(salahType);
      }

      const total = await SalahConfigModel.countDocuments({});
      expect(total).toBe(5);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Admin Views All Configs', () => {
  // ───────────────────────────────────────────────────────────────────────────

    it('SUPER_ADMIN retrieves all configured SalahConfig documents', async () => {
      console.info(`
📖 BDD SCENARIO: 06. ADMIN REVIEWS ALL SALAH CONFIGS
Feature: Config Management Dashboard
  As a SUPER_ADMIN
  I want to see all configured salah configs on the admin dashboard
  So that I can verify or update each one

  Given all five salah types have been configured
  When the Admin calls GET /api/v1/namaz/salah-config
  Then the response contains all 5 SalahConfig documents
  And each document has a rakats array with surah data
      `);

      const res = await request(app)
        .get('/api/v1/namaz/salah-config')
        .set('Authorization', `Bearer ${adminToken}`);

      logApi('GET', '/api/v1/namaz/salah-config', {
        headers: { Authorization: 'Bearer <adminToken>' },
      }, res.body, 'ADMIN-GET-ALL-CONFIGS', 'Admin reviews all configured salah types');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(5);

      const types = res.body.data.map((d: any) => d.salahType);
      expect(types).toContain('Fajr');
      expect(types).toContain('Dhuhr');
      expect(types).toContain('Asr');
      expect(types).toContain('Maghrib');
      expect(types).toContain('Isha');

      for (const doc of res.body.data) {
        expect(Array.isArray(doc.rakats)).toBe(true);
        expect(doc.rakats.length).toBeGreaterThan(0);
        // Each rakat has full surah text from the API
        expect(doc.rakats[0].surahName).toBe('Al-Ikhlas');
        expect(doc.rakats[0].verses.length).toBeGreaterThan(0);
        expect(doc.rakats[0].verses[0].arabicText.length).toBeGreaterThan(0);
        expect(doc.rakats[0].verses[0].transliteration.length).toBeGreaterThan(0);
        expect(doc.rakats[0].verses[0].translation.length).toBeGreaterThan(0);
        expect(doc.rakats[0].verses[0].audioUrl).not.toBeNull();
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('4. User Prayer Guide Flow', () => {
  // ───────────────────────────────────────────────────────────────────────────

    it('User fetches the Fajr prayer guide — 14 steps in correct order', async () => {
      console.info(`
📖 BDD SCENARIO: 07. USER READS FAJR PRAYER GUIDE
Feature: Prayer Guide Retrieval
  As a Muslim user preparing to pray Fajr
  I want to see the full 14-step Fajr prayer guide
  So that I can follow each step of the prayer correctly

  Given the Fajr prayer guide is seeded in the database
  When the user calls GET /api/v1/namaz/guide/Fajr
  Then the response contains exactly 14 steps
  And the steps are ordered from Niyyah (1) to Salam (14)
  And every step has stepKey, stepName, arabicText, transliteration, translation
      `);

      const res = await request(app)
        .get('/api/v1/namaz/guide/Fajr')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/namaz/guide/:salahType', {
        params: { salahType: 'Fajr' },
        headers: { Authorization: 'Bearer <userToken>' },
      }, res.body, 'USER-GUIDE-FAJR', 'User fetches the complete Fajr prayer guide');

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(14);

      for (let i = 0; i < 14; i++) {
        expect(res.body.data[i].order).toBe(i + 1);
      }

      expect(res.body.data[0].stepKey).toBe('niyyah');
      expect(res.body.data[13].stepKey).toBe('salam');

      for (const step of res.body.data) {
        expect(typeof step.stepKey).toBe('string');
        expect(typeof step.stepName).toBe('string');
        expect(typeof step.arabicText).toBe('string');
        expect(typeof step.transliteration).toBe('string');
        expect(typeof step.translation).toBe('string');
      }
    });

    it('Step 5 (Additional Surah) carries the configured per-rakat surah data for Fajr', async () => {
      console.info(`
📖 BDD SCENARIO: 08. ADDITIONAL SURAH STEP MERGES CONFIG DATA
Feature: Dynamic Prayer Guide Composition
  As a Muslim user following the Fajr prayer guide
  I want the Additional Surah step to show the surah the Admin assigned
  So that I recite the correct surah during the prayer

  Given the Admin configured Al-Ikhlas for Fajr rakat 1
  When the user fetches the Fajr guide
  Then step 5 (index 4) has stepKey 'additional-surah'
  And its rakats array contains 1 entry with the Al-Ikhlas surah data
  And the word-by-word breakdown from the verses API is available
      `);

      const res = await request(app)
        .get('/api/v1/namaz/guide/Fajr')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/namaz/guide/:salahType', {
        params: { salahType: 'Fajr' },
      }, res.body, 'USER-FAJR-ADDITIONAL-SURAH', 'Step 5 shows Al-Ikhlas from Admin config');

      const additionalSurah = res.body.data[4];
      expect(additionalSurah.stepKey).toBe('additional-surah');
      expect(additionalSurah.order).toBe(5);
      expect(Array.isArray(additionalSurah.rakats)).toBe(true);
      expect(additionalSurah.rakats).toHaveLength(1);
      expect(additionalSurah.rakats[0].rakat).toBe(1);
      expect(additionalSurah.rakats[0].surahName).toBe('Al-Ikhlas');
      expect(additionalSurah.rakats[0].verses.length).toBeGreaterThan(0);
      expect(additionalSurah.rakats[0].verses[0].arabicText.length).toBeGreaterThan(0);
      expect(additionalSurah.rakats[0].verses[0].transliteration.length).toBeGreaterThan(0);
      expect(additionalSurah.rakats[0].verses[0].translation.length).toBeGreaterThan(0);
      expect(additionalSurah.rakats[0].verses[0].audioUrl).not.toBeNull();
    });

    it('Step 5 shows 2 different rakats for Dhuhr', async () => {
      console.info(`
📖 BDD SCENARIO: 09. MULTI-RAKAT GUIDE — DHUHR
Feature: Per-Rakat Surah in Prayer Guide
  As a Muslim user following the Dhuhr prayer guide
  I want step 5 to show both rakat surah assignments
  So that I know which surah to recite in each rakat

  Given the Admin configured Al-Kawthar for rakat 1 and Al-Ikhlas for rakat 2 of Dhuhr
  When the user fetches the Dhuhr guide
  Then step 5 has rakats[0] = Al-Kawthar and rakats[1] = Al-Ikhlas
      `);

      const res = await request(app)
        .get('/api/v1/namaz/guide/Dhuhr')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/namaz/guide/:salahType', {
        params: { salahType: 'Dhuhr' },
      }, res.body, 'USER-DHUHR-GUIDE', 'Step 5 shows 2 per-rakat surahs for Dhuhr');

      expect(res.status).toBe(StatusCodes.OK);
      const additionalSurah = res.body.data[4];
      expect(additionalSurah.rakats).toHaveLength(2);
      expect(additionalSurah.rakats[0].surahName).toBe('Al-Kawthar');
      expect(additionalSurah.rakats[1].surahName).toBe('Al-Ikhlas');
    });

    it('User can fetch the prayer guide for all five Salah types', async () => {
      console.info(`
📖 BDD SCENARIO: 10. USER BROWSES ALL PRAYER GUIDES
Feature: Complete Prayer Coverage
  As a Muslim user
  I want to access prayer guides for all five daily prayers
  So that I have guidance for Fajr, Dhuhr, Asr, Maghrib, and Isha

  Given prayer steps are seeded and configs exist for all 5 salah types
  When the user fetches each guide
  Then all five guides return 200 with exactly 14 steps
      `);

      const salahTypes = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

      for (const salahType of salahTypes) {
        const res = await request(app)
          .get(`/api/v1/namaz/guide/${salahType}`)
          .set('Authorization', `Bearer ${userToken}`);

        logApi('GET', '/api/v1/namaz/guide/:salahType', {
          params: { salahType },
        }, res.body, `USER-GUIDE-${salahType.toUpperCase()}`,
          `User fetches ${salahType} prayer guide (14 steps)`);

        expect(res.status).toBe(StatusCodes.OK);
        expect(res.body.data).toHaveLength(14);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Full Journey — Admin Updates → User Sees Change', () => {
  // ───────────────────────────────────────────────────────────────────────────

    it('Admin switches Isha to 4 rakats; User guide immediately reflects all 4', async () => {
      console.info(`
📖 BDD SCENARIO: 11. LIVE CONFIG UPDATE — ADMIN TO USER
Feature: Real-Time Prayer Guide Updates
  As a SUPER_ADMIN who just decided to change the Isha configuration
  I want to assign 4 different surahs to the 4 rakats of Isha
  So that the app immediately shows the updated guide to all users

  Given the Admin submits a new 4-rakat config for Isha (4 × 2 = 8 API calls)
  When the user subsequently fetches the Isha prayer guide
  Then the Additional Surah step shows all 4 rakat entries
  And each rakat has the correct surah assigned
  And all other 13 fixed steps are completely unaffected
      `);

      const spy = vi.spyOn(axios, 'get');
      // 4 rakats × 2 calls each = 8 mock calls
      mockAxiosForRakats(
        [CHAPTER_112, VERSES_112], // rakat 1 → Al-Ikhlas
        [CHAPTER_108, VERSES_108], // rakat 2 → Al-Kawthar
        [CHAPTER_112, VERSES_112], // rakat 3 → Al-Ikhlas
        [CHAPTER_108, VERSES_108], // rakat 4 → Al-Kawthar
      );

      const adminBody = {
        rakats: [
          { rakat: 1, surahNumber: 112 },
          { rakat: 2, surahNumber: 108 },
          { rakat: 3, surahNumber: 112 },
          { rakat: 4, surahNumber: 108 },
        ],
      };

      const adminRes = await request(app)
        .put('/api/v1/namaz/salah-config/Isha')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(adminBody);

      logApi('PUT', '/api/v1/namaz/salah-config/:salahType', {
        params: { salahType: 'Isha' }, body: adminBody,
      }, adminRes.body, 'JOURNEY-ADMIN-4-RAKAT',
        'Admin configures Isha with 4 rakats (Al-Ikhlas, Al-Kawthar, Al-Ikhlas, Al-Kawthar)');

      expect(adminRes.status).toBe(StatusCodes.OK);
      expect(adminRes.body.data.rakats).toHaveLength(4);

      const userRes = await request(app)
        .get('/api/v1/namaz/guide/Isha')
        .set('Authorization', `Bearer ${userToken}`);

      logApi('GET', '/api/v1/namaz/guide/:salahType', {
        params: { salahType: 'Isha' },
      }, userRes.body, 'JOURNEY-USER-4-RAKAT',
        'User sees updated Isha guide with 4 per-rakat surahs at step 5');

      expect(userRes.status).toBe(StatusCodes.OK);
      expect(userRes.body.data).toHaveLength(14);

      const additionalSurah = userRes.body.data[4];
      expect(additionalSurah.stepKey).toBe('additional-surah');
      expect(additionalSurah.rakats).toHaveLength(4);
      expect(additionalSurah.rakats[0].surahName).toBe('Al-Ikhlas');
      expect(additionalSurah.rakats[1].surahName).toBe('Al-Kawthar');
      expect(additionalSurah.rakats[2].surahName).toBe('Al-Ikhlas');
      expect(additionalSurah.rakats[3].surahName).toBe('Al-Kawthar');

      const fixedSteps = userRes.body.data.filter((_: any, i: number) => i !== 4);
      expect(fixedSteps).toHaveLength(13);
      for (const step of fixedSteps) {
        expect(step.stepKey).not.toBe('additional-surah');
        expect(step.arabicText.length).toBeGreaterThan(0);
      }

      expect(await SalahConfigModel.countDocuments({ salahType: 'Isha' })).toBe(1);
    });
  });
});
