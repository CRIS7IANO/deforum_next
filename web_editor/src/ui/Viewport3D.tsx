import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type Props = { rangeData: any; frame: number; project?: any };

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
    new THREE.Vector3(-nw, nh, -near)
  ];
  const f = [
    new THREE.Vector3(-fw, -fh, -far),
    new THREE.Vector3(fw, -fh, -far),
    new THREE.Vector3(fw, fh, -far),
    new THREE.Vector3(-fw, fh, -far)
  ];

  const edges: [THREE.Vector3, THREE.Vector3][] = [
    [n[0], n[1]], [n[1], n[2]], [n[2], n[3]], [n[3], n[0]],
    [f[0], f[1]], [f[1], f[2]], [f[2], f[3]], [f[3], f[0]],
    [n[0], f[0]], [n[1], f[1]], [n[2], f[2]], [n[3], f[3]]
  ];

  const verts: number[] = [];
  edges.forEach(([a, b]) => {
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  });
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
  return new THREE.LineSegments(geom, mat);
}

export default function Viewport3D({ rangeData, frame, project }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pathLineRef = useRef<THREE.Line | null>(null);
  const railLineRef = useRef<THREE.Line | null>(null);
  const frustumRef = useRef<THREE.Object3D | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);

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

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(6, 5, 10);
    camera.lookAt(0, 1.5, 0);
    camRef.current = camera;

    scene.add(new THREE.GridHelper(40, 40, 0x2a2f3a, 0x1b1f28));
    scene.add(new THREE.AxesHelper(2));

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(5, 10, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const frustum = makeFrustumLines(45, 9 / 16, 0.2, 1.2);
    frustumRef.current = frustum;
    scene.add(frustum);

    const targetGeom = new THREE.SphereGeometry(0.07, 16, 16);
    const targetMat = new THREE.MeshStandardMaterial({ color: 0xffcc66 });
    const targetMesh = new THREE.Mesh(targetGeom, targetMat);
    targetRef.current = targetMesh;
    scene.add(targetMesh);

    const onResize = () => {
      if (!mountRef.current || !rendererRef.current || !camRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      rendererRef.current.setSize(w, h);
      camRef.current.aspect = w / h;
      camRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // draw rail spline (if any)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (railLineRef.current) {
      scene.remove(railLineRef.current);
      railLineRef.current.geometry.dispose();
      (railLineRef.current.material as THREE.Material).dispose();
      railLineRef.current = null;
    }

    const sp = project?.timeline?.objects?.splines?.dolly_spline_A;
    if (!sp?.points?.length) return;

    const pts = sp.points.map((p: number[]) => new THREE.Vector3(p[0], p[1], p[2]));
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x44ff88 });
    const line = new THREE.Line(geom, mat);
    railLineRef.current = line;
    scene.add(line);
  }, [project]);

  // draw evaluated path
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
    pathLineRef.current = line;
    scene.add(line);
  }, [rangeData]);

  // update frustum and target for selected frame
  useEffect(() => {
    const frames = rangeData?.frames ?? [];
    if (!frames.length) return;

    const idx = Math.max(0, Math.min(frames.length - 1, frame));
    const f = frames[idx];
    const frustum = frustumRef.current;
    const target = targetRef.current;
    if (frustum) {
      frustum.position.set(f.position[0], f.position[1], f.position[2]);
      const tgt = f.target ?? [0, 1.5, 0];
      frustum.lookAt(tgt[0], tgt[1], tgt[2]);
    }
    if (target) {
      const tgt = f.target ?? [0, 1.5, 0];
      target.position.set(tgt[0], tgt[1], tgt[2]);
    }
  }, [rangeData, frame]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
