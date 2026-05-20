# Connection Module Audit & Fixes

This document outlines the issues discovered during the architecture audit of the `connection` module and how they were fixed to meet industry standards.

## 1. Bidirectional Race Condition (Critical)
**Issue:** When User A sent a request to User B, and User B simultaneously sent a request to User A, both requests were created as `PENDING`. The previous unique index `{ sender: 1, receiver: 1 }` did not prevent this because `{A, B}` and `{B, A}` are distinct pairs.
**Fix:** Introduced a deterministic `connectionKey` field (formatted as `min(userId, otherUserId)_max(userId, otherUserId)`). A new unique index `connectionSchema.index({ connectionKey: 1 }, { unique: true })` ensures only one request can ever exist between two users, regardless of direction.

## 2. Lack of Transactions (High)
**Issue:** `respondToRequest` modified both the `Connection` collection and interacted with the `ChatService`. If one operation failed, the database would be left in an inconsistent state (e.g., chat created but connection not accepted).
**Fix:** Wrapped `respondToRequest` and `removeConnection` with Mongoose Sessions (`session.startTransaction()`). This guarantees atomicity—either all operations succeed, or none do. Notifications and Socket.io events were moved outside the transaction to prevent external failures from rolling back valid database changes.

## 3. Invalid Chat Deactivation Logic (Medium)
**Issue:** In `removeConnection`, there was code attempting to deactivate a chat: `await Chat.findByIdAndUpdate(connection.chatId, { status: false });`. However, the `Chat` model did not have a `status` field. Mongoose ignored this operation in strict mode. If users re-connected later, they were given the same chat.
**Fix:** Removed the invalid `status: false` update. It is standard practice to preserve chat history between users even if they disconnect and reconnect later.

## 4. Spam & Resource Exhaustion (Medium)
**Issue:** A malicious user could send thousands of pending connection requests, exhausting database resources and spamming users.
**Fix:** Implemented a hard limit in `sendRequest`. Users can now have a maximum of 50 pending sent requests at any given time. Exceeding this limit returns a `429 Too Many Requests` error.

## 5. Inaccurate Error Messaging (Low)
**Issue:** If a user tried to send a request to someone they were already connected with, they received the generic error: "Connection request already exists".
**Fix:** Updated the logic to check if the existing connection is `ACCEPTED` and return a clearer message: "You are already connected with this user".

## 6. Asymmetric Mutation Response Shapes (Medium)
**Issue:** The three "deletion" mutations (`REJECT`, `CANCEL`, `REMOVE`) returned either `data: null` (REJECT) or omitted the `data` key entirely (CANCEL, REMOVE). The `ACCEPT` action, by contrast, returned a rich object `{ id, status, chatId }`. This asymmetry forced front-end clients to either special-case each mutation or perform an additional round-trip fetch just to synchronise their local cache after a deletion.
**Fix:** All three deletion/rejection operations now return a uniform `{ id: connectionId, status: 'NONE' }` object. `'NONE'` is an **API-layer sentinel** — it is never stored in the database (the record is still physically deleted). The shape gives the client everything it needs to immediately invalidate or transition a cached entry without a second network request, which is the standard pattern expected by cache libraries such as RTK Query and React Query.

## 7. Action-Based API Design (World-Class Refactor)
**Issue:** Previously, the module used generic HTTP methods (`PATCH`, `DELETE`) with body-based `action` parameters (e.g., `PATCH /connections/:id` with `{ action: 'ACCEPT' }`). This followed a strict "Resource-based" REST model which often obscures the **User Intent** and leads to complex logic branching inside a single controller.

**Fix:** Refactored the entire module to an **Action-Based API** model. 

### 🔥 The Mental Model: Intent vs Resource

In world-class backend engineering, HTTP method selection isn't just about "side effects." It's about **how the API is understood by humans.**

| Aspect | Resource-based (Old) | Action-based (New) |
| :--- | :--- | :--- |
| **Focus** | Data Structure (Resource) | User Intention (Action) |
| **Method** | `PATCH`, `DELETE` | `POST` |
| **Endpoints** | `/connections/:id` | `/connections/:id/accept`, `/connections/:id/cancel` |
| **Clarity** | Medium (Technical) | Very High (Business) |

### 🚀 Why POST for everything?
Contrary to popular belief, `POST` isn't used just because "side effects exist" (PATCH and DELETE also have side effects). In action-based APIs, **POST is used because intent clarity and external usability matter more than strict REST semantics.**

- **Intent thinking:** Instead of saying "I am modifying the balance resource" (`PATCH /account`), we say "I want to deposit money" (`POST /deposit`).
- **Safety:** It minimizes developer mistakes by making actions explicit.
- **Scalability:** It's easier to add new business actions without overloading a single `PATCH` or `DELETE` endpoint.

**Refactor Outcome:**
- `POST /connections` (Send Request)
- `POST /connections/:id/accept` (Accept)
- `POST /connections/:id/reject` (Reject)
- `POST /connections/:id/cancel` (Cancel)
- `POST /connections/:id/remove` (Remove)

Each action now has its own dedicated endpoint, making the system prioritizes **explicit user intent, safer client interaction, and clearer business semantics.**

