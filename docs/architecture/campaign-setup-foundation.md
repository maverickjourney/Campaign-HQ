# Campaign Seat Setup Foundation

## Purpose

Campaign Setup is the configuration engine for a Campaign Seat
workspace.

The workspace profile determines:

- campaign identity
- political affiliation
- recommended visual theme
- election dates
- district and jurisdiction
- enabled modules
- onboarding progress
- integration requirements
- team setup
- compliance setup

## Person vs. workspace

A Campaign Seat user is a person.

A Campaign Seat workspace represents the campaign, committee,
organization, or office.

Provider connections belong primarily to the workspace, not to a
person's Campaign Seat profile.

## Theme model

Political party and visual theme are separate values.

Examples:

- Republican → recommended red
- Democratic → recommended blue
- Independent → recommended neutral
- Nonpartisan → recommended neutral

A campaign may later choose custom branding without changing the
stored political affiliation.

## Onboarding flow

1. Campaign identity
2. Election details
3. Branding
4. Security
5. Team
6. Email and contacts
7. Calendar
8. Files
9. Campaign texting
10. Review and activate

## Integration security

`public.workspace_integrations` contains safe connection metadata.

Provider credentials, refresh-token references, or managed-provider
grant references belong in the private server-only schema.

The browser must never receive raw provider secrets.

## Platform administration

Campaign administrators and Campaign Seat platform administrators are
different concepts.

Campaign roles operate inside a workspace.

Campaign Seat platform staff operate the software platform itself.

Platform operations must be audited and should expose operational
metadata by default rather than customer content.

## First workspace creation

Campaign Seat currently uses invitation-only account creation.

That protection should remain in place.

The future self-service Create Campaign flow will use a protected
server function to provision the workspace and generate the first
campaign-owner invitation. The owner's account is then created through
the existing invitation-secured signup path.

## Integration roadmap

1. Setup Wizard
2. Integration Center
3. Secure workspace provisioning
4. Google / Microsoft communications
5. Calendar sync
6. Files integration
7. Texting / compliance
8. Super Admin Control Center
