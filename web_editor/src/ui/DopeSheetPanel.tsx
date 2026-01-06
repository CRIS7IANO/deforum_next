import React, { useMemo, useRef, useState } from "react";
import { Key, getAllTracks, listChannels, getKeys, setKeys, clone, snapInt, safeNum } from "./keyframe_utils";

type Props = {
  project: any;
  maxFrame: number;
  onUpdateProject: (next: any) => void;
  onSelect: (trackId: string, channel: string) => void;
  selectedTrackId: string;
  selectedChannel: string;
};

type Row = { trackId: string; channel: string; keys: Key[] };

export default function DopeSheetPanel({ project, maxFrame, onUpdateProject, onSelect, selectedTrackId, selectedChannel }: Props) {
  const tracks = useMemo(() => getAllTracks(project), [project]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const t of tracks) {
      const chans = listChannels(t);
      for (const ch of chans) {
        out.push({ trackId: t.id, channel: ch, keys: getKeys(t, ch) || [] });
      }
    }
    return out;
  }, [tracks]);

  const [globalShift, setGlobalShift] = useState(0);

  // multi-row selection
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const lastClickedRef = useRef<number | null>(null);

  // box select
  const [boxSelecting, setBoxSelecting] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ripple
  const [rippleFrom, setRippleFrom] = useState(0);
  const [rippleDelta, setRippleDelta] = useState(10);
  const [rippleScope, setRippleScope] = useState<"selected" | "all">("selected");

  const keyForRow = (r: Row) => `${r.trackId}::${r.channel}`;

  const applyGlobalShift = () => {
    const s = snapInt(safeNum(globalShift, 0));
    if (!Number.isFinite(s) || s === 0) return;
    const p = clone(project);
    for (const t of (p?.timeline?.tracks ?? [])) {
      for (const ch of Object.keys(t.channels ?? {})) {
        const ks: Key[] = (t.channels[ch].keys ?? []) as any;
        const shifted = ks.map((k) => ({ ...k, t: Math.max(0, Math.min(maxFrame, snapInt(k.t + s))) }));
        setKeys(t, ch, shifted);
      }
    }
    onUpdateProject(p);
  };

  const applyRipple = () => {
    const from = snapInt(safeNum(rippleFrom, 0));
    const delta = snapInt(safeNum(rippleDelta, 0));
    if (!Number.isFinite(from) || !Number.isFinite(delta) || delta === 0) return;

    const p = clone(project);
    const scopeSelected = rippleScope === "selected";

    const selectedKeys = selectedRows;

    for (const t of (p?.timeline?.tracks ?? [])) {
      for (const ch of Object.keys(t.channels ?? {})) {
        const rowId = `${t.id}::${ch}`;
        if (scopeSelected && !selectedKeys[rowId]) continue;

        const ks: Key[] = (t.channels[ch].keys ?? []) as any;
        const shifted = ks.map((k) => {
          if (k.t >= from) {
            return { ...k, t: Math.max(0, Math.min(maxFrame, snapInt(k.t + delta))) };
          }
          return k;
        });
        setKeys(t, ch, shifted);
      }
    }
    onUpdateProject(p);
  };

  const clearSelection = () => setSelectedRows({});

  const selectSingle = (idx: number) => {
    const r = rows[idx];
    const id = keyForRow(r);
    setSelectedRows({ [id]: true });
    lastClickedRef.current = idx;
  };

  const toggleRow = (idx: number) => {
    const r = rows[idx];
    const id = keyForRow(r);
    setSelectedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    lastClickedRef.current = idx;
  };

  const rangeSelect = (idx: number) => {
    const last = lastClickedRef.current;
    if (last === null) return selectSingle(idx);
    const a = Math.min(last, idx);
    const b = Math.max(last, idx);
    const next: Record<string, boolean> = { ...selectedRows };
    for (let i = a; i <= b; i++) {
      next[keyForRow(rows[i])] = true;
    }
    setSelectedRows(next);
  };

  const onRowClick = (e: React.MouseEvent, idx: number) => {
    if (e.shiftKey) rangeSelect(idx);
    else if (e.ctrlKey || e.metaKey) toggleRow(idx);
    else selectSingle(idx);

    const r = rows[idx];
    onSelect(r.trackId, r.channel);
  };

  // box select (mouse drag on empty area)
  const onMouseDownContainer = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only start box select if click is on container background (not on a row)
    const target = e.target as HTMLElement;
    if (target.closest("tr")) return;
    const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
    setBoxSelecting(true);
    setBoxStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    clearSelection();
  };

  const onMouseMoveContainer = (e: React.MouseEvent) => {
    if (!boxSelecting || !boxStart || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const x0 = Math.min(boxStart.x, x);
    const x1 = Math.max(boxStart.x, x);
    const y0 = Math.min(boxStart.y, y);
    const y1 = Math.max(boxStart.y, y);

    // select rows whose bounding boxes intersect y-range (simple)
    const table = containerRef.current.querySelector("table");
    if (!table) return;
    const trs = Array.from(table.querySelectorAll("tbody tr"));
    const next: Record<string, boolean> = {};
    trs.forEach((tr, i) => {
      const trRect = tr.getBoundingClientRect();
      const localTop = trRect.top - rect.top;
      const localBot = trRect.bottom - rect.top;
      const intersectsY = !(localBot < y0 || localTop > y1);
      if (intersectsY) next[keyForRow(rows[i])] = true;
    });
    setSelectedRows(next);
  };

  const onMouseUpContainer = () => {
    setBoxSelecting(false);
    setBoxStart(null);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <b>Dope Sheet (v18)</b>
      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
        Multi-select rows with Ctrl/Cmd, range-select with Shift. Drag on empty area to box-select rows. Ripple tool can shift keys after a frame.
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12 }}>
          Global key shift (frames):
          <input style={{ marginLeft: 8, width: 120 }} type="number" value={globalShift} onChange={(e) => setGlobalShift(safeNum(e.target.value, 0) as any)} />
        </label>
        <button onClick={applyGlobalShift}>Apply shift</button>

        <span style={{ width: 10 }} />

        <label style={{ fontSize: 12 }}>
          Ripple from frame:
          <input style={{ marginLeft: 8, width: 120 }} type="number" value={rippleFrom} onChange={(e) => setRippleFrom(safeNum(e.target.value, 0) as any)} />
        </label>
        <label style={{ fontSize: 12 }}>
          Delta:
          <input style={{ marginLeft: 8, width: 120 }} type="number" value={rippleDelta} onChange={(e) => setRippleDelta(safeNum(e.target.value, 10) as any)} />
        </label>
        <label style={{ fontSize: 12 }}>
          Scope:
          <select style={{ marginLeft: 8 }} value={rippleScope} onChange={(e) => setRippleScope(e.target.value as any)}>
            <option value="selected">selected rows</option>
            <option value="all">all rows</option>
          </select>
        </label>
        <button onClick={applyRipple} disabled={rippleScope === "selected" && Object.keys(selectedRows).length === 0}>Apply ripple</button>
        <button onClick={clearSelection}>Clear selection</button>
      </div>

      <div
        ref={containerRef}
        onMouseDown={onMouseDownContainer}
        onMouseMove={onMouseMoveContainer}
        onMouseUp={onMouseUpContainer}
        onMouseLeave={onMouseUpContainer}
        style={{ border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, overflow: "hidden", position: "relative" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "rgba(148,163,184,0.10)" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Track</th>
              <th style={{ textAlign: "left", padding: 8 }}>Channel</th>
              <th style={{ textAlign: "left", padding: 8 }}>Keys</th>
              <th style={{ textAlign: "left", padding: 8 }}>Frames</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const sel = !!selectedRows[keyForRow(r)];
              const active = r.trackId === selectedTrackId && r.channel === selectedChannel;
              const frames = (r.keys || []).map((k) => k.t).slice(0, 20);
              return (
                <tr
                  key={keyForRow(r)}
                  onClick={(e) => onRowClick(e, idx)}
                  style={{
                    cursor: "pointer",
                    background: active ? "rgba(34,211,238,0.14)" : sel ? "rgba(251,191,36,0.12)" : "transparent",
                    borderTop: "1px solid rgba(148,163,184,0.12)",
                  }}
                >
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{r.trackId}</td>
                  <td style={{ padding: 8, whiteSpace: "nowrap" }}>{r.channel}</td>
                  <td style={{ padding: 8 }}>{(r.keys || []).length}</td>
                  <td style={{ padding: 8, opacity: 0.85 }}>{frames.join(", ")}{(r.keys || []).length > 20 ? "…" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {boxSelecting && boxStart ? (
          <div style={{ position: "absolute", left: boxStart.x, top: boxStart.y, width: 1, height: 1, pointerEvents: "none" }} />
        ) : null}
      </div>

      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Selected rows: {Object.keys(selectedRows).length}
      </div>
    </div>
  );
}
