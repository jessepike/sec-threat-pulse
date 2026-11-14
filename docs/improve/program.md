# Improve loop

A scheduled Claude Code session runs this on Monday, Wednesday and Friday at 9:47 AM Pacific, after
the daily routine (`docs/routine.md`). The daily routine keeps the site running. This loop makes it
better: one measured change per run, kept only if the scorecard says it helped. The owner approved
it on Nov 14, 2026 ("go ahead and build this all the way out"): every change is a pull request
that merges itself once checks and the review panel pass. Design: the Claude Doc "STP
self-improvement loop: design".

The scheduled task's prompt is one line: read this file and follow it. Change the loop here, and
only through a tier 2 pull request.

## Lane

**Coverage first** (owner, Nov 14). More keyless sources and fewer untracked rungs, judged by
what they do to accuracy and lead time. Next lanes, in order, once coverage runs dry: accuracy,
UX, growth. Changing the lane needs the owner.

## Dry runs first

The first two runs are dry runs: they go through step 6, then write what they would ship (item,
tier, target metric, before and after) as a ledger row marked `dry`, and stop. Real runs start once
the ledger holds two `dry` rows.

## Each run

1. **Orient.** Read `AGENTS.md`, `status.md`, `lessons.md`, `BACKLOG.md`, this file, the last 10
   rows of `docs/improve/ledger.md` and `docs/improve/ideas.md`. Stop at once, saying why in the
   ledger, if `docs/improve/PAUSE` exists, an issue labeled `alert` is open, another `improve/` pull
   request is open, or the last three ledger rows are all discards (then ask the owner instead).
2. **Measure.** `git fetch origin data`, then
   `git show origin/data:improve/live.json > /tmp/live.json` (skip `--live` if it is missing or over
   48 hours old, and say so) and
   `npm run scorecard -- --live /tmp/live.json --out /tmp/before.json`.
3. **Recheck.** For each kept row from 6 to 8 days ago, compare its target metric now with its
   "after" value. If the gain is gone, the run's change is a revert of that pull request.
4. **Pick.** Candidates: open `feedback` issues the daily routine left open as too large, unticked
   `BACKLOG.md` items, scorecard gaps, `docs/improve/ideas.md`. Score each in the lane as expected
   gain (in the target metric's units, over its noise band) x confidence (0.2 to 1) / effort (1 to
   5 runs). Take the top one that fits one run. Skip anything that needs a key, a paid service, an
   email or form sent outside, or the owner's judgment, and park it in `ideas.md` with why. Nothing
   scores above 0.5: do nothing, write a ledger row, stop.
5. **Build.** Branch `improve/<YYYY-MM-DD>-<slug>` from `origin/main`. Write the acceptance
   criteria into the pull request body before the code. Under 400 changed lines. Additive
   migrations only. A new source: check its terms in `docs/source-registry.md`, send the STP
   User-Agent, add a fixture test, remove the rung from `UNTRACKED_RUNGS` in the same pull request
   if it fills one. Never edit the protected files (the scorecard, `scripts/improve/`,
   `src/lib/improve/`, this file, the backtest harness and dataset) in a run whose target metric
   they compute.
6. **Verify.** `npm test`, `npm run lint`, `npm run typecheck`. Rerun the scorecard to
   `/tmp/after.json`, then `node scripts/improve/keep.mjs /tmp/before.json /tmp/after.json --target <id>`.
   DISCARD: close the branch, write the ledger row, stop. A metric that only moves live (a new
   source's `live.sourcesOk`) is judged at the 7 day recheck; at build time the rule is "nothing
   regresses" (`--target none`) plus the fixture test. Page changes: screenshots at 1440px and 390px.
7. **Review panel.** Open the pull request with the before and after numbers. Classify it with the
   tier the `improve-gate` check prints (`scripts/improve/tier.mjs`), then:
   - **Tier 0:** Codex review, checks green.
   - **Tier 1:** Codex, plus one Claude reviewer started with the Agent tool on a different model
     from this session (`model: "sonnet"`), given only the diff, the acceptance criteria and
     `AGENTS.md`, never this session's reasoning. Both approve.
   - **Tier 2:** Codex, plus two Claude reviewers that never see each other's answer: one on
     `sonnet` reviewing the diff, one on `opus` told to find the strongest reason to reject and to
     rerun the tests and scorecard itself. All approve. Gemini Code Assist joins as a fourth once
     the owner installs it.
   - **Rules:** the tier 2 panel, plus a held-out backtest reveal (logged, as `decisions.md`
     requires) that beats the active version with intervals that do not overlap the old figure.
     Then add the `rules-notice` label and tell the owner in one message; it merges after 48
     hours unless the owner objects. After 48 hours, remove and add the `panel-approved` label to re-run
     the check (never remove `rules-notice`: that restarts the clock).
   - **Owner tier:** never on an improve branch.
   Codex findings marked P1 or P2 block until fixed. A reviewer that rejects: fix once and ask
   again; a second reject parks the item for the owner. When every reviewer approves, post one
   comment listing each reviewer's verdict and ending with
   `<!-- improve-panel: sha=<full head sha> tier=<tier> -->`. Then add the `panel-approved` label,
   which only re-runs the `improve-gate` check; the comment is the approval. Any later commit needs
   the panel again, a new comment for its sha, and the label removed and added again.
8. **Merge.** Squash merge once every check is green. The smoke test runs after the deploy and
   opens an alert if it fails; if it does, revert at once.
9. **Record.** One ledger row (kept, discarded or none, with the metric before and after and each
   reviewer's verdict), one line in `status.md`, ticks in `BACKLOG.md`, one line in `lessons.md`
   if something surprised you. These ride in the same pull request when there is one.
10. **Report.** One short message: what changed and the number that moved, or why nothing did.

## Never

- Change what the scorecard measures in the same run that is judged by it.
- Reveal held-out backtest results outside the rules tier.
- Add keys, paid services, emails, forms or anything sent outside the project.
- Edit `intent.md`, `docs/policy-claims-and-takedown.md` or `docs/improve/PAUSE`.
- Remove or restore content about a named organization.
- Skip, delete or weaken a test to get a green check.
- Plain language in anything a reader sees. No em dashes.

## The owner's off switch

Add a file named `docs/improve/PAUSE` to `main` (any content, one GitHub edit). Every run stops at
step 1 and the `improve-gate` check fails every improve pull request until it is removed.
