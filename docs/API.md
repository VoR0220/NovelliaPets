# Novellia Pets API

Base URL (local): `http://localhost:4000`

All JSON endpoints use `Content-Type: application/json` unless noted. Errors typically look like:

```json
{ "error": "Human-readable message" }
```

Validation failures may also surface Zod error details depending on the error middleware.

---

## Conventions

### Auth

Most routes require a JWT from `POST /api/auth/verify-otp`.

```http
Authorization: Bearer <token>
```

The SSE stream also accepts `?token=<jwt>` because `EventSource` cannot set headers.

### Roles (quick reference)

| Action | Who |
|--------|-----|
| Add / delete pets | Family **admin** (delete also requires **steward**) |
| Invite, rename family, request merge, approve merge/transfer into family | Family **admin** |
| Add / edit medical records | Family **member** or admin |
| Request pet transfer | Pet **steward** (and member of source family) |
| Approve / deny transfer | Destination family **admin** |

### IDs

- Mongo ObjectIds for `familyId`, `petId`, `inviteId`, etc.
- Public family codes like `NP-000042` (also accepted as `42` / `np-42` where serial input is used).

---

## Health

### `GET /api/health`

No auth.

**Response**

```json
{ "ok": true, "service": "novellia-pets" }
```

---

## Auth — `/api/auth`

### `POST /api/auth/request-otp`

Send a one-time code to email **or** phone (exactly one).

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | one of | Valid email |
| `phone` | string | one of | 7–20 chars |

```json
{ "email": "alex@example.com" }
```

**Response**

```json
{
  "ok": true,
  "channel": "email",
  "destination": "alex@example.com",
  "expiresInMinutes": 10,
  "existingAccount": true,
  "devOtpHint": "123456"
}
```

- `existingAccount` — returning humans can skip name / 18+ on verify.
- `devOtpHint` — only when `NODE_ENV !== "production"`.

---

### `POST /api/auth/verify-otp`

Exchange OTP for a JWT.

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` / `phone` | string | one of | Same destination as request |
| `code` | string | yes | 4–8 chars |
| `adultAttested` | boolean | for **new** humans | Must be `true` to create account |
| `firstName` | string | no | Used for display name |
| `lastName` | string | no | |
| `name` | string | no | Deprecated; prefer first/last |

```json
{
  "email": "morgan@example.com",
  "code": "123456",
  "adultAttested": true,
  "firstName": "Morgan",
  "lastName": "Ellis"
}
```

**Response**

```json
{
  "token": "<jwt>",
  "human": { "id": "...", "email": "...", "name": "...", ... },
  "isNewHuman": true
}
```

If a new account needs attestation:

```json
{
  "error": "Adult attestation required for new accounts (confirm you are 18+)",
  "requiresAdultAttestation": true
}
```

---

### `GET /api/auth/me`

Auth required.

**Response**

```json
{
  "human": { "id": "...", "email": "...", "name": "...", ... },
  "memberships": [
    {
      "id": "...",
      "familyId": "...",
      "humanId": "...",
      "role": "admin",
      "family": { "id": "...", "name": "...", "serialCode": "NP-000001", "status": "active", ... }
    }
  ]
}
```

Merged families are omitted from memberships.

---

### `POST /api/auth/logout`

Auth required. Client should discard the JWT (server is a no-op placeholder).

**Response:** `{ "ok": true }`

---

## Dashboard — `/api/dashboard`

### `GET /api/dashboard`

Auth required. Pets + care buckets across all active family memberships.

**Response**

```json
{
  "pets": [ /* PetDto[] */ ],
  "care": {
    "overdue": [ /* MedicalRecordDto[] */ ],
    "dueSoon": [ /* MedicalRecordDto[] */ ]
  },
  "familyCount": 2
}
```

Due soon = `nextDueAt` within 14 days (`DUE_SOON_DAYS`).

---

## Pets — `/api/pets`

### `GET /api/pets`

Auth required. Conjoined list from all memberships.

**Query**

| Param | Notes |
|-------|--------|
| `q` | Case-insensitive text filter (name, breed, notes, etc.) |
| `species` | Exact species match (case-insensitive) |
| `dueStatus` | `overdue` \| `due_soon` \| `ok` \| `none` (pets with no due records) |

---

### `POST /api/pets`

Auth required. Provide **either** `familyId` (must be admin) **or** `newFamilyName` (creates family + makes you admin).

**Body**

| Field | Type | Required |
|-------|------|----------|
| `familyId` | string | one of |
| `newFamilyName` | string | one of |
| `name` | string | yes |
| `species` | string | yes |
| `breed` | string | yes |
| `sex` | `"male"` \| `"female"` \| `"unknown"` | yes |
| `approxAge` | string | yes |
| `photoUrl` | string | no |
| `notes` | string | no |

```json
{
  "newFamilyName": "Morgan's Family",
  "name": "Pixel",
  "species": "Cat",
  "breed": "Tabby",
  "sex": "female",
  "approxAge": "2 years"
}
```

Creator becomes `stewardHumanId`. **201** + `PetDto`.

---

### `GET /api/pets/:petId`

Auth required. Must be a member of the pet’s family.

---

### `PATCH /api/pets/:petId`

Auth required. Member of pet’s family.

**Body** (all optional): `name`, `species`, `breed`, `sex`, `approxAge`, `photoUrl`, `notes`

---

### `DELETE /api/pets/:petId`

Auth required. Must be the pet’s **steward**. Deletes pet and related medical records.

---

## Medical records — `/api/pets/:petId/records`

### `GET /api/pets/:petId/records`

Auth required. Member of pet’s family.

**Query:** `q`, `type` (`vaccine` \| `medication` \| `checkup` \| `procedure` \| `other`), `dueStatus`

---

### `POST /api/pets/:petId/records`

Auth required. Member.

**Body**

| Field | Type | Required |
|-------|------|----------|
| `type` | enum above | yes |
| `title` | string | yes |
| `date` | ISO / date string | yes |
| `nextDueAt` | string \| null | no |
| `vetName` | string | no |
| `notes` | string | no |
| `attachmentUrl` | string | no |

**201** + `MedicalRecordDto` (includes computed `dueStatus`).

---

### `PATCH /api/pets/:petId/records/:recordId`

Auth required. Partial body (same fields as create). Set `nextDueAt` / `attachmentUrl` to `null` to clear.

---

### `DELETE /api/pets/:petId/records/:recordId`

Auth required. Member.

---

## Families — `/api/families`

### `GET /api/families`

Auth required. Your memberships (with nested `family` when available).

---

### `GET /api/families/:familyId`

Auth required. Member. Returns family detail:

```json
{
  "family": { ... },
  "myRole": "admin",
  "members": [ ... ],
  "invites": [ ... ],
  "transfers": [ ... ],
  "merges": [ ... ]
}
```

Pending transfers/merges involving this family are included.

---

### `PATCH /api/families/:familyId`

Auth required. **Admin.**

**Body:** `{ "name": "New household name" }`

---

### `POST /api/families/:familyId/promote/:memberHumanId`

Auth required. **Admin.** Promotes a member to admin.

---

## Invites

### `GET /api/families/invites/mine`

Auth required. Pending invites addressed to your email or phone.

---

### `POST /api/families/invites/:inviteId/accept`

Auth required. Invite must match your email/phone and not be expired.

**Response:** `{ "ok": true, "family": { ... } }` — you join as **member**.

---

### `POST /api/families/:familyId/invites`

Auth required. **Admin.** Exactly one of email or phone.

**Body**

```json
{ "targetEmail": "friend@example.com" }
```

or

```json
{ "targetPhone": "+15551234567" }
```

**201** + `InviteDto`. If the target already has an account, they get an `invite_received` notification.

---

### `DELETE /api/families/:familyId/invites/:inviteId`

Auth required. **Admin.** Revokes invite (`status: "revoked"`).

---

## Transfers

### `POST /api/families/:familyId/transfers`

Auth required. Caller must be a **member** of `:familyId` and the pet’s **steward**.

**Body** — exactly **one** destination field, plus:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `petId` | string | yes | Must live in `:familyId` |
| `toFamilySerial` | string | one of | e.g. `NP-000003` |
| `toEmail` | string | one of | Existing account; admin or no household |
| `toPhone` | string | one of | Same rules as email |
| `warningAcknowledged` | `true` | yes | Literal true |
| `withDocumentation` | boolean | no | Sets status to `pending_documentation` |

```json
{
  "petId": "...",
  "toEmail": "morgan@example.com",
  "warningAcknowledged": true,
  "withDocumentation": false
}
```

**Email/phone rules**

- No account → **404** `No account found…`
- Member only (not an admin of another family) → **400** `…not a family admin…`
- No household yet → creates a family for them; they approve as admin
- Cannot transfer to yourself

**201** + `PetTransferDto`

---

### `POST /api/families/transfers/:transferId/documentation`

Auth required. Source family **admin**.

**Body:** `{ "documentationUrl": "/uploads/..." }`

May bump status from `requested` → `pending_documentation`.

---

### `POST /api/families/transfers/:transferId/decide`

Auth required. Destination family **admin**.

**Body:** `{ "decision": "approved" | "denied" }`

On **approved**: pet (+ records) move to destination family; steward becomes `toHumanId` if set, otherwise the approving admin.

---

## Merges

### `POST /api/families/:familyId/merges`

Auth required. Source family **admin**.

**Body**

| Field | Type | Required |
|-------|------|----------|
| `toAdminEmail` | string (email) | yes |
| `warningAcknowledged` | `true` | yes |

Resolves the destination as an **active family** where that human is an **admin** (excluding the source). If they admin several, the lowest `serialId` is used.

```json
{
  "toAdminEmail": "alex@example.com",
  "warningAcknowledged": true
}
```

**201** + `FamilyMergeDto`

---

### `POST /api/families/merges/:mergeId/decide`

Auth required. Destination family **admin**.

**Body:** `{ "decision": "approved" | "denied" }`

On **approved**: pets and records move; source members become admins on destination; source family `status: "merged"`; **stewards unchanged**.

---

## Notifications — `/api/notifications`

### `GET /api/notifications`

Auth required. Latest 50 for the current human.

---

### `POST /api/notifications/read`

Auth required.

**Body**

```json
{ "ids": ["...", "..."] }
```

Omit `ids` (or empty array) to mark **all** unread as read.

**Response:** `{ "ok": true }`

---

### `GET /api/notifications/stream`

Auth via `Authorization: Bearer …` **or** `?token=<jwt>`.

SSE stream. Events:

- `connected` — `{ "humanId": "..." }`
- `notification` — full `NotificationDto`
- comment heartbeats (`: ping`)

---

## Uploads — `/api/uploads`

### `POST /api/uploads`

Auth required. `multipart/form-data` with field name **`file`**. Max 5MB.

**Response**

```json
{ "url": "/uploads/1710000000000-photo.jpg", "filename": "..." }
```

Serve static files at `GET /uploads/:filename` (no auth on static).

---

## Enums cheat sheet

| Name | Values |
|------|--------|
| `FamilyRole` | `admin`, `member` |
| `PetSex` | `male`, `female`, `unknown` |
| `MedicalRecordType` | `vaccine`, `medication`, `checkup`, `procedure`, `other` |
| `DueStatus` | `overdue`, `due_soon`, `ok` |
| `TransferStatus` | `requested`, `pending_documentation`, `approved`, `denied` |
| `MergeStatus` | `requested`, `approved`, `denied` |
| `InviteStatus` | `pending`, `accepted`, `revoked`, `expired` |
| `FamilyStatus` | `active`, `merged` |

Shared TypeScript DTOs live in `@novellia/shared` (`shared/src/index.ts`).
