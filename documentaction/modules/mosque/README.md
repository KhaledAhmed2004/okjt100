# Mosque Management Module APIs

> **Section**: Backend API specifications for the Mosque Management module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Mosque listing page — Search, filter, and view prayer times
> - Admin Dashboard - Mosque Management — Create, update, and delete mosques

---

## Database Design

### Mosque Model (`mosques`)
Stores details and prayer times for mosques.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `mosqueName` | String | ✅ | Name of the mosque |
| `address` | String | ✅ | Full address of the mosque |
| `area` | String | ✅ | Area or neighborhood |
| `phoneNumber` | String | ✅ | Contact number |
| `website` | String | ❌ | Official website (optional) |
| `location.latitude` | Number | ✅ | Latitude for mapping |
| `location.longitude`| Number | ✅ | Longitude for mapping |
| `prayerTimes.fajr` | String | ✅ | Fajr time (HH:MM) |
| `prayerTimes.dhuhr` | String | ✅ | Dhuhr time (HH:MM) |
| `prayerTimes.asr` | String | ✅ | Asr time (HH:MM) |
| `prayerTimes.maghrib`| String | ✅ | Maghrib time (HH:MM) |
| `prayerTimes.isha` | String | ✅ | Isha time (HH:MM) |
| `prayerTimes.jummah`| String | ❌ | Optional Jummah time |

**Indexes**:
- `{ mosqueName: 'text', area: 'text', address: 'text' }` — Supports search
- `{ area: 1 }` — Fast filtering by area

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/mosques` | Admin | **Pending**: Creates a new mosque entry. | [01-create-mosque.md](./01-create-mosque.md) |
| 02 | GET | `/mosques` | None | **Pending**: Fetches paginated mosques with search/filter. | [02-get-all-mosques.md](./02-get-all-mosques.md) |
| 03 | GET | `/mosques/:mosqueId` | None | **Pending**: Retrieves full details of a single mosque. | [03-get-single-mosque.md](./03-get-single-mosque.md) |
| 04 | PATCH | `/mosques/:mosqueId`| Admin | **Pending**: Updates mosque details or prayer times. | [04-update-mosque.md](./04-update-mosque.md) |
| 05 | DELETE | `/mosques/:mosqueId`| Admin | **Pending**: Deletes a mosque entry. | [05-delete-mosque.md](./05-delete-mosque.md) |
