# Campaign Seat Disaster-Recovery Runbook

## Purpose

This runbook documents how Campaign Seat should respond to:

- Accidental database or file deletion
- Compromised administrator access
- Failed database migrations
- Supabase project loss
- Vercel deployment failure
- Domain or DNS failure
- Authentication or MFA configuration failure

Never store passwords, API keys, database connection strings, MFA setup
keys, backup passphrases, or other secrets in this document or repository.

---

## Current production services

| Service | Production resource |
|---|---|
| Website | `https://campaignseat.com` |
| Git repository | `maverickjourney/Campaign-HQ` |
| Supabase project | `mmeugqtusohviqvivifr` |
| Vercel scope | `maverickjourneys-projects` |
| Supabase Storage bucket | `campaign-files` |
| Turnstile widget | `Campaign Seat Authentication` |
| Email delivery | Resend SMTP |

---

## Verified recovery baseline — July 21, 2026

### Database archive

`campaign-seat-database-20260721T184717Z.tar.gz.enc`

Verified contents:

- Database roles
- Database schema
- Database data
- RLS policies
- Database functions and triggers
- Auth users
- Auth identities
- Enrolled MFA factors
- MFA assurance records

Verified Auth record counts at backup time:

| Auth table | Records |
|---|---:|
| `auth.users` | 5 |
| `auth.identities` | 5 |
| `auth.mfa_factors` | 2 |
| `auth.mfa_amr_claims` | 2 |
| `auth.sessions` | 1 |
| `auth.refresh_tokens` | 2 |

### Storage archive

`campaign-seat-storage-20260721T185532Z.tar.gz.enc`

Verified contents:

- 3 Storage objects
- Approximately 7.6 MB
- Per-file checksums
- Remote object inventory

### Backup locations

The encrypted archives and their SHA-256 files are stored in:

1. The protected local Campaign Seat backup folder on the primary Mac
2. `Campaign Seat Secure Backups` in iCloud Drive

The encryption passphrase is stored separately in the approved password
manager. It must never be saved in GitHub, iCloud Drive, a text message,
email, Slack, or this runbook.

---

## Items requiring manual reconfiguration

A database and Storage restoration does not by itself recreate every
Campaign Seat platform setting.

Reconfigure and verify:

### Supabase

- Project URL and API keys
- Authorized site and redirect URLs
- Resend SMTP configuration
- Email templates
- Password policy
- Email OTP length and expiration
- Secure email-change protection
- Secure password-change protection
- Cloudflare Turnstile CAPTCHA protection
- Before User Created Auth Hook
- MFA policies
- Database extensions and settings
- Realtime settings
- Storage bucket privacy and limits
- Edge Function secrets
- Edge Function deployments

### Edge Functions

Redeploy and test:

- `send-workspace-invitation`
- `delete-workspace-account`

### Vercel

Recreate and verify the production environment-variable names:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`

Never place a Turnstile secret, Supabase service-role key, SMTP password,
or other server secret in a `VITE_` variable.

### Cloudflare Turnstile

Verify the widget permits:

- `campaignseat.com`
- `localhost`
- `127.0.0.1`

The private Turnstile secret must be entered directly into Supabase and
must not be placed in the frontend or repository.

### Domain

Verify:

- `campaignseat.com`
- `www.campaignseat.com`
- HTTPS certificate
- Redirect behavior
- Vercel domain assignment
- DNS records

---

## Incident-response procedure

### 1. Contain the incident

- Stop making unrelated production changes.
- Record the discovery time and symptoms.
- Preserve relevant screenshots and logs.
- Identify affected users, services, and data.
- Disable compromised user access when appropriate.
- Rotate exposed credentials through the affected service.
- Do not delete the damaged project before evidence and backups are secured.

### 2. Protect the current state

Before attempting repair, create a new encrypted database and Storage
backup whenever the affected services remain accessible.

Record:

- Current Git commit
- Supabase migration history
- Deployed Edge Function versions
- Vercel deployment identifier
- Approximate incident start time

### 3. Choose the recovery approach

Use the least disruptive safe approach:

1. Repair the existing production project
2. Roll the application back to a known-good Git commit
3. Restore data into an isolated replacement Supabase project
4. Move production traffic only after the replacement passes testing

Never perform an untested restore directly over the only production copy.

---

## Isolated restoration order

### Phase A — Create an isolated environment

1. Create a replacement Supabase project.
2. Do not connect the production domain.
3. Record its project reference securely.
4. Install required extensions and project settings.
5. Keep all test emails restricted to authorized campaign personnel.

### Phase B — Restore the database

Restore in this order:

1. `roles.sql`
2. `schema.sql`
3. `data.sql`

Circular foreign-key warnings involving `field_assignments` or
`field_stops` must be reviewed during the restore. Do not ignore an
actual restore failure.

### Phase C — Verify the restored database

Confirm:

- Expected Auth user count
- Expected identity count
- Expected MFA-factor count
- Workspace memberships
- Invitations
- Audit records
- RLS policies
- Database functions
- Sensitive leadership actions require AAL2
- Invitation-only account creation remains enforced

### Phase D — Restore Storage

1. Recreate the private `campaign-files` bucket.
2. Restore all encrypted-backup objects.
3. Verify object checksums.
4. Verify private object access.
5. Test upload, download, and deletion permissions.

### Phase E — Restore application services

1. Deploy both Edge Functions.
2. Add Edge Function secrets directly in Supabase.
3. Reconfigure Auth URLs, SMTP, password security, CAPTCHA, MFA, and hooks.
4. Update Vercel environment variables.
5. Deploy the application from a known-good Git commit.
6. Test using the temporary Vercel URL before changing production DNS.

### Phase F — Production smoke test

Test all of the following:

- Main sign-in
- Turnstile completion
- Invalid-password rejection
- Leadership MFA challenge
- Password-reset request
- Password recovery with MFA
- Invitation creation
- Invitation-only registration
- Existing-member invitation sign-in
- Team member removal
- Permanent account deletion
- Private file upload and download
- Audit-event creation
- `/`
- `/forgot-password`
- `/calendar`
- Mobile and desktop layouts

### Phase G — Production cutover

Only after all tests pass:

1. Point the production environment to the replacement project.
2. Deploy Vercel.
3. Verify the production domain and HTTPS.
4. Require all users to sign in again.
5. Rotate API keys or secrets affected by the incident.
6. Monitor Auth, Edge Function, database, Vercel, and Turnstile logs.
7. Keep the previous environment intact until recovery is confirmed.

---

## Recovery acceptance criteria

Recovery is complete only when:

- The website loads over HTTPS
- Authorized members can sign in
- Leadership MFA works
- Uninvited registration is blocked
- Password recovery works
- Invitations work
- RLS isolation is confirmed
- Sensitive actions require AAL2
- Private Storage objects are accessible only to authorized users
- Email delivery works
- Edge Functions work
- No secrets are exposed in frontend bundles or Git history
- A new encrypted post-recovery backup has been created and verified

---

## Backup policy

Create a new encrypted database and Storage backup:

- At least monthly
- Before significant migrations
- After significant security changes
- Before changing Auth or Storage architecture
- Immediately after a successful disaster recovery

For every backup:

1. Generate the database archive.
2. Generate the Storage archive.
3. Test decryption.
4. Verify SHA-256 checksums.
5. Confirm Auth and MFA records are present.
6. Copy both archives and checksum files off-device.
7. Confirm off-device synchronization.
8. Keep the passphrase only in the approved password manager.

Never delete the newest verified local backup until another verified
local and off-device backup set exists.
