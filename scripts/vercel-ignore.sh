#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand). Exit 0 skips the build, exit 1 builds.
#
# Production always builds. A preview is skipped when it cannot change what a reviewer would look at:
#   - Dependabot branches (CI already builds and tests them);
#   - commits that touch only docs, agent notes, workflows, reports or tests.
# Builds are the largest line on the Vercel bill; Nov 8, 2026 had 37 preview builds in one day.
set -u

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "Production: build."
  exit 1
fi

case "${VERCEL_GIT_COMMIT_REF:-}" in
  dependabot/*)
    echo "Dependabot branch: skip the preview."
    exit 0
    ;;
esac
if [ "${VERCEL_GIT_COMMIT_AUTHOR_LOGIN:-}" = "dependabot[bot]" ]; then
  echo "Dependabot commit: skip the preview."
  exit 0
fi

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  base="HEAD^"
fi
if ! changed=$(git diff --name-only "$base" HEAD 2>/dev/null); then
  echo "Cannot read the change: build."
  exit 1
fi
if [ -z "$changed" ]; then
  echo "No file changes found: build."
  exit 1
fi

# The methodology page renders this file, so a reviewer needs the preview.
if printf '%s\n' "$changed" | grep -qx 'docs/methodology-rules.md'; then
  echo "Methodology text changed: build."
  exit 1
fi

# Anything outside this list builds.
needs_build=$(printf '%s\n' "$changed" | grep -Ev '^(docs/|reports/|data/|\.github/|[^/]+\.md$|LICENSE$|\.gitignore$|src/.*\.test\.tsx?$|src/lib/ingest/__fixtures__/|scripts/(ops|backtest)/|scripts/(smoke|agent-tests)\.mjs$)' || true)
if [ -z "$needs_build" ]; then
  echo "Only docs, workflows, reports, tests or ops scripts changed: skip the preview."
  exit 0
fi
echo "Site files changed: build."
exit 1
