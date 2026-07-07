import { useMemo, useState } from "react";
import type { DashboardState } from "@mission-control/domain";
import { deriveSceneState } from "./scene-state.js";
import { Facility, webglAvailable } from "./Facility.js";
import { StatusMap2D } from "./StatusMap2D.js";
import { loadPrefs, savePrefs, type DisplayPrefs } from "../prefs.js";

// Facility viewport with accessibility controls (VISUAL_DESIGN §13). The 3D
// scene is never the only source of information: the exact activity panel
// and the 2D fallback carry everything as text.

export function FacilityPanel({ state }: { state: DashboardState }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>(() => loadPrefs());
  const [hasWebgl] = useState(() => webglAvailable());
  const scene = useMemo(() => deriveSceneState(state), [state]);

  function update(next: Partial<DisplayPrefs>) {
    setPrefs((current) => {
      const merged = { ...current, ...next };
      savePrefs(merged);
      return merged;
    });
  }

  const show3d = hasWebgl && !prefs.disable3d;

  return (
    <section className="panel facility-panel" aria-label="Facility view">
      <div className="row" style={{ marginBottom: 8 }}>
        <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
          Facility
        </h2>
        <label className="row muted">
          <input
            type="checkbox"
            checked={prefs.reducedMotion}
            onChange={(e) => update({ reducedMotion: e.target.checked })}
          />
          Reduce motion
        </label>
        <label className="row muted">
          <input
            type="checkbox"
            checked={prefs.disable3d}
            onChange={(e) => update({ disable3d: e.target.checked })}
            disabled={!hasWebgl}
          />
          Disable 3D
        </label>
      </div>
      {show3d ? (
        <div className="facility-viewport" aria-label="3D facility scene">
          <Facility scene={scene} reducedMotion={prefs.reducedMotion} />
        </div>
      ) : (
        <StatusMap2D scene={scene} />
      )}
    </section>
  );
}
