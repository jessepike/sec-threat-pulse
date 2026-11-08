import { Eyebrow, H2 } from "./ui";

type Week = { week: string; count: number; partial: boolean };

const short = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * One live chart: CISA KEV additions per week, last 12 weeks. A single series, so no legend: the
 * title names it. Labels only on the peak and the current week; every bar has a hover and focus
 * tooltip, and the numbers are in a table below.
 */
export function KevWeeks({ weeks }: { weeks: Week[] }) {
  if (!weeks.length) return null;
  const max = Math.max(1, ...weeks.map((w) => w.count));
  const peak = weeks.reduce((a, w, i) => (w.count > weeks[a].count ? i : a), 0);
  const full = weeks.filter((w) => !w.partial);
  const avg = full.length ? full.reduce((n, w) => n + w.count, 0) / full.length : 0;
  const last = weeks.at(-1)!;
  return (
    <section aria-labelledby="kev-weeks" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Eyebrow>{"// LIVE · CISA KEV"}</Eyebrow>
        <H2 id="kev-weeks">Flaws newly confirmed as exploited, per week</H2>
        <p className="m-0 max-w-[720px] text-base leading-[1.6] text-fg-2">
          Each bar counts the flaws CISA added to its Known Exploited Vulnerabilities catalog that week. Over the last {full.length} full weeks the average was {avg.toFixed(1)} a week.
          {last.partial ? ` This week so far: ${last.count}.` : ""}
        </p>
      </div>
      <figure className="m-0 flex flex-col gap-3 rounded border border-line bg-surface p-5 sm:p-7">
        <div className="relative flex h-[180px] items-end gap-[2px] border-b border-line-strong sm:gap-1" role="img" aria-label={`Weekly CISA KEV additions, ${short(weeks[0].week)} to ${short(last.week)}: ${weeks.map((w) => w.count).join(", ")}.`}>
          {weeks.map((w, i) => {
            const h = (w.count / max) * 100;
            const label = i === peak || i === weeks.length - 1;
            const tip = `Week of ${short(w.week)}${w.partial ? " (so far)" : ""}: ${w.count} added`;
            return (
              <div key={w.week} tabIndex={0} aria-label={tip} className="group relative flex h-full flex-1 flex-col justify-end outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {label && <span className="mb-1 text-center font-mono text-xs font-bold text-fg">{w.count}</span>}
                <div
                  className={`mx-auto w-full max-w-[44px] rounded-t-[4px] ${w.partial ? "bg-accent/50" : "bg-accent"} group-hover:bg-accent-hover group-focus-visible:bg-accent-hover`}
                  style={{ height: `${Math.max(h, w.count ? 2 : 0)}%` }}
                />
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line-strong bg-bg px-2.5 py-1.5 font-mono text-xs text-fg shadow group-hover:block group-focus-visible:block"
                >
                  {tip}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between font-mono text-[11px] tracking-[0.06em] text-muted">
          <span>WEEK OF {short(weeks[0].week).toUpperCase()}</span>
          <span>{last.partial ? "THIS WEEK, SO FAR" : `WEEK OF ${short(last.week).toUpperCase()}`}</span>
        </div>
        <details className="font-mono text-xs text-muted">
          <summary className="cursor-pointer py-1">SHOW AS TABLE</summary>
          <table className="mt-2 w-full max-w-[360px] border-collapse text-left text-[13px] text-fg-2">
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1 font-normal">Week of</th>
                <th scope="col" className="py-1 text-right font-normal">Added</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week} className="border-t border-line-soft">
                  <td className="py-1">{short(w.week)}{w.partial ? " (so far)" : ""}</td>
                  <td className="py-1 text-right tabular-nums">{w.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <div className="font-mono text-xs text-faint">
          SRC:{" "}
          <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener noreferrer" className="text-faint underline decoration-line-strong underline-offset-2 hover:text-fg">
            CISA KEV catalog
          </a>
          , date added. Updated every run.
        </div>
      </figure>
    </section>
  );
}
