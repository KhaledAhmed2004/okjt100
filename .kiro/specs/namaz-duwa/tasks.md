# Implementation Plan: namaz-duwa

## Overview

Implement the Namaz prayer guide module as a new Express sub-module alongside the existing Dua module. The work is split into: TypeScript interfaces and Mongoose models, the seed script, the service layer, the controller and routes, route registration, and finally property-based and unit tests.

All code is TypeScript following the existing project conventions.

---

## Tasks

- [x] 1. Create TypeScript interfaces and Mongoose models
  - [x] 1.1 Create `src/app/modules/namaz/namaz.interface.ts`
    - Define `IPrayerStep` interface (stepKey, order, stepName, arabicText, transliteration, translation, isPlaceholder, timestamps)
    - Define `TSalahType` union type: `'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'`
    - Define `IWordByWord` interface (arabic, transliteration, meaning)
    - Define `ISalahConfig` interface (salahType, surahNumber, surahName, arabicText, transliteration, translation, wordByWord, audioUrl, timestamps)
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 3.2_

  - [x] 1.2 Create `src/app/modules/namaz/namaz.model.ts`
    - Implement `PrayerStepSchema` with unique index on `stepKey` and index on `order`
    - Implement `WordByWordSchema` (sub-document, `_id: false`)
    - Implement `SalahConfigSchema` with enum constraint on `salahType`, range constraints on `surahNumber`, and unique index on `salahType`
    - Export `PrayerStepModel` and `SalahConfigModel`
    - _Requirements: 1.1, 2.3_

- [x] 2. Create Zod validation schemas
  - [x] 2.1 Create `src/app/modules/namaz/namaz.validation.ts`
    - Define `salahTypeParamSchema` validating `:salahType` is one of the five valid values; return 400 with valid-values message on failure
    - Define `upsertSalahConfigBodySchema` validating `surahNumber` is a required integer in [1, 114]
    - _Requirements: 2.7, 2.8, 3.6_

- [x] 3. Implement the seed script
  - [x] 3.1 Create `src/scripts/seed-namaz.ts`
    - Define the full `PRAYER_STEPS` array with all 14 steps and their Arabic text, transliteration, and translation; mark the `additional-surah` step with `isPlaceholder: true` and empty text fields
    - Connect to MongoDB using the project's existing config pattern
    - Loop over each step and call `PrayerStepModel.bulkWrite([single upsert op])` individually; catch and log errors per step then continue
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Write property test for seed idempotency (Property 1)
    - **Property 1: Seed idempotency** — for any run count in [2, 20], running the seed N times leaves exactly 14 PrayerStep documents with no duplicates
    - Use `fc.integer({ min: 2, max: 20 })` as the arbitrary
    - Use an in-memory MongoDB instance (e.g., `mongodb-memory-server`)
    - **Validates: Requirements 1.2**

  - [x] 3.3 Write property test for seed field completeness (Property 2)
    - **Property 2: Seed field completeness** — for any non-placeholder PrayerStep after seeding, `arabicText`, `transliteration`, and `translation` are non-empty strings
    - Use `fc.constantFrom(...PRAYER_STEPS.filter(s => !s.isPlaceholder))` as the arbitrary
    - **Validates: Requirements 1.3**

  - [x] 3.4 Write property test for seed error resilience (Property 3)
    - **Property 3: Seed error resilience** — for any subset of steps that fail to write, the remaining steps are present in the DB after the seed finishes
    - Use `fc.subarray(STEP_KEYS)` to select failing steps; mock `bulkWrite` to reject on those keys
    - **Validates: Requirements 1.4**

- [x] 4. Implement the service layer
  - [x] 4.1 Create `src/app/modules/namaz/namaz.service.ts` — `getSurahList`
    - Implement `getSurahList()`: proxy `GET https://api.islamic.app/surahs` with 10-second axios timeout; return response data directly; throw `ApiError(502)` on failure
    - _Requirements: 2.12, 2.13_

  - [x] 4.2 Implement `upsertSalahConfig` in `namaz.service.ts`
    - Implement private `fetchSurahData(surahNumber)`: call `GET https://api.islamic.app/surah/{surahNumber}` with 10-second timeout and map response to `ISalahConfig` fields
    - Implement `upsertSalahConfig(salahType, surahNumber)`: call `fetchSurahData`; on failure throw `ApiError(502)` before any DB write; on success call `SalahConfigModel.findOneAndUpdate` with `upsert: true, new: true, runValidators: true`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Write property test for surahNumber input validation (Property 4)
    - **Property 4: surahNumber input validation** — any integer outside [1, 114], any non-integer, or absent `surahNumber` returns 400 without calling axios or DB
    - Use `fc.integer().filter(n => n < 1 || n > 114)`, `fc.string()`, `fc.float()` as arbitraries
    - **Validates: Requirements 2.1, 2.8**

  - [x] 4.4 Write property test for SalahConfig upsert uniqueness (Property 5)
    - **Property 5: SalahConfig upsert produces exactly one document per Salah type** — any number of PUT calls for the same salahType leaves exactly one SalahConfig document for that type
    - Use `fc.constantFrom('Fajr','Dhuhr','Asr','Maghrib','Isha')` and `fc.integer({ min: 1, max: 114 })` as arbitraries
    - **Validates: Requirements 2.3, 2.4, 2.5**

  - [x] 4.5 Write property test for API failure leaving SalahConfig unchanged (Property 6)
    - **Property 6: External API failure leaves SalahConfig unchanged** — when axios throws, the existing SalahConfig document is unmodified and the endpoint returns 502
    - Use `fc.record(...)` to generate a valid SalahConfig; mock axios to throw; assert DB doc unchanged
    - **Validates: Requirements 2.6**

  - [x] 4.6 Implement `getAllSalahConfigs` in `namaz.service.ts`
    - Implement `getAllSalahConfigs()`: `SalahConfigModel.find({})` and return the array
    - _Requirements: 2.11_

  - [x] 4.7 Implement `getPrayerGuide` in `namaz.service.ts`
    - Fetch all 14 PrayerStep documents sorted by `order: 1`
    - Fetch `SalahConfigModel.findOne({ salahType })`
    - Map steps: for the step where `isPlaceholder === true`, merge config fields if config exists, otherwise keep placeholder text with `wordByWord: []` and `audioUrl: null`
    - Return the 14-step array
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x] 4.8 Write property test for prayer guide 14 ordered steps (Property 8)
    - **Property 8: Prayer guide returns 14 ordered steps with all required fields** — for any valid salahType, getPrayerGuide returns exactly 14 objects ordered by `order` 1–14 with all required fields present
    - Use `fc.constantFrom('Fajr','Dhuhr','Asr','Maghrib','Isha')` as the arbitrary
    - **Validates: Requirements 3.2, 3.7**

  - [x] 4.9 Write property test for Additional Surah merge (Property 9)
    - **Property 9: Additional Surah step is correctly merged from SalahConfig** — for any salahType with a stored SalahConfig, the step at index 4 has stepKey `additional-surah` with all SalahConfig fields merged correctly
    - Use `fc.record(...)` generating a valid SalahConfig with wordByWord entries
    - **Validates: Requirements 3.3, 3.4**

  - [x] 4.10 Write property test for missing SalahConfig fallback (Property 10)
    - **Property 10: Missing SalahConfig falls back gracefully** — for any salahType with no SalahConfig, getPrayerGuide returns 200 with `wordByWord: []` and `audioUrl: null` on the additional-surah step
    - Use `fc.constantFrom('Fajr','Dhuhr','Asr','Maghrib','Isha')` with no SalahConfig seeded
    - **Validates: Requirements 3.5**

- [x] 5. Checkpoint — ensure seed and service tests pass
  - Ensure all tests pass up to this point, ask the user if questions arise.

- [x] 6. Implement controller and routes
  - [x] 6.1 Create `src/app/modules/namaz/namaz.controller.ts`
    - Implement `getSurahList` handler: call `NamazService.getSurahList()`, return 200 with data
    - Implement `upsertSalahConfig` handler: extract `salahType` from params and `surahNumber` from body, call `NamazService.upsertSalahConfig(salahType, surahNumber)`, return 200 with saved config
    - Implement `getAllSalahConfigs` handler: call `NamazService.getAllSalahConfigs()`, return 200 with array
    - Implement `getPrayerGuide` handler: extract `salahType` from params, call `NamazService.getPrayerGuide(salahType)`, return 200 with guide array
    - Wrap all handlers with `catchAsync`
    - _Requirements: 2.1, 2.9, 2.10, 2.11, 2.12, 3.1, 3.8_

  - [x] 6.2 Create `src/app/modules/namaz/namaz.route.ts`
    - Define `NamazRouter` (Express Router)
    - `GET /surah-list` → public → `validateRequest(surahListSchema)` (if any) → `NamazController.getSurahList`
    - `PUT /salah-config/:salahType` → `auth(USER_ROLES.SUPER_ADMIN)` → `validateRequest(salahTypeParamSchema, upsertSalahConfigBodySchema)` → `NamazController.upsertSalahConfig`
    - `GET /salah-config` → `auth(USER_ROLES.SUPER_ADMIN)` → `NamazController.getAllSalahConfigs`
    - `GET /guide/:salahType` → public → `validateRequest(salahTypeParamSchema)` → `NamazController.getPrayerGuide`
    - Export `NamazRoutes`
    - _Requirements: 2.1, 2.7, 2.9, 2.10, 2.11, 2.12, 3.1, 3.6, 3.8_

  - [x] 6.3 Write property test for invalid salahType returning 400 (Property 7)
    - **Property 7: Invalid salahType path parameter returns 400 on all routes** — any string not in `['Fajr','Dhuhr','Asr','Maghrib','Isha']` as `:salahType` causes PUT salah-config and GET guide to return 400
    - Use `fc.string().filter(s => !VALID_SALAH_TYPES.includes(s as any))` as the arbitrary
    - **Validates: Requirements 2.7, 3.6**

  - [x] 6.4 Write unit tests for controller handlers
    - Test `getSurahList` — happy path returns 200 with proxied data; 502 when service throws
    - Test `upsertSalahConfig` — happy path returns 200 with upserted config; 502 when API fails; 400 on invalid body
    - Test `getAllSalahConfigs` — returns 200 with array
    - Test `getPrayerGuide` — returns 200 with 14-step guide; 400 on invalid salahType
    - Mock service layer functions; use existing `catchAsync` and `ApiError` patterns
    - _Requirements: 2.1, 2.6, 2.12, 3.1, 3.5_

- [x] 7. Register the Namaz module router
  - [x] 7.1 Update `src/routes/index.ts` to import `NamazRoutes` and mount at `/namaz`
    - Add `import { NamazRoutes } from '../app/modules/namaz/namaz.route';`
    - Append `{ path: '/namaz', route: NamazRoutes }` to the routes array
    - _Requirements: 2.1, 2.11, 2.12, 3.1_

- [x] 8. Verify Duwa module regression
  - [x] 8.1 Run the existing Dua module test suite and confirm all tests pass without modification
    - No code changes to `src/app/modules/dua/` — this task is a verification step only
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use **fast-check** (`fc`) and run a minimum of 100 iterations each
- Tag format for property tests: `// Feature: namaz-duwa, Property N: <property_text>`
- An in-memory MongoDB instance (`mongodb-memory-server`) is recommended for seed and service-layer property tests
- The Admin role guard uses `auth(USER_ROLES.SUPER_ADMIN)` matching the existing pattern in `dua.route.ts`; if a separate `ADMIN` role is added to the enum later, only the route guard files need updating
- The `additional-surah` seed step intentionally has empty text fields — content is injected at query time from `SalahConfig`
- All HTTP error handling follows the existing `ApiError` + `catchAsync` + global error handler pattern

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1", "4.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 5, "tasks": ["4.8", "4.9", "4.10", "6.1"] },
    { "id": 6, "tasks": ["6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 8, "tasks": ["8.1"] }
  ]
}
```
