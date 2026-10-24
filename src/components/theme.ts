export const THEME_COOKIE = "stp-theme";
export const THEMES = ["dark", "grey"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(v: string | undefined | null): Theme {
  return v === "grey" ? "grey" : "dark";
}
