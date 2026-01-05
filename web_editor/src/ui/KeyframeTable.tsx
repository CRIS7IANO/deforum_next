import React, { useMemo, useState } from "react";
import { nearestSnapFrame, Marker } from "./TimelineMarkers";

type Props = {
  track: any;
  onChange: (trackPatch: any) => void;
  snapEnabled?: boolean;
  markers?: Marker[];
  beats?: { frame: number }[];
  maxFrame?: number;
};

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

export default function KeyframeTable({ track, onChange, snapEnabled=false, markers=[], beats=[], maxFrame=100000 }: Props) {
  const channels = track?.channels ?? {};
  const channelNames = useMemo(() => Object.keys(channels).sort(), [channels]);
  const [selectedChannel, setSelectedChannel] = useState(channelNames[0] ?? "");

  const keys = useMemo(() => {
    const ch = channels?.[selectedChannel];
    return ch?.keys ?? [];
  }, [channels, selectedChannel]);

  function setKeys(nextKeys: any[]) {
    const patch = deepClone(track);
    patch.channels = patch.channels ?? {};
    patch.channels[selectedChannel] = patch.channels[selectedChannel] ?? {};
    patch.channels[selectedChannel].keys = nextKeys;
    onChange(patch);
  }

  function snapFrameIfNeeded(t: number) {
    const tt = clamp(Math.round(t), 0, maxFrame);
    if (!snapEnabled) return tt;
    return nearestSnapFrame(tt, markers, beats as any, maxFrame, 3);
  }

  function addKey() {
    const t = snapFrameIfNeeded(0);
    const next = [...keys, { t, v: 0.0, interp: "bezier" }].sort((a,b)=>a.t-b.t);
    setKeys(next);
  }

  function removeKey(i: number) {
    const next = keys.filter((_: any, idx: number) => idx !== i);
    setKeys(next);
  }

  function updateKey(i: number, patch: any) {
    const next = deepClone(keys);
    next[i] = { ...next[i], ...patch };
    if (patch.t !== undefined) next[i].t = snapFrameIfNeeded(patch.t);
    next.sort((a:any,b:any)=>a.t-b.t);
    setKeys(next);
  }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ fontSize: 12, opacity: 0.85 }}>Channel</label>
        <select value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)} style={{ flex: 1 }}>
          {channelNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button onClick={addKey} disabled={!selectedChannel}>Add key</button>
      </div>

      {selectedChannel ? (
        <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #222", borderRadius: 6, padding: 6 }}>
          {keys.length ? (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.85 }}>
                  <th>t</th><th>v</th><th>interp</th><th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k: any, i: number) => (
                  <tr key={i}>
                    <td><input type="number" value={k.t} onChange={(e) => updateKey(i, { t: parseInt(e.target.value, 10) || 0 })} style={{ width: 90 }} /></td>
                    <td><input type="number" value={k.v} onChange={(e) => updateKey(i, { v: parseFloat(e.target.value) || 0 })} style={{ width: 120 }} /></td>
                    <td>
                      <select value={k.interp ?? "bezier"} onChange={(e) => updateKey(i, { interp: e.target.value })}>
                        <option value="bezier">bezier</option>
                        <option value="linear">linear</option>
                        <option value="hold">hold</option>
                      </select>
                    </td>
                    <td><button onClick={() => removeKey(i)}>del</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.75 }}>No keyframes.</div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>No channels found.</div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Snapping uses beats + markers within ±3 frames (MVP).
      </div>
    </div>
  );
}
