import React, { useEffect, useMemo, useRef, useState } from "react";
import { Key, clamp, safeNum, snapInt, getKeys, setKeys, upsertKey, deleteKey } from "./keyframe_utils";
import { sampleChannel } from "./spline_eval";

type Props = {
  project: any;
  trackId: string;
  channel: string;
  maxFrame: number;
  onUpdateProject: (nextProject: any) => void;
};

type Bounds = { minT: number; maxT: number; minV: number; maxV: number };

type DragMode = "none" | "key" | "in_handle" | "out_handle";

const EASING_PRESETS: Record<string, [number, number, number, number]> = {
  linear: [0.0, 0.0, 1.0, 1.0],
  ease: [0.25, 0.1, 0.25, 1.0],
  "ease-in": [0.42, 0.0, 1.0, 1.0],
  "ease-out": [0.0, 0.0, 0.58, 1.0],
  "ease-in-out": [0.42, 0.0, 0.58, 1.0],
};

function computeBounds(keys: Key[], maxFrame: number): Bounds {
  const vs = keys.map((k) => k.v);
  const minT = 0;
  const maxT = Math.max(1, maxFrame);
  let minV = vs.length ? Math.min(...vs) : -1;
  let maxV = vs.length ? Math.max(...vs) : 1;
  if (Math.abs(maxV - minV) < 1e-6) {
    maxV += 1;
    minV -= 1;
  }
  const pad = 0.08;
  const dv = maxV - minV;
  minV = minV - dv * pad;
  maxV = maxV + dv * pad;
  return { minT, maxT, minV, maxV };
}

function snapToStep(v: number, step: number) {
  if (!Number.isFinite(step) || step <= 0) return v;
  return Math.round(v / step) * step;
}

export default function GraphEditorPanel({ project, trackId, channel, maxFrame, onUpdateProject }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [selectedT, setSelectedT] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>("none");

  const [snapValues, setSnapValues] = useState(true);
  const [valueStep, setValueStep] = useState(0.05);

  const [snapTangents, setSnapTangents] = useState(true);
  const [tanDtStep, setTanDtStep] = useState(0.05);
  const [tanDvStep, setTanDvStep] = useState(0.05);

  const [preset, setPreset] = useState("ease-in-out");

  const track = useMemo(() => {
    const tracks: any[] = project?.timeline?.tracks ?? [];
    return tracks.find((t) => t?.id === trackId) ?? null;
  }, [project, trackId]);

  const keys = useMemo(() => (track ? (getKeys(track, channel) || []) : []), [track, channel]);
  const bounds = useMemo(() => computeBounds(keys, maxFrame), [keys, maxFrame]);

  const selectedIndex = useMemo(() => {
    if (selectedT === null) return -1;
    return keys.findIndex((k) => k.t === selectedT);
  }, [keys, selectedT]);

  const selectedKey = useMemo(() => {
    if (selectedIndex < 0) return null;
    return keys[selectedIndex] ?? null;
  }, [keys, selectedIndex]);

  const nextKey = useMemo(() => {
    if (selectedIndex < 0) return null;
    return keys[selectedIndex + 1] ?? null;
  }, [keys, selectedIndex]);

  const prevKey = useMemo(() => {
    if (selectedIndex < 0) return null;
    return keys[selectedIndex - 1] ?? null;
  }, [keys, selectedIndex]);

  const toCanvas = (t: number, v: number, w: number, h: number) => {
    const { minT, maxT, minV, maxV } = bounds;
    const x = 40 + ((t - minT) / (maxT - minT)) * (w - 55);
    const y = 15 + (1 - (v - minV) / (maxV - minV)) * (h - 30);
    return { x, y };
  };

  const fromCanvas = (x: number, y: number, w: number, h: number) => {
    const { minT, maxT, minV, maxV } = bounds;
    const tx = clamp((x - 40) / (w - 55), 0, 1);
    const ty = clamp((y - 15) / (h - 30), 0, 1);
    const t = minT + tx * (maxT - minT);
    const v = minV + (1 - ty) * (maxV - minV);
    return { t, v };
  };

  const applyKeys = (next: Key[]) => {
    if (!track) return;
    const p = JSON.parse(JSON.stringify(project));
    const tracks: any[] = p.timeline.tracks ?? [];
    const t = tracks.find((x) => x.id === trackId);
    if (!t) return;
    setKeys(t, channel, next);
    onUpdateProject(p);
  };

  function getSegmentFramesForOut(): number {
    if (!selectedKey || !nextKey) return 1;
    return Math.max(1, nextKey.t - selectedKey.t);
  }
  function getSegmentFramesForIn(): number {
    if (!selectedKey || !prevKey) return 1;
    return Math.max(1, selectedKey.t - prevKey.t);
  }

  function handlePoints(canvasW: number, canvasH: number) {
    if (!selectedKey) return { inP: null as any, outP: null as any, keyP: null as any };
    const kp = toCanvas(selectedKey.t, selectedKey.v, canvasW, canvasH);

    const pxPerFrame = (canvasW - 55) / (bounds.maxT - bounds.minT);
    const pxPerValue = (canvasH - 30) / (bounds.maxV - bounds.minV);

    // out handle depends on segment to next key
    let outP = null;
    if (nextKey) {
      const segFrames = getSegmentFramesForOut();
      const dt = clamp(selectedKey.out_tan?.[0] ?? 0.25, 0, 1);
      const dv = selectedKey.out_tan?.[1] ?? 0;
      outP = { x: kp.x + dt * segFrames * pxPerFrame, y: kp.y - dv * pxPerValue };
    }

    // in handle depends on segment from prev key to selectedKey
    let inP = null;
    if (prevKey) {
      const segFrames = getSegmentFramesForIn();
      const dt = clamp(selectedKey.in_tan?.[0] ?? -0.25, -1, 0);
      const dv = selectedKey.in_tan?.[1] ?? 0;
      inP = { x: kp.x + dt * segFrames * pxPerFrame, y: kp.y - dv * pxPerValue };
    }

    return { inP, outP, keyP: kp, pxPerFrame, pxPerValue };
  }

  function hitTestHandles(mx: number, my: number, canvasW: number, canvasH: number): DragMode {
    const { inP, outP } = handlePoints(canvasW, canvasH);
    const hit = (p: any) => p && Math.hypot(p.x - mx, p.y - my) <= 9;
    if (hit(outP)) return "out_handle";
    if (hit(inP)) return "in_handle";
    return "none";
  }

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const w = c.width;
    const h = c.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, w, h);

    // axes
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, h - 15);
    ctx.lineTo(w - 10, h - 15);
    ctx.stroke();

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.10)";
    for (let i = 0; i <= 10; i++) {
      const x = 40 + ((w - 55) * i) / 10;
      const y = 15 + ((h - 30) * i) / 10;
      ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, h - 15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 10, y); ctx.stroke();
    }

    // curve (spline samples)
if (keys.length >= 2) {
  const samples = sampleChannel(keys as any, bounds.minT, bounds.maxT, 420);
  ctx.strokeStyle = "rgba(34,211,238,0.92)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const [tt, vv] = samples[i];
    const p = toCanvas(tt, vv, w, h);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

    // points
    for (const k of keys) {
      const p = toCanvas(k.t, k.v, w, h);
      const isSel = selectedT === k.t;

      ctx.fillStyle = isSel ? "rgba(251,191,36,0.95)" : "rgba(226,232,240,0.8)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSel ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // selected handles
    if (selectedKey) {
      const { inP, outP, keyP } = handlePoints(w, h);
      ctx.strokeStyle = "rgba(251,191,36,0.65)";
      ctx.lineWidth = 1.5;

      if (outP) {
        ctx.beginPath(); ctx.moveTo(keyP.x, keyP.y); ctx.lineTo(outP.x, outP.y); ctx.stroke();
        ctx.fillStyle = "rgba(251,191,36,0.85)";
        ctx.beginPath(); ctx.arc(outP.x, outP.y, 3.8, 0, Math.PI * 2); ctx.fill();
      }
      if (inP) {
        ctx.beginPath(); ctx.moveTo(keyP.x, keyP.y); ctx.lineTo(inP.x, inP.y); ctx.stroke();
        ctx.fillStyle = "rgba(251,191,36,0.85)";
        ctx.beginPath(); ctx.arc(inP.x, inP.y, 3.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // labels
    ctx.fillStyle = "rgba(226,232,240,0.85)";
    ctx.font = "12px system-ui";
    ctx.fillText(`Graph: ${trackId}.${channel}`, 10, 14);
  }, [keys, selectedT, bounds, trackId, channel, selectedKey, nextKey, prevKey]);

  const onMouseDown = (e: React.MouseEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = c.width, h = c.height;

    // 1) if selected key, allow picking handles
    if (selectedKey) {
      const hm = hitTestHandles(mx, my, w, h);
      if (hm !== "none") {
        setDragMode(hm);
        return;
      }
    }

    // 2) find nearest key
    let best: { t: number; d: number } | null = null;
    for (const k of keys) {
      const p = toCanvas(k.t, k.v, w, h);
      const d = Math.hypot(p.x - mx, p.y - my);
      if (best === null || d < best.d) best = { t: k.t, d };
    }
    if (best && best.d <= 10) {
      setSelectedT(best.t);
      setDragMode("key");
      return;
    }

    // 3) create new key
    const pv = fromCanvas(mx, my, w, h);
    const nt = clamp(snapInt(pv.t), 0, maxFrame);
    let nv = pv.v;
    if (snapValues) nv = snapToStep(nv, valueStep);
    const nk: Key = { t: nt, v: nv, interp: "bezier", in_tan: [-0.25, 0], out_tan: [0.25, 0] };
    setSelectedT(nt);
    applyKeys(upsertKey(keys, nk));
    setDragMode("key");
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragMode === "none" || selectedT === null) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = c.width, h = c.height;

    const cur = keys.find((k) => k.t === selectedT);
    if (!cur) return;

    // drag key
    if (dragMode === "key") {
      const pv = fromCanvas(mx, my, w, h);
      const nt = clamp(snapInt(pv.t), 0, maxFrame);
      let nv = pv.v;
      if (snapValues) nv = snapToStep(nv, valueStep);

      let nextKeys = keys;
      if (nt !== selectedT) {
        nextKeys = deleteKey(nextKeys, selectedT);
        setSelectedT(nt);
        nextKeys = upsertKey(nextKeys, { ...cur, t: nt, v: nv });
      } else {
        nextKeys = upsertKey(nextKeys, { ...cur, v: nv });
      }
      applyKeys(nextKeys);
      return;
    }

    // drag handles
    const { keyP, pxPerFrame, pxPerValue } = handlePoints(w, h);
    const dx = mx - keyP.x;
    const dy = my - keyP.y;

    // convert to tangent dt,dv in normalized units
    if (dragMode === "out_handle") {
      if (!nextKey) return;
      const segFrames = getSegmentFramesForOut();
      let dt = dx / (pxPerFrame * segFrames);
      let dv = -dy / pxPerValue;
      dt = clamp(dt, 0, 1);
      if (snapTangents) {
        dt = snapToStep(dt, tanDtStep);
        dv = snapToStep(dv, tanDvStep);
      }
      applyKeys(upsertKey(keys, { ...cur, out_tan: [dt, dv] }));
      return;
    }

    if (dragMode === "in_handle") {
      if (!prevKey) return;
      const segFrames = getSegmentFramesForIn();
      let dt = dx / (pxPerFrame * segFrames);
      let dv = -dy / pxPerValue;
      dt = clamp(dt, -1, 0);
      if (snapTangents) {
        dt = snapToStep(dt, tanDtStep);
        dv = snapToStep(dv, tanDvStep);
      }
      applyKeys(upsertKey(keys, { ...cur, in_tan: [dt, dv] }));
      return;
    }
  };

  const onMouseUp = () => setDragMode("none");

  const setInterp = (interp: any) => {
    if (selectedKey) applyKeys(upsertKey(keys, { ...selectedKey, interp }));
  };

  const setTan = (which: "in_tan" | "out_tan", dt: number, dv: number) => {
    if (!selectedKey) return;
    let ndt = dt;
    if (which === "out_tan") ndt = clamp(ndt, 0, 1);
    if (which === "in_tan") ndt = clamp(ndt, -1, 0);

    let ndv = dv;
    if (snapTangents) {
      ndt = snapToStep(ndt, tanDtStep);
      ndv = snapToStep(ndv, tanDvStep);
    }
    applyKeys(upsertKey(keys, { ...selectedKey, [which]: [ndt, ndv] as any }));
  };

  const deleteSelected = () => {
    if (selectedT === null) return;
    applyKeys(deleteKey(keys, selectedT));
    setSelectedT(null);
  };

  const copyJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(keys, null, 2));
      alert("Copied channel keys JSON to clipboard.");
    } catch {
      alert("Clipboard not available.");
    }
  };

  const pasteJSON = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      const js = JSON.parse(txt);
      if (!Array.isArray(js)) throw new Error("Expected an array of keys");
      const next: Key[] = js
        .map((k: any) => ({
          t: snapInt(safeNum(k.t, 0)),
          v: safeNum(k.v, 0),
          interp: k.interp || "bezier",
          in_tan: k.in_tan || null,
          out_tan: k.out_tan || null,
        }))
        .sort((a, b) => a.t - b.t);
      applyKeys(next);
    } catch (e: any) {
      alert("Paste failed: " + String(e?.message ?? e));
    }
  };

  const applyPresetToSegment = () => {
    if (!selectedKey || !nextKey) {
      alert("Select a key that has a next key to apply easing to a segment.");
      return;
    }
    const bez = EASING_PRESETS[preset] ?? EASING_PRESETS["ease-in-out"];
    const [x1, y1, x2, y2] = bez;
    const delta = (nextKey.v - selectedKey.v);

    const out_tan: [number, number] = [clamp(x1, 0, 1), delta * y1];
    const in_tan: [number, number] = [clamp(x2 - 1.0, -1, 0), delta * (y2 - 1.0)];

    const nextKeys = upsertKey(keys, { ...selectedKey, interp: "bezier", out_tan })
      .map((k) => (k.t === nextKey.t ? { ...k, interp: "bezier", in_tan } : k));
    applyKeys(nextKeys);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <b>Graph Editor (v17)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Click to add keys. Drag keys to retime and change value. Drag tangent handles to sculpt Bezier easing.
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={snapValues} onChange={(e) => setSnapValues(e.target.checked)} />
          Snap values
        </label>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          value step:
          <input style={{ marginLeft: 6, width: 90 }} type="number" step={0.01} value={valueStep} onChange={(e) => setValueStep(safeNum(e.target.value, valueStep))} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, opacity: 0.9 }}>
          <input type="checkbox" checked={snapTangents} onChange={(e) => setSnapTangents(e.target.checked)} />
          Snap tangents
        </label>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          dt step:
          <input style={{ marginLeft: 6, width: 90 }} type="number" step={0.01} value={tanDtStep} onChange={(e) => setTanDtStep(safeNum(e.target.value, tanDtStep))} />
        </label>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          dv step:
          <input style={{ marginLeft: 6, width: 90 }} type="number" step={0.01} value={tanDvStep} onChange={(e) => setTanDvStep(safeNum(e.target.value, tanDvStep))} />
        </label>
      </div>

      <canvas
        ref={canvasRef}
        width={720}
        height={280}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)" }}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={copyJSON}>Copy channel JSON</button>
        <button onClick={pasteJSON}>Paste channel JSON</button>
        <button onClick={deleteSelected} disabled={selectedT === null}>Delete selected</button>

        <span style={{ width: 12 }} />

        <label style={{ fontSize: 12, opacity: 0.9 }}>
          Easing preset (segment):
          <select value={preset} onChange={(e) => setPreset(e.target.value)} style={{ marginLeft: 8 }}>
            {Object.keys(EASING_PRESETS).map((k) => (<option key={k} value={k}>{k}</option>))}
          </select>
        </label>
        <button onClick={applyPresetToSegment} disabled={!selectedKey || !nextKey}>Apply to key → next</button>
      </div>

      {selectedKey ? (
        <div style={{ display: "grid", gap: 8, border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, padding: 10 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 12 }}><b>Selected:</b> t={selectedKey.t}, v={selectedKey.v.toFixed(4)}</div>
            <label style={{ fontSize: 12 }}>
              interp:
              <select value={selectedKey.interp ?? "bezier"} onChange={(e) => setInterp(e.target.value)} style={{ marginLeft: 6 }}>
                <option value="bezier">bezier</option>
                <option value="linear">linear</option>
                <option value="catmull_rom">catmull_rom</option>
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <TangentEditor
              title="In tangent (dt,dv)"
              dt={selectedKey.in_tan?.[0] ?? -0.25}
              dv={selectedKey.in_tan?.[1] ?? 0}
              onChange={(dt, dv) => setTan("in_tan", dt, dv)}
            />
            <TangentEditor
              title="Out tangent (dt,dv)"
              dt={selectedKey.out_tan?.[0] ?? 0.25}
              dv={selectedKey.out_tan?.[1] ?? 0}
              onChange={(dt, dv) => setTan("out_tan", dt, dv)}
            />
          </div>

          <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.35 }}>
            <b>Handle rules:</b> out tangent uses the segment to the next key; in tangent uses the segment from the previous key.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>Select a key by clicking near a point.</div>
      )}
    </div>
  );
}

function TangentEditor({ title, dt, dv, onChange }: { title: string; dt: number; dv: number; onChange: (dt: number, dv: number) => void }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <b style={{ fontSize: 12 }}>{title}</b>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>dt</div>
          <input type="number" step={0.01} value={dt} onChange={(e) => onChange(safeNum(e.target.value, dt), dv)} />
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>dv</div>
          <input type="number" step={0.01} value={dv} onChange={(e) => onChange(dt, safeNum(e.target.value, dv))} />
        </div>
      </div>
    </div>
  );
}
