# Google Maps setup

Create separate Google Cloud credentials for browser and server traffic. Do not
reuse one key for both trust boundaries.

## Browser credential

1. Enable **Maps JavaScript API** and **Places API (New)** in the production
   Google Cloud project.
2. Create a browser key and apply **Websites** application restrictions. Add
   each exact production origin and the development origins the team uses (for
   example `https://planner.example.com/*` and `http://localhost:3000/*`). Do
   not use a wildcard that permits unrelated subdomains.
3. Apply API restrictions for Maps JavaScript API and Places API (New).
4. Set the restricted key as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the browser
   build environment.
5. Create a Google Map ID for the JavaScript vector map, restrict its use to
   the intended project, and set it as `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.

Values prefixed with `NEXT_PUBLIC_` are intentionally shipped to browsers. The
referrer and API restrictions, quota alerts, and separate project permissions
are the security boundary—not secrecy of the browser key.

## Server credential

If a server-side Google API is added, store its credential only as
`GOOGLE_MAPS_SERVER_API_KEY`. Restrict it to the individual server APIs and to
the deployment's static egress IP addresses where that API supports IP
restrictions. Never pass it to a Client Component, API response, log, or a
`NEXT_PUBLIC_` variable.

## Operations and data handling

- Configure quota alerts and billing budgets separately for browser and server
  credentials so a failure is attributable to one trust boundary.
- Preserve each Google Place ID. Store trip notes, custom category, duration,
  visit status, ordering, and social source independently from Google-managed
  display data.
- Request only fields rendered by the details panel. Refresh Google-managed
  data from the Place ID when it is stale or before a time-sensitive decision;
  do not treat cached hours, ratings, or contact details as permanent.
- Keep the Google attribution shown by Maps and Places. Do not obscure it with
  sheets or controls, and follow the current Google Maps Platform Terms for
  caching, attribution, and displaying Places content.
