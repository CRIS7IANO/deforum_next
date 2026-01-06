import React, { useEffect, useMemo, useRef, useState } from "react";

type Sample = {
  frame: number;
  pos: [number, number, number];
  target: [number, number, number];
  euler_deg: [number, number, number];
  focal_length_mm: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function uniq(nums: number[]) {
  const s = new Set<number>();
  for (const n of nums) s.add(n);
  return [...s].sort((a,b)=>a-b);
}

export default function CameraPathPanel({
  bridgeUrl,
  project,
  start,
  end,
  frame,
}: {
  bridgeUrl: string;
  project: any;
  start: number;
  end: number;
  frame: number;
}) {
  const [applyConstraints, setApplyConstraints] = useState(true);
  const [showKeys, setShowKeys] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const keyFrames = useMemo(() => {
    if (!project) return [];
    // attempt to find camera transform channels in tracks
    const tracks: any[] = project?.timeline?.tracks ?? [];
    const cam = tracks.find((t) => String(t.id || "").includes("camera"));
    const ch = cam?.channels ?? {};
    const xs = (ch["position.x"]?.keys ?? []).map((k: any) => k.t);
    const zs = (ch["position.z"]?.keys ?? []).map((k: any) => k.t);
    const rs = (ch["roll_deg"]?.keys ?? []).map((k: any) => k.t);
    return uniq([...(xs||[]), ...(zs||[]), ...(rs||[])].filter((n: any) => Number.isFinite(n)));
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setErr(null);
        const url = `${bridgeUrl}/camera_path?start=${start}&end=${end}&apply=${applyConstraints ? "true" : "false"}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = await res.json();
        if (cancelled) return;
        setSamples((js.samples ?? []) as Sample[]);
      } catch (e: any) {
        if (cancelled) return;
        setErr(String(e?.message ?? e));
        setSamples([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bridgeUrl, start, end, applyConstraints]);

  const bounds = useMemo(() => {
    if (samples.length === 0) return null;
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const s of samples) {
      minx = Math.min(minx, s.pos[0]);
      maxx = Math.max(maxx, s.pos[0]);
      minz = Math.min(minz, s.pos[2]);
      maxz = Math.max(maxz, s.pos[2]);
    }
    const pad = 0.08;
    const dx = (maxx - minx) || 1;
    const dz = (maxz - minz) || 1;
    return { minx: minx - dx * pad, maxx: maxx + dx * pad, minz: minz - dz * pad, maxz: maxz + dz * pad };
  }, [samples]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    // background
    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, c.width, c.height);

    if (!bounds || samples.length < 2) {
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "12px system-ui";
      ctx.fillText("No camera samples (start bridge + load project).", 10, 20);
      return;
    }

    const { minx, maxx, minz, maxz } = bounds;
    const w = c.width, h = c.height;
    const sx = (x: number) => ((x - minx) / (maxx - minx)) * (w - 20) + 10;
    const sz = (z: number) => (h - 10) - ((z - minz) / (maxz - minz)) * (h - 20);

    // grid
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const gx = 10 + ((w - 20) * i) / 10;
      const gz = 10 + ((h - 20) * i) / 10;
      ctx.beginPath(); ctx.moveTo(gx, 10); ctx.lineTo(gx, h - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, gz); ctx.lineTo(w - 10, gz); ctx.stroke();
    }

    // path
    ctx.strokeStyle = "rgba(34,211,238,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i].pos;
      const x = sx(p[0]);
      const y = sz(p[2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // keyframe markers on path (sample nearest per key frame)
    if (showKeys && keyFrames.length > 0) {
      ctx.fillStyle = "rgba(148,163,184,0.85)";
      for (const kf of keyFrames) {
        const idx = samples.findIndex(s => s.frame >= kf);
        const s = idx >= 0 ? samples[idx] : null;
        if (!s) continue;
        const x = sx(s.pos[0]);
        const y = sz(s.pos[2]);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();

        if (showHandles) {
          const s2 = samples[Math.min(samples.length-1, Math.max(0, idx+1))];
          const dx = sx(s2.pos[0]) - x;
          const dy = sz(s2.pos[2]) - y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx/len, uy = dy/len;
          ctx.strokeStyle = "rgba(148,163,184,0.5)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + ux*18, y + uy*18);
          ctx.stroke();
        }
      }
    }

    // current frame marker
    const f0 = samples[0].frame;
    const f1 = samples[samples.length - 1].frame;
    const t = clamp((frame - f0) / Math.max(1, (f1 - f0)), 0, 1);
    const idx = Math.round(t * (samples.length - 1));
    const cur = samples[idx];
    if (cur) {
      const x = sx(cur.pos[0]);
      const y = sz(cur.pos[2]);

      ctx.fillStyle = "rgba(251,191,36,0.95)";
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();

      // arrow for look direction (pos -> target)
      const tx = sx(cur.target[0]);
      const ty = sz(cur.target[2]);
      ctx.strokeStyle = "rgba(251,191,36,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    }

    // legend
    ctx.fillStyle = "rgba(226,232,240,0.9)";
    ctx.font = "12px system-ui";
    ctx.fillText("Top-down path (X vs Z). Keys + trajectory handles are approximated from sampled path.", 10, 18);
  }, [samples, bounds, frame, showKeys, showHandles, keyFrames]);

  const curInfo = useMemo(() => {
    if (samples.length === 0) return null;
    const f0 = samples[0].frame;
    const f1 = samples[samples.length - 1].frame;
    const t = clamp((frame - f0) / Math.max(1, (f1 - f0)), 0, 1);
    const idx = Math.round(t * (samples.length - 1));
    return samples[idx] ?? null;
  }, [samples, frame]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <b>Camera Path Visualizer (v15)</b>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={applyConstraints} onChange={(e) => setApplyConstraints(e.target.checked)} />
          <span style={{ fontSize: 12, opacity: 0.85 }}>Apply constraints</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={showKeys} onChange={(e) => setShowKeys(e.target.checked)} />
          <span style={{ fontSize: 12, opacity: 0.85 }}>Show keyframes</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={showHandles} onChange={(e) => setShowHandles(e.target.checked)} />
          <span style={{ fontSize: 12, opacity: 0.85 }}>Trajectory handles</span>
        </label>
        {err ? <span style={{ fontSize: 12, color: "#fca5a5" }}>{err}</span> : null}
      </div>

      <canvas ref={canvasRef} width={520} height={260} style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(148,163,184,0.25)" }} />

      {curInfo ? (
        <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
          <div><b>Frame:</b> {curInfo.frame}</div>
          <div><b>Pos:</b> [{curInfo.pos.map((x) => x.toFixed(3)).join(", ")}]</div>
          <div><b>Target:</b> [{curInfo.target.map((x) => x.toFixed(3)).join(", ")}]</div>
          <div><b>Roll/Focal:</b> {curInfo.euler_deg[0].toFixed(2)}° / {curInfo.focal_length_mm.toFixed(2)}mm</div>
        </div>
      ) : null}
    </div>
  );
}
