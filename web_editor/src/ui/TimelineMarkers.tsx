import React, { useMemo, useState } from "react";

export type Marker = { frame: number; label: string };

export type SnapPriority = "closest" | "markers" | "beats";
export type SnapOptions = {
  radiusFrames: number;
  priority: SnapPriority;
  subdivision: number; // 1=beats, 2=half-beat, 4=quarter-beat, etc.
  gridStep: number; // 0 disables; otherwise snaps to multiples of gridStep
};

type Props = {
  frame: number;
  maxFrame: number;
  markers: Marker[];
  onChange: (markers: Marker[]) => void;
  beats?: { frame: number; time: number; strength: number }[];
  snapEnabled: boolean;
  setFrame: (f: number) => void;
  snapOptions?: SnapOptions;
};

function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

function withSubdivisions(beats: { frame: number }[] = [], subdivision: number): { frame: number }[] {
  const sub = Math.max(1, Math.floor(subdivision || 1));
  if (sub === 1 || beats.length < 2) return beats;
  const out: { frame: number }[] = [];
  for (let i = 0; i < beats.length - 1; i++) {
    const a = beats[i].frame;
    const b = beats[i+1].frame;
    out.push({ frame: a });
    const step = (b - a) / sub;
    for (let k = 1; k < sub; k++) {
      out.push({ frame: Math.round(a + step * k) });
    }
  }
  out.push({ frame: beats[beats.length - 1].frame });
  // unique + sort
  const uniq = Array.from(new Set(out.map(o => o.frame))).sort((x,y)=>x-y).map(f => ({frame:f}));
  return uniq;
}

export function nearestSnapFrame(
  frame: number,
  markers: Marker[] = [],
  beats: { frame: number }[] = [],
  maxFrame: number = 0,
  options: SnapOptions = { radiusFrames: 3, priority: "closest", subdivision: 1, gridStep: 0 }
): number {
  const radiusFrames = Math.max(0, Math.floor(options.radiusFrames ?? 3));
  const priority = (options.priority ?? "closest") as SnapPriority;
  const beatSet = withSubdivisions(beats as any, options.subdivision ?? 1);

  // Grid snap candidate
  const gridStep = Math.max(0, Math.floor(options.gridStep ?? 0));
  const gridFrame = gridStep > 0 ? Math.round(frame / gridStep) * gridStep : frame;

  function nearestIn(list: { frame: number }[]) {
    let best = frame;
    let bestD = radiusFrames + 1;
    for (const it of list) {
      const d = Math.abs(it.frame - frame);
      if (d < bestD) { bestD = d; best = it.frame; }
    }
    return { best, bestD };
  }

  const m = nearestIn(markers as any);
  const b = nearestIn(beatSet as any);
  const g = { best: gridFrame, bestD: Math.abs(gridFrame - frame) };

  let picked = frame;
  let d = radiusFrames + 1;

  if (priority === "markers") {
    if (m.bestD <= radiusFrames) { picked = m.best; d = m.bestD; }
    else if (b.bestD <= radiusFrames) { picked = b.best; d = b.bestD; }
    else if (g.bestD <= radiusFrames) { picked = g.best; d = g.bestD; }
  } else if (priority === "beats") {
    if (b.bestD <= radiusFrames) { picked = b.best; d = b.bestD; }
    else if (m.bestD <= radiusFrames) { picked = m.best; d = m.bestD; }
    else if (g.bestD <= radiusFrames) { picked = g.best; d = g.bestD; }
  } else {
    // closest (include grid)
    const cand = [m, b, g].sort((a, b) => a.bestD - b.bestD)[0];
    picked = cand.best; d = cand.bestD;
  }

  picked = clamp(picked, 0, maxFrame);
  return d <= radiusFrames ? picked : frame;
}

export default function TimelineMarkers({ frame, maxFrame, markers, onChange, beats = [], snapEnabled, setFrame, snapOptions }: Props) {
  const sorted = useMemo(() => [...markers].sort((a, b) => a.frame - b.frame), [markers]);
  const [label, setLabel] = useState("cut");

  function add() {
    const next = [...markers, { frame, label: label || "marker" }];
    onChange(next);
  }

  function remove(i: number) {
    const next = sorted.filter((_, idx) => idx !== i);
    onChange(next);
  }

  function seek(f: number) {
    const target = snapEnabled ? nearestSnapFrame(f, sorted, beats, maxFrame, snapOptions ?? { radiusFrames: 3, priority: "closest", subdivision: 1 }) : f;
    setFrame(clamp(target, 0, maxFrame));
  }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Timeline Markers</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>snap: {snapEnabled ? "on" : "off"}</div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label" style={{ flex: 1 }} />
        <button onClick={add}>Add @ frame</button>
      </div>

      <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid #222", borderRadius: 6, padding: 6 }}>
        {sorted.length ? (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.85 }}>
                <th>frame</th><th>label</th><th></th><th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={i} style={{ borderTop: "1px solid #222" }}>
                  <td style={{ padding: "4px 6px" }}>{m.frame}</td>
                  <td style={{ padding: "4px 6px" }}>{m.label}</td>
                  <td style={{ padding: "4px 6px" }}><button onClick={() => seek(m.frame)}>Go</button></td>
                  <td style={{ padding: "4px 6px" }}><button onClick={() => remove(i)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>No markers.</div>
        )}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Markers are stored in <code>timeline.markers</code> and can be used for snapping keyframes and playhead.
      </div>
    </div>
  );
}
