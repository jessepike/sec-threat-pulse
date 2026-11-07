# Lessons

Hot buffer. One line per insight, newest first. Keep the last 15 or so; promote lasting patterns
into AGENTS.md or docs and drop them from here. Read at session start.

## 2026-11-07

- The live site cannot be reached from the cloud container or the device VM (proxy refuses the host). Fetch it with the Vercel MCP `web_fetch_vercel_url` tool, or build locally with sample data for screenshots.
- A health check that runs inside the cron it watches goes quiet exactly when the cron dies. The probe has to run from another host (GitHub Actions).
- Nothing was committed for 11 days because sessions only start when someone opens one. Autonomy needs a scheduled routine, not a standing rule in AGENTS.md.
- Security Market Pulse's own blind score found stale and mislabeled figures that reviewers had passed. Freshness and label checks belong in the build, not in review.
- [withheld:2026-11-07] gitleaks-action on a pull_request event needs `pull-requests: read` on its job; with only `contents: read` it dies with a 403 before scanning, which looks like a leak finding but is not.
- [withheld:2026-11-07] db.test.ts fixtures are dated October 2026 and the home page filters on the last 30 days from Date.now(), so the suite expired on Nov 2 with no code change. Pin the clock with vi.useFakeTimers({ toFake: ['Date'] }) in any test that mixes fixed dates with a rolling window.
