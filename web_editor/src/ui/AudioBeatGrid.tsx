import React, { useMemo, useRef, useState } from "react";

export type Beat = { time: number; frame: number; strength: number };

type Props = {
  fps: number;
  maxFrame: number;
  frame: number;
  setFrame: (f: number) => void;
  onAudio?: (file: File | null) => void;
  onBeats?: (beats: Beat[]) => void;
};

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

// Lightweight peak picking on short-time energy (MVP)
async function detectBeats(file: File, fps: number): Promise<Beat[]> {
  const arrayBuf = await file.arrayBuffer();
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
  const ch0 = audioBuf.getChannelData(0);
  const sr = audioBuf.sampleRate;

  const win = 1024;
  const hop = 512;
  const energies: number[] = [];
  for (let i = 0; i + win < ch0.length; i += hop) {
    let e = 0;
    for (let j = 0; j < win; j++) {
      const s = ch0[i + j];
      e += s * s;
    }
    energies.push(e / win);
  }

  const maxE = Math.max(...energies, 1e-9);
  const norm = energies.map(e => e / maxE);

  const beats: Beat[] = [];
  const radius = 8;
  for (let i = 1; i < norm.length - 1; i++) {
    let sum = 0;
    let cnt = 0;
    for (let k = -radius; k <= radius; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < norm.length) { sum += norm[idx]; cnt++; }
    }
    const mean = sum / Math.max(1, cnt);
    const thresh = mean * 1.35;
    const isPeak = norm[i] > thresh && norm[i] > norm[i - 1] && norm[i] > norm[i + 1];
    if (isPeak) {
      const time = (i * hop) / sr;
      const frame = Math.round(time * fps);
      beats.push({ time, frame, strength: norm[i] });
    }
  }

  const bin = 0.2;
  const binned: Beat[] = [];
  let cur: Beat[] = [];
  let curStart = 0;
  for (const b of beats) {
    if (b.time - curStart > bin) {
      if (cur.length) {
        cur.sort((a, b) => b.strength - a.strength);
        binned.push(cur[0]);
      }
      cur = [b];
      curStart = b.time;
    } else {
      cur.push(b);
    }
  }
  if (cur.length) {
    cur.sort((a, b) => b.strength - a.strength);
    binned.push(cur[0]);
  }

  await ctx.close();
  return binned;
}

export default function AudioBeatGrid({ fps, maxFrame, frame, setFrame, onAudio, onBeats }: Props) {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const nearest = useMemo(() => {
    if (!beats.length) return null;
    let best = beats[0];
    let bestD = Math.abs(best.frame - frame);
    for (const b of beats) {
      const d = Math.abs(b.frame - frame);
      if (d < bestD) { best = b; bestD = d; }
    }
    return { beat: best, dist: bestD };
  }, [beats, frame]);

  async function onPick(file: File) {
    setError(null);
    setBeats([]);
    setAudioFile(file);
    onAudio?.(file);
    try {
      const res = await detectBeats(file, fps);
      const filtered = res.filter(b => b.frame >= 0 && b.frame <= maxFrame);
      setBeats(filtered);
      onBeats?.(filtered);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  function snapToNearest() {
    if (!nearest) return;
    setFrame(clamp(nearest.beat.frame, 0, maxFrame));
  }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Audio Beat Grid</div>
        <label style={{ fontSize: 12, opacity: 0.85 }}>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> snap
        </label>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPick(f);
        }}
      />

      {error && <div style={{ color: "salmon", fontSize: 12, whiteSpace: "pre-wrap" }}>{error}</div>}

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        file: <b>{audioFile ? audioFile.name : "—"}</b> | beats: <b>{beats.length}</b> {beats.length ? `(nearest Δ ${nearest?.dist ?? 0} frames)` : ""}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={snapToNearest} disabled={!beats.length}>Snap to nearest beat</button>
        <button onClick={() => { setBeats([]); setAudioFile(null); onAudio?.(null); onBeats?.([]); }} disabled={!beats.length && !audioFile}>Clear</button>
      </div>

      <div style={{ maxHeight: 140, overflow: "auto", border: "1px solid #222", borderRadius: 6, padding: 6 }}>
        {beats.length ? (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.85 }}>
                <th>time (s)</th>
                <th>frame</th>
                <th>strength</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {beats.slice(0, 200).map((b, i) => (
                <tr key={i}>
                  <td>{b.time.toFixed(3)}</td>
                  <td>{b.frame}</td>
                  <td>{b.strength.toFixed(3)}</td>
                  <td><button onClick={() => setFrame(clamp(b.frame, 0, maxFrame))}>go</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Load an audio file to detect beats.</div>
        )}
      </div>

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Notes: peak-based detection; robust enough for snapping preview frames. A future v5 can implement spectral flux + tempo inference.
      </div>
    </div>
  );
}
