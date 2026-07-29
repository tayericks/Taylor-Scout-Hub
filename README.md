# Taylor Scout Hub v2

A show-first hub that uses the same Supabase login and show records as Scout Route.

## Included in v2
- Prep / Wrap Calendar card
- Scout Route card
- Location List placeholder card
- Budget card
- Location Bible card
- Waypoint placeholder card
- Searchable wide show list
- Cleaner show dashboard
- Team & Permissions prototype screen
- Role templates and tool/scope permission planning
- Show ID and show name passed to connected tools in the URL
- No SQL migration and no changes to existing Scout Route data

## Environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CALENDAR_URL=https://calendar.taylorscout.com`
- `VITE_SCOUT_ROUTE_URL=https://app.taylorscout.com`
- `VITE_LOCATION_LIST_URL=`
- `VITE_BUDGET_URL=https://budget.taylorscout.com`
- `VITE_BIBLE_URL=https://bible.taylorscout.com`
- `VITE_WAYPOINT_URL=`

The Location List and Waypoint cards stay disabled until their URLs are supplied.

## Important permissions note
The Team & Permissions screen in this version is a UI prototype and saves locally in the browser. It does not change live Supabase permissions yet. Database-level permissions will require additive shared tables and row-level security policies.

## Deploy
Upload these files over the existing Hub repository root. Do not upload `node_modules`, `dist`, `.env`, or `.DS_Store`. Vercel will rebuild automatically.


## Update 4.0.0
- Unified Taylor Scout logo and dashboard navigation.
- Interface and print refinements requested July 29, 2026.


Build: v5
