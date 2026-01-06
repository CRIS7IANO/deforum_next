import React from "react";

type CameraConstraints = {
  enabled?: boolean;
  max_speed_pos?: number;
  max_accel_pos?: number;
  max_speed_target?: number;
  max_accel_target?: number;
  max_speed_roll_deg?: number;
  max_speed_focal_mm?: number;
  smoothing_window?: number;
  sample_step?: number;
};

function num(v: any, d: number) {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
}

export default function ConstraintsPanel({
  constraints,
  onChange,
}: {
  constraints: CameraConstraints | null | undefined;
  onChange: (next: CameraConstraints) => void;
}) {
  const c: CameraConstraints = constraints ?? {
    enabled: true,
    max_speed_pos: 1.5,
    max_accel_pos: 0.4,
    max_speed_target: 1.5,
    max_accel_target: 0.4,
    max_speed_roll_deg: 4.0,
    max_speed_focal_mm: 1.5,
    smoothing_window: 3,
    sample_step: 1,
  };

  const set = (k: keyof CameraConstraints, v: any) => {
    onChange({ ...c, [k]: v });
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <b>Camera Constraints (v14)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        These constraints are applied by <code>bake-camera</code> (recommended) and by the <code>/camera_path</code> debug endpoint.
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={!!c.enabled} onChange={(e) => set("enabled", e.target.checked)} />
        <span>Enabled</span>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <Field label="Max speed pos (units/frame)" value={c.max_speed_pos} onChange={(v)=>set("max_speed_pos", v)} />
        <Field label="Max accel pos (units/frame²)" value={c.max_accel_pos} onChange={(v)=>set("max_accel_pos", v)} />
        <Field label="Max speed target" value={c.max_speed_target} onChange={(v)=>set("max_speed_target", v)} />
        <Field label="Max accel target" value={c.max_accel_target} onChange={(v)=>set("max_accel_target", v)} />
        <Field label="Max roll speed (deg/frame)" value={c.max_speed_roll_deg} onChange={(v)=>set("max_speed_roll_deg", v)} />
        <Field label="Max focal speed (mm/frame)" value={c.max_speed_focal_mm} onChange={(v)=>set("max_speed_focal_mm", v)} />
        <Field label="Smoothing window" value={c.smoothing_window} step={1} onChange={(v)=>set("smoothing_window", Math.max(0, Math.round(v)))} />
        <Field label="Sample step (frames)" value={c.sample_step} step={1} onChange={(v)=>set("sample_step", Math.max(1, Math.round(v)))} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: any;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{label}</div>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(num(e.target.value, 0))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
