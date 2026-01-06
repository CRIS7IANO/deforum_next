import React, { useMemo, useState } from "react";

type Props = {
  project: any;
  maxFrame: number;
  onUpdateProject: (p: any) => void;
};

type Shot = {
  id: string;
  name?: string;
  start: number;
  end: number;
  transition_in?: number;
  transition_out?: number;
  camera_constraints_override?: any;
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function uid(prefix = "shot") {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

export default function ShotTimelinePanel({ project, maxFrame, onUpdateProject }: Props) {
  const shots: Shot[] = useMemo(() => (project?.timeline?.shots ?? []) as any, [project]);
  const [selectedId, setSelectedId] = useState<string | null>(shots?.[0]?.id ?? null);

  const selected = useMemo(() => shots.find((s) => s.id === selectedId) ?? null, [shots, selectedId]);

  const ensureShots = (p: any) => {
    p.timeline = p.timeline || {};
    p.timeline.shots = p.timeline.shots || [];
    return p.timeline.shots as Shot[];
  };

  const setShots = (next: Shot[]) => {
    const p = clone(project);
    const arr = ensureShots(p);
    arr.splice(0, arr.length, ...next);
    // normalize order
    arr.sort((a: Shot, b: Shot) => a.start - b.start);
    onUpdateProject(p);
  };

  const addShot = () => {
    const next = [...shots];
    const lastEnd = next.length ? next[next.length - 1].end : 0;
    const s: Shot = { id: uid(), name: `Shot ${next.length + 1}`, start: lastEnd, end: clamp(lastEnd + 60, 1, maxFrame), transition_in: 0, transition_out: 0 };
    next.push(s);
    setShots(next);
    setSelectedId(s.id);
  };

  const deleteShot = () => {
    if (!selectedId) return;
    const next = shots.filter((s) => s.id !== selectedId);
    setShots(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const splitAt = (frame: number) => {
    const f = clamp(Math.round(frame), 0, maxFrame);
    if (!selected) return;
    if (!(selected.start < f && f < selected.end)) {
      alert("Split frame must be inside the selected shot range.");
      return;
    }
    const a: Shot = { ...selected, end: f };
    const b: Shot = { ...selected, id: uid(), name: (selected.name || "Shot") + " (B)", start: f, end: selected.end };
    const next = shots.filter((s) => s.id !== selected.id);
    next.push(a, b);
    setShots(next);
    setSelectedId(b.id);
  };

  const updateSelected = (patch: Partial<Shot>) => {
    if (!selected) return;
    const next = shots.map((s) => (s.id === selected.id ? { ...s, ...patch } : s));
    setShots(next);
  };

  const total = Math.max(1, maxFrame);
  const pxW = 760;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <b>Shot Timeline (v18)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Manage shots/cuts at a cinematic level. Each shot defines a frame range and optional transition in/out (blend region).
        Shot-level camera constraint overrides can be edited in the JSON view in later versions; this panel focuses on timing and transitions.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={addShot}>Add shot</button>
        <button onClick={deleteShot} disabled={!selected}>Delete selected</button>
        <label style={{ fontSize: 12 }}>
          Split selected at frame:
          <input style={{ marginLeft: 8, width: 120 }} type="number" defaultValue={selected ? Math.round((selected.start + selected.end) / 2) : 0}
            onKeyDown={(e) => {
              if (e.key === "Enter") splitAt(parseFloat((e.target as HTMLInputElement).value));
            }}
          />
          <span style={{ marginLeft: 8, opacity: 0.7 }}>(press Enter)</span>
        </label>
      </div>

      <div style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, padding: 10 }}>
        <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
          <div style={{ position: "relative", width: pxW, height: 46, background: "rgba(148,163,184,0.06)", borderRadius: 8 }}>
            {shots.map((s) => {
              const left = (s.start / total) * pxW;
              const width = Math.max(2, ((s.end - s.start) / total) * pxW);
              const isSel = s.id === selectedId;
              const tin = Math.max(0, s.transition_in ?? 0);
              const tout = Math.max(0, s.transition_out ?? 0);
              const tinW = (tin / total) * pxW;
              const toutW = (tout / total) * pxW;

              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  title={`${s.name ?? s.id}  [${s.start}-${s.end}]`}
                  style={{
                    position: "absolute",
                    left,
                    top: 8,
                    width,
                    height: 30,
                    borderRadius: 8,
                    cursor: "pointer",
                    border: isSel ? "2px solid rgba(34,211,238,0.9)" : "1px solid rgba(148,163,184,0.25)",
                    background: isSel ? "rgba(34,211,238,0.18)" : "rgba(226,232,240,0.10)",
                    overflow: "hidden",
                  }}
                >
                  {/* blend regions */}
                  {tin > 0 ? (
                    <div style={{ position: "absolute", left: 0, top: 0, width: tinW, height: "100%", background: "rgba(251,191,36,0.20)" }} />
                  ) : null}
                  {tout > 0 ? (
                    <div style={{ position: "absolute", right: 0, top: 0, width: toutW, height: "100%", background: "rgba(251,191,36,0.20)" }} />
                  ) : null}

                  <div style={{ position: "absolute", left: 8, top: 6, fontSize: 12, opacity: 0.9, whiteSpace: "nowrap" }}>
                    {s.name ?? s.id}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selected ? (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: 12 }}>
                Name:
                <input style={{ marginLeft: 8, width: 220 }} value={selected.name ?? ""} onChange={(e) => updateSelected({ name: e.target.value })} />
              </label>
              <label style={{ fontSize: 12 }}>
                Start:
                <input style={{ marginLeft: 8, width: 120 }} type="number" value={selected.start} onChange={(e) => updateSelected({ start: clamp(Math.round(parseFloat(e.target.value)), 0, maxFrame - 1) })} />
              </label>
              <label style={{ fontSize: 12 }}>
                End:
                <input style={{ marginLeft: 8, width: 120 }} type="number" value={selected.end} onChange={(e) => updateSelected({ end: clamp(Math.round(parseFloat(e.target.value)), 1, maxFrame) })} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: 12 }}>
                Transition In (frames):
                <input style={{ marginLeft: 8, width: 120 }} type="number" value={selected.transition_in ?? 0}
                  onChange={(e) => updateSelected({ transition_in: clamp(Math.round(parseFloat(e.target.value)), 0, selected.end - selected.start) })} />
              </label>
              <label style={{ fontSize: 12 }}>
                Transition Out (frames):
                <input style={{ marginLeft: 8, width: 120 }} type="number" value={selected.transition_out ?? 0}
                  onChange={(e) => updateSelected({ transition_out: clamp(Math.round(parseFloat(e.target.value)), 0, selected.end - selected.start) })} />
              </label>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Blend regions are highlighted in amber on the shot block.
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
              <b>Notes:</b> transitions are currently metadata for editorial continuity. Upcoming versions can use these frames to automatically
              generate camera/seed/prompt blends, or to bake cross-fades in the render pipeline.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>No shot selected.</div>
        )}
      </div>
    </div>
  );
}
