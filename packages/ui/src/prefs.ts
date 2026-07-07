// Presentation preferences (VISUAL_DESIGN §13). Persisted best-effort in
// localStorage — sandboxed iframes may deny storage, in which case the
// toggles still work for the session.

export interface DisplayPrefs {
  reducedMotion: boolean;
  disable3d: boolean;
}

const KEY = "cmc-display-prefs";

export function loadPrefs(): DisplayPrefs {
  const systemReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const defaults: DisplayPrefs = { reducedMotion: systemReduced, disable3d: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return defaults;
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>;
    return {
      reducedMotion:
        typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : defaults.reducedMotion,
      disable3d: typeof parsed.disable3d === "boolean" ? parsed.disable3d : defaults.disable3d,
    };
  } catch {
    return defaults;
  }
}

export function savePrefs(prefs: DisplayPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage denied in this sandbox; session-only prefs are fine.
  }
}
