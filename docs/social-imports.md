# Social post imports

## Provider prerequisites and limitations

Imports accept only canonical public post URLs on `www.tiktok.com` and canonical public post/reel URLs on `www.instagram.com`. Short links, stories, profile pages, query strings, and other hosts are unsupported. TikTok uses its public oEmbed endpoint. Instagram uses Meta's Instagram oEmbed endpoint and requires `INSTAGRAM_ACCESS_TOKEN` for an approved Meta application with the permissions required by Meta at deployment time. Operators must verify that provider approval, terms, quotas, and available fields remain suitable.

Private, deleted, age/region-restricted, or unavailable posts cannot be imported. Embed APIs expose less data than first-party applications, so visible locations may be absent. The API reports `private_post`, `unsupported_link`, `metadata_unavailable`, `rate_limited`, or `no_location_detected`.

Nominatim geocodes phrases using the centroid of existing trip points. Deployments must follow the current OpenStreetMap Foundation usage policy or use a compliant hosted instance; the public service is unsuitable for high volume.

## Security and retention

The route uses an explicit host/path allowlist. Fixed platform adapters—not a user-selectable fetch endpoint—make outbound requests. Every redirect is allowlisted and DNS-resolved; private, loopback, link-local, reserved, multicast, and unique-local addresses are blocked. Requests have an eight-second timeout, three redirects, and a 256 KB limit.

Raw responses, embed HTML, media, comments, avatars, and tokens are not retained. Records keep only the canonical URL, platform, state, actionable failure, and candidate name, address, coordinates, confidence, and short evidence. Candidates are deleted after confirmation. Terminal records should follow a short-lived audit retention schedule; 30 days is the recommended maximum.

## Consent and confirmation

Submitting a URL explicitly requests sending that public URL to its platform embed API and geocoding location phrases. Clients must disclose this before submission. Imports never create points automatically: `needs_confirmation` presents ranked evidence and map positions, and the user must select a candidate or submit edited name, address, and coordinates. Confirmation creates one point and removes candidates.
