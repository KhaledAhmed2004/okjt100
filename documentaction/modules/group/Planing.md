# Group Management Module Design

## 1. Overview
This module allows admins to create, organize, and manage user groups. Groups are restricted based on user type (Male/Female) and categorized for better organization. Users can join groups and interact with posts inside them.

---

## 2. Data Model (Backend Structure)

### Group Table
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "userType": "Male | Female",
  "categoryId": "string",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### Group Members Table
```json
{
  "id": "string",
  "groupId": "string",
  "userId": "string",
  "joinedAt": "datetime",
  "role": "member | admin"
}
```

### Group Posts Table
```json
{
  "id": "string",
  "groupId": "string",
  "userId": "string",
  "content": "string",
  "attachments": ["string"],
  "createdAt": "datetime"
}
```

### Post Comments Table
```json
{
  "id": "string",
  "postId": "string",
  "userId": "string",
  "comment": "string",
  "createdAt": "datetime"
}
```

### Post Likes Table
```json
{
  "id": "string",
  "postId": "string",
  "userId": "string",
  "createdAt": "datetime"
}
```

---

## 3. Admin Module Features

### Group Creation
Admin can create groups with:
* Group Name
* Description
* User Type (Male / Female)
* Category selection

### Group List (Admin Table View)
| Column        | Description         |
| ------------- | ------------------- |
| Group Name    | Title of group      |
| Members Count | Total joined users  |
| Created Date  | Group creation time |
| Description   | Short details       |
| Group Type    | Male / Female       |
| Category      | Assigned category   |

### Admin Capabilities
* Create / Edit / Delete groups
* Assign category
* Control visibility by user type
* View group analytics (members, posts)

---

## 4. Group Page (User Side)

### Access Control
* Users only see groups matching their gender type
* Example:
  * Male users → Only Male groups
  * Female users → Only Female groups

### Group Page Layout
#### 1. Group Header
* Group Name
* Description
* Total Members Count
* Join / Leave Button

#### 2. Group Feed (Posts Section)
Each post includes:
* User info
* Text content
* Attachments (images/files)
* Like button
* Comment section

### 3. Group Actions
#### Join / Leave Group
* User can join or leave anytime
* Membership updated in real-time

#### Post Creation
Users can create posts with:
* Text content
* File/Image attachments

#### Post Interaction
* Like post
* Comment on post

#### Comment Rules
* Comment can be deleted by:
  * Comment owner
  * Admin only

---

## 5. Business Rules
* Users must match group userType to access
* Only members can post/comment
* Group member count updates automatically
* Posts are visible only inside their group

---

## 6. Optional Enhancements (Recommended)
* Real-time updates (WebSocket)
* Post reporting system
* Pinned posts (Admin feature)
* Group analytics dashboard
* Notification system