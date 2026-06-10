/**
 * Unit tests for NamazController handlers
 * Requirements: 2.1, 2.6, 2.12, 3.1, 3.5
 *
 * Strategy:
 *  - Build a minimal Express app that mounts NamazRoutes with the real
 *    validateRequest + globalErrorHandler middleware so that 400 validation
 *    paths are exercised end-to-end without a live DB or JWT.
 *  - Mock `auth` to call next() immediately for protected routes.
 *  - Mock `NamazService` with vi.mock for all four service functions.
 *  - Mock OpenTelemetry tracing used inside validateRequest so no OTel
 *    infrastructure is needed in the test environment.
 */

import express from 'express';
import supertest from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';

// ── Mock OpenTelemetry before importing anything that depends on it ────────────
vi.mock('@opentelemetry/api', () => {
  const noop = () => ({});
  const fakeSpan = {
    setAttribute: vi.fn(),
    addEvent: vi.fn(),
    recordException: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  };
  const fakeTracer = {
    startActiveSpan: vi.fn((_name: string, fn: (span: any) => any) => fn(fakeSpan)),
    startSpan: vi.fn(() => fakeSpan),
  };
  return {
    trace: { getTracer: vi.fn(() => fakeTracer) },
    context: { with: vi.fn((_ctx: any, fn: () => any) => fn()) },
    SpanStatusCode: { OK: 1, ERROR: 2 },
    diag: { setLogger: vi.fn() },
    DiagConsoleLogger: vi.fn(),
    DiagLogLevel: { ERROR: 'ERROR' },
  };
});

// ── Mock the auth middleware so protected routes don't need a real JWT ─────────
vi.mock('../../app/middlewares/auth', () => ({
  default: (..._roles: string[]) =>
    (_req: any, _res: any, next: any) => next(),
}));

// ── Mock NamazService ─────────────────────────────────────────────────────────
vi.mock('../../app/modules/namaz/namaz.service', () => ({
  NamazService: {
    getSurahList: vi.fn(),
    upsertSalahConfig: vi.fn(),
    getAllSalahConfigs: vi.fn(),
    getPrayerGuide: vi.fn(),
  },
}));

// ── Now import modules that depend on the mocked ones ─────────────────────────
import { NamazRoutes } from '../../app/modules/namaz/namaz.route';
import { NamazService } from '../../app/modules/namaz/namaz.service';
import globalErrorHandler from '../../app/middlewares/globalErrorHandler';
import ApiError from '../../errors/ApiError';

// ── Build a slim test app ─────────────────────────────────────────────────────
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/namaz', NamazRoutes);
  app.use(globalErrorHandler);
  return app;
};

// ── Sample data fixtures ──────────────────────────────────────────────────────
const SAMPLE_SURAH_LIST = [
  { number: 1, name: 'Al-Fatihah' },
  { number: 2, name: 'Al-Baqarah' },
];

const SAMPLE_SALAH_CONFIG = {
  salahType: 'Fajr',
  rakats: [{
    rakat: 1,
    surahNumber: 1,
    surahName: 'Al-Fatihah',
    verses: [{
      verseNumber: 1,
      verseKey: '1:1',
      arabicText: 'بِسْمِ اللَّهِ',
      transliteration: 'Bismillah',
      translation: 'In the name of Allah',
      audioUrl: 'http://example.com/audio.mp3',
    }],
  }],
};

const VALID_RAKATS_BODY = { rakats: [{ rakat: 1, surahNumber: 1 }] };

const SAMPLE_PRAYER_GUIDE = Array.from({ length: 14 }, (_, i) => ({
  stepKey: `step-${i + 1}`,
  order: i + 1,
  stepName: `Step ${i + 1}`,
  arabicText: 'اللَّهُ أَكْبَرُ',
  transliteration: 'Allahu Akbar',
  translation: 'Allah is the Greatest',
  isPlaceholder: false,
}));

// ─────────────────────────────────────────────────────────────────────────────
// GET /namaz/surah-list — getSurahList
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /namaz/surah-list — getSurahList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('happy path: returns 200 with proxied surah list data', async () => {
    vi.mocked(NamazService.getSurahList).mockResolvedValueOnce(SAMPLE_SURAH_LIST);

    const app = buildApp();
    const res = await supertest(app).get('/namaz/surah-list');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Surah list fetched successfully');
    expect(res.body.data).toEqual(SAMPLE_SURAH_LIST);
    expect(NamazService.getSurahList).toHaveBeenCalledOnce();
  });

  it('502 when NamazService.getSurahList throws an ApiError(502)', async () => {
    vi.mocked(NamazService.getSurahList).mockRejectedValueOnce(
      new ApiError(StatusCodes.BAD_GATEWAY, 'Islamic App API is currently unavailable'),
    );

    const app = buildApp();
    const res = await supertest(app).get('/namaz/surah-list');

    expect(res.status).toBe(StatusCodes.BAD_GATEWAY);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Islamic App API is currently unavailable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /namaz/salah-config/:salahType — upsertSalahConfig
// ─────────────────────────────────────────────────────────────────────────────
describe('PUT /namaz/salah-config/:salahType — upsertSalahConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('happy path: returns 200 with upserted config on valid salahType and body', async () => {
    vi.mocked(NamazService.upsertSalahConfig).mockResolvedValueOnce(SAMPLE_SALAH_CONFIG as any);

    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/Fajr')
      .send(VALID_RAKATS_BODY);

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Salah config saved successfully');
    expect(res.body.data.salahType).toBe('Fajr');
    expect(res.body.data.rakats[0].surahNumber).toBe(1);
    expect(NamazService.upsertSalahConfig).toHaveBeenCalledWith('Fajr', VALID_RAKATS_BODY.rakats);
  });

  it('502 when NamazService.upsertSalahConfig throws an ApiError(502)', async () => {
    vi.mocked(NamazService.upsertSalahConfig).mockRejectedValueOnce(
      new ApiError(StatusCodes.BAD_GATEWAY, 'Islamic App API is currently unavailable'),
    );

    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/Dhuhr')
      .send({ rakats: [{ rakat: 1, surahNumber: 2 }] });

    expect(res.status).toBe(StatusCodes.BAD_GATEWAY);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Islamic App API is currently unavailable');
  });

  it('400 on invalid salahType in path param', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/InvalidType')
      .send(VALID_RAKATS_BODY);

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    expect(NamazService.upsertSalahConfig).not.toHaveBeenCalled();
  });

  it('400 on missing rakats in body', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/Fajr')
      .send({});

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    expect(NamazService.upsertSalahConfig).not.toHaveBeenCalled();
  });

  it('400 on empty rakats array', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/Asr')
      .send({ rakats: [] });

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    expect(NamazService.upsertSalahConfig).not.toHaveBeenCalled();
  });

  it('400 on surahNumber out of range (> 114)', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/Asr')
      .send({ rakats: [{ rakat: 1, surahNumber: 200 }] });

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    expect(NamazService.upsertSalahConfig).not.toHaveBeenCalled();
  });

  it('400 on duplicate rakat numbers', async () => {
    const app = buildApp();
    const res = await supertest(app)
      .put('/namaz/salah-config/Maghrib')
      .send({ rakats: [{ rakat: 1, surahNumber: 112 }, { rakat: 1, surahNumber: 108 }] });

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    expect(NamazService.upsertSalahConfig).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /namaz/salah-config — getAllSalahConfigs
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /namaz/salah-config — getAllSalahConfigs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with the array of salah configs', async () => {
    vi.mocked(NamazService.getAllSalahConfigs).mockResolvedValueOnce([
      SAMPLE_SALAH_CONFIG,
    ] as any);

    const app = buildApp();
    const res = await supertest(app).get('/namaz/salah-config');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Salah configs fetched successfully');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(NamazService.getAllSalahConfigs).toHaveBeenCalledOnce();
  });

  it('returns 200 with an empty array when no configs exist', async () => {
    vi.mocked(NamazService.getAllSalahConfigs).mockResolvedValueOnce([] as any);

    const app = buildApp();
    const res = await supertest(app).get('/namaz/salah-config');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /namaz/guide/:salahType — getPrayerGuide
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /namaz/guide/:salahType — getPrayerGuide', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('happy path: returns 200 with 14-step guide for a valid salahType', async () => {
    vi.mocked(NamazService.getPrayerGuide).mockResolvedValueOnce(SAMPLE_PRAYER_GUIDE as any);

    const app = buildApp();
    const res = await supertest(app).get('/namaz/guide/Isha');

    expect(res.status).toBe(StatusCodes.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Prayer guide fetched successfully');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(14);
    expect(NamazService.getPrayerGuide).toHaveBeenCalledWith('Isha');
  });

  it('400 on invalid salahType in path param', async () => {
    const app = buildApp();
    const res = await supertest(app).get('/namaz/guide/Friday');

    expect(res.status).toBe(StatusCodes.BAD_REQUEST);
    expect(res.body.success).toBe(false);
    // Validation message lists valid values
    expect(res.body.message).toBe('Validation Error');
    // Service should NOT have been reached
    expect(NamazService.getPrayerGuide).not.toHaveBeenCalled();
  });

  it('valid salahTypes pass validation and reach the service', async () => {
    const validTypes = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

    for (const salahType of validTypes) {
      vi.mocked(NamazService.getPrayerGuide).mockResolvedValueOnce(SAMPLE_PRAYER_GUIDE as any);

      const app = buildApp();
      const res = await supertest(app).get(`/namaz/guide/${salahType}`);

      expect(res.status).toBe(StatusCodes.OK);
      expect(res.body.success).toBe(true);
    }

    expect(NamazService.getPrayerGuide).toHaveBeenCalledTimes(5);
  });
});
