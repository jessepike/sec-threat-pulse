export const REPO = "jessepike/sec-threat-pulse";

export interface GhIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  createdAt: string;
}

const headers = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "SecurityThreatPulse-admin",
});

export async function listIssues(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; issues: GhIssue[] } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`, {
      headers: headers(token),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `GitHub answered ${res.status}.` };
    const data = (await res.json()) as Array<{
      number: number;
      title: string;
      html_url: string;
      created_at: string;
      pull_request?: unknown;
      labels: Array<string | { name?: string }>;
    }>;
    return {
      ok: true,
      issues: data
        .filter((i) => !i.pull_request)
        .map((i) => ({
          number: i.number,
          title: i.title,
          url: i.html_url,
          createdAt: i.created_at,
          labels: i.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean),
        })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed." };
  }
}

export async function createIssue(
  token: string,
  input: { title: string; body: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${REPO}/issues`, {
      method: "POST",
      headers: { ...headers(token), "content-type": "application/json" },
      body: JSON.stringify({ title: input.title, body: input.body, labels: ["idea"] }),
    });
    if (!res.ok) return { ok: false, error: `GitHub answered ${res.status}.` };
    const data = (await res.json()) as { html_url: string };
    return { ok: true, url: data.html_url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed." };
  }
}
