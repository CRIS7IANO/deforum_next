import React, { useMemo, useRef, useState } from "react";
import { Marker, nearestSnapFrame } from "./TimelineMarkers";

type Key = any;

type Props = {
  channelName: string;
  keys: Key[];
  onChange: (keys: Key[]) => void;

  snapEnabled?: boolean;
  markers?: Marker[];
  beats?: { frame: number }[];
  maxFrame?: number;
};

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

function sortKeys(keys: Key[]) {
  return [...keys].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
}

export default function GraphEditor({ channelName, keys, onChange, snapEnabled=false, markers=[], beats=[], maxFrame=100000 }: Props) {
  const W = 520, H = 240;
  const pad = 24;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [zoomX, setZoomX] = useState(1.0);
  const [zoomY, setZoomY] = useState(1.0);
  const [panX, setPanX] = useState(0.0);
  const [panY, setPanY] = useState(0.0);

  const [selected, setSelected] = useState<number[]>([]);
  const [dragPan, setDragPan] = useState<{x:number,y:number,ox:number,oy:number} | null>(null);

  const [box, setBox] = useState<{x0:number,y0:number,x1:number,y1:number} | null>(null);
  const [dragGroup, setDragGroup] = useState<{ startX:number; startY:number; base: {t:number,v:number}[]; idxs:number[] } | null>(null);

  const ks = useMemo(() => sortKeys(keys ?? []), [keys]);

  const tMin = useMemo(() => ks.length ? ks[0].t : 0, [ks]);
  const tMax = useMemo(() => ks.length ? ks[ks.length - 1].t : 100, [ks]);

  const vMin = useMemo(() => {
    if (!ks.length) return -1;
    let m = ks[0].v ?? 0;
    for (const k of ks) m = Math.min(m, k.v ?? 0);
    return m;
  }, [ks]);
  const vMax = useMemo(() => {
    if (!ks.length) return 1;
    let m = ks[0].v ?? 0;
    for (const k of ks) m = Math.max(m, k.v ?? 0);
    return m;
  }, [ks]);

  const tSpan = Math.max(1e-6, (tMax - tMin));
  const vSpan = Math.max(1e-6, (vMax - vMin));

  function tx(t: number) {
    const u = (t - tMin) / tSpan;
    const x = pad + u * (W - 2 * pad);
    return (x - W/2) * zoomX + W/2 + panX;
  }
  function ty(v: number) {
    const u = (v - vMin) / vSpan;
    const y = H - pad - u * (H - 2 * pad);
    return (y - H/2) * zoomY + H/2 + panY;
  }

  function invT(xp: number) {
    const x = ((xp - panX) - W/2) / zoomX + W/2;
    const u = (x - pad) / (W - 2*pad);
    return tMin + clamp(u, 0, 1) * tSpan;
  }
  function invV(yp: number) {
    const y = ((yp - panY) - H/2) / zoomY + H/2;
    const u = (H - pad - y) / (H - 2*pad);
    return vMin + clamp(u, 0, 1) * vSpan;
  }

  function snapTIfNeeded(t: number) {
    const raw = clamp(Math.round(t), 0, maxFrame);
    if (!snapEnabled) return raw;
    return nearestSnapFrame(raw, markers, beats as any, maxFrame, 3);
  }

  function toggleSelect(idx: number, additive: boolean) {
    if (!additive) { setSelected([idx]); return; }
    setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }

  function setSelectionFromBox(b: {x0:number,y0:number,x1:number,y1:number}, additive: boolean) {
    const xMin = Math.min(b.x0, b.x1), xMax = Math.max(b.x0, b.x1);
    const yMin = Math.min(b.y0, b.y1), yMax = Math.max(b.y0, b.y1);
    const hits: number[] = [];
    ks.forEach((k, idx) => {
      const x = tx(k.t), y = ty(k.v);
      if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) hits.push(idx);
    });
    if (!additive) { setSelected(hits); return; }
    setSelected(prev => Array.from(new Set([...prev, ...hits])));
  }

  function updateKeys(next: any[]) { onChange(sortKeys(next)); }

  function updateKey(idx: number, patch: any) {
    const next = deepClone(ks);
    next[idx] = { ...next[idx], ...patch };
    updateKeys(next);
  }

  function setTangentLocked(idx: number, locked: boolean) {
    updateKey(idx, { tan_lock: locked });
  }

  function applyGroupDrag(ev: MouseEvent) {
    if (!dragGroup || !svgRef.current) return;
    const dx = ev.clientX - dragGroup.startX;
    const dy = ev.clientY - dragGroup.startY;

    const dt = invT(clamp((W/2)+dx, 0, W)) - invT(W/2);
    const dv = invV(clamp((H/2)+dy, 0, H)) - invV(H/2);

    const next = deepClone(ks);
    dragGroup.idxs.forEach((idx, j) => {
      const bt = dragGroup.base[j].t + dt;
      const bv = dragGroup.base[j].v + dv;
      next[idx] = { ...next[idx], t: snapTIfNeeded(bt), v: bv };
    });
    updateKeys(next);
  }

  function dragPoint(idx: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const wasSelected = selected.includes(idx);
    if (!wasSelected) setSelected([idx]);

    const idxs = (wasSelected ? selected : [idx]).slice().sort((a,b)=>a-b);
    const base = idxs.map(i => ({ t: ks[i].t ?? 0, v: ks[i].v ?? 0 }));
    setDragGroup({ startX: e.clientX, startY: e.clientY, base, idxs });

    function onMove(ev: MouseEvent) { applyGroupDrag(ev); }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setDragGroup(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function dragHandle(idx: number, which: "in" | "out", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const k = ks[idx];
    const tanLock = !!k.tan_lock;

    function onMove(ev: MouseEvent) {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const xp = clamp(ev.clientX - rect.left, 0, W);
      const yp = clamp(ev.clientY - rect.top, 0, H);
      const t = invT(xp);
      const v = invV(yp);
      const dt = (t - (k.t ?? 0)) / Math.max(1, tSpan);
      const dv = (v - (k.v ?? 0)) / Math.max(1e-6, vSpan);

      if (which === "out") {
        const out = [clamp(dt, -1, 1), clamp(dv, -1, 1)];
        const patch: any = { out_tan: out, interp: "bezier" };
        if (tanLock) patch.in_tan = [-out[0], -out[1]];
        updateKey(idx, patch);
      } else {
        const inn = [clamp(dt, -1, 1), clamp(dv, -1, 1)];
        const patch: any = { in_tan: inn, interp: "bezier" };
        if (tanLock) patch.out_tan = [-inn[0], -inn[1]];
        updateKey(idx, patch);
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function bezierPath() {
    if (ks.length < 2) return "";
    let d = "";
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i], b = ks[i+1];
      const ax = tx(a.t), ay = ty(a.v);
      const bx = tx(b.t), by = ty(b.v);
      const out = a.out_tan ?? [0.25, 0.0];
      const inn = b.in_tan ?? [-0.25, 0.0];
      const c1x = ax + out[0] * (W - 2*pad) * zoomX;
      const c1y = ay - out[1] * (H - 2*pad) * zoomY;
      const c2x = bx + inn[0] * (W - 2*pad) * zoomX;
      const c2y = by - inn[1] * (H - 2*pad) * zoomY;

      if (i === 0) d += `M ${ax} ${ay} `;
      d += `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${bx} ${by} `;
    }
    return d;
  }

  function onBackgroundMouseDown(e: React.MouseEvent) {
    if (e.button === 0 && !e.altKey) {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x0 = clamp(e.clientX - rect.left, 0, W);
      const y0 = clamp(e.clientY - rect.top, 0, H);
      setBox({ x0, y0, x1: x0, y1: y0 });
      return;
    }

    if (e.button === 2 || e.altKey) {
      e.preventDefault();
      setDragPan({ x: e.clientX, y: e.clientY, ox: panX, oy: panY });
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (dragPan) {
      const dx = e.clientX - dragPan.x;
      const dy = e.clientY - dragPan.y;
      setPanX(dragPan.ox + dx);
      setPanY(dragPan.oy + dy);
      return;
    }
    if (box && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x1 = clamp(e.clientX - rect.left, 0, W);
      const y1 = clamp(e.clientY - rect.top, 0, H);
      setBox({ ...box, x1, y1 });
    }
  }

  function onMouseUp(e: React.MouseEvent) {
    if (dragPan) setDragPan(null);
    if (box) {
      setSelectionFromBox(box, e.shiftKey);
      setBox(null);
    }
  }

  function onContextMenu(e: React.MouseEvent) { e.preventDefault(); }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>Graph Editor: {channelName}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>ZoomX</label>
          <input type="range" min={0.5} max={3} step={0.05} value={zoomX} onChange={(e)=>setZoomX(parseFloat(e.target.value))} />
          <label style={{ fontSize: 12, opacity: 0.85 }}>ZoomY</label>
          <input type="range" min={0.5} max={3} step={0.05} value={zoomY} onChange={(e)=>setZoomY(parseFloat(e.target.value))} />
          <button onClick={() => { setZoomX(1); setZoomY(1); setPanX(0); setPanY(0); }}>Reset</button>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={W}
        height={H}
        style={{ width: "100%", background: "#0b0e14", borderRadius: 6, userSelect: "none" }}
        onMouseDown={onBackgroundMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
      >
        <g opacity={0.25} stroke="#ffffff">
          {Array.from({ length: 9 }).map((_, i) => {
            const x = pad + (i/8) * (W - 2*pad);
            return <line key={"vx"+i} x1={x} y1={pad} x2={x} y2={H-pad} />;
          })}
          {Array.from({ length: 5 }).map((_, i) => {
            const y = pad + (i/4) * (H - 2*pad);
            return <line key={"hy"+i} x1={pad} y1={y} x2={W-pad} y2={y} />;
          })}
        </g>

        <path d={bezierPath()} fill="none" stroke="#66ccff" strokeWidth={2} />

        {ks.map((k, idx) => {
          const x = tx(k.t);
          const y = ty(k.v);
          const sel = selected.includes(idx);

          const out = k.out_tan ?? null;
          const inn = k.in_tan ?? null;

          const cOut = out ? { x: x + out[0] * (W - 2*pad) * zoomX, y: y - out[1] * (H - 2*pad) * zoomY } : null;
          const cIn = inn ? { x: x + inn[0] * (W - 2*pad) * zoomX, y: y - inn[1] * (H - 2*pad) * zoomY } : null;

          return (
            <g key={idx}>
              {cOut && (
                <>
                  <line x1={x} y1={y} x2={cOut.x} y2={cOut.y} stroke="#999" opacity={0.6} />
                  <circle cx={cOut.x} cy={cOut.y} r={5} fill="#ffcc66" onMouseDown={(e)=>dragHandle(idx,"out",e)} />
                </>
              )}
              {cIn && (
                <>
                  <line x1={x} y1={y} x2={cIn.x} y2={cIn.y} stroke="#999" opacity={0.6} />
                  <circle cx={cIn.x} cy={cIn.y} r={5} fill="#ffcc66" onMouseDown={(e)=>dragHandle(idx,"in",e)} />
                </>
              )}

              <circle
                cx={x}
                cy={y}
                r={sel ? 7 : 6}
                fill={sel ? "#ffffff" : "#66ccff"}
                stroke={sel ? "#66ccff" : "none"}
                onMouseDown={(e)=>{ 
                  const additive = e.shiftKey;
                  toggleSelect(idx, additive);
                  dragPoint(idx, e);
                }}
              />
            </g>
          );
        })}

        {box && (
          <rect
            x={Math.min(box.x0, box.x1)}
            y={Math.min(box.y0, box.y1)}
            width={Math.abs(box.x1 - box.x0)}
            height={Math.abs(box.y1 - box.y0)}
            fill="rgba(102,204,255,0.12)"
            stroke="rgba(102,204,255,0.8)"
            strokeWidth={1}
          />
        )}
      </svg>

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Box-select: drag on background (Shift = additive). Move group: drag any selected point. Pan: right mouse or Alt-drag. Snap (drag): {snapEnabled ? "on" : "off"}.
      </div>

      {selected.length ? (
        <div style={{ border: "1px solid #222", borderRadius: 6, padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: 12 }}>Selection ({selected.length})</b>
            <button onClick={() => setSelected([])}>Clear</button>
          </div>

          {selected.slice(0, 3).map((idx) => {
            const k = ks[idx];
            return (
              <div key={idx} style={{ marginTop: 8, display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Key #{idx}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>t</label>
                  <input type="number" value={k.t} onChange={(e)=>updateKey(idx,{t: snapTIfNeeded(parseInt(e.target.value,10)||0)})} style={{ width: 90 }} />
                  <label style={{ fontSize: 12, opacity: 0.85 }}>v</label>
                  <input type="number" value={k.v} onChange={(e)=>updateKey(idx,{v: parseFloat(e.target.value)||0})} style={{ width: 120 }} />
                  <label style={{ fontSize: 12, opacity: 0.85 }}>
                    <input type="checkbox" checked={!!k.tan_lock} onChange={(e)=>setTangentLocked(idx,e.target.checked)} /> tangent lock
                  </label>
                </div>
              </div>
            );
          })}

          {selected.length > 3 && <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>… {selected.length - 3} more selected</div>}
        </div>
      ) : null}
    </div>
  );
}
