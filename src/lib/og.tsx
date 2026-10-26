import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

const BG = "#0a0e13";
const SURFACE = "#111820";
const LINE = "#3a4a5c";
const FG = "#e8eef4";
const MUTED = "#9fb0c0";
const ACCENT = "#5eb8ff";

type State = "confirmed" | "reported" | "none";

function Bar({ state }: { state: State }) {
  const style =
    state === "confirmed"
      ? { background: ACCENT, border: `2px solid ${ACCENT}` }
      : state === "reported"
        ? { background: `repeating-linear-gradient(135deg, ${ACCENT} 0px, ${ACCENT} 3px, transparent 3px, transparent 8px)`, border: `2px solid ${ACCENT}` }
        : { background: "transparent", border: `2px solid ${LINE}` };
  return <div style={{ display: "flex", flex: 1, height: 36, ...style }} />;
}

const VERDICT: Record<string, { label: string; color: string }> = {
  act_now: { label: "▲ ACT NOW", color: "#ff6b5e" },
  watch: { label: "◆ WATCH", color: "#f5b942" },
  low: { label: "● LOW", color: "#7fd18b" },
};

export interface OgEvent {
  title: string;
  verdict: string;
  ids: string;
  states: State[];
}

/** Share image for one event: its plain title, verdict and real evidence ladder. */
export function renderEventOgImage(e: OgEvent): ImageResponse {
  const v = VERDICT[e.verdict] ?? VERDICT.low;
  const title = e.title.length > 110 ? `${e.title.slice(0, 107).replace(/\s+\S*$/, "")}…` : e.title;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: BG, color: FG, padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 5, color: MUTED, fontWeight: 700 }}>SECURITY_THREAT_PULSE</div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 3, color: v.color, border: `2px solid ${v.color}`, padding: "8px 18px" }}>{v.label}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 2, color: MUTED }}>{e.ids}</div>
          <div style={{ display: "flex", fontSize: title.length > 60 ? 56 : 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 1070 }}>{title}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, background: SURFACE, border: `1px solid ${LINE}`, padding: "22px 28px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {e.states.map((s, i) => (
              <Bar key={i} state={s} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 22, letterSpacing: 3, color: MUTED }}>
            {["TALK", "EXPOSED", "TRIED", "EXPLOITED", "DAMAGE"].map((l) => (
              <div key={l} style={{ display: "flex", flex: 1 }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}

/** The 1200 by 630 share image: dark theme, name, tagline and a sample evidence ladder. */
export function renderOgImage(): ImageResponse {
  const states: State[] = ["confirmed", "confirmed", "confirmed", "reported", "none"];
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: BG, color: FG, padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 28 28">
            <rect x="0.5" y="0.5" width="27" height="27" rx="4" fill="none" stroke={LINE} />
            <path d="M4 14h5l2.5-6 5 12 2.5-6h5" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 5, color: MUTED, fontWeight: 700 }}>SECURITY_THREAT_PULSE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>{SITE_NAME}</div>
          <div style={{ display: "flex", fontSize: 40, lineHeight: 1.3, color: MUTED, maxWidth: 980 }}>{SITE_TAGLINE}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, background: SURFACE, border: `1px solid ${LINE}`, padding: "22px 28px" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {states.map((s, i) => (
              <Bar key={i} state={s} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 22, letterSpacing: 3, color: MUTED }}>
            {["TALK", "EXPOSED", "TRIED", "EXPLOITED", "DAMAGE"].map((l) => (
              <div key={l} style={{ display: "flex", flex: 1 }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
