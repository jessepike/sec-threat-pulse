"use client";

import { useState } from "react";
import { THEME_COOKIE, type Theme } from "./theme";

function applyTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function pick(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  const btn = (t: Theme, label: string) => (
    <button
      type="button"
      onClick={() => pick(t)}
      aria-pressed={theme === t}
      className={`min-h-9 cursor-pointer rounded-sm border px-3 font-mono text-xs tracking-[0.08em] ${
        theme === t ? "border-accent bg-surface text-fg" : "border-line-strong bg-transparent text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="Color theme" className="flex items-center gap-2">
      <span className="font-mono text-xs tracking-[0.08em] text-faint">THEME</span>
      {btn("dark", "DARK")}
      {btn("grey", "GREY")}
    </div>
  );
}
