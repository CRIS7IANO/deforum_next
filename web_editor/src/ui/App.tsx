import React, { useEffect, useMemo, useState } from "react";
import { evalRange } from "../engine_bridge/api";
import Viewport3D from "./Viewport3D";
import KeyframeTable from "./KeyframeTable";

const DEFAULT_BRIDGE = "http://127.0.0.1:8787";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export default function App() {
  const [bridgeUrl, setBridgeUrl] = useState(DEFAULT_BRIDGE);
  const [project, setProject] = useState<any>(null);
  const [rangeData, setRangeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadJsonFile(file: File) {
    const txt = await file.text();
    setProject(JSON.parse(txt));
    setRangeData(null);
    setError(null);
  }

  function exportJson() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function refreshPreview() {
    if (!project) return;
    setError(null);
    try {
      const frames = project?.meta?.frames ?? 120;
      const end = Math.min(frames - 1, 240);
      const res = await evalRange(bridgeUrl, project, 0, end);
      setRangeData(res);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    if (!project) {
      setProject({
        schema_version: "2.0",
        meta: { name: "New Project", fps: 24, frames: 120, resolution: [576, 1024] },
        assets: {},
        timeline: {
          tracks: [{
            id: "camera.transform",
            type: "CameraTransformTrack",
            channels: {
              "position.x": { keys: [{ t: 0, v: 0.0, interp: "bezier" }, { t: 119, v: 0.0, interp: "bezier" }] },
              "position.y": { keys: [{ t: 0, v: 1.5, interp: "linear" }, { t: 119, v: 1.5, interp: "linear" }] },
              "position.z": { keys: [{ t: 0, v: -6.0, interp: "catmull_rom" }, { t: 119, v: -6.0, interp: "catmull_rom" }] },
              "target.x": { value: 0.0 },
              "target.y": { value: 1.5 },
              "target.z": { value: 0.0 },
              "focal_length_mm": { value: 35.0 }
            },
            constraints: [],
            modifiers: []
          }],
          objects: { nulls: { hero: { type: "Null", position: [0, 1.5, 0] } } }
        },
        render: { backend: "headless", sampler: "DPM++ 2M Karras", steps: 28, cfg: 6.5, seed_mode: { type: "per_frame", base_seed: 12345, jitter: 0 }, prompts: { positive: "", negative: "" } }
      });
    }
  }, [project]);

  const camTrack = useMemo(() => {
    const tracks = project?.timeline?.tracks ?? [];
    return tracks.find((t: any) => t.id === "camera.transform") ?? tracks[0];
  }, [project]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "440px 1fr", height: "100vh", fontFamily: "system-ui" }}>
      <div style={{ padding: 12, borderRight: "1px solid #333", overflow: "auto" }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Deforum Next Editor (MVP)</h2>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>Bridge URL</label>
          <input value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)} style={{ flex: 1 }} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadJsonFile(f);
            }}
          />
          <button onClick={exportJson} disabled={!project}>Export JSON</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button onClick={() => void refreshPreview()} disabled={!project}>Refresh Preview</button>
        </div>

        {error && (
          <div style={{ color: "salmon", whiteSpace: "pre-wrap", fontSize: 12 }}>
            {error}
          </div>
        )}

        <hr />
        <h3 style={{ margin: "8px 0" }}>Keyframes (camera.transform)</h3>
        <KeyframeTable track={camTrack} onChange={(updated) => {
          const p = deepClone(project);
          const idx = p.timeline.tracks.findIndex((t: any) => t.id === updated.id);
          if (idx >= 0) p.timeline.tracks[idx] = updated;
          setProject(p);
        }} />

        <p style={{ fontSize: 12, opacity: 0.75 }}>
          MVP: table editor + 3D path preview. Graph Editor, constraints UI, audio sync are next milestones.
        </p>
      </div>

      <div style={{ position: "relative" }}>
        <Viewport3D rangeData={rangeData} />
        <div style={{ position: "absolute", left: 12, bottom: 12, fontSize: 12, padding: 8, background: "rgba(0,0,0,0.5)", color: "white" }}>
          {rangeData ? "Preview loaded" : "Click 'Refresh Preview' to evaluate camera path."}
        </div>
      </div>
    </div>
  );
}
