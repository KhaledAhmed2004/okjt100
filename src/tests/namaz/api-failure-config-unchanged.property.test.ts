// Feature: namaz-duwa, Property 6: External API failure leaves SalahConfig unchanged
// Validates: Requirements 2.6

import * as fc from 'fast-check';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import axios from 'axios';

import { SalahConfigModel } from '../../app/modules/namaz/namaz.model';
import { NamazService } from '../../app/modules/namaz/namaz.service';
import ApiError from '../../errors/ApiError';
import { TSalahType } from '../../app/modules/namaz/namaz.interface';

// Arbitrary for a single rakat entry
const rakatEntryArb = (rakat: number) =>
  fc.record({
    rakat: fc.constant(rakat),
    surahNumber: fc.integer({ min: 1, max: 114 }),
    surahName: fc.string({ minLength: 1, maxLength: 50 }),
    verses: fc.array(
      fc.record({
        verseNumber: fc.integer({ min: 1 }),
        verseKey: fc.string({ minLength: 1 }),
        arabicText: fc.string({ minLength: 1 }),
        transliteration: fc.string({ minLength: 1 }),
        translation: fc.string({ minLength: 1 }),
        audioUrl: fc.oneof(fc.constant(null), fc.string({ minLength: 1 })),
      }),
      { maxLength: 3 },
    ),
  });

// Arbitrary that generates a valid SalahConfig document (new per-rakat shape)
const validSalahConfigArbitrary = fc.record({
  salahType: fc.constantFrom<TSalahType>('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'),
  rakats: fc.tuple(rakatEntryArb(1), rakatEntryArb(2)).map(([r1, r2]) => [r1, r2]),
});

describe('Property 6: External API failure leaves SalahConfig unchanged', () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'when axios throws, the existing SalahConfig document is unmodified and the service throws a 502 ApiError',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validSalahConfigArbitrary,
          async (seedConfig) => {
            // Reset the collection for each property iteration
            await SalahConfigModel.deleteMany({});

            // Pre-insert the generated SalahConfig directly into DB (bypass service)
            const { salahType, rakats } = seedConfig;
            await SalahConfigModel.create({ salahType, rakats });

            // Snapshot the pre-existing document
            const docBefore = await SalahConfigModel.findOne({ salahType }).lean();
            expect(docBefore).not.toBeNull();
            const originalRakatsJson = JSON.stringify(docBefore!.rakats);

            // Mock axios.get to throw a network error
            vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));

            // Attempt upsert with a new rakats payload — it should fail before touching DB
            const newRakats = [{ rakat: 1, surahNumber: 50 }];

            let thrownError: unknown;
            try {
              await NamazService.upsertSalahConfig(salahType, newRakats);
            } catch (err) {
              thrownError = err;
            }

            // Assert that a 502 ApiError was thrown
            expect(thrownError).toBeInstanceOf(ApiError);
            expect((thrownError as ApiError).statusCode).toBe(502);

            // Fetch doc from DB and assert rakats are completely unchanged
            const docAfter = await SalahConfigModel.findOne({ salahType }).lean();
            expect(docAfter).not.toBeNull();
            expect(JSON.stringify(docAfter!.rakats)).toBe(originalRakatsJson);

            // Restore the mock after each iteration
            vi.restoreAllMocks();
          },
        ),
        { numRuns: 100 },
      );
    },
    120_000,
  );
});
