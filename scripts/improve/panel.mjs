// Reads the review panel's approval from pull request comments. Pure, unit tested
// (src/lib/improve/panel.test.ts). A protected file: changing it needs the tier 2 panel.
//
// The loop posts one comment per approved head commit, with every reviewer's verdict and the marker
//   <!-- improve-panel: sha=<full head sha> tier=<0|1|2|rules> -->
// Only comments from the repository owner's account count (the loop runs as that account), so
// nobody else can approve by commenting on the public repo. An approval covers one commit and its
// tier or a lower one: a new push, or a change that grows into a higher tier, needs a new approval.

const RANK = { 0: 0, 1: 1, 2: 2, rules: 3 };
const MARKER = /<!--\s*improve-panel:\s*sha=([0-9a-f]{40})\s+tier=(0|1|2|rules)\s*-->/;

/**
 * @param {{ body?: string | null, author_association?: string }[]} comments  issue comments on the pull request
 * @param {string} sha  the pull request's current head commit
 * @param {0 | 1 | 2 | "rules"} tier  the tier the change needs
 */
export function panelApproves(comments, sha, tier) {
  return comments.some((c) => {
    if (c.author_association !== "OWNER") return false;
    const m = MARKER.exec(c.body ?? "");
    if (!m || m[1] !== sha) return false;
    const approved = m[2] === "rules" ? "rules" : Number(m[2]);
    return RANK[approved] >= RANK[tier];
  });
}
