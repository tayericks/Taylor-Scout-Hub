# Taylor Scout Hub v1

A show-first hub that uses the same Supabase login and show records as Scout Route.

## What this version does
- Email/password login through the existing Scout Route Supabase project
- Lists the same accessible shows through `list_accessible_shows`
- Opens a show dashboard first
- Provides connected cards for Scout Route, Budget, Waypoint, and Location Bible
- Does not change, migrate, overwrite, or delete any saved Scout Route data
- Requires no SQL migration

## Deploy safely
1. Create a new GitHub repository for this hub. Do **not** upload it over the Scout Route repository.
2. Import the new repository into Vercel as a separate project.
3. Add these environment variables using the same Supabase project as Scout Route:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SCOUT_ROUTE_URL=https://app.taylorscout.com`
   - `VITE_BUDGET_URL=` (add after Budget is deployed)
   - `VITE_WAYPOINT_URL=` (add after Waypoint is deployed)
   - `VITE_BIBLE_URL=` (leave blank for the placeholder)
4. Add `taylorscout.com` as the custom domain for this new Vercel project.
5. Keep `app.taylorscout.com` attached to the existing Scout Route Vercel project.

## Domain layout
- `taylorscout.com` — Taylor Scout Hub
- `app.taylorscout.com` — Scout Route
- `budget.taylorscout.com` — Budget app later
- `waypoint.taylorscout.com` — Waypoint later

## Local use
```bash
npm install
cp .env.example .env
npm run dev
```
