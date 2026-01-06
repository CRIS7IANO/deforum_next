import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

type Props = {
  rangeData: any;
  frame: number;
  project?: any;
  onKeyframe?: (frame: number, payload: { position: [number, number, number]; target: [number, number, number]; roll_deg?: number }) => void;
};

function makeFrustumLines(fovDeg: number, aspect: number, near: number, far: number) {
  const fov = (fovDeg * Math.PI) / 180;
  const nh = Math.tan(fov / 2) * near;
  const nw = nh * aspect;
  const fh = Math.tan(fov / 2) * far;
  const fw = fh * aspect;

  const n = [
    new THREE.Vector3(-nw, -nh, -near),
    new THREE.Vector3(nw, -nh, -near),
    new THREE.Vector3(nw, nh, -near),
    new THREE.Vector3(-nw, nh, -near),
  ];
  const f = [
    new THREE.Vector3(-fw, -fh, -far),
    new THREE.Vector3(fw, -fh, -far),
    new THREE.Vector3(fw, fh, -far),
    new THREE.Vector3(-fw, fh, -far),
  ];

  const points: THREE.Vector3[] = [];
  points.push(n[0], n[1], n[1], n[2], n[2], n[3], n[3], n[0]); // near
  points.push(f[0], f[1], f[1], f[2], f[2], f[3], f[3], f[0]); // far
  for (let i = 0; i < 4; i++) points.push(n[i], f[i]); // connect
  return points;
}

function bezier3(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number) {
  const u = 1 - t;
  const b0 = u*u*u;
  const b1 = 3*u*u*t;
  const b2 = 3*u*t*t;
  const b3 = t*t*t;
  return new THREE.Vector3(
    b0*p0.x + b1*p1.x + b2*p2.x + b3*p3.x,
    b0*p0.y + b1*p1.y + b2*p2.y + b3*p3.y,
    b0*p0.z + b1*p1.z + b2*p2.z + b3*p3.z,
  );
}

function sampleBezierSpline(segments: any[], samplesPerSeg: number) {
  const out: THREE.Vector3[] = [];
  const sps = Math.max(6, Math.min(200, samplesPerSeg|0));
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    const p0 = new THREE.Vector3(seg.p0[0], seg.p0[1], seg.p0[2]);
    const p1 = new THREE.Vector3(seg.p1[0], seg.p1[1], seg.p1[2]);
    const p2 = new THREE.Vector3(seg.p2[0], seg.p2[1], seg.p2[2]);
    const p3 = new THREE.Vector3(seg.p3[0], seg.p3[1], seg.p3[2]);
    for (let k=0; k<=sps; k++) {
      const t = k / sps;
      const pt = bezier3(p0,p1,p2,p3,t);
      if (out.length === 0 || out[out.length-1].distanceToSquared(pt) > 1e-8) out.push(pt);
    }
  }
  return out;
}

function densifyPolyline(raw: THREE.Vector3[], stepsPerSeg: number) {
  const out: THREE.Vector3[] = [];
  const steps = Math.max(2, Math.min(80, stepsPerSeg|0));
  for (let i=0; i<raw.length-1; i++) {
    const a = raw[i], b = raw[i+1];
    out.push(a.clone());
    for (let k=1; k<steps; k++) out.push(a.clone().lerp(b, k/steps));
  }
  if (raw.length) out.push(raw[raw.length-1].clone());
  return out;
}

function getAllSplineLines(project: any): { id: string; pts: THREE.Vector3[]; color: number }[] {
  const out: { id: string; pts: THREE.Vector3[]; color: number }[] = [];
  const splines = project?.timeline?.objects?.splines ?? {};
  for (const id of Object.keys(splines)) {
    const sp = splines[id];
    if (sp?.points?.length) {
      const raw = sp.points.map((p: number[]) => new THREE.Vector3(p[0], p[1], p[2]));
      const pts = densifyPolyline(raw, 10);
      out.push({ id, pts, color: 0x44ff88 });
    } else if (sp?.segments?.length) {
      const pts = sampleBezierSpline(sp.segments, 24);
      out.push({ id, pts, color: 0xffaa44 });
    }
  }
  return out;
}

export default function Viewport3D({ rangeData, frame, project, onKeyframe }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const frustumRef = useRef<THREE.Object3D | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);
  const camDotRef = useRef<THREE.Mesh | null>(null);
  const lookLineRef = useRef<THREE.Line | null>(null);

  const pathLineRef = useRef<THREE.Line | null>(null);
  const splineLinesRef = useRef<THREE.Line[]>([]);

  const transformRef = useRef<TransformControls | null>(null);

  const [gizmo, setGizmo] = useState<"off" | "camera" | "target">("off");
  const [mode, setMode] = useState<"translate" | "rotate">("translate");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0e14);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 2000);
    camera.position.set(6, 5, 10);
    camera.lookAt(0, 1.5, 0);
    camRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);
    controlsRef.current = controls;

    scene.add(new THREE.GridHelper(40, 40, 0x2a2f3a, 0x1b1f28));
    scene.add(new THREE.AxesHelper(2));

    // target point
    const tgtGeo = new THREE.SphereGeometry(0.08, 18, 18);
    const tgtMat = new THREE.MeshBasicMaterial({ color: 0xff4455 });
    const tgt = new THREE.Mesh(tgtGeo, tgtMat);
    scene.add(tgt);
    targetRef.current = tgt;

    // camera dot
    const cdGeo = new THREE.SphereGeometry(0.07, 14, 14);
    const cdMat = new THREE.MeshBasicMaterial({ color: 0x66ccff });
    const cd = new THREE.Mesh(cdGeo, cdMat);
    scene.add(cd);
    camDotRef.current = cd;

    // look line
    const llGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const llMat = new THREE.LineBasicMaterial({ color: 0x8899ff });
    const ll = new THREE.Line(llGeom, llMat);
    scene.add(ll);
    lookLineRef.current = ll;

    // camera frustum object
    const frustum = new THREE.Object3D();
    scene.add(frustum);
    frustumRef.current = frustum;

    // transform controls
    const tctrl = new TransformControls(camera, renderer.domElement);
    tctrl.setMode("translate");
    tctrl.setSize(0.85);
    tctrl.addEventListener("dragging-changed", (e: any) => {
      if (controlsRef.current) controlsRef.current.enabled = !e.value;
    });
    tctrl.addEventListener("mouseUp", () => {
      const camDot = camDotRef.current;
      const target = targetRef.current;
      if (!camDot || !target) return;
      if (!onKeyframe) return;
      onKeyframe(frame, {
        position: [camDot.position.x, camDot.position.y, camDot.position.z],
        target: [target.position.x, target.position.y, target.position.z],
        roll_deg: (camDot.rotation.x * 180) / Math.PI,
      });
    });
    scene.add(tctrl);
    transformRef.current = tctrl;

    let raf = 0;
    const onResize = () => {
      const cam = camRef.current;
      const ren = rendererRef.current;
      if (!mount || !cam || !ren) return;
      cam.aspect = mount.clientWidth / mount.clientHeight;
      cam.updateProjectionMatrix();
      ren.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      tctrl.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [frame, onKeyframe]);

  // attach transform control based on gizmo selection
  useEffect(() => {
    const tctrl = transformRef.current;
    const camDot = camDotRef.current;
    const target = targetRef.current;
    if (!tctrl) return;

    tctrl.setMode(mode);
    if (gizmo === "off") {
      tctrl.detach();
      return;
    }
    if (gizmo === "camera" && camDot) tctrl.attach(camDot);
    if (gizmo === "target" && target) tctrl.attach(target);
  }, [gizmo, mode]);

  // draw spline lines from project
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (const l of splineLinesRef.current) {
      scene.remove(l);
      l.geometry.dispose();
      (l.material as THREE.Material).dispose();
    }
    splineLinesRef.current = [];

    const lines = getAllSplineLines(project);
    for (const ln of lines) {
      if (!ln.pts.length) continue;
      const geom = new THREE.BufferGeometry().setFromPoints(ln.pts);
      const mat = new THREE.LineBasicMaterial({ color: ln.color });
      const line = new THREE.Line(geom, mat);
      scene.add(line);
      splineLinesRef.current.push(line);
    }
  }, [project]);

  // draw evaluated camera path line
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (pathLineRef.current) {
      scene.remove(pathLineRef.current);
      pathLineRef.current.geometry.dispose();
      (pathLineRef.current.material as THREE.Material).dispose();
      pathLineRef.current = null;
    }

    const frames = rangeData?.frames ?? [];
    if (!frames.length) return;

    const pts = frames.map((f: any) => new THREE.Vector3(f.position[0], f.position[1], f.position[2]));
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x66ccff });
    const line = new THREE.Line(geom, mat);
    scene.add(line);
    pathLineRef.current = line;
  }, [rangeData]);

  // update active frustum and target
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const frames = rangeData?.frames ?? [];
    if (!frames.length) return;
    const idx = Math.max(0, Math.min(frame, frames.length - 1));
    const f = frames[idx];

    const frustum = frustumRef.current;
    const target = targetRef.current;
    const camDot = camDotRef.current;
    const lookLine = lookLineRef.current;

    if (!frustum || !target || !camDot || !lookLine) return;

    const focal = f.focal_length_mm ?? 35;
    const fov = (2 * Math.atan(36.0 / (2 * focal))) * (180 / Math.PI);
    const aspect = 16/9;
    const near = 0.2;
    const far = 2.0;

    frustum.clear();
    const pts = makeFrustumLines(fov, aspect, near, far);
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const lines = new THREE.LineSegments(geom, mat);
    frustum.add(lines);

    const pos = f.position ?? [0, 0, 0];
    const tgt = f.target ?? [0, 1.5, 0];

    frustum.position.set(pos[0], pos[1], pos[2]);
    frustum.lookAt(tgt[0], tgt[1], tgt[2]);

    target.position.set(tgt[0], tgt[1], tgt[2]);
    camDot.position.set(pos[0], pos[1], pos[2]);

    const g = lookLine.geometry as THREE.BufferGeometry;
    const arr = new Float32Array([pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2]]);
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    g.computeBoundingSphere();
  }, [rangeData, frame]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      <div style={{
        position: "absolute", right: 12, top: 12,
        background: "rgba(0,0,0,0.55)", padding: 8,
        borderRadius: 8, color: "white", fontSize: 12, display: "grid", gap: 6, width: 220
      }}>
        <b>Viewport Gizmo (v9)</b>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setGizmo("off")} style={{ opacity: gizmo==="off" ? 1 : 0.7 }}>Off</button>
          <button onClick={() => setGizmo("camera")} style={{ opacity: gizmo==="camera" ? 1 : 0.7 }}>Camera</button>
          <button onClick={() => setGizmo("target")} style={{ opacity: gizmo==="target" ? 1 : 0.7 }}>Target</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setMode("translate")} style={{ opacity: mode==="translate" ? 1 : 0.7 }}>Translate</button>
          <button onClick={() => setMode("rotate")} style={{ opacity: mode==="rotate" ? 1 : 0.7 }}>Rotate</button>
        </div>
        <div style={{ opacity: 0.8, lineHeight: 1.3 }}>
          Drag gizmo then release to write keyframes at frame <b>{frame}</b>.
        </div>
      </div>
    </div>
  );
}
