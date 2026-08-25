-- Campaign Seat private backend state.
-- These records are accessed through SECURITY DEFINER RPCs /
-- trusted backend processes, never directly by customer clients.

alter table private.seat_product_oauth_states
  enable row level security;

alter table private.seat_product_integration_credentials
  enable row level security;

alter table private.seat_workspace_initial_sync_jobs
  enable row level security;

alter table private.workspace_invitation_deliveries
  enable row level security;
