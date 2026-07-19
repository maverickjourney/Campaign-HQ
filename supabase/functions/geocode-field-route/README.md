# geocode-field-route

Leadership-only Campaign HQ Edge Function.

It validates the signed-in user, calls the existing
`is_field_leadership` database helper, loads only route stops
authorized by existing RLS policies, sends missing addresses to
the U.S. Census Geocoder, and saves successful latitude/longitude
matches back to `field_stops`.

Deploy this function in the campaign's Supabase Dashboard under:

Edge Functions -> Deploy a new function -> Via Editor

Function name:

geocode-field-route
