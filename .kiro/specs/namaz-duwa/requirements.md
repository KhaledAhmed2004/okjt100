# Requirements Document

## Introduction

The **Namaz & Duwa** module is a combined Islamic practice feature for the application. It provides:

1. **A fixed, seeded Namaz (Salah) prayer guide** — the 14-step prayer sequence is standard and hardcoded via a seed script. No Admin management of individual steps is required.
2. **Admin-configurable "Additional Surah"** — the only dynamic content in the prayer sequence. The Admin selects a Surah by number (1–114); the backend fetches all Surah data from the `islamic.app` API and stores it in `Salah_Config`, independently per Salah type (Fajr, Dhuhr, Asr, Maghrib, Isha).
3. **A public Surah list endpoint** so the Admin dashboard can render a dropdown of all 114 Surahs.
4. **A public endpoint** to retrieve the full prayer guide for a given Salah type, with the configured Additional Surah — including word-by-word data and audio URL — populated in position.
5. **Existing Duwa functionality** preserved as-is.

---

## Glossary

- **Namaz_Module**: The backend service responsible for serving the Namaz prayer guide, managing the Additional Surah configuration per Salah type, and proxying Surah data from the Islamic_App_API.
- **Duwa_Module**: The backend service responsible for managing individual duas, including Admin CRUD and public retrieval by prayer time.
- **Prayer_Step**: A single unit in the fixed 14-step Namaz sequence (e.g., Niyyah, Takbir, Ruku). Contains `stepName`, `arabicText`, `transliteration`, and `translation`. Seeded at deployment; not Admin-managed.
- **Additional_Surah**: The dynamic prayer step inserted at position 5 of the sequence (after Surah Al-Fatihah). Its content is fetched from the Islamic_App_API by `surahNumber` and stored in `Salah_Config` per Salah type.
- **Salah_Type**: One of the five daily Islamic prayers: `Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`.
- **Salah_Config**: An Admin-managed document that stores the fetched Surah data (`surahNumber`, `surahName`, `arabicText`, `transliteration`, `translation`, `wordByWord`, `audioUrl`) for a specific Salah type.
- **Word_By_Word**: An array of objects, one per word in the Surah, each containing the word's `arabic`, `transliteration`, and `meaning` as returned by the Islamic_App_API.
- **Islamic_App_API**: The external API at `https://api.islamic.app` (no authentication required) that provides Quran data including Arabic text, translation, transliteration, word-by-word breakdown, and audio URLs.
- **Admin**: A user with role `ADMIN` or `SUPER_ADMIN` who has write access to manage Salah_Config and Dua content.
- **Public**: Any client — authenticated or unauthenticated — that can access read-only endpoints.
- **Waqt**: The Islamic prayer time slot. Enum values: `Fajr`, `Zuhr`, `Asr`, `Maghrib`, `Isha`. Used by the Dua model to filter duas by prayer time.

---

## Requirements

### Requirement 1: Seed the Fixed Prayer Step Sequence

**User Story:** As a developer, I want the 14 standard Namaz prayer steps to be seeded into the database on deployment, so that the prayer guide is available without any Admin input.

#### Acceptance Criteria

1. THE Namaz_Module SHALL provide a database seed script that creates the following 14 Prayer_Steps in the exact order listed: Niyyah, Takbir (Takbiratul Ihram), Sana, Surah Al-Fatihah, Additional Surah (placeholder), Ruku, Qaumah, First Sajdah, Jalsah, Second Sajdah, Tashahhud, Durood Ibrahim, Dua, Salam.
2. WHEN the seed script is run against a database that already contains Prayer_Steps, THE Namaz_Module seed script SHALL use upsert logic (matching on `stepKey`) to avoid creating duplicate records.
3. THE Namaz_Module seed script SHALL populate `arabicText`, `transliteration`, and `translation` for all 13 fixed steps. The "Additional Surah" step SHALL be seeded as a placeholder whose content is overridden at query time by the active Salah_Config.
4. IF the seed script encounters a database write error for any individual step, THEN THE Namaz_Module seed script SHALL log the error with the affected `stepKey` and continue seeding the remaining steps.

---

### Requirement 2: Admin Manages the Additional Surah per Salah Type

**User Story:** As an Admin, I want to select a Surah by number for each of the five daily prayers so that the backend automatically fetches the full Surah data and stores it, removing the need for manual text entry.

#### Acceptance Criteria

1. THE Namaz_Module SHALL provide a `PUT /namaz/salah-config/:salahType` endpoint, accessible only to Admin, whose request body accepts `surahNumber` (integer 1–114, required) as the sole input field.
2. WHEN a `PUT /namaz/salah-config/:salahType` request is received with a valid `surahNumber`, THE Namaz_Module SHALL call the Islamic_App_API to fetch the following data for that Surah: `surahName`, `arabicText`, `transliteration`, `translation`, `wordByWord` array (each entry containing `arabic`, `transliteration`, and `meaning`), and `audioUrl`.
3. WHEN the Islamic_App_API returns a successful response, THE Namaz_Module SHALL upsert a Salah_Config document for the specified Salah type, storing all fetched fields alongside `surahNumber`.
4. WHEN a `PUT /namaz/salah-config/:salahType` request is received and no Salah_Config exists for that Salah type, THE Namaz_Module SHALL create a new Salah_Config document.
5. WHEN a `PUT /namaz/salah-config/:salahType` request is received and a Salah_Config already exists for that Salah type, THE Namaz_Module SHALL update the existing document, replacing all stored fields with the freshly fetched data.
6. IF the Islamic_App_API is unreachable or returns a non-200 HTTP status, THEN THE Namaz_Module SHALL return a `502 Bad Gateway` error without modifying the existing Salah_Config.
7. IF the `:salahType` path parameter is not one of `Fajr`, `Dhuhr`, `Asr`, `Maghrib`, or `Isha`, THEN THE Namaz_Module SHALL return a `400 Bad Request` error listing the valid values.
8. IF the `surahNumber` in the request body is absent, non-integer, or outside the range 1–114, THEN THE Namaz_Module SHALL return a `400 Bad Request` error describing the validation failure.
9. WHEN a `PUT /namaz/salah-config/:salahType` request is made without a valid Bearer token with role `ADMIN` or `SUPER_ADMIN`, THE Namaz_Module SHALL return a `401 Unauthorized` error.
10. WHEN a `PUT /namaz/salah-config/:salahType` request is made with a valid Bearer token whose role is not `ADMIN` or `SUPER_ADMIN`, THE Namaz_Module SHALL return a `403 Forbidden` error.
11. THE Namaz_Module SHALL provide a `GET /namaz/salah-config` endpoint, accessible to Admin, that returns the current Salah_Config for all five Salah types, including all stored fields.
12. THE Namaz_Module SHALL provide a `GET /namaz/surah-list` endpoint, accessible to Public, that fetches and returns the list of all 114 Surahs from the Islamic_App_API so that the Admin dashboard can render a Surah selection dropdown.
13. IF the Islamic_App_API is unreachable or returns a non-200 HTTP status when handling a `GET /namaz/surah-list` request, THEN THE Namaz_Module SHALL return a `502 Bad Gateway` error.

---

### Requirement 3: Public Prayer Guide Retrieval

**User Story:** As a user, I want to retrieve the full step-by-step prayer guide for a specific Salah type, so that I can follow the complete prayer with the correct Surah — including word-by-word data and audio — in position.

#### Acceptance Criteria

1. THE Namaz_Module SHALL provide a `GET /namaz/guide/:salahType` endpoint accessible to Public that returns the full prayer guide for the specified Salah type.
2. WHEN a `GET /namaz/guide/:salahType` request is received, THE Namaz_Module SHALL return an ordered array of 14 steps. Each step SHALL include: `stepKey`, `stepName`, `arabicText`, `transliteration`, and `translation`.
3. WHEN constructing the response for `GET /namaz/guide/:salahType`, THE Namaz_Module SHALL replace the "Additional Surah" placeholder step's `stepName`, `arabicText`, `transliteration`, and `translation` with the values from the active Salah_Config for the requested Salah type. The `stepKey` SHALL remain `additional-surah`.
4. WHEN constructing the "Additional Surah" step in the response, THE Namaz_Module SHALL also include the `wordByWord` array and `audioUrl` fields from the active Salah_Config alongside the text fields.
5. WHEN a `GET /namaz/guide/:salahType` request is received and no Salah_Config exists for the requested Salah type, THE Namaz_Module SHALL return the guide with the "Additional Surah" step using its seeded placeholder text, with `wordByWord` as an empty array and `audioUrl` as `null`, without returning an error.
6. IF the `:salahType` path parameter is not one of the five valid values (`Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha`), THEN THE Namaz_Module SHALL return a `400 Bad Request` error with a message listing the valid values.
7. THE Namaz_Module SHALL return the 14 steps in the fixed seed order, from Niyyah (position 1) to Salam (position 14), regardless of database insertion order.
8. THE Namaz_Module SHALL NOT require authentication for `GET /namaz/guide/:salahType` and SHALL allow access to Public.

---

### Requirement 4: Preserve Existing Duwa Functionality

**User Story:** As an Admin, I want the existing Dua management functionality to be preserved and accessible, so that users can continue to browse and listen to duas filtered by prayer time.

#### Acceptance Criteria

1. THE Duwa_Module SHALL continue to expose all existing Dua CRUD endpoints (`POST /duas`, `GET /duas`, `GET /duas/:duaId`, `PATCH /duas/:duaId`, `DELETE /duas/:duaId`) with no change in behaviour or response shape.
2. WHEN a `GET /duas` request is made with a `waqt` query parameter, THE Duwa_Module SHALL return only duas where the `waqt` field matches the provided value.
3. WHEN a `GET /duas` request is made with a `searchTerm` query parameter, THE Duwa_Module SHALL perform a full-text search on `title` and `details` fields and return matching results.
4. THE Duwa_Module SHALL support pagination on `GET /duas` responses, returning `page`, `limit`, `total`, and `totalPage` in a `meta` object.
5. IF a `GET /duas/:duaId` request is made for a dua where `isDeleted` is `true`, THEN THE Duwa_Module SHALL return a `404 Not Found` error.
6. WHERE an audio file is provided during Dua creation or update, THE Duwa_Module SHALL accept the file via `multipart/form-data` and store the resulting URL in the `audioUrl` field.
7. WHEN a request is made to `POST`, `PATCH`, or `DELETE` endpoints under `/duas`, THE Duwa_Module SHALL require a valid Bearer token with role `ADMIN` or `SUPER_ADMIN`.
