import React from "react";

type Props = {
  track: any;
  onChange: (track: any) => void;
};

function ensure(track: any, name: string) {
  track.channels = track.channels ?? {};
  if (!track.channels[name]) track.channels[name] = { keys: [] };
  if (!track.channels[name].keys) track.channels[name].keys = [];
}

export default function KeyframeTable({ track, onChange }: Props) {
  const channels = track?.channels ?? {};
  const names = ["position.x", "position.y", "position.z", "focal_length_mm"];

  function addKey(ch: string) {
    const t = window.prompt("Frame (t)?", "0");
    const v = window.prompt("Value (v)?", "0.0");
    if (t == null || v == null) return;
    const tt = Math.max(0, parseInt(t, 10));
    const vv = parseFloat(v);
    const next = JSON.parse(JSON.stringify(track));
    ensure(next, ch);
    next.channels[ch].keys.push({ t: tt, v: vv, interp: "bezier" });
    next.channels[ch].keys.sort((a: any, b: any) => a.t - b.t);
    onChange(next);
  }

  function delKey(ch: string, idx: number) {
    const next = JSON.parse(JSON.stringify(track));
    ensure(next, ch);
    next.channels[ch].keys.splice(idx, 1);
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {names.map((ch) => {
        const keys = channels[ch]?.keys ?? [];
        return (
          <div key={ch} style={{ border: "1px solid #333", borderRadius: 6, padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{ch}</div>
              <button onClick={() => addKey(ch)}>+ Key</button>
            </div>
            {keys.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.75 }}>No keys</div>
            ) : (
              <table style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th align="left">t</th>
                    <th align="left">v</th>
                    <th align="left">interp</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k: any, idx: number) => (
                    <tr key={idx}>
                      <td>{k.t}</td>
                      <td>{k.v}</td>
                      <td>{k.interp}</td>
                      <td align="right"><button onClick={() => delKey(ch, idx)}>Del</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
