# Ask Imam Module Design

## 1. Overview
The **Ask Imam** module allows users to submit questions and receive answers from the `SUPER_ADMIN`. The system maintains full tracking of question status and provides an organized interface for both users and admins.

---

## 2. Core Features

### User Features
* Submit a question with optional images (Ask Imam section)
* View all submitted questions in a list (isolated to own questions)
* See question status (Pending / Answered)
* View admin answers once available

### Admin Features (SUPER_ADMIN only)
* View all submitted user questions with full-text search
* Review question details and attached images
* Provide answers through admin dashboard
* Automatically update question status to **Answered**
* View module-wide analytics (Total, Pending, Answered)

---

## 3. Status Management
Each question has a lifecycle status:

### Status Types
* **Pending** → Default when a question is submitted
* **Answered** → Set automatically after admin response

### Status Flow
```
User submits question → Pending
Admin answers question → Automatically changes to Answered
```

---

## 4. Behavioral Constraints

### 4.1 Data Isolation
Users can only see questions they personally submitted. The `userId` is enforced via JWT at the service layer to prevent unauthorized data access.

### 4.2 Account Eligibility
Only users with an `ACTIVE` account status can interact with this module. Accounts that are `SUSPENDED`, `REJECTED`, or `DELETED` are blocked at the middleware level.

### 4.3 Input Limits
Questions are limited to 2000 characters and must contain non-whitespace content.

### 4.4 File Attachments
Users can attach a single image (Max 10MB, JPEG/PNG/WebP). Images are optimized and resized to 800px width before storage.

---

## 5. Implementation Roadmap

### Phase 1: Core API (✅ Completed)
- [x] Question submission with file upload
- [x] User-specific question history
- [x] Admin overview with QueryBuilder (search/filter/sort)
- [x] Admin answer submission
- [x] Real-time analytics

### Phase 2: Enhancements (Planned)
- [ ] Push notification on answer submission
- [ ] Question rejection with reason
- [ ] Question categories (e.g., Fiqh, Hadith)
- [ ] Admin assignment (assigning questions to specific Imams)
