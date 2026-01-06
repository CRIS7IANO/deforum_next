import React from "react";
import { SnapOptions, SnapPriority } from "./TimelineMarkers";

type Props = {
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  snapOptions: SnapOptions;
  setSnapOptions: (v: SnapOptions) => void;
};

export default function SnapSettings({ snapEnabled, setSnapEnabled, snapOptions, setSnapOptions }: Props) {
  const radiusFrames = snapOptions.radiusFrames ?? 3;
  const priority = (snapOptions.priority ?? "closest") as SnapPriority;
  const subdivision = snapOptions.subdivision ?? 1;
  const gridStep = snapOptions.gridStep ?? 0;

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Snap Settings</div>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          <input type="checkbox" checked={snapEnabled} onChange={(e)=>setSnapEnabled(e.target.checked)} /> Enable
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>Snap radius (frames)</div>
        <input type="number" value={radiusFrames} min={0} max={60} onChange={(e)=>setSnapOptions({ ...snapOptions, radiusFrames: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)) })} />

        <div style={{ fontSize: 12, opacity: 0.85 }}>Priority</div>
        <select value={priority} onChange={(e)=>setSnapOptions({ ...snapOptions, priority: e.target.value as any })}>
          <option value="closest">Closest</option>
          <option value="markers">Markers first</option>
          <option value="beats">Beats first</option>
        </select>

        <div style={{ fontSize: 12, opacity: 0.85 }}>Grid step (frames)</div>
        <input type="number" value={gridStep} min={0} max={240} onChange={(e)=>setSnapOptions({ ...snapOptions, gridStep: Math.max(0, Math.min(240, parseInt(e.target.value, 10) || 0)) })} />

        <div style={{ fontSize: 12, opacity: 0.85 }}>Beat subdivision</div>
        <select value={subdivision} onChange={(e)=>setSnapOptions({ ...snapOptions, subdivision: parseInt(e.target.value, 10) || 1 })}>
          <option value={1}>1 (beat)</option>
          <option value={2}>2 (half-beat)</option>
          <option value={4}>4 (quarter-beat)</option>
          <option value={8}>8 (eighth)</option>
        </select>
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Snapping affects the playhead, marker seeks, and keyframe dragging when enabled.
      </div>
    </div>
  );
}
