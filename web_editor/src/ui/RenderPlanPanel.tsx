import React, { useMemo } from "react";

function computePlan(cuts: any[], framesTotal: number) {
  const frames = (cuts ?? []).map((c: any) => (c.frame|0)).sort((a:number,b:number)=>a-b);
  const boundaries = [0, ...frames, Math.max(0,(framesTotal|0)-1)+1].sort((a:number,b:number)=>a-b);
  const shots: { start: number; end: number; transition_out?: any }[] = [];
  for (let i=0;i<boundaries.length-1;i++){
    const s = boundaries[i];
    const e = boundaries[i+1]-1;
    if (e>=s) shots.push({ start:s, end:e });
  }
  // attach transition_out by end frame
  const cutMap: Record<number, any> = {};
  for (const c of (cuts ?? [])) cutMap[(c.frame|0)] = c;
  for (const sh of shots) sh.transition_out = cutMap[sh.end] ?? null;

  const segments: any[] = [];
  const transitions: any[] = [];
  for (let i=0;i<shots.length;i++){
    const sh = shots[i];
    segments.push({ shot_index:i, type:"main", start:sh.start, end:sh.end });
    const to = sh.transition_out;
    if (to && (to.transition === "dissolve") && (to.duration_frames|0) > 0 && i+1 < shots.length){
      const d = to.duration_frames|0;
      const tail_s = Math.max(sh.start, sh.end - d + 1);
      const head_e = Math.min((framesTotal|0)-1, sh.end + d);
      transitions.push({ at_frame: sh.end, type:"dissolve", duration_frames:d, tail:{shot_index:i,start:tail_s,end:sh.end}, head:{shot_index:i+1,start:sh.end+1,end:Math.min((framesTotal|0)-1, sh.end+d)}});
      segments.push({ shot_index:i, type:"overlap_tail", start:tail_s, end:sh.end });
      segments.push({ shot_index:i+1, type:"overlap_head", start:sh.end+1, end:Math.min((framesTotal|0)-1, sh.end+d) });
    }
  }
  return { shots, segments, transitions };
}

export default function RenderPlanPanel({ cuts, framesTotal }: { cuts: any[]; framesTotal: number }) {
  const plan = useMemo(()=>computePlan(cuts, framesTotal), [cuts, framesTotal]);

  return (
    <div style={{ display:"grid", gap: 10 }}>
      <b>Render Plan (v11)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Preview of overlap segments for transitions. Use CLI <code>deforumx export-render-plan</code> to export a JSON plan.
      </div>

      <div style={{ display:"grid", gap: 8 }}>
        <div style={{ fontSize: 12, opacity: 0.85 }}><b>Shots:</b> {plan.shots.length} | <b>Transitions:</b> {plan.transitions.length}</div>

        <div style={{ border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:10, display:"grid", gap:6, maxHeight: 220, overflow:"auto" }}>
          {plan.segments.map((s:any, i:number)=>(
            <div key={i} style={{ fontSize: 12, opacity: 0.9 }}>
              <code>{s.type}</code> — shot {s.shot_index} — frames {s.start}-{s.end}
            </div>
          ))}
        </div>

        {plan.transitions.length ? (
          <div style={{ border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:10, display:"grid", gap:6 }}>
            {plan.transitions.map((t:any, i:number)=>(
              <div key={i} style={{ fontSize: 12 }}>
                dissolve @ {t.at_frame} for {t.duration_frames}f — tail {t.tail.start}-{t.tail.end}, head {t.head.start}-{t.head.end}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
