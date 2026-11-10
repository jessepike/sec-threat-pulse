# Lessons

Hot buffer. One line per insight, newest first. Keep the last 15 or so; promote lasting patterns
into AGENTS.md or docs and drop them from here. Read at session start.

## 2026-11-09

- Two crons seven minutes apart never let Neon sleep: its free plan suspends after 5 idle minutes and counts awake time against 100 compute hours a month. Count scheduled database touches per hour, not query cost.
- An issue opened with the owner's own token notifies nobody, because GitHub does not email you about your own actions. Alerts must come from a bot identity.
- Making the repo public did not speed up GitHub's scheduler: the 30-minute freshness probe still ran about every 7 hours (Nov 10: 02:01, 09:40 UTC). Plan around a best-effort schedule.
- A daily schedule on this private repo can be skipped outright, not only delayed (05:23 snapshot and 05:17 agent tests had not fired 7 hours later). Give each daily workflow fallback slots with a skip guard instead of one slot.

## 2026-11-08

- A pull request that adds columns took the live site down for 15 minutes twice (#16, #17): the new build selected the columns before the next cron tick applied the migration. Migrations now run in the Vercel build (`scripts/db-migrate.mjs`, production only) before `next build`, and must stay additive because the old deployment serves until the new one is live.
- The routine's GitHub access cannot dispatch a workflow (403 "Resource not accessible by integration"), so a drill or a manual rerun needs the owner. Squash merges also leave old branches that git cannot prove are merged; check the PR list, not `git branch --merged`.
- GitHub ran none of the new scheduled workflows in the first four hours after they landed on main, and this repo's weekly schedule has fired up to nine hours late. Private repos get low scheduler priority and capped minutes. Do not treat a missing first scheduled run as a workflow bug; use "Run workflow" for a drill.
- A symbol glyph (▲ ◆ ●) in a `next/og` image makes Satori fetch a font for it from Google at request time; on Vercel that call fails with 400 on every share. Keep share images to letters and draw shapes with divs.
- The auto-mode classifier refuses `git push --force-with-lease` and edits that remove a security job, even on a branch only this session uses. Merge the stale remote branch instead of forcing, and gate a job instead of deleting it.

## 2026-11-07

- The live site cannot be reached from the cloud container or the device VM (proxy refuses the host). Fetch it with the Vercel MCP `web_fetch_vercel_url` tool, or build locally with sample data for screenshots.
- A health check that runs inside the cron it watches goes quiet exactly when the cron dies. The probe has to run from another host (GitHub Actions).
- Nothing was committed for 11 days because sessions only start when someone opens one. Autonomy needs a scheduled routine, not a standing rule in AGENTS.md.
- Security Market Pulse's own blind score found stale and mislabeled figures that reviewers had passed. Freshness and label checks belong in the build, not in review.
- [withheld:2026-11-07] gitleaks-action on a pull_request event needs `pull-requests: read` on its job; with only `contents: read` it dies with a 403 before scanning, which looks like a leak finding but is not.
- [withheld:2026-11-07] db.test.ts fixtures are dated October 2026 and the home page filters on the last 30 days from Date.now(), so the suite expired on Nov 2 with no code change. Pin the clock with vi.useFakeTimers({ toFake: ['Date'] }) in any test that mixes fixed dates with a rolling window.
- Vercel sent no GitHub `deployment_status` event for this repo (the deployments list is empty), so a workflow on that trigger never ran. `repository_dispatch` with type `vercel.deployment.success` did not arrive either. The commit status named `Vercel` does, so trigger on `status`. Check that a new workflow actually ran once before calling it done.
- A source that needs a key and has none must cost nothing per run and must not be credited on the site. Check `requiresEnv` before any database write, and show its credit only when `isConfigured` says it is read.
