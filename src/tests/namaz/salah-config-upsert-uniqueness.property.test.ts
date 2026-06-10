// Feature: namaz-duwa, Property 5: SalahConfig upsert produces exactly one document per Salah type
// Validates: Requirements 2.3, 2.4, 2.5

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import axios from 'axios';

import { NamazService } from '../../app/modules/namaz/namaz.service';
import { SalahConfigModel } from '../../app/modules/namaz/namaz.model';
import { TSalahType } from '../../app/modules/namaz/namaz.interface';

const FAKE_CHAPTER_RESPONSE = {
  data: {
    data: {
      chapter: {
        name_simple: 'Al-Fatiha',
      },
    },
  },
};

const FAKE_VERSES_RESPONSE = {
  data: {
    data: {
      verses: [
        {
          text_uthmani: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
          translations: [{ text: 'In the name of Allah, the Entirely Merciful' }],
          words: [
            {
              char_type_name: 'word',
              text_uthmani: 'بِسْمِ',
              transliteration: { text: 'bismi' },
              translation: { text: 'In (the) name' },
            },
          ],
        },
      ],
    },
  },
};

describe('Property 5: SalahConfig upsert produces exactly one document per Salah type', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it(
    'any number of upsertSalahConfig calls for the same salahType leaves exactly one document for that type',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'),
          fc.integer({ min: 1, max: 114 }),
          fc.integer({ min: 2, max: 10 }),
          async (salahType, surahNumber, callCount) => {
            await SalahConfigModel.deleteMany({});

            vi.spyOn(axios, 'get')
              .mockResolvedValueOnce(FAKE_CHAPTER_RESPONSE)
              .mockResolvedValueOnce(FAKE_VERSES_RESPONSE);

            // Use per-rakat format: [{ rakat: 1, surahNumber }]
            const rakats = [{ rakat: 1, surahNumber }];

            for (let i = 0; i < callCount; i++) {
              // Each call needs 2 mock responses (chapter + verses)
              vi.spyOn(axios, 'get')
                .mockResolvedValueOnce(FAKE_CHAPTER_RESPONSE)
                .mockResolvedValueOnce(FAKE_VERSES_RESPONSE);
              await NamazService.upsertSalahConfig(salahType as TSalahType, rakats);
            }

            const count = await SalahConfigModel.countDocuments({ salahType });
            expect(count).toBe(1);

            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    },
    120_000,
  );
});
