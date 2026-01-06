import React from "react";

export type Cut = {
  frame: number;
  transition: string;
  duration_frames: number;
  curve?: [number, number, number, number] | null;
};

function defaultCut(frame: number): Cut {
  return { frame, transition: "hard", duration_frames: 0, curve: null };
}

export default function CutsEditor({
  frame,
  cuts,
  onChange,
  onAddMarkerCut,
}: {
  frame: number;
  cuts: Cut[];
  onChange: (cuts: Cut[]) => void;
  onAddMarkerCut?: (frame: number) => void;
}) {
  const sorted = [...(cuts ?? [])].sort((a, b) => (a.frame|0) - (b.frame|0));

  function addAtCurrent() {
    const f = frame|0;
    if (sorted.find(c => (c.frame|0) === f)) return;
    const next = [...sorted, defaultCut(f)].sort((a,b)=> (a.frame|0)-(b.frame|0));
    onChange(next);
    onAddMarkerCut?.(f);
  }

  function update(idx: number, patch: Partial<Cut>) {
    const next = sorted.map((c, i) => i === idx ? ({ ...c, ...patch }) : c);
    onChange(next);
  }

  function remove(idx: number) {
    const next = sorted.filter((_, i) => i !== idx);
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>Camera Cuts</b>
        <button onClick={addAtCurrent}>Add Cut @ frame {frame}</button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Cuts are exported as shot boundaries. You can optionally set a transition for the cut-out.
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {sorted.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>No cuts. Add one to split into shots.</div>
        ) : null}

        {sorted.map((c, idx) => (
          <div key={idx} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Frame</div>
                <input type="number" value={c.frame} min={0} onChange={(e)=>update(idx,{frame: parseInt(e.target.value||"0",10)})} style={{ width: 110 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Transition</div>
                <select value={c.transition} onChange={(e)=>update(idx,{transition:e.target.value})}>
                  <option value="hard">hard</option>
                  <option value="dissolve">dissolve</option>
                  <option value="match">match</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>Duration</div>
                <input type="number" value={c.duration_frames ?? 0} min={0} onChange={(e)=>update(idx,{duration_frames: parseInt(e.target.value||"0",10)})} style={{ width: 110 }} />
              </div>
              <button onClick={()=>remove(idx)}>Remove</button>
            </div>

            {c.transition === "dissolve" ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>curve</span>
                {([0,1,2,3] as const).map((j)=>(
                  <input
                    key={j}
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={(c.curve ?? [0.42,0,0.58,1])[j]}
                    onChange={(e)=>{
                      const cur = c.curve ?? [0.42,0,0.58,1];
                      const v = parseFloat(e.target.value||"0");
                      const next:[number,number,number,number]=[cur[0],cur[1],cur[2],cur[3]];
                      next[j]=isFinite(v)?v:cur[j];
                      update(idx,{curve: next});
                    }}
                    style={{ width: 70 }}
                  />
                ))}
                <button onClick={()=>update(idx,{curve:[0.42,0,0.58,1]})}>easeInOut</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
