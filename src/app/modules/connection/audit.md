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
