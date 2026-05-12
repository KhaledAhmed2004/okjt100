# Group Management Module APIs

> **Section**: Backend API specifications for the Group Management module.
> **Base URL**: `{{baseUrl}}` = `http://localhost:5000/api/v1`
> **Response format**: See [Standard Response Envelope](../../README.md#standard-response-envelope)
> **UX Flows referencing this module**:
> - App - Group Discovery — Find and join groups based on gender
> - App - Group Feed — Interact with posts, likes, and comments
> - Admin Dashboard - Group Management — Create and moderate groups

---

## Database Design

### 1. Group Model (`groups`)
Stores metadata for groups.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `name` | String | ✅ | Title of the group |
| `description` | String | ✅ | Short details |
| `userType` | String | ✅ | `Male` or `Female` |
| `categoryId` | ObjectId | ✅ | Reference to category |
| `memberCount` | Number | ✅ | Total joined users (Auto-updated) |

### 2. Group Member Model (`group-members`)
Tracks user membership in groups.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `groupId` | ObjectId | ✅ | Reference to group |
| `userId` | ObjectId | ✅ | Reference to user |
| `role` | String | ✅ | `member` or `admin` |
| `joinedAt` | Date | ✅ | When the user joined |

### 3. Group Post Model (`group-posts`)
Stores posts created within groups.

| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `groupId` | ObjectId | ✅ | Reference to group |
| `userId` | ObjectId | ✅ | Reference to poster |
| `content` | String | ✅ | Post text |
| `attachments` | String[] | ❌ | List of file/image URLs |
| `likesCount` | Number | ✅ | Total likes (Auto-updated) |
| `commentsCount` | Number | ✅ | Total comments (Auto-updated) |

---

## Unified API Registry

| # | Method | Endpoint | Auth | Purpose & Status | Documentation |
|---|---|---|---|---|---|
| 01 | POST | `/groups` | Admin | **Done**: Create a new group | [01-create-group.md](./01-create-group.md) |
| 02 | GET | `/groups` | User | **Done**: List groups (gender filtered) | [02-list-groups.md](./02-list-groups.md) |
| 03 | POST | `/groups/:groupId/join` | User | **Done**: Join a group | [03-join-group.md](./03-join-group.md) |
| 04 | POST | `/groups/:groupId/posts` | User | **Done**: Create a post | [04-create-post.md](./04-create-post.md) |
| 05 | GET | `/groups/:groupId/posts` | User | **Done**: Get group feed | [05-get-feed.md](./05-get-feed.md) |
| 06 | POST | `/groups/posts/:postId/like` | User | **Done**: Like/Unlike a post | [06-like-post.md](./06-like-post.md) |
| 07 | POST | `/groups/posts/:postId/comments`| User | **Done**: Add a comment | [07-add-comment.md](./07-add-comment.md) |
| 08 | DELETE | `/groups/posts/:postId` | Author/Admin | **Done**: Delete a post | [08-delete-post.md](./08-delete-post.md) |
| 09 | DELETE | `/groups/comments/:commentId` | Author/Admin | **Done**: Delete a comment | [09-delete-comment.md](./09-delete-comment.md) |
