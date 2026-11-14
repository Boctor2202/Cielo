import * as THREE from "three";
import { clamp01, smooth } from "./timeline";

/**
 * Final chapter of the home page: a photographic Earth (NASA Blue Marble by day, Black Marble city lights by
 * night, clouds, ocean glint, atmosphere) with the pilot's routes drawing themselves along great circles.
 * The visitor turns it with click-and-drag (inertia); scroll zooms in and draws the routes.
 */

export interface SceneOptions {
  reducedMotion: boolean;
  mobile: boolean;
}

const D2R = Math.PI / 180;
const R = 10;
const HOME = { lat: 48.97, lon: 2.44 }; // LFPB, Paris–Le Bourget
const DESTS: [number, number][] = [
  [43.66, 7.22], [46.24, 6.11], [51.15, -0.19], [40.47, -3.56], [41.8, 12.25], [37.94, 23.94], [55.62, 12.65],
  [40.64, -73.78], [25.25, 55.36], [64.13, -21.94], [36.68, -4.5], [52.31, 4.76], [33.37, -7.59], [42.36, -71.01],
];

const TEX = "/immersive/earth";

/** Same convention as THREE.SphereGeometry's UVs: lon 0 on +X, east towards −Z, north on +Y. */
function llToVec(lat: number, lon: number, r: number): THREE.Vector3 {
  const la = lat * D2R;
  const lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uWater;
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudShift;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vPosW);
  float ndl = dot(n, uSun);
  float dayMix = smoothstep(-0.12, 0.22, ndl);

  vec3 day = texture2D(uDay, vUv).rgb;
  float water = texture2D(uWater, vUv).r;
  // the source oceans are flat navy: give them depth and colour
  day = mix(day, day * vec3(0.7, 1.0, 1.25) + vec3(0.004, 0.022, 0.06), water);
  // soft cloud shadows on the ground
  float shadow = texture2D(uClouds, vUv + vec2(uCloudShift - 0.0015, 0.0)).r;
  day *= 1.0 - shadow * 0.35;
  vec3 lit = day * (0.06 + 1.05 * max(ndl, 0.0));

  // city lights on the night side, warm, fading through the terminator
  vec3 lights = texture2D(uNight, vUv).rgb;
  lights = pow(lights, vec3(1.35)) * vec3(1.35, 1.05, 0.72) * 2.2;
  vec3 col = mix(lights, lit, dayMix);

  // sun glint on the oceans
  vec3 h = normalize(uSun + v);
  float spec = pow(max(dot(n, h), 0.0), 140.0) * water * dayMix;
  col += vec3(1.0, 0.92, 0.78) * spec * 0.45;

  // atmospheric scattering at the limb: blue by day, orange at the terminator
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 sky = mix(vec3(0.85, 0.5, 0.3), vec3(0.32, 0.6, 1.0), smoothstep(-0.12, 0.2, ndl));
  col += sky * fres * smoothstep(-0.15, 0.25, ndl) * 0.75;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudShift;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  float a = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
  float ndl = dot(n, uSun);
  float light = smoothstep(-0.18, 0.35, ndl);
  vec3 tint = mix(vec3(1.0, 0.62, 0.4), vec3(1.0), smoothstep(0.0, 0.3, ndl));
  gl_FragColor = vec4(tint * (0.04 + 0.96 * light), a * 0.92 * (0.15 + 0.85 * light));
  #include <colorspace_fragment>
}`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(cameraPosition - vPosW);
  // back faces of the shell: -dot(n,v) goes from 0 at the outer edge to ~0.33 at the Earth's limb
  float rim = pow(clamp(-dot(n, v) / 0.33, 0.0, 1.0), 2.4);
  float lit = smoothstep(-0.35, 0.4, dot(n, uSun));
  vec3 c = mix(vec3(0.9, 0.55, 0.35), vec3(0.35, 0.65, 1.0), smoothstep(-0.2, 0.25, dot(n, uSun)));
  gl_FragColor = vec4(c, rim * (0.05 + 0.95 * lit) * 0.9);
}`;

const ROUTE_VERT = /* glsl */ `
varying float vT;
attribute float aT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ROUTE_FRAG = /* glsl */ `
uniform float uDraw;
uniform float uHead;
uniform vec3 uColor;
varying float vT;
void main() {
  if (vT > uDraw) discard;
  float tail = smoothstep(0.0, 0.08, vT) * 0.55 + 0.25;
  float comet = exp(-pow((vT - uHead) * 22.0, 2.0)) * 1.4;
  gl_FragColor = vec4(uColor * (tail + comet), (tail + comet) * 0.9);
}`;

interface Route {
  mat: THREE.ShaderMaterial;
  delay: number;
  speed: number;
}

export class FlightScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 3000);
  private raf = 0;
  private last = 0;
  private running = false;
  private target = 0;
  private progress = 0;
  private time = 0;
  private w = 1;
  private h = 1;
  private globe = new THREE.Group();
  private clouds: THREE.Mesh;
  private stars: THREE.Points;
  private routes: Route[] = [];
  private uniforms: { uSun: { value: THREE.Vector3 }; uCloudShift: { value: number } };
  // user rotation (radians) with inertia
  private yaw = 0;
  private pitch = 0;
  private vYaw = 0;
  private vPitch = 0;
  private dragging = false;
  private lastPointer = { x: 0, y: 0, t: 0 };
  private idle = 0;
  private loaded = 0;
  onReady?: () => void;

  constructor(private canvas: HTMLCanvasElement, private opts: SceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.75 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const q = opts.mobile || this.renderer.capabilities.maxTextureSize < 4096 ? "lo" : "hi";

    const loader = new THREE.TextureLoader();
    const done = () => {
      this.loaded++;
      if (this.loaded === 4) {
        this.render();
        this.onReady?.();
      }
    };
    const tex = (file: string, srgb: boolean) => {
      const t = loader.load(`${TEX}/${file}.webp`, done, undefined, done);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = maxAniso;
      t.wrapS = THREE.RepeatWrapping;
      return t;
    };
    const day = tex(`day-${q}`, true);
    const night = tex(`night-${q}`, true);
    const water = tex("water", false);
    const cloudMap = tex(`clouds-${q}`, false);

    // sun: lights Europe and the Atlantic, the terminator crossing Asia so city lights show
    this.uniforms = { uSun: { value: new THREE.Vector3(-0.35, 0.25, 0.9).normalize() }, uCloudShift: { value: 0 } };

    // starfield, a few bright ones
    const n = opts.mobile ? 1500 : 3500;
    const sp = new Float32Array(n * 3);
    const sc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 500);
      sp.set([v.x, v.y, v.z], i * 3);
      const b = 0.35 + Math.pow(Math.random(), 4) * 0.65;
      sc.set([b, b * (0.92 + Math.random() * 0.08), b], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sg.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.scene.add(this.stars);

    // Earth
    const seg = opts.mobile ? 96 : 160;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, seg, seg / 2),
      new THREE.ShaderMaterial({
        uniforms: { uDay: { value: day }, uNight: { value: night }, uWater: { value: water }, uClouds: { value: cloudMap }, ...this.uniforms },
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
      }),
    );
    this.globe.add(earth);

    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.007, seg, seg / 2),
      new THREE.ShaderMaterial({
        uniforms: { uClouds: { value: cloudMap }, ...this.uniforms },
        vertexShader: EARTH_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.globe.add(this.clouds);

    // atmosphere halo (outside the limb)
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, 96, 48),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(atmo);

    // routes from the home base along great circles, lifted into arcs, as thin glowing tubes
    const home = llToVec(HOME.lat, HOME.lon, 1).normalize();
    DESTS.forEach(([lat, lon], i) => {
      const b = llToVec(lat, lon, 1).normalize();
      const ang = home.angleTo(b);
      const pts: THREE.Vector3[] = [];
      const steps = 96;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const v = home.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(b.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang));
        v.multiplyScalar(R * (1.012 + Math.sin(Math.PI * t) * Math.min(0.2, 0.03 + ang * 0.22)));
        pts.push(v);
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubular = 160;
      const radial = 6;
      const geo = new THREE.TubeGeometry(curve, tubular, R * (opts.mobile ? 0.0032 : 0.0024), radial, false);
      const ts = new Float32Array(geo.attributes.position!.count);
      for (let k = 0; k < ts.length; k++) ts[k] = Math.floor(k / (radial + 1)) / tubular;
      geo.setAttribute("aT", new THREE.BufferAttribute(ts, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uDraw: { value: 0 }, uHead: { value: -1 }, uColor: { value: new THREE.Color(i % 3 === 2 ? 0xfde68a : 0x67e8f9) } },
        vertexShader: ROUTE_VERT,
        fragmentShader: ROUTE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.globe.add(new THREE.Mesh(geo, mat));
      this.routes.push({ mat, delay: i * 0.035, speed: 0.16 + (i % 4) * 0.025 });
    });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.copy(home.clone().multiplyScalar(R * 1.012));
    glow.scale.setScalar(R * 0.035);
    this.globe.add(glow);

    this.scene.add(this.globe);
    this.resize();
    this.apply();
  }

  setProgress(p: number) {
    this.target = clamp01(p);
  }

  /* ---------- click & drag ---------- */
  pointerDown(x: number, y: number) {
    this.dragging = true;
    this.vYaw = this.vPitch = 0;
    this.lastPointer = { x, y, t: performance.now() };
  }
  pointerMove(x: number, y: number) {
    if (!this.dragging) return;
    const now = performance.now();
    const k = (Math.PI / Math.max(this.h, 1)) * 0.9;
    const dx = (x - this.lastPointer.x) * k;
    const dy = (y - this.lastPointer.y) * k;
    this.yaw += dx;
    this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch + dy));
    const dt = Math.max(1, now - this.lastPointer.t) / 1000;
    this.vYaw = dx / dt;
    this.vPitch = dy / dt;
    this.lastPointer = { x, y, t: now };
    this.idle = 0;
    if (!this.running) {
      this.apply();
      this.render();
    }
  }
  pointerUp() {
    this.dragging = false;
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.w = parent.clientWidth || 1;
    this.h = parent.clientHeight || 1;
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.fov = this.w / this.h < 0.8 ? 46 : 32;
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
      this.progress = this.opts.reducedMotion ? this.target : this.progress + (this.target - this.progress) * (1 - Math.exp(-dt * 5));
      if (!this.opts.reducedMotion) this.time += dt;
      if (!this.dragging) {
        // inertia, then a slow drift once the visitor lets go
        this.yaw += this.vYaw * dt;
        this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch + this.vPitch * dt));
        const f = Math.exp(-dt * 2.6);
        this.vYaw *= f;
        this.vPitch *= f;
        this.idle += dt;
        if (!this.opts.reducedMotion && this.idle > 2.5) this.yaw += dt * 0.03 * Math.min(1, (this.idle - 2.5) / 2);
        if (this.idle > 4) this.pitch *= Math.exp(-dt * 0.6);
      }
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
    // desktop: globe sits in the right part of the screen, text on the left
    const sx = portrait ? 0 : 0.18;
    const sy = portrait ? 0.14 : 0;
    this.camera.setViewOffset(this.w, this.h, -sx * this.w, -sy * this.h, this.w, this.h);
    this.renderer.render(this.scene, this.camera);
  }

  private apply() {
    const p = this.progress;
    const t = this.time;
    const portrait = this.w / this.h < 0.8;
    // approach: from deep space to a close orbit
    const dist = (portrait ? 1.35 : 1) * (78 - 34 * smooth(0, 0.6, p));
    this.camera.position.set(0, 4 * (1 - p), dist);
    this.camera.lookAt(0, 0, 0);
    this.stars.rotation.y = t * 0.003;

    // base orientation faces the home base, tilted so Europe and the North Atlantic show
    const scrollYaw = -(p - 0.4) * 0.9;
    this.globe.rotation.order = "XYZ";
    this.globe.rotation.x = HOME.lat * D2R * 0.72 + this.pitch;
    this.globe.rotation.y = -Math.PI / 2 - HOME.lon * D2R + 0.25 + this.yaw + scrollYaw;
    this.uniforms.uCloudShift.value = t * 0.0009;
    this.clouds.rotation.y = 0;

    const draw = smooth(0.25, 0.85, p);
    for (const r of this.routes) {
      const local = clamp01((draw - r.delay) / 0.45);
      r.mat.uniforms.uDraw!.value = local * 1.001;
      r.mat.uniforms.uHead!.value = local >= 1 && !this.opts.reducedMotion ? (t * r.speed + r.delay * 7) % 1.3 - 0.1 : local;
    }
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        const u = (x as THREE.ShaderMaterial).uniforms;
        if (u) for (const k of Object.keys(u)) (u[k]!.value as THREE.Texture | undefined)?.dispose?.();
        (x as THREE.SpriteMaterial).map?.dispose();
        x.dispose();
      });
    });
    this.renderer.dispose();
  }
}

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.2, "rgba(170,240,255,.7)");
  grd.addColorStop(1, "rgba(34,211,238,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
