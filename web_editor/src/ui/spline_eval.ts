/**
 * Lightweight spline evaluator for the Web editor.
 *
 * Goal: render curve shape consistent with backend evaluation:
 * - linear
 * - bezier (with in_tan/out_tan)
 * - catmull_rom
 *
 * Keys:
 *   t: frame index (integer)
 *   v: value
 *   interp: 'linear' | 'bezier' | 'catmull_rom'
 *   out_tan: [dt, dv] where dt is normalized (0..1) and dv is absolute value delta
 *   in_tan:  [dt, dv] where dt is normalized (-1..0) and dv is absolute value delta
 */

export type Key = {
  t: number;
  v: number;
  interp?: "linear" | "bezier" | "catmull_rom";
  in_tan?: [number, number] | null;
  out_tan?: [number, number] | null;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Cubic Bezier 1D
function cubic(a: number, b: number, c: number, d: number, u: number) {
  const uu = 1 - u;
  return uu*uu*uu*a + 3*uu*uu*u*b + 3*uu*u*u*c + u*u*u*d;
}

/**
 * Evaluate Bezier segment between k0 and k1 at target time t (frame float).
 *
 * We treat the segment as a 2D cubic Bezier curve in (time,value):
 *   P0=(t0,v0)
 *   P1=(t0 + out_dt*dtFrames, v0 + out_dv)
 *   P2=(t1 + in_dt*dtFrames,  v1 + in_dv)
 *   P3=(t1,v1)
 *
 * Then solve for u such that x(u)=t (binary search), return y(u).
 * This produces CSS-like easing behavior when tangents were created from cubic-bezier presets.
 */
export function evalBezierSegment(k0: Key, k1: Key, t: number): number {
  const t0 = k0.t, t1 = k1.t;
  const dtFrames = Math.max(1e-6, t1 - t0);
  const xTarget = clamp((t - t0) / dtFrames, 0, 1);

  const out_dt = clamp(k0.out_tan?.[0] ?? 0.25, 0, 1);
  const out_dv = k0.out_tan?.[1] ?? 0;

  const in_dt = clamp(k1.in_tan?.[0] ?? -0.25, -1, 0);
  const in_dv = k1.in_tan?.[1] ?? 0;

  // normalize time control points to [0,1] domain; clamp to keep monotonic-ish
  const x0 = 0;
  const x1 = clamp(out_dt, 0, 1);
  const x2 = clamp(1 + in_dt, 0, 1);
  const x3 = 1;

  // normalize value control points to value domain
  const y0 = k0.v;
  const y1 = k0.v + out_dv;
  const y2 = k1.v + in_dv;
  const y3 = k1.v;

  // invert x(u)=xTarget
  let lo = 0, hi = 1, u = xTarget;
  for (let i = 0; i < 18; i++) {
    u = (lo + hi) / 2;
    const x = cubic(x0, x1, x2, x3, u);
    if (x < xTarget) lo = u;
    else hi = u;
  }
  return cubic(y0, y1, y2, y3, u);
}

/**
 * Catmull-Rom interpolation (uniform) on values.
 */
export function evalCatmullRom(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * u +
    (2*p0 - 5*p1 + 4*p2 - p3) * u2 +
    (-p0 + 3*p1 - 3*p2 + p3) * u3
  );
}

/**
 * Evaluate channel at a given frame t (float).
 * Expects keys sorted by t.
 */
export function evalChannel(keys: Key[], t: number, defaultValue = 0): number {
  if (!keys || keys.length === 0) return defaultValue;
  if (t <= keys[0].t) return keys[0].v;
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v;

  // find segment
  let i = 0;
  while (i < keys.length - 1 && !(keys[i].t <= t && t <= keys[i+1].t)) i++;
  const k0 = keys[i], k1 = keys[i+1];
  const span = Math.max(1e-6, k1.t - k0.t);
  const u = clamp((t - k0.t) / span, 0, 1);
  const mode = (k0.interp || "bezier") as any;

  if (mode === "linear") return lerp(k0.v, k1.v, u);
  if (mode === "catmull_rom") {
    const km1 = keys[Math.max(0, i-1)];
    const kp2 = keys[Math.min(keys.length-1, i+2)];
    return evalCatmullRom(km1.v, k0.v, k1.v, kp2.v, u);
  }
  // default bezier
  return evalBezierSegment(k0, k1, t);
}

/**
 * Produce samples for drawing: returns [t,v] list.
 */
export function sampleChannel(keys: Key[], t0: number, t1: number, samples: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const n = Math.max(2, samples | 0);
  for (let i = 0; i < n; i++) {
    const tt = t0 + (t1 - t0) * (i / (n - 1));
    out.push([tt, evalChannel(keys, tt, 0)]);
  }
  return out;
}
