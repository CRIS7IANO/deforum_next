export type Key = {
  t: number;
  v: number;
  interp?: "linear" | "bezier" | "catmull_rom";
  in_tan?: [number, number] | null;
  out_tan?: [number, number] | null;
};

export function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function upsertKey(keys: Key[], k: Key): Key[] {
  const out = [...(keys || [])];
  const idx = out.findIndex((x) => x.t === k.t);
  if (idx >= 0) out[idx] = { ...out[idx], ...k };
  else out.push(k);
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function deleteKey(keys: Key[], t: number): Key[] {
  return (keys || []).filter((k) => k.t !== t).sort((a,b)=>a.t-b.t);
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function snapInt(v: number) {
  return Math.round(v);
}

export function safeNum(v: any, d = 0) {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : d;
}

export function getAllTracks(project: any): any[] {
  return (project?.timeline?.tracks ?? []) as any[];
}

export function findTrack(project: any, trackId: string): any | null {
  const tracks = getAllTracks(project);
  return tracks.find((t) => t?.id === trackId) ?? null;
}

export function ensureTrack(project: any, trackId: string, type: string): any {
  project.timeline = project.timeline || {};
  project.timeline.tracks = project.timeline.tracks || [];
  let t = project.timeline.tracks.find((x: any) => x.id === trackId);
  if (!t) {
    t = { id: trackId, type, channels: {} };
    project.timeline.tracks.push(t);
  }
  t.channels = t.channels || {};
  return t;
}

export function ensureChannel(track: any, channel: string): any {
  track.channels = track.channels || {};
  if (!track.channels[channel]) track.channels[channel] = { keys: [] };
  if (!track.channels[channel].keys) track.channels[channel].keys = [];
  return track.channels[channel];
}

export function listChannels(track: any): string[] {
  const ch = track?.channels || {};
  return Object.keys(ch).sort();
}

export function getKeys(track: any, channel: string): Key[] {
  const ch = track?.channels?.[channel];
  return (ch?.keys || []) as Key[];
}

export function setKeys(track: any, channel: string, keys: Key[]) {
  const ch = ensureChannel(track, channel);
  ch.keys = [...keys].sort((a,b)=>a.t-b.t);
}
