import React, { useState } from "react";
import ConstraintsPanel from "./ConstraintsPanel";

type ShotOverride = {
  start: number;
  end: number;
  render_overrides: Record<string, any>;
  prompt_override?: string | null;
  prompt_layers?: string[] | null;
  style_layers?: string[] | null;
  negative_prompt_override?: string | null;
  negative_layers?: string[] | null;
  prompt_layers?: string[] | null;
  style_layers?: string[] | null;
  seed_override?: number | null;
  sampler_override?: string | null;
  steps_override?: number | null;
  cfg_override?: number | null;
  camera_constraints_override?: any | null;
};

function computeShotsFromCuts(frames: number[], start: number, end: number): { start: number; end: number }[] {
  const cuts = [...frames].filter(f => f >= start && f <= end).sort((a,b)=>a-b);
  const boundaries = [start, ...cuts, end+1].sort((a,b)=>a-b);
  const out: { start: number; end: number }[] = [];
  for (let i=0; i<boundaries.length-1; i++) {
    const s = boundaries[i];
    const e = boundaries[i+1]-1;
    if (e >= s) out.push({ start: s, end: e });
  }
  return out;
}

export default function ShotOverridesPanel({
  cuts,
  framesTotal,
  overrides,
  onChange,
}: {
  cuts: { frame: number }[];
  framesTotal: number;
  overrides: ShotOverride[];
  onChange: (overrides: ShotOverride[]) => void;
}) {
  const allShots = computeShotsFromCuts(cuts.map(c=>c.frame|0), 0, Math.max(0,(framesTotal|0)-1));

  function getOv(s: number, e: number): ShotOverride {
    const found = (overrides ?? []).find(o => (o.start|0)===s && (o.end|0)===e);
    return found ?? { start: s, end: e, render_overrides: {} };
  }

  function setOv(s: number, e: number, patch: Partial<ShotOverride>) {
    const next = [...(overrides ?? [])];
    const idx = next.findIndex(o => (o.start|0)===s && (o.end|0)===e);
    const base = idx>=0 ? next[idx] : { start: s, end: e, render_overrides: {} };
    const upd: ShotOverride = { ...base, ...patch };

    // Also mirror typed fields into render_overrides (helps older exporters)
    const ro = { ...(upd.render_overrides ?? {}) };
    if (upd.cfg_override !== undefined && upd.cfg_override !== null && ro.cfg === undefined) ro.cfg = upd.cfg_override;
    if (upd.steps_override !== undefined && upd.steps_override !== null && ro.steps === undefined) ro.steps = upd.steps_override;
    if (upd.sampler_override !== undefined && upd.sampler_override !== null && ro.sampler === undefined) ro.sampler = upd.sampler_override;
    if (upd.seed_override !== undefined && upd.seed_override !== null && ro.seed_mode === undefined) ro.seed_mode = { mode: "fixed", seed: upd.seed_override };
    if ((upd.prompt_override || upd.negative_prompt_override) && ro.prompts === undefined) ro.prompts = { base: upd.prompt_override ?? null, negative: upd.negative_prompt_override ?? null };
    upd.render_overrides = ro;

    if (idx>=0) next[idx]=upd; else next.push(upd);

    // remove empty overrides
    const cleaned = next.filter(o => {
      const hasTyped = !!(o.prompt_override || o.negative_prompt_override || o.seed_override || o.sampler_override || o.steps_override || o.cfg_override);
      const hasRO = Object.keys(o.render_overrides ?? {}).length > 0;
      return hasTyped || hasRO;
    });
    onChange(cleaned);
  }

  return (
    <div style={{ display:"grid", gap: 10 }}>
      <b>Shot Overrides (v11)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Per-shot overrides for <b>render + prompts + seed</b>. Allowed keys: sampler, steps, cfg, seed_mode, prompts.
      </div>

      <div style={{ display:"grid", gap: 10 }}>
        {allShots.map((sh, idx)=> {
          const ov = getOv(sh.start, sh.end);
          const ro = ov.render_overrides ?? {};
          return (
            <div key={idx} style={{ border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:10, display:"grid", gap:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div><b>Shot {idx+1}</b> <span style={{ opacity:0.7 }}>({sh.start}-{sh.end})</span></div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{Object.keys(ro).length ? "overrides set" : "no overrides"}</div>
              </div>

              <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:12, opacity:0.85 }}>cfg</div>
                  <input type="number" step={0.1} value={ov.cfg_override ?? ""} onChange={(e)=>setOv(sh.start, sh.end,{cfg_override: e.target.value===""? null : parseFloat(e.target.value)})} style={{ width: 110 }} />
                </div>
                <div>
                  <div style={{ fontSize:12, opacity:0.85 }}>steps</div>
                  <input type="number" step={1} value={ov.steps_override ?? ""} onChange={(e)=>setOv(sh.start, sh.end,{steps_override: e.target.value===""? null : parseInt(e.target.value,10)})} style={{ width: 110 }} />
                </div>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontSize:12, opacity:0.85 }}>sampler</div>
                  <input type="text" value={ov.sampler_override ?? ""} placeholder="e.g. DPM++ 2M Karras" onChange={(e)=>setOv(sh.start, sh.end,{sampler_override: e.target.value||null})} style={{ width: 240 }} />
                </div>
                <div>
                  <div style={{ fontSize:12, opacity:0.85 }}>seed</div>
                  <input type="number" step={1} value={ov.seed_override ?? ""} onChange={(e)=>setOv(sh.start, sh.end,{seed_override: e.target.value===""? null : parseInt(e.target.value,10)})} style={{ width: 130 }} />
                </div>
              </div>

              <div style={{ display:"grid", gap: 6 }}>
                <div style={{ fontSize:12, opacity:0.85 }}>Prompt override (base)</div>
                <textarea value={ov.prompt_override ?? ""} placeholder="Leave empty to use global base prompt" onChange={(e)=>setOv(sh.start, sh.end,{prompt_override: e.target.value||null})} style={{ width:"100%", minHeight: 54 }} />
              </div>
<div style={{ display:"grid", gap: 6 }}>
  <div style={{ fontSize:12, opacity:0.85 }}>Prompt layers (one per line)</div>
  <textarea
    value={(ov.prompt_layers ?? []).join("\n")}
    placeholder="e.g. slow dolly-in\n35mm film look\nvolumetric haze"
    onChange={(e)=>setOv(sh.start, sh.end,{prompt_layers: (e.target.value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean)})}
    style={{ width:"100%", minHeight: 64 }}
  />
</div>

<div style={{ display:"grid", gap: 6 }}>
  <div style={{ fontSize:12, opacity:0.85 }}>Style layers (one per line)</div>
  <textarea
    value={(ov.style_layers ?? []).join("\n")}
    placeholder="e.g. Pixar 3D\nsoft global illumination\nclean edges"
    onChange={(e)=>setOv(sh.start, sh.end,{style_layers: (e.target.value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean)})}
    style={{ width:"100%", minHeight: 64 }}
  />
</div>

              <div style={{ display:"grid", gap: 6 }}>
                <div style={{ fontSize:12, opacity:0.85 }}>Negative override</div>
                <textarea value={ov.negative_prompt_override ?? ""} placeholder="Leave empty to use global negative" onChange={(e)=>setOv(sh.start, sh.end,{negative_prompt_override: e.target.value||null})} style={{ width:"100%", minHeight: 54 }} />
              </div>
<div style={{ display:"grid", gap: 6 }}>
  <div style={{ fontSize:12, opacity:0.85 }}>Negative layers (one per line)</div>
  <textarea
    value={(ov.negative_layers ?? []).join("\n")}
    placeholder="e.g. text\nwatermark\nextra fingers"
    onChange={(e)=>setOv(sh.start, sh.end,{negative_layers: (e.target.value||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean)})}
    style={{ width:"100%", minHeight: 64 }}
  />
</div>

              <div style={{ fontSize: 12, opacity: 0.65 }}>
                Note: typed fields are mirrored into <code>render_overrides</code> to keep exports backward compatible.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
