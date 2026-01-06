import React, { useMemo, useState } from "react";

type Key = { t: number; v: number; interp?: string; in_tan?: [number, number] | null; out_tan?: [number, number] | null };

function upsertKey(keys: Key[], k: Key): Key[] {
  const out = [...(keys || [])];
  const idx = out.findIndex(x => x.t === k.t);
  if (idx >= 0) out[idx] = { ...out[idx], ...k };
  else out.push(k);
  out.sort((a,b)=>a.t-b.t);
  return out;
}

export default function LensRigPanel({
  frame,
  onSetLensKey,
}: {
  frame: number;
  onSetLensKey: (channel: string, key: Key) => void;
}) {
  const [focal, setFocal] = useState(35.0);
  const [focus, setFocus] = useState(2.8);
  const [aperture, setAperture] = useState(2.8);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <b>Lens / DOF Rig (v15)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Keyframe lens parameters for cinematic control. These are exported as camera.lens channels.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        <Field label="Focal (mm)" value={focal} step={0.1} onChange={setFocal} />
        <Field label="Focus (m)" value={focus} step={0.05} onChange={setFocus} />
        <Field label="Aperture (f/)" value={aperture} step={0.1} onChange={setAperture} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => onSetLensKey("focal_length_mm", { t: frame, v: focal, interp: "bezier" })}>Set focal key</button>
        <button onClick={() => onSetLensKey("focus_distance_m", { t: frame, v: focus, interp: "bezier" })}>Set focus key</button>
        <button onClick={() => onSetLensKey("aperture_f", { t: frame, v: aperture, interp: "bezier" })}>Set aperture key</button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{label}</div>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}
