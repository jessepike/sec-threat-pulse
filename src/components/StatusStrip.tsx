import { fmtClock, fmtDayYear, fmtStamp } from "@/lib/data/format";
import type { DataMode, StatusView } from "@/lib/data/types";

export function SampleBadge() {
  return (
    <span className="rounded-sm border border-warn px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] text-warn-text" title="This page shows made-up sample data, not live results.">
      SAMPLE DATA
    </span>
  );
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 font-mono text-xs tracking-[0.06em] text-muted sm:px-6">
      {children}
    </div>
  );
}

function Live({ mode }: { mode: DataMode }) {
  return (
    <>
      <div className="flex items-center gap-2 text-accent">
        <span className="stp-live inline-block size-2 rounded-full bg-accent" aria-hidden="true" />
        LIVE
      </div>
      {mode === "sample" && <SampleBadge />}
    </>
  );
}

export function HomeStrip({ status }: { status: StatusView }) {
  return (
    <Strip>
      <Live mode={status.mode} />
      <div>LAST RUN {fmtStamp(status.lastRunAt)}</div>
      {status.nextRunAt && <div>NEXT {fmtClock(status.nextRunAt)}</div>}
      <div>{status.runsPerDay}</div>
      {status.sourceCount !== null && <div>{status.sourceCount} SOURCES</div>}
      {status.progress !== null && (
        <div className="h-0.5 min-w-[120px] flex-[1_1_160px] bg-line-soft" role="presentation">
          <div className="h-0.5 bg-accent" style={{ width: `${status.progress}%` }} />
        </div>
      )}
    </Strip>
  );
}

export function EventStrip({ status, updatedAt, trackingSince, sourceCount }: { status: StatusView; updatedAt: string; trackingSince: string; sourceCount: number }) {
  return (
    <Strip>
      <Live mode={status.mode} />
      <div>
        LAST UPDATED <time dateTime={updatedAt}>{fmtStamp(updatedAt)}</time>
      </div>
      <div>
        FIRST SEEN <time dateTime={trackingSince}>{fmtDayYear(trackingSince)}</time>
      </div>
      <div>
        {sourceCount} {sourceCount === 1 ? "SOURCE" : "SOURCES"} ON THIS EVENT
      </div>
    </Strip>
  );
}

export function PlainStrip({ mode, children }: { mode: DataMode; children?: React.ReactNode }) {
  return (
    <Strip>
      <Live mode={mode} />
      {children}
    </Strip>
  );
}
