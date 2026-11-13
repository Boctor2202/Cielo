import * as THREE from "three";
import { clamp01, num, smooth, vec, type Key } from "./timeline";

/**
 * Globe chapter of the home page: the Earth drawn from real aerodromes, flight routes from Paris-CDG
 * drawing themselves along great circles, in a starfield. Driven by scroll progress (0..1 of the whole story);
 * the canvas is only visible from p ≈ 0.55 (the photo chapters come before).
 */

export interface SceneOptions {
  reducedMotion: boolean;
  mobile: boolean;
  globeDots: number[]; // flat [lat, lon, lat, lon, ...]
}

const D2R = Math.PI / 180;
const R = 13;
const HOME = { lat: 49.01, lon: 2.55 }; // LFPG
const DESTS: [number, number][] = [
  [41.8, 12.25], [40.47, -3.56], [51.47, -0.45], [50.03, 8.57], [38.77, -9.13], [33.37, -7.59], [37.94, 23.94],
  [40.64, -73.78], [45.47, -73.74], [25.25, 55.36], [-26.13, 28.24], [64.13, -21.94], [55.97, 37.41], [30.12, 31.41],
];

type V3 = [number, number, number];

// Camera around the globe (centred at origin)
const CAM_POS: Key<V3>[] = [[0.55, [0, 6, 95]], [0.72, [0, 1, 58]], [0.86, [-6, 4, 55]], [1, [-18, 9, 50]]];
const SHIFT_X: Key<number>[] = [[0.55, 0.2], [1, 0.2]];

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,.55)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function llToVec(lat: number, lon: number, r: number): THREE.Vector3 {
  const la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

const ATMO_VERT = `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-wp.xyz); gl_Position = projectionMatrix * wp; }`;
const ATMO_FRAG = `uniform float uOpacity; uniform vec3 uColor; uniform float uPower; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), uPower); gl_FragColor = vec4(uColor, f * uOpacity); }`;

export class FlightScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  private raf = 0;
  private last = 0;
  private running = false;
  private target = 0;
  private progress = 0;
  private time = 0;
  private w = 1;
  private h = 1;
  private spin = new THREE.Group();
  private stars: THREE.Points;
  private arcs: { line: THREE.Line; count: number; dot: THREE.Sprite; pts: THREE.Vector3[]; delay: number }[] = [];

  constructor(private canvas: HTMLCanvasElement, private opts: SceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.75 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    const glow = glowTexture();

    // Starfield
    const n = opts.mobile ? 1400 : 3000;
    const sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(600 + Math.random() * 300);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, color: 0xdfeaff, transparent: true, opacity: 0.85, depthWrite: false }));
    this.scene.add(this.stars);

    // Earth: face Europe to the camera, then the scroll rotates it
    const tilt = new THREE.Group();
    tilt.rotation.x = 40 * D2R;
    tilt.add(this.spin);
    this.scene.add(tilt);

    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), new THREE.MeshBasicMaterial({ color: 0x07142a }));
    earth.renderOrder = -1; // drawn first so dots and arcs (no depth write) stay on top
    this.spin.add(earth);
    const grat = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(R * 1.001, 24, 12)),
      new THREE.LineBasicMaterial({ color: 0x1c3352, transparent: true, opacity: 0.35 }),
    );
    grat.renderOrder = -1;
    this.spin.add(grat);

    const d = opts.globeDots;
    const dp: number[] = [];
    for (let i = 0; i < d.length; i += 2) {
      const v = llToVec(d[i]!, d[i + 1]!, R * 1.003);
      dp.push(v.x, v.y, v.z);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
    this.spin.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.24, transparent: true, opacity: 0.85, depthWrite: false })));

    const atmo = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0.75 }, uColor: { value: new THREE.Color(0x22d3ee) }, uPower: { value: 3.2 } },
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
    });
    tilt.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 48, 32), atmo));

    // Routes from LFPG along great circles, lifted into arcs
    const home = llToVec(HOME.lat, HOME.lon, 1).normalize();
    DESTS.forEach(([lat, lon], i) => {
      const b = llToVec(lat, lon, 1).normalize();
      const ang = home.angleTo(b);
      const steps = 72;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const v = home.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(b.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang));
        v.multiplyScalar(R * (1.006 + Math.sin(Math.PI * t) * Math.min(0.22, ang * 0.32)));
        pts.push(v);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      geo.setDrawRange(0, 0);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: i < 7 ? 0x22d3ee : 0xa5b4fc, transparent: true, opacity: 0.95 }));
      this.spin.add(line);
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false }));
      dot.scale.setScalar(0.6);
      dot.visible = false;
      this.spin.add(dot);
      const end = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x22d3ee, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
      end.position.copy(pts[steps]!);
      end.scale.setScalar(0.5);
      this.spin.add(end);
      this.arcs.push({ line, count: steps + 1, dot, pts, delay: i * 0.045 });
    });
    const hub = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false }));
    hub.position.copy(home.clone().multiplyScalar(R * 1.01));
    hub.scale.setScalar(1.1);
    this.spin.add(hub);

    this.resize();
    this.apply();
  }

  setProgress(p: number) {
    this.target = clamp01(p);
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.w = parent.clientWidth || 1;
    this.h = parent.clientHeight || 1;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.fov = this.w / this.h < 0.8 ? 52 : 38;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.render();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      // scrub with ~1 s of lag (instant under reduced motion)
      this.progress = this.opts.reducedMotion ? this.target : this.progress + (this.target - this.progress) * (1 - Math.exp(-dt * 4.5));
      if (!this.opts.reducedMotion) this.time += dt;
      this.apply();
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private render() {
    const portrait = this.w / this.h < 0.8;
    const sx = portrait ? 0 : num(SHIFT_X, this.progress);
    const sy = portrait ? 0.17 : 0;
    this.camera.setViewOffset(this.w, this.h, -sx * this.w, -sy * this.h, this.w, this.h);
    this.renderer.render(this.scene, this.camera);
  }

  private apply() {
    const p = this.progress;
    const t = this.time;
    const motion = !this.opts.reducedMotion;
    const k = this.w / this.h < 0.8 ? 1.5 : 1;
    const c = vec(CAM_POS, p);
    this.camera.position.set(c[0] * k, c[1] * k, c[2] * k);
    this.camera.lookAt(0, 0, 0);
    this.stars.rotation.y = motion ? t * 0.004 : 0;

    this.spin.rotation.y = -HOME.lon * D2R + (p - 0.8) * 1.1 + (motion ? t * 0.012 : 0);
    const draw = smooth(0.7, 0.92, p);
    for (const a of this.arcs) {
      const local = clamp01((draw - a.delay) / 0.4);
      a.line.geometry.setDrawRange(0, Math.floor(a.count * local));
      a.dot.visible = local >= 1 && motion;
      if (a.dot.visible) {
        const i = Math.floor(((((t * 0.18 + a.delay * 3) % 1) + 1) % 1) * (a.count - 1));
        a.dot.position.copy(a.pts[i]!);
      }
    }
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        (x as THREE.SpriteMaterial).map?.dispose();
        x.dispose();
      });
    });
    this.renderer.dispose();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
