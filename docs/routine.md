# Daily routine

A scheduled Claude Code session runs this once a day (4:23 AM Pacific, after the nightly snapshot)
in the project's cloud environment. It is the autonomy layer from the Nov 7 plan: nothing waits for
someone to open a session. The owner approved it on Nov 7, 2026 ("Yes to open questions 2&3"): the
routine may merge its own pull requests once checks pass. Only a new rules version waits for the owner.

The scheduled task's prompt is one line: read this file and follow it. Change the routine here.

## Each run

1. **Orient.** Read `AGENTS.md`, `status.md`, `lessons.md` and `BACKLOG.md`. Start the branch
   `routine/<YYYY-MM-DD>` from `origin/main`.
2. **Owner feedback first.** List open issues labeled `feedback`. For each: make the small, clear
   change, reply on the issue with the commit and page, close it. Anything large or ambiguous gets a
   recommendation and stays open.
3. **Alerts.** List open issues labeled `alert`. Read `/status.json` on the live site. For each alert,
   find the cause (admin runs page, adapter code, source terms), fix it on the branch, reply on the
   issue. The outside probe opens and closes every alert from `/status.json`. Never close one by hand
   unless the source was retired on purpose. An alert titled "[alert] Agent test set: ..." comes from the
   nightly 30 questions (`npm run agent-tests`); its table names the failing question and the value seen.
4. **Freshness.** If `/status.json` says `delayed` or `down` and no alert exists, open one labeled
   `alert` and treat it as the day's first job.
5. **Dependencies.** Open Dependabot pull requests: merge patch and minor bumps once CI is green. Hold
   major bumps that the backlog lists as held (TypeScript 7, ESLint 10, `@types/node` above the runtime)
   and any bump that fails CI; say why on the pull request.
6. **Health of the record.** Confirm the nightly snapshot workflow committed to the `data` branch in
   the last 36 hours, the freshness probe ran in the last hour and the agent test set ran last night. If
   any did not, fix the workflow.
7. **Ship.** Run `npm test`, `npm run lint`, `npm run typecheck`. For any page change, render at
   1440px and 390px and attach both screenshots to the pull request. Open the pull request, wait for
   checks, merge with squash. The smoke test runs by itself after each production deployment and
   opens an alert if it fails; confirm it passed. Put the day's work in one pull request: each merge
   is a production build.
8. **Record.** Update `status.md` (date, what changed, what is next). Add one line to `lessons.md`
   when something surprised you. Tick the matching boxes in `BACKLOG.md`.
9. **Report.** Say in one short message what changed, what is open, and what needs the owner. If
   nothing changed and nothing is open, say nothing.

## Rules the routine never breaks

- No new rules version, no change to verdict logic, no edit to `intent.md` without the owner.
- No new API keys. No secrets in the repo.
- Never remove or restore content about a named organization on its own; legal demands go to Jesse.
- Plain language in anything a reader sees. No em dashes.
- A failed step never blocks the rest: record it and carry on.
