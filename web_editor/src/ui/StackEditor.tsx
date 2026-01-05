import React, { useState } from "react";

type Item = { type: string; order?: number; enabled?: boolean; params?: any };

type Props = {
  title: string;
  items: Item[];
  onChange: (items: Item[]) => void;
  suggestions: string[];
};

function deepClone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

export default function StackEditor({ title, items, onChange, suggestions }: Props) {
  const [newType, setNewType] = useState(suggestions[0] ?? "Custom");

  function normalizeOrder(arr: Item[]) {
    // Preserve explicit order, but ensure it exists and is unique-ish
    const out = [...arr].map((it, idx) => ({ ...it, order: typeof it.order === "number" ? it.order : idx * 10 }));
    out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return out.map((it, idx) => ({ ...it, order: it.order ?? idx * 10 }));
  }

  function add() {
    const next = normalizeOrder([...items, { type: newType, enabled: true, params: {} }]);
    onChange(next);
  }

  function remove(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    onChange(normalizeOrder(next));
  }

  function move(i: number, dir: -1 | 1) {
    const next = deepClone(items);
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
    // reassign order in steps
    const normalized = normalizeOrder(next).map((it, idx) => ({ ...it, order: idx * 10 }));
    onChange(normalized);
  }

  function update(i: number, patch: Partial<Item>) {
    const next = deepClone(items);
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  return (
    <div style={{ border: "1px solid #333", borderRadius: 6, padding: 10, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {suggestions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={add}>Add</button>
        </div>
      </div>

      {items.length ? items.map((it, i) => (
        <div key={i} style={{ border: "1px solid #222", borderRadius: 6, padding: 8, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 12, opacity: 0.85 }}>
                <input type="checkbox" checked={it.enabled ?? true} onChange={(e) => update(i, { enabled: e.target.checked })} /> enabled
              </label>
              <b style={{ fontSize: 12 }}>{it.type}</b>
              <span style={{ fontSize: 12, opacity: 0.7 }}>order: {it.order ?? 0}</span>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => move(i, -1)} disabled={i === 0}>Up</button>
              <button onClick={() => move(i, 1)} disabled={i === items.length - 1}>Down</button>
              <button onClick={() => remove(i)}>Remove</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.85 }}>Type</label>
            <input value={it.type} onChange={(e) => update(i, { type: e.target.value })} />

            <label style={{ fontSize: 12, opacity: 0.85 }}>Order</label>
            <input type="number" value={it.order ?? 0} onChange={(e) => update(i, { order: parseInt(e.target.value, 10) || 0 })} />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Params (JSON)</div>
            <textarea
              value={JSON.stringify(it.params ?? {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  update(i, { params: parsed });
                } catch {
                  // keep raw; do not update
                }
              }}
              style={{ width: "100%", height: 120, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
            />
          </div>
        </div>
      )) : (
        <div style={{ fontSize: 12, opacity: 0.75 }}>No items in stack.</div>
      )}

      <div style={{ fontSize: 12, opacity: 0.7 }}>
        Tip: Order executes low → high. Disable items to A/B test rig behavior.
      </div>
    </div>
  );
}
