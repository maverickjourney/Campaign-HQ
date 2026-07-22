# Campaign Seat Platform Recovery Inventory

**Inventory date:** 2026-07-22 00:28:32 EDT
**Production website:** `https://campaignseat.com`
**Supabase project:** `mmeugqtusohviqvivifr`
**Vercel project:** `campaign-hq`
**Vercel scope:** `maverickjourneys-projects`
**Git branch:** `main`
**Git commit:** `5b31e4a14bcbbfab18ad7018f1f593d25389a2b7`

This document contains only non-secret configuration names, service
identifiers, verification results, and recovery checklists.

It must never contain secret values, passwords, private API keys,
database credentials, SMTP credentials, MFA setup keys, recovery codes,
session tokens, or backup passphrases.

---

## Supabase Edge Functions

- `delete-workspace-account` — deployed remotely: Yes
- `geocode-field-route` — deployed remotely: Yes
- `send-workspace-invitation` — deployed remotely: Yes

Recovery requirements:

- Redeploy every function from the trusted Git commit.
- Recreate required secret names through the Supabase Dashboard or CLI.
- Verify authentication and AAL2 enforcement after deployment.

## Supabase Edge Function secret names

Only names are recorded. Values and digests are excluded.

- `RESEND_API_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWKS`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_SECRET_KEYS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

## Environment-variable names referenced by source

- `CAMPAIGN_SEAT_APP_URL`
- `CAMPAIGN_SEAT_INVITATION_FROM`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEYS`
- `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`

Variables beginning with `VITE_` are compiled into the frontend and must
never contain private credentials.

## Supabase migration history

Migration versions recorded remotely:

- `20260712231807`
- `20260713034500`
- `20260713040000`
- `20260713042500`
- `20260713044000`
- `20260713050500`
- `20260713052500`
- `20260713054500`
- `20260713060000`
- `20260713063000`
- `20260716103500`
- `20260716124500`
- `20260716133000`
- `20260716181500`
- `20260716221500`
- `20260717021500`
- `20260717213000`
- `20260720164500`
- `20260720171500`
- `20260720180000`
- `20260721013000`
- `20260721143000`

The recovery drill confirmed that migration-history records require
separate preservation or reconstruction.

## Vercel environment-variable names

### Production

- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_TURNSTILE_SITE_KEY`

### Preview

- None detected

### Development

- None detected

Required production frontend variables include:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`

## Vercel domains

- `campaignseat.com` — DNS verification: **PASS**
- `www.campaignseat.com` — DNS verification: **PASS**

Recovery checks:

- Both domains are assigned to `campaign-hq`.
- HTTPS certificates are valid.
- Root and `www` behavior is intentional.
- DNS records match Vercel’s current expected records.

## Cloudflare Turnstile

- Widget: `Campaign Seat Authentication`
- Mode: Managed
- Pre-clearance: Off
- Authorized hostname: `campaignseat.com`
- Authorized hostname: `localhost`
- Authorized hostname: `127.0.0.1`
- Public-key variable: `VITE_TURNSTILE_SITE_KEY`
- Private-secret location: Supabase Authentication CAPTCHA settings

Recovery checks:

- Turnstile protection is enabled in Supabase.
- Provider is Cloudflare Turnstile.
- Login completes the security check before authentication.
- Password reset works.
- Invitation signup and invitation sign-in work.

## Supabase Authentication

Recovery checks:

- Site URL is `https://campaignseat.com`.
- Required redirect URLs are configured.
- Email/password authentication is enabled.
- New-user signup remains enabled.
- Before User Created hook is enabled.
- Hook is `public.hook_require_workspace_invitation`.
- Password minimum is 12 characters.
- Uppercase, lowercase, number, and symbol are required.
- Secure email change is enabled.
- Secure password change is enabled.
- Email OTP length is 8 digits.
- Email OTP expiration is 1,800 seconds.
- Leadership MFA behavior is tested.
- Password recovery requires MFA where applicable.

## Resend SMTP

- Provider: Resend
- SMTP host: `smtp.resend.com`
- SMTP username: `resend`

Recovery checks:

- Verified sending domain is active.
- Sender email and display name are configured.
- SMTP port and TLS mode are configured.
- The API key is stored only in the approved secure location.
- Invitation and password-reset test emails succeed.

## Supabase Storage

- Bucket: `campaign-files`
- Public access: No
- Database metadata restored during drill: Yes
- Actual file bytes restored separately during drill: Yes
- Verified objects during drill: 3
- Verified bytes during drill: 8,003,166

Recovery requires both the database metadata and the separately
encrypted Storage archive.

## DNS and registrar

Record and verify manually:

- Domain registrar and account owner
- Registrar MFA
- Domain expiration and automatic renewal
- Domain transfer lock
- Nameserver provider
- Root-domain and `www` records
- Resend SPF
- Resend DKIM
- DMARC

Do not store registrar passwords, recovery codes, or DNS-provider tokens
in this repository.

## Recovery acceptance tests

- Production homepage
- Password-reset page
- Calendar route
- Turnstile
- Email/password login
- Leadership MFA
- Password recovery with MFA
- Invitation creation
- Invitation-only registration
- Edge Function AAL2 enforcement
- Team-member removal
- Permanent account deletion
- Private Storage upload and download
- Invitation email
- Password-reset email
- Root and `www` domain behavior
- HTTPS certificate
