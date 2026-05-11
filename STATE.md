# Implementation State: Preference Card Download Endpoint

## Status: COMPLETED ✅

### 📍 Endpoint
`POST /preference-cards/:cardId/download`

### 🛠 Technical Implementation Details

#### 1. Database Layer (`model.ts` & `interface.ts`)
- **Schema Update**: Added `isDeleted` field to `PreferenceCardSchema`.
- **Idempotency Tracking**: Created `PreferenceCardDownloadModel` with a compound unique index on `(userId, cardId, downloadDate)`.
  - `downloadDate` is stored as `YYYY-MM-DD` string to ensure "once per day" counting.
- **Indexes**: Ensured efficient querying for cards and download logs.

#### 2. Validation Layer (`validation.ts`)
- **Zod Schema**: `downloadPreferenceCardSchema` validates `cardId` as a valid 24-character hex string (ObjectId format).
- **Middleware**: Integrated `validateRequest` in the route layer.

#### 3. Service Layer (`service.ts`)
- **Atomic Increment**: Used Mongoose `$inc` operator to prevent race conditions.
- **Idempotency Logic**: 
  - Attempts to create a download log first.
  - If log creation succeeds (no duplicate), it increments the `downloadCount`.
  - If log creation fails (duplicate key error), it proceeds without incrementing.
- **Status Checks**: Validates `isDeleted` (returns 410 Gone) and `published` status.
- **Authorization**: Restricts private card downloads to creators and SUPER_ADMINs.
- **PDF Generation**: Integrated `PDFBuilder` with a "modern" theme to generate a detailed preference card PDF.
- **Population**: Populates `supplies` and `sutures` for the PDF report.

#### 4. Controller Layer (`controller.ts`)
- **Binary Response**: Sets `Content-Type: application/pdf` and `Content-Disposition` headers.
- **Buffer Stream**: Sends the generated PDF buffer directly to the client.

#### 5. Route Layer (`route.ts`)
- **Middleware Chain**: `auth` -> `rateLimitMiddleware` (20 req/min) -> `validateRequest` -> `Controller`.
- **Security**: Enforces Bearer token authentication.

### 🧪 Verification
- [x] cardId format validation (400)
- [x] Card existence check (404)
- [x] isDeleted status check (410)
- [x] Private card authorization (403)
- [x] Rate limiting (429)
- [x] Atomic increment via $inc
- [x] Idempotency (Unique log per user/card/day)
- [x] PDF Generation success

### 📝 Notes
- The PDF filename is dynamically generated based on the card title.
- Used `.lean()` for performance where possible.
