# Campaign Seat Isolated Recovery Drill

**Drill date:** July 21, 2026
**Result:** PASS
**Environment:** Local isolated Supabase stack in Docker
**Production project modified:** No

## Scope

This drill tested restoration of:

- PostgreSQL roles
- Database schema
- Database records
- Supabase Auth users and identities
- MFA enrollment records
- Campaign Seat tables and functions
- Private Supabase Storage metadata
- Actual private Storage file bytes

This drill did not test restoration of external platform configuration such
as DNS, Vercel settings, SMTP, API keys, Edge Function secrets, Cloudflare
Turnstile settings, or Supabase Dashboard configuration.

## Database verification

The restored local database contained:

| Record set | Verified count |
|---|---:|
| `auth.users` | 5 |
| `auth.identities` | 5 |
| `auth.mfa_factors` | 2 |
| `workspace_invitations` | 8 |
| `workspace_members` | 5 |
| `field_assignments` | 0 |
| `field_stops` | 0 |

The following critical database objects were present:

- `public.workspace_invitations`
- `public.workspace_members`
- `public.field_assignments`
- `public.field_stops`
- `public.hook_require_workspace_invitation(jsonb)`

The Supabase migration-history table was not included in the restored
database. Schema, functions, policies, and application records were
verified independently.

## Storage verification

The restored private bucket was:

- `campaign-files`
- Public access: disabled
- Metadata records: 3

Storage restoration results:

| Check | Result |
|---|---|
| Objects uploaded | 3 |
| Objects downloaded for verification | 3 |
| Total verified bytes | 8,003,166 |
| Backup checksums passed | Yes |
| Restored-file checksums passed | Yes |
| Object paths preserved | Yes |
| Object IDs preserved | Yes |
| Object ownership preserved | Yes |
| Bucket privacy preserved | Yes |

## Isolation controls

The drill verified:

- No remote Supabase project link existed
- The production project reference was not used as a restore destination
- Database restoration targeted only the local Docker database
- Storage restoration targeted only the local Storage API
- Temporary decrypted files were removed
- No backup passphrase or service key was written to this report

## Findings

1. Database and Storage backups were both usable.
2. Supabase Auth users, identities, and enrolled MFA factors were present.
3. Database Storage metadata alone did not restore the actual file bytes.
4. Storage files had to be restored separately through the Storage API.
5. The restored private files matched the backup copies by SHA-256.
6. Supabase migration history requires separate preservation or reconstruction.
7. Platform-level configuration still requires a separate recovery inventory.

## Conclusion

Campaign Seat successfully completed an isolated database and Storage
restoration drill. The encrypted backup set is capable of restoring the
campaign's database records, Auth records, MFA records, private Storage
metadata, and actual private Storage files.

The next recovery-readiness phase is documenting and securely inventorying
platform configuration for Supabase, Vercel, Resend, Cloudflare Turnstile,
DNS, and Edge Functions.
