# API errors

How failures are returned, and a catalog of application error messages.

For request/response shapes see [API.md](./API.md).

---

## Response shape

Most errors:

```json
{ "error": "Human-readable message" }
```

Zod validation failures (`400`):

```json
{
  "error": "Validation failed",
  "details": { /* Zod flatten() output */ }
}
```

Adult attestation on signup (`400`) also sets a flag the client can key off:

```json
{
  "error": "Adult attestation required for new accounts (confirm you are 18+)",
  "requiresAdultAttestation": true
}
```

---

## How errors are produced

| Pattern | Where | How the client sees it |
|---------|--------|-------------------------|
| `res.status(n).json({ error })` | Route handlers | Immediate JSON response |
| `throw` `Error` with `.status` | `services/authz.ts`, `services/transfers.ts` | Caught by `asyncHandler` → `middleware/error.ts` |
| `ZodError` | Any `.parse(req.body)` | `400` + `details` via `errorHandler` |
| Unhandled / no status | Anywhere | `500` `{ "error": "<message or Internal server error>" }` |

Central handler: `server/src/middleware/error.ts`.

---

## Status code usage

| Code | Meaning in this app |
|------|---------------------|
| **400** | Bad input, business rule, expired/invalid OTP, wrong transfer target role |
| **401** | Missing / bad / expired JWT |
| **403** | Authenticated but not allowed (membership, admin, steward, invite mismatch) |
| **404** | Resource or account not found |
| **500** | Unexpected / infra (logged server-side) |

---

## Catalog by area

### Auth middleware — `server/src/middleware/auth.ts`

| Status | Message |
|--------|---------|
| 401 | `Missing authorization token` |
| 401 | `Human not found` |
| 401 | `Invalid or expired token` |

### Authz helpers — `server/src/services/authz.ts`

Thrown; usually surface as **403**.

| Status | Message | When |
|--------|---------|------|
| 403 | `Not a member of this family` | `requireMembership` |
| 403 | `Admin role required` | `requireMembership(..., "admin")` |
| 403 | `Only the pet’s steward can transfer or delete this pet` | `requirePetSteward` |

### Auth routes — `server/src/routes/auth.ts`

| Status | Message | Extra |
|--------|---------|--------|
| 400 | `No valid OTP found. Request a new code.` | |
| 400 | `Invalid code` | |
| 400 | `Adult attestation required for new accounts (confirm you are 18+)` | `requiresAdultAttestation: true` |
| 400 | `Adult attestation required` | `requiresAdultAttestation: true` |

### Pets & medical records — `server/src/routes/pets.ts`

| Status | Message |
|--------|---------|
| 400 | `Family is not available` |
| 404 | `Pet not found` |
| 404 | `Record not found` |

(Admin / steward denials use authz **403** messages above.)

### Uploads — `server/src/routes/uploads.ts`

| Status | Message |
|--------|---------|
| 400 | `No file uploaded` |

### Families, invites, transfers, merges — `server/src/routes/families.ts`

#### Invites

| Status | Message |
|--------|---------|
| 404 | `Invite not found or not pending` |
| 400 | `Invite expired` |
| 403 | `This invite is addressed to a different email or phone` |
| 404 | `Invite not found` |

#### Family CRUD / members

| Status | Message |
|--------|---------|
| 404 | `Family not found` |
| 404 | `Member not found` |
| 404 | `Source family not found` |

#### Transfers (route-level)

| Status | Message |
|--------|---------|
| 404 | `Transfer not found` |
| 400 | `Transfer is no longer pending` |
| 404 | `Pet not found in this family` |

Destination resolution errors are thrown from `services/transfers.ts` and returned by the create-transfer handler:

#### Transfer destination — `server/src/services/transfers.ts`

| Status | Message |
|--------|---------|
| 400 | `Invalid family ID. Use a code like NP-000042` |
| 404 | `No family found with that ID` |
| 400 | `Source and target family must differ` |
| 400 | `Provide a family in your circle, or an email / phone` |
| 404 | `No account found for that email or phone. They need to sign up first.` |
| 400 | `You cannot transfer a pet to yourself` |
| 400 | `That person is not a family admin. Transfers go to an admin’s household (or someone with no household yet).` |
| 400 | `That person is only an admin of this household — pick someone who admins a different family` |
| 500 | `Failed to create destination family` |

#### Merges

| Status | Message |
|--------|---------|
| 404 | `No account found with that email` |
| 400 | `That person is not an admin of any family` |
| 400 | `That admin’s only household is this one — pick an admin of a different family` |
| 400 | `A merge request is already pending` |
| 404 | `Merge request not found` |
| 400 | `Families are not in a mergeable state` |

### Infrastructure (usually not API responses)

| Where | Message |
|-------|---------|
| `server/src/config.ts` | `Missing required env var: <NAME>` (process startup) |
| `server/src/models/Counter.ts` | `Failed to allocate sequence: <name>` |

### Catch-all — `server/src/middleware/error.ts`

| Status | Message |
|--------|---------|
| 400 | `Validation failed` (+ `details`) |
| 500 | Error `.message`, or `Internal server error` |

---

## Client tips

- Prefer branching on **HTTP status** + exact `error` string for known flows (OTP attestation, transfer-to-non-admin).
- Use `requiresAdultAttestation` when present instead of parsing the attestation message.
- Zod `details` is for form field highlighting; the top-level `error` is always `"Validation failed"`.
