# Novellia Pets

MERN MVP for pet medical records across shared **Families**, with passwordless OTP login scoped to a **Human**. Families are created when you add your first pet (or join via invite) — never empty households on signup.

## Stack

- **MongoDB** (Docker)
- **Express** + Mongoose (TypeScript, strict)
- **React** + Vite (TypeScript, strict)
- Shared DTO types in `@novellia/shared`
- Dev OTP (console / on-screen hint) + JWT
- In-app notifications via **SSE**

## Quick start

```bash
# 1. Start MongoDB (if pull hangs: docker compose up -d --pull never)
npm run docker:up

# 2. Install workspaces
npm install

# 3. Build shared types
npm run build --workspace=@novellia/shared

# 4. Seed demo scenarios
npm run seed

# 5. Run API + client
npm run dev:server
npm run dev:client
```

- App: http://localhost:5173  
- API: http://localhost:4000  

Copy `server/.env.example` to `server/.env` if needed (a default `.env` is included for local demo).

## Demo scenarios (seed walkthrough)

`npm run seed` wipes the database and loads six end-to-end stories. OTP codes appear in the **server console** and as a **dev hint** on the login screen.

### Personas & Family IDs

| Persona | Login | Role in the demo |
|---------|-------|------------------|
| **Alex Rivera** | `alex@example.com` | Admin of solo family + shared household; steward of Maple, Biscuit, Nova |
| **Jordan Lee** | `jordan@example.com` | Member of shared household |
| **Sam Okonkwo** | `+15551234567` | Has rabbit Pepper; **pending invite** to shared household |
| **Casey Nguyen** | `casey@example.com` | Target of **pending transfer** (Nova) |
| **Morgan Ellis** | `morgan@example.com` | No family yet — empty-start path |

| Family ID | Name | Members / pets |
|-----------|------|----------------|
| `NP-000001` | Alex's Family | Alex · Maple |
| `NP-000002` | Rivera–Lee Household | Alex (admin), Jordan (member) · Biscuit, Nova |
| `NP-000003` | Casey's Family | Casey · (awaiting Nova) |
| `NP-000004` | Sam's Family | Sam · Pepper |

### Scenario 1 — Care due / overdue

**Login as:** Alex (`alex@example.com`)

1. Open **Dashboard**.
2. Maple’s **Rabies** vaccine should appear under **Overdue**.
3. **Annual wellness** should appear under **Due soon**.

*Shows why someone opens the app today: care across every family you belong to.*

### Scenario 2 — Shared household (member view)

**Login as:** Jordan (`jordan@example.com`)

1. Open **Pets** — Biscuit and Nova appear with the Rivera–Lee family badge.
2. Maple (Alex’s solo family) does **not** appear.
3. Open **Families** — Jordan is a **member** (can add medical records; cannot add pets or invite).

### Scenario 3 — Accept a pending invite

**Login as:** Sam (`+15551234567`)

1. Check the notification bell / **Families → Invites** for the invite into Rivera–Lee.
2. **Accept** the invite.
3. **Pets** now shows Pepper **and** Biscuit/Nova (conjoined across families — no family switcher).

### Scenario 4 — Approve a pet transfer

**Login as:** Casey (`casey@example.com`)

1. Open **Families → Casey's Family**.
2. Under pending transfers, **Nova** should be waiting with a documentation stub.
3. **Approve** the transfer.
4. Nova moves to Casey’s family; Jordan/Alex no longer see Nova on their pet lists for the shared household.

*Transfer requires steward action on the source side and admin decision on the target. Optional documentation covers “court order / agreement” without claiming legal review.*

### Scenario 5 — Multi-family (conjoined list)

**Login as:** Alex (`alex@example.com`)

1. Open **Pets**.
2. Maple shows Family ID `NP-000001`; Biscuit and Nova show `NP-000002`.
3. Dashboard family count is **2+** — one Human, multiple Families, one combined list.

### Scenario 6 — Empty start (first pet creates a family)

**Login as:** Morgan (`morgan@example.com`)

1. After OTP, **Pets** / **Families** are empty — signup does **not** create a household.
2. **Add a pet** and choose **create a new family** (e.g. “Morgan's Family”).
3. Morgan becomes admin; a new `NP-######` Family ID is assigned.

*Invite-only growth: join someone else’s household via invite, or start your own when the first pet arrives.*

### Extra demos (same seed)

- **Invite someone:** As Alex, open Rivera–Lee → invite by email/phone.
- **Request a transfer:** As Alex (steward), open a pet → **Transfer…**. Pick another family in your circle from the dropdown, or choose **Email or phone** (e.g. `morgan@example.com`) — if they have no household yet, one is created for them to approve. Jordan (non-steward) cannot transfer.
- **Merge households:** As Alex, from Alex’s Family request a merge using a destination **admin email** (e.g. `alex@example.com` for Rivera–Lee). Approving moves pets, **keeps stewards**, unions members as admins, and archives the source family as `merged`.

## Product model

- **Human** — identity (email or phone). OTP creates/authenticates them; no empty family on signup.
- **Family** — owns pets; public shareable ID `NP-######`. Created on first pet or via invite/merge.
- **Pets** — `familyId`-scoped with a **steward** (who can transfer/delete). Admins add pets.
- **Medical records** — separate collection; `nextDueAt` drives the care dashboard.
- **Conjoined UI** — no family switcher; pets from all memberships appear together with a family badge.
- **Transfers** — steward requests; target family admin approves/denies.
- **Merges** — source admin requests; target admin approves; stewards preserved.

## Auth approach

Passwordless OTP shaped like production: request → verify → JWT.

For production next steps: Twilio Verify / email provider, optional OAuth linked to the same Human, refresh tokens, invite deep links.

## Tests

```bash
npm test
# or
npm run test --workspace=@novellia/server
```

API tests use an in-memory MongoDB and exercise the same seed scenarios (care due, invites, transfers, multi-family, empty start) plus steward/merge/auth guards.

## Loom checklist ideas

1. OTP login → dashboard overdue care → conjoined pets with badges.
2. Add/edit pet & medical records; filters.
3. Invite + accept in a second browser; SSE notification bell.
4. Transfer by Family ID + approve with documentation stub.
5. Empty-start: first pet creates family; merge keeps stewards.
6. Tradeoff: **dev OTP** proves the auth shape with zero external keys.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run docker:up` | Start Mongo on `:27017` |
| `npm run seed` | Reset DB + demo scenarios |
| `npm run test` | API scenario + guard tests |
| `npm run dev:server` | API on `:4000` |
| `npm run dev:client` | Vite on `:5173` |

## API

Full request/response reference (bodies, query params, auth, roles):

→ **[docs/API.md](docs/API.md)**

Quick map:

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/request-otp`, `verify-otp`, `GET /me`, `POST /logout` |
| Care | `GET /api/dashboard` |
| Pets | `CRUD /api/pets`, `CRUD /api/pets/:id/records` |
| Families | `GET/PATCH /api/families/:id`, invites, transfers, merges |
| Realtime | `GET /api/notifications`, `GET /api/notifications/stream` (SSE) |
| Files | `POST /api/uploads` (`multipart` field `file`) |
