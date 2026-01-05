import React, { useMemo, useState } from "react";

export type Marker = { frame: number; label: string };

type Props = {
  frame: number;
  maxFrame: number;
  markers: Marker[];
  onChange: (markers: Marker[]) => void;
  beats?: { frame: number; time: number; strength: number }[];
  snapEnabled: boolean;
  setFrame: (f: number) => void;
};

function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

export function nearestSnapFrame(frame: number, markers: Marker[], beats: {frame:number}[] = [], maxFrame: number = 0, radiusFrames: number = 3): number {
  let best = frame;
  let bestD = radiusFrames + 1;
  for (const m of markers) {
    const d = Math.abs(m.frame - frame);
    if (d < bestD) { bestD = d; best = m.frame; }
  }
  for (const b of beats) {
    const d = Math.abs(b.frame - frame);
    if (d < bestD) { bestD = d; best = b.frame; }
  }
  best = clamp(best, 0, maxFrame);
  return bestD <= radiusFrames ? best : frame;
}

export default function TimelineMarkers({ frame, maxFrame, markers, onChange, beats = [], snapEnabled, setFrame }: Props) {
  const [label, setLabel] = useState("marker");
  const sorted = useMemo(() => [...markers].sort((a,b)=>a.frame-b.frame), [markers]);

  function add() {
    const next = [...markers, { frame: clamp(frame, 0, maxFrame), label: label || "marker" }];
    onChange(next);
  }

  function remove(i: number) {
    const next = sorted.filter((_, idx) => idx !== i);
    onChange(next);
  }

  function seek(f: number) {
    const target = snapEnabled ? nearestSnapFrame(f, sorted, beats, maxFrame, 3) : f;
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
                <tr key={i}>
                  <td>{m.frame}</td>
                  <td>{m.label}</td>
                  <td><button onClick={() => seek(m.frame)}>go</button></td>
                  <td><button onClick={() => remove(i)}>del</button></td>
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
