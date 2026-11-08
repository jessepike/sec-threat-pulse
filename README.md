# Security Threat Pulse: data snapshot

Taken 2026-11-08T12:00:33.272Z from https://securitythreatpulse.com. Rebuilt every night by `.github/workflows/snapshot.yml` on the `main` branch.

- `events.json`: every visible event as the API lists it (112 events), with the rules version and the license.
- `events/<id>.json`: one file per event with its dated, linked evidence, as `/api/v1/events/<id>` serves it.
- `status.json`: the site's health report at snapshot time (last complete run, last attempt, per-source health).
- `manifest.json`: SHA-256 and size of every file, so a copy can be checked.

License: STP's own fields are CC BY 4.0; attribute as "Security Threat Pulse, https://securitythreatpulse.com".
Evidence items stay under their source's terms. Sources that do not allow re-serving are not here. Not advice.
