import React, { useEffect, useMemo, useRef, useState } from "react";
import { evalRange } from "../engine_bridge/api";
import Viewport3D from "./Viewport3D";
import KeyframeTable from "./KeyframeTable";
import GraphEditor from "./GraphEditor";
import AudioBeatGrid, { Beat } from "./AudioBeatGrid";
import AudioWaveform from "./AudioWaveform";
import StackEditor from "./StackEditor";
import TimelineMarkers, { Marker, nearestSnapFrame } from "./TimelineMarkers";

const DEFAULT_BRIDGE = "http://127.0.0.1:8787";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

export default function App() {
  const [bridgeUrl, setBridgeUrl] = useState(DEFAULT_BRIDGE);
  const [project, setProject] = useState<any>(null);
  const [rangeData, setRangeData] = useState<any>(null);
  const [frame, setFrame] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [channelForGraph, setChannelForGraph] = useState("rail.u");

  // playback
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<number | null>(null);

  // snapping
  const [snapEnabled, setSnapEnabled] = useState(true);

  // audio
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);

  async function loadJsonFile(file: File) {
    const txt = await file.text();
    setProject(JSON.parse(txt));
    setRangeData(null);
    setError(null);
    setFrame(0);
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
      const frames = project?.meta?.frames ?? 180;
      const end = Math.min(frames - 1, 720);
      const res = await evalRange(bridgeUrl, project, 0, end);
      setRangeData(res);
      setFrame((f) => Math.max(0, Math.min(end, f)));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    if (!project) {
      setProject({
        schema_version: "2.0",
        meta: { name: "New Project", fps: 24, frames: 180, resolution: [576, 1024] },
        assets: {},
        timeline: {
          markers: [
            { frame: 0, label: "intro" },
            { frame: 48, label: "beat_1" },
            { frame: 96, label: "beat_2" },
            { frame: 144, label: "climax" }
          ],
          objects: {
            nulls: { hero: { type: "Null", position: [0, 1.5, 0] } },
            splines: {
              dolly_spline_A: {
                type: "CatmullRomSpline",
                closed: false,
                points: [
                  [-3.0, 1.8, -7.0],
                  [-1.5, 1.6, -5.0],
                  [0.0, 1.5, -3.3],
                  [1.2, 1.55, -2.6],
                  [2.4, 1.65, -3.2],
                  [3.0, 1.8, -5.2]
                ]
              }
            }
          },
          tracks: [{
            id: "camera.transform",
            type: "CameraTransformTrack",
            channels: {
              "rail.u": { keys: [
                { t: 0, v: 0.0, interp: "bezier", out_tan: [0.2, 0.0], tan_mode: "free", tan_lock: true },
                { t: 120, v: 1.0, interp: "bezier", in_tan: [-0.2, 0.0], tan_lock: true }
              ] },
              "target.x": { keys: [{ t: 0, v: 0.0, interp: "bezier" }, { t: 179, v: 1.2, interp: "bezier" }] },
              "target.y": { value: 1.5 },
              "target.z": { value: 0.0 },
              "focal_length_mm": { keys: [{ t: 0, v: 28, interp: "bezier" }, { t: 179, v: 55, interp: "bezier" }] }
            },
            constraints: [
              { type: "Rail", order: 0, enabled: true, params: { spline_id: "dolly_spline_A", offset: [0, 0, 0] } },
              { type: "LookAtObject", order: 5, enabled: true, params: { null_id: "hero" } },
              { type: "Orbit", order: 20, enabled: false, params: { radius: 6.0, azimuth_deg: 0.0, elevation_deg: 10.0, offset: [0, 0, 0] } }
            ],
            modifiers: [
              { type: "AimSpring", order: 0, enabled: true, params: { stiffness: 18.0, damping: 6.0 } },
              { type: "NoiseShake", order: 10, enabled: true, params: { seed: 42, amp_pos: 0.03, amp_tgt: 0.015, freq_hz: 5.5 } },
              { type: "DollyZoom", order: 20, enabled: true, params: { reference_focal_mm: 35.0, reference_distance_m: 3.2, min_focal_mm: 18.0, max_focal_mm: 120.0 } },
              { type: "HorizonLock", order: 30, enabled: true, params: {} }
            ]
          }]
        },
        render: { backend: "headless", sampler: "DPM++ 2M Karras", steps: 28, cfg: 6.5, seed_mode: { type: "per_frame", base_seed: 12345, jitter: 0 }, prompts: { positive: "", negative: "" } }
      });
    }
  }, [project]);

  const fps = project?.meta?.fps ?? 24;

  const maxFrame = useMemo(() => {
    const frames = project?.meta?.frames ?? 180;
    const previewMax = rangeData?.frames?.length ? rangeData.frames.length - 1 : frames - 1;
    return Math.max(0, previewMax);
  }, [project, rangeData]);

  useEffect(() => {
    if (!playing) {
      if (playRef.current) window.clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    const intervalMs = Math.round(1000 / Math.max(1, fps));
    playRef.current = window.setInterval(() => {
      setFrame((f) => (f + 1 > maxFrame ? 0 : f + 1));
    }, intervalMs);

    return () => {
      if (playRef.current) window.clearInterval(playRef.current);
      playRef.current = null;
    };
  }, [playing, fps, maxFrame]);

  const markers: Marker[] = project?.timeline?.markers ?? [];

  const camTrack = useMemo(() => {
    const tracks = project?.timeline?.tracks ?? [];
    return tracks.find((t: any) => t.id === "camera.transform") ?? tracks[0];
  }, [project]);

  const graphKeys = useMemo(() => {
    const ch = camTrack?.channels?.[channelForGraph];
    return ch?.keys ?? [];
  }, [camTrack, channelForGraph]);

  function setGraphKeys(keys: any[]) {
    const p = deepClone(project);
    const idx = p.timeline.tracks.findIndex((t: any) => t.id === camTrack.id);
    if (idx >= 0) {
      p.timeline.tracks[idx].channels[channelForGraph] = p.timeline.tracks[idx].channels[channelForGraph] ?? {};
      p.timeline.tracks[idx].channels[channelForGraph].keys = keys;
    }
    setProject(p);
  }

  function updateTrackPatch(patch: any) {
    const p = deepClone(project);
    const idx = p.timeline.tracks.findIndex((t: any) => t.id === camTrack.id);
    if (idx >= 0) p.timeline.tracks[idx] = { ...p.timeline.tracks[idx], ...patch };
    setProject(p);
  }

  function setMarkers(next: Marker[]) {
    const p = deepClone(project);
    p.timeline.markers = next;
    setProject(p);
  }

  function setFrameSnapped(f: number) {
    const raw = clamp(f, 0, maxFrame);
    const snapped = snapEnabled ? nearestSnapFrame(raw, markers, beats, maxFrame, 3) : raw;
    setFrame(snapped);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "580px 1fr", height: "100vh", fontFamily: "system-ui" }}>
      <div style={{ padding: 12, borderRight: "1px solid #333", overflow: "auto" }}>
        <h2 style={{ margin: "0 0 8px 0" }}>Deforum Next Editor (v6)</h2>

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

        <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <button onClick={() => void refreshPreview()} disabled={!project}>Refresh Preview</button>
          <button onClick={() => setPlaying(p => !p)}>{playing ? "Pause" : "Play"}</button>
          <button onClick={() => setFrameSnapped(0)}>Home</button>
          <label style={{ fontSize: 12, opacity: 0.85 }}>
            <input type="checkbox" checked={snapEnabled} onChange={(e)=>setSnapEnabled(e.target.checked)} /> snap
          </label>
        </div>

        {error && (
          <div style={{ color: "salmon", whiteSpace: "pre-wrap", fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 10, border: "1px solid #333", borderRadius: 6, padding: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}><b>Timeline</b></div>
          <input
            type="range"
            min={0}
            max={maxFrame}
            value={Math.min(frame, maxFrame)}
            onChange={(e) => setFrameSnapped(parseInt(e.target.value, 10))}
            style={{ width: "100%" }}
          />
          <div style={{ fontSize: 12, opacity: 0.8 }}>frame: {Math.min(frame, maxFrame)} / {maxFrame} | fps: {fps}</div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <TimelineMarkers
            frame={Math.min(frame, maxFrame)}
            maxFrame={maxFrame}
            markers={markers}
            onChange={setMarkers}
            beats={beats}
            snapEnabled={snapEnabled}
            setFrame={setFrameSnapped}
          />
          <AudioBeatGrid
            fps={fps}
            maxFrame={maxFrame}
            frame={Math.min(frame, maxFrame)}
            setFrame={setFrameSnapped}
            onAudio={setAudioFile}
            onBeats={setBeats}
          />
          <AudioWaveform
            fps={fps}
            maxFrame={maxFrame}
            frame={Math.min(frame, maxFrame)}
            setFrame={setFrameSnapped}
            beats={beats}
            audioFile={audioFile}
          />
        </div>

        <hr />
        <h3 style={{ margin: "10px 0 6px 0" }}>Camera Rig Stacks</h3>
        <StackEditor
          title="Constraints"
          items={camTrack?.constraints ?? []}
          suggestions={["Rail", "FollowPath", "LookAtObject", "Orbit"]}
          onChange={(items) => updateTrackPatch({ constraints: items })}
        />
        <div style={{ height: 10 }} />
        <StackEditor
          title="Modifiers"
          items={camTrack?.modifiers ?? []}
          suggestions={["AimSpring", "NoiseShake", "DollyZoom", "HorizonLock"]}
          onChange={(items) => updateTrackPatch({ modifiers: items })}
        />

        <hr />
        <h3 style={{ margin: "10px 0 6px 0" }}>Keyframes (with snapping)</h3>
        <KeyframeTable
          track={camTrack}
          onChange={(updated) => updateTrackPatch(updated)}
          snapEnabled={snapEnabled}
          markers={markers}
          beats={beats}
          maxFrame={maxFrame}
        />

        <hr />
        <h3 style={{ margin: "10px 0 6px 0" }}>Graph Editor</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 12, opacity: 0.85 }}>Channel</label>
          <select value={channelForGraph} onChange={(e) => setChannelForGraph(e.target.value)} style={{ flex: 1 }}>
            <option value="rail.u">rail.u</option>
            <option value="target.x">target.x</option>
            <option value="focal_length_mm">focal_length_mm</option>
          </select>
        </div>
        <GraphEditor channelName={channelForGraph} keys={graphKeys} onChange={setGraphKeys} />

        <p style={{ fontSize: 12, opacity: 0.75 }}>
          v5 adds snapping + timeline markers, pan/zoom + selection in the graph editor, HorizonLock modifier, and an A1111 schedule pack exporter.
        </p>
      </div>

      <div style={{ position: "relative" }}>
        <Viewport3D rangeData={rangeData} frame={frame} project={project} />
        <div style={{ position: "absolute", left: 12, bottom: 12, fontSize: 12, padding: 8, background: "rgba(0,0,0,0.5)", color: "white" }}>
          {rangeData ? "Preview loaded" : "Click 'Refresh Preview' to evaluate camera path."}
        </div>
      </div>
    </div>
  );
}
