import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  fps: number;
  frame: number;
  setFrame: (f: number) => void;
  maxFrame: number;
  beats: { time: number; frame: number; strength: number }[];
  audioFile: File | null;
};

function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

export default function AudioWaveform({ fps, frame, setFrame, maxFrame, beats, audioFile }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [sr, setSr] = useState<number>(44100);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!audioFile) { setSamples(null); return; }
      const ab = await audioFile.arrayBuffer();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      const ch0 = buf.getChannelData(0);
      setSr(buf.sampleRate);
      // Downsample for drawing (max 120k points)
      const maxPts = 120000;
      const step = Math.max(1, Math.floor(ch0.length / maxPts));
      const down = new Float32Array(Math.floor(ch0.length / step));
      for (let i = 0, j = 0; i < ch0.length; i += step, j++) down[j] = ch0[i];
      if (!cancelled) setSamples(down);
      await ctx.close();
    }
    void load();
    return () => { cancelled = true; };
  }, [audioFile]);

  const durationSec = useMemo(() => {
    if (!samples) return 0;
    // approximate duration from downsampled count; original length unknown here, but good enough for UI.
    // treat downsampled as representative; we rely on maxFrame anyway.
    return maxFrame / Math.max(1, fps);
  }, [samples, fps, maxFrame]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);

    // background
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0, 0, W, H);

    // waveform
    if (samples) {
      ctx.strokeStyle = "#66ccff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const mid = H / 2;
      for (let x = 0; x < W; x++) {
        const i = Math.floor((x / (W - 1)) * (samples.length - 1));
        const y = mid - samples[i] * (mid * 0.85);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = "#888";
      ctx.font = "12px system-ui";
      ctx.fillText("Load audio to see waveform", 10, 18);
    }

    // beat markers
    if (beats?.length) {
      ctx.strokeStyle = "#ffcc66";
      ctx.lineWidth = 1;
      for (const b of beats) {
        const u = clamp(b.frame / Math.max(1, maxFrame), 0, 1);
        const x = u * (W - 1);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    // playhead
    const u = clamp(frame / Math.max(1, maxFrame), 0, 1);
    const px = u * (W - 1);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, H);
    ctx.stroke();

  }, [samples, beats, frame, maxFrame, fps]);

  function onClick(e: React.MouseEvent) {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const u = clamp(x / rect.width, 0, 1);
    const f = Math.round(u * maxFrame);
    setFrame(f);
  }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ fontWeight: 700 }}>Audio Timeline</div>
      <canvas ref={canvasRef} width={480} height={120} onClick={onClick} style={{ width: "100%", cursor: "pointer", borderRadius: 6 }} />
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Click waveform to seek. Beats shown as yellow markers; playhead is white.
      </div>
    </div>
  );
}
