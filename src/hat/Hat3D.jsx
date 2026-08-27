import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FELTS, shade } from "./data.js";

// ---------------------------------------------------------------------------
// GLB pipeline (drop-in). Point this at a realistic model whose meshes are
// named "crown" / "brim" / "band" / "charm". When set, Hat3D renders the GLB
// and recolors the felt parts from the current build — still one model, all
// 525 combos. Until a GLB exists we render the procedural mesh below.
// ---------------------------------------------------------------------------
export const HAT_MODEL_URL = null;

// ---------------------------------------------------------------------------
// One parametric 3D hat. Felt / brim / band / charm / initials are *inputs*:
// a single mesh recolors and reshapes for all 525 combinations — we never
// author the combos by hand, the geometry + materials derive them.
// ---------------------------------------------------------------------------

const BRASS = "#caa24a";
const SILVER = "#d7dadf";

// --- Crown: a lathed felt dome (profile rotated around Y) --------------------
function useCrownGeometry() {
  return useMemo(() => {
    const pts = [
      [1.02, 0.0],
      [1.0, 0.12],
      [0.99, 0.3],
      [0.96, 0.62],
      [0.91, 0.96],
      [0.83, 1.24],
      [0.7, 1.44],
      [0.46, 1.53],
      [0.2, 1.56],
      [0.0, 1.57],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 96);
    g.computeVertexNormals();
    return g;
  }, []);
}

// --- Brim: a procedural surface whose edge curls per style -------------------
function useBrimGeometry(style) {
  const geo = useMemo(() => {
    const S = 180; // around
    const R = 30; // inner -> outer rings
    const rInner = 0.97;
    const rOuter = 2.3;
    const pos = [];
    const uv = [];
    for (let i = 0; i <= R; i++) {
      const u = i / R;
      const rad = rInner + u * (rOuter - rInner);
      const e = u * u; // weight toward the outer edge
      for (let j = 0; j <= S; j++) {
        const a = (j / S) * Math.PI * 2; // front = +X (a=0), sides = ±Z
        const c = Math.cos(a);
        const s = Math.sin(a);
        let y = -0.03 - u * 0.05; // gentle overall droop
        if (style === "curl") {
          y += e * 0.6 * Math.pow(Math.abs(s), 1.25); // sides sweep up
          y -= e * 0.12 * Math.max(0, c); // front dips a touch
        } else if (style === "flat") {
          y += -e * 0.05;
          y += e * 0.04 * Math.abs(s);
        } else if (style === "down") {
          y += -e * 0.5 * Math.max(0, c); // front pulls down (gambler dip)
          y += e * 0.34 * Math.max(0, -c); // back lifts
          y += e * 0.14 * Math.abs(s);
        }
        pos.push(Math.cos(a) * rad, y, Math.sin(a) * rad);
        uv.push(j / S, u);
      }
    }
    const idx = [];
    const row = S + 1;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < S; j++) {
        const x = i * row + j;
        idx.push(x, x + row, x + 1, x + 1, x + row, x + row + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [style]);

  // free the old brim's GPU buffers when the style swaps it out
  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

// ---------------------------------------------------------------------------
// PBR felt textures (primary path). Drop tileable maps into
// src/assets/textures/felt/ named:
//
//   felt-albedo.jpg     (optional — keep ~neutral/grey: it's multiplied by
//                         the chosen felt color so all 7 felts stay accurate)
//   felt-normal.jpg     (the wool weave — replaces the procedural bump)
//   felt-roughness.jpg  (micro sheen variation)
//
// (.png / .webp also work.) Detection happens at BUILD time via
// import.meta.glob, so nothing is probed over the network: an empty folder
// means zero requests — the material silently uses the procedural bump below.
// ---------------------------------------------------------------------------
const FELT_TEX_FILES = import.meta.glob("../assets/textures/felt/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});
const FELT_SLOTS = { albedo: "map", normal: "normalMap", roughness: "roughnessMap" };
const FELT_REPEAT = 6;

function useFeltMaps() {
  const [maps, setMaps] = useState({});
  useEffect(() => {
    const entries = Object.entries(FELT_TEX_FILES)
      .map(([path, url]) => {
        const m = path.match(/felt-(albedo|normal|roughness)\.(jpg|jpeg|png|webp)$/);
        return m ? [FELT_SLOTS[m[1]], url] : null;
      })
      .filter(Boolean);
    if (!entries.length) return undefined;
    const loader = new THREE.TextureLoader();
    let active = true;
    const loaded = [];
    entries.forEach(([key, url]) => {
      loader.load(url, (tex) => {
        if (!active) {
          tex.dispose();
          return;
        }
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(FELT_REPEAT, FELT_REPEAT);
        tex.anisotropy = 8;
        if (key === "map") tex.colorSpace = THREE.SRGBColorSpace;
        loaded.push(tex);
        setMaps((m) => ({ ...m, [key]: tex }));
      });
    });
    return () => {
      active = false;
      loaded.forEach((t) => t.dispose());
    };
  }, []);
  return maps;
}

// Procedural felt micro-texture (tileable noise) — the silent fallback bump
// used whenever no real normal map is present in src/assets/textures/felt/.
function useFeltBump() {
  return useMemo(() => {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const v = 188 + Math.random() * 67;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(7, 7);
    t.anisotropy = 4;
    return t;
  }, []);
}

// Premium fabric look — physical sheen + real PBR maps when present, else the
// procedural bump. `key` forces a clean recompile when maps arrive at runtime.
function FeltMaterial({ color, side, bump, maps = {} }) {
  const hasNormal = !!maps.normalMap;
  return (
    <meshPhysicalMaterial
      key={Object.keys(maps).join("|")}
      color={color}
      map={maps.map || null}
      normalMap={maps.normalMap || null}
      roughnessMap={maps.roughnessMap || null}
      roughness={0.95}
      metalness={0}
      sheen={1}
      sheenRoughness={0.5}
      sheenColor={shade(color, 0.4)}
      clearcoat={0.05}
      clearcoatRoughness={0.8}
      bumpMap={hasNormal ? null : bump}
      bumpScale={0.012}
      envMapIntensity={0.55}
      side={side ?? THREE.FrontSide}
    />
  );
}

// --- Beaded ring: one instanced mesh instead of 28 separate spheres ----------
const BEAD_COUNT = 28;
function BeadRing({ y }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let k = 0; k < BEAD_COUNT; k++) {
      const a = (k / BEAD_COUNT) * Math.PI * 2;
      m.setPosition(Math.cos(a) * 1.0, y, Math.sin(a) * 1.0);
      ref.current.setMatrixAt(k, m);
      ref.current.setColorAt(k, c.set(k % 2 ? "#c25b34" : "#efe6d2"));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [y]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BEAD_COUNT]} castShadow>
      <sphereGeometry args={[0.05, 12, 10]} />
      <meshStandardMaterial roughness={0.4} />
    </instancedMesh>
  );
}

function Band({ id, crownColor }) {
  if (id === "none") return null;
  const y = 0.2;
  const ring = (color, props = {}) => (
    <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow {...props}>
      <torusGeometry args={[1.0, 0.085, 24, 96]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.05} />
    </mesh>
  );

  if (id === "leather")
    return (
      <group>
        {ring("#a9743f")}
        <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.052, 16, 96]} />
          <meshStandardMaterial color="#7e5326" roughness={0.6} />
        </mesh>
      </group>
    );

  if (id === "turquoise")
    return (
      <group>
        {ring("#cdd0d4", { rotation: [Math.PI / 2, 0, 0] })}
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * Math.PI * 2;
          return (
            <mesh key={k} position={[Math.cos(a) * 1.0, y, Math.sin(a) * 1.0]} rotation={[0, -a, 0]} castShadow>
              <sphereGeometry args={[0.11, 18, 14]} />
              <meshStandardMaterial color="#3fa89a" roughness={0.32} metalness={0.1} />
            </mesh>
          );
        })}
      </group>
    );

  if (id === "beaded")
    return (
      <group>
        {ring("#d98c9a")}
        <BeadRing y={y} />
      </group>
    );

  if (id === "horsehair")
    return (
      <group>
        {ring("#7a5c44")}
        <mesh position={[0, y + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.04, 12, 96]} />
          <meshStandardMaterial color="#9a7a5c" roughness={0.7} />
        </mesh>
      </group>
    );

  return ring(shade(crownColor, -0.2));
}

// ---------------------------------------------------------------------------
// Charms. Each charm may be swapped for a small realistic GLB dropped into
// src/assets/models/charms/<id>.glb (feather.glb, bloom.glb, concho.glb,
// star.glb). Charms never recolor per felt, so baked mini-models are safe —
// detection is at build time, missing files cost nothing. Until then the
// procedural versions below render.
// ---------------------------------------------------------------------------
const CHARM_GLBS = import.meta.glob("../assets/models/charms/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
});
const charmModelUrl = (id) => CHARM_GLBS[`../assets/models/charms/${id}.glb`] || null;

function CharmGLB({ url, position, rotation, scale = 1 }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

// --- Feather: curved vane + rachis + quill (replaces the old two cones) ------
function useFeatherGeometry() {
  return useMemo(() => {
    const U = 48; // along the feather
    const V = 10; // across the vane
    const pos = [];
    const uvs = [];
    for (let i = 0; i <= U; i++) {
      const u = i / U;
      // leaf-shaped width profile, tapering into the tip
      let w = 0.17 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.8);
      // subtle barb splits along the upper half
      if (u > 0.35) w *= 1 - 0.12 * Math.pow(Math.max(0, Math.sin(26 * Math.PI * u)), 2);
      for (let j = 0; j <= V; j++) {
        const v = (j / V) * 2 - 1;
        pos.push(v * w, u * 1.08 - 0.54, 0.045 * (1 - v * v) + 0.09 * Math.sin(Math.PI * u));
        uvs.push(j / V, u);
      }
    }
    const idx = [];
    const row = V + 1;
    for (let i = 0; i < U; i++) {
      for (let j = 0; j < V; j++) {
        const a = i * row + j;
        idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
}

function FeatherCharm({ position }) {
  const vane = useFeatherGeometry();
  const rachis = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.64, 0.02),
      new THREE.Vector3(0, -0.2, 0.08),
      new THREE.Vector3(0, 0.2, 0.13),
      new THREE.Vector3(0, 0.5, 0.14),
    ]);
    return new THREE.TubeGeometry(curve, 20, 0.016, 8, false);
  }, []);
  return (
    <group position={position} rotation={[0.15, 0.55, 0.42]} scale={0.95}>
      <mesh geometry={vane} castShadow>
        <meshPhysicalMaterial
          color="#c25b34"
          roughness={0.62}
          sheen={0.8}
          sheenColor="#e8926a"
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={rachis} castShadow>
        <meshStandardMaterial color="#f3e2cf" roughness={0.5} />
      </mesh>
      {/* bare quill below the vane */}
      <mesh position={[0, -0.68, 0.01]} rotation={[0.12, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.011, 0.16, 8]} />
        <meshStandardMaterial color="#6f2a12" roughness={0.45} />
      </mesh>
    </group>
  );
}

// --- Bloom: two rings of curled petals around a brass heart ------------------
function usePetalGeometry() {
  return useMemo(() => {
    const U = 22;
    const V = 8;
    const pos = [];
    const uvs = [];
    for (let i = 0; i <= U; i++) {
      const u = i / U;
      const w = 0.085 * Math.sin(Math.PI * Math.pow(u, 0.9));
      for (let j = 0; j <= V; j++) {
        const v = (j / V) * 2 - 1;
        // camber across + upward curl along the petal
        pos.push(v * w, u * 0.24, 0.02 * (1 - v * v) + 0.085 * u * u);
        uvs.push(j / V, u);
      }
    }
    const idx = [];
    const row = V + 1;
    for (let i = 0; i < U; i++) {
      for (let j = 0; j < V; j++) {
        const a = i * row + j;
        idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
}

function BloomCharm({ position }) {
  const petal = usePetalGeometry();
  const petalMat = (color) => (
    <meshPhysicalMaterial color={color} roughness={0.5} sheen={0.9} sheenColor="#f2c7cf" side={THREE.DoubleSide} />
  );
  return (
    <group position={position} rotation={[0.35, 0.45, 0]} scale={1.05}>
      {/* outer ring of 6 petals, opened wide */}
      {Array.from({ length: 6 }, (_, k) => (
        <group key={`o${k}`} rotation={[0, 0, (k * Math.PI) / 3]}>
          <mesh geometry={petal} rotation={[0.95, 0, 0]} castShadow>
            {petalMat("#d98c9a")}
          </mesh>
        </group>
      ))}
      {/* inner ring of 5 petals, more upright */}
      {Array.from({ length: 5 }, (_, k) => (
        <group key={`i${k}`} rotation={[0, 0, (k * 2 * Math.PI) / 5 + 0.6]}>
          <mesh geometry={petal} rotation={[0.55, 0, 0]} scale={0.62} castShadow>
            {petalMat("#e8aab6")}
          </mesh>
        </group>
      ))}
      {/* brass heart */}
      <mesh position={[0, 0, 0.05]} castShadow>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.35} />
      </mesh>
    </group>
  );
}

function StarCharm({ position }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    const N = 5;
    const R = 0.22;
    const r = R * 0.45;
    for (let i = 0; i < N * 2; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (Math.PI / N) * i - Math.PI / 2;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      bevelSegments: 2,
    });
  }, []);
  return (
    <mesh geometry={geo} position={position} castShadow>
      <meshStandardMaterial color={BRASS} metalness={1} roughness={0.35} />
    </mesh>
  );
}

function Charm({ id }) {
  if (id === "none") return null;
  // front-left of the band
  const base = [0.84, 0.26, 0.52];

  const glb = charmModelUrl(id);
  if (glb) return <CharmGLB url={glb} position={base} rotation={[0.2, 0.5, 0.25]} />;

  if (id === "feather") return <FeatherCharm position={base} />;

  if (id === "concho")
    return (
      <group position={base} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
          <meshStandardMaterial color={SILVER} metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 24]} />
          <meshStandardMaterial color="#9aa0a8" metalness={1} roughness={0.3} />
        </mesh>
      </group>
    );

  if (id === "bloom") return <BloomCharm position={base} />;

  if (id === "star") return <StarCharm position={base} />;

  return null;
}

// ---------------------------------------------------------------------------
// Monogram plate: the initials are drawn with the page's own brand font
// (Clash Display, already loaded by the site's stylesheet) onto a canvas
// texture — no external glyph font is fetched, and the type matches the site.
// ---------------------------------------------------------------------------
function useMonogramTexture(mono) {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    if (!mono) {
      setTex(null);
      return undefined;
    }
    let cancelled = false;
    let texture = null;
    const draw = () => {
      if (cancelled) return;
      const spaced = mono.split("").join("  ");
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.font = "600 150px 'Clash Display', 'Satoshi', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 10;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#7a5a16";
      ctx.strokeText(spaced, 256, 136);
      ctx.fillStyle = "#e6c06a";
      ctx.fillText(spaced, 256, 136);
      texture = new THREE.CanvasTexture(c);
      texture.anisotropy = 8;
      texture.colorSpace = THREE.SRGBColorSpace;
      setTex(texture);
    };
    // wait for the brand font so the first paint isn't a fallback face
    if (document.fonts?.ready) document.fonts.ready.then(draw);
    else draw();
    return () => {
      cancelled = true;
      if (texture) texture.dispose();
    };
  }, [mono]);
  return tex;
}

function Monogram({ initials }) {
  const mono = (initials || "").toUpperCase().slice(0, 3);
  const tex = useMonogramTexture(mono);
  if (!tex) return null;
  return (
    <mesh position={[1.03, 0.2, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.82, 0.41]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function HatModel({ felt, brim, band, charm, initials, autoRotate }) {
  const group = useRef();
  const feltColor = FELTS.find((f) => f.id === felt).color;
  const brimColor = shade(feltColor, -0.16);
  const crown = useCrownGeometry();
  const brimGeo = useBrimGeometry(brim);
  const bump = useFeltBump();
  const maps = useFeltMaps();

  useFrame((state, dt) => {
    if (group.current && autoRotate) group.current.rotation.y += dt * 0.25;
  });

  return (
    <group ref={group} rotation={[0, -0.5, 0]} position={[0, -0.35, 0]}>
      {/* crown */}
      <mesh geometry={crown} castShadow receiveShadow>
        <FeltMaterial color={feltColor} bump={bump} maps={maps} />
      </mesh>
      {/* brim (thin sheet -> double sided) */}
      <mesh geometry={brimGeo} castShadow receiveShadow>
        <FeltMaterial color={brimColor} side={THREE.DoubleSide} bump={bump} maps={maps} />
      </mesh>
      <Band id={band} crownColor={feltColor} />
      <Charm id={charm} />
      <Monogram initials={initials} />
    </group>
  );
}

// Realistic GLB variant — recolors the felt parts of a supplied model.
function HatGLBModel({ felt, autoRotate }) {
  const group = useRef();
  const { scene } = useGLTF(HAT_MODEL_URL);
  const feltColor = FELTS.find((f) => f.id === felt).color;

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.name.toLowerCase();
      o.castShadow = o.receiveShadow = true;
      if (n.includes("crown") || n.includes("brim") || n.includes("felt")) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(n.includes("brim") ? shade(feltColor, -0.16) : feltColor);
      }
    });
    return c;
  }, [scene, feltColor]);

  useFrame((_, dt) => {
    if (group.current && autoRotate) group.current.rotation.y += dt * 0.25;
  });

  return <primitive ref={group} object={cloned} />;
}

export default function Hat3D({ felt, brim, band, charm, initials, interactive = true }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.05, 5.4], fov: 30 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />

      {/* In-engine studio HDRI — premium reflections, no external download */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#1a0f08"]} />
        <Lightformer intensity={3} position={[0, 4, 2]} scale={[7, 2.5, 1]} color="#fff4e6" />
        <Lightformer intensity={1.4} position={[-4, 1.5, 1]} scale={[3, 4, 1]} color="#e0905f" />
        <Lightformer intensity={1.6} position={[4, 1, -3]} scale={[4, 4, 1]} color="#a9ddd3" />
        <Lightformer intensity={1} position={[0, -2, 3]} scale={[5, 2, 1]} color="#ffffff" />
      </Environment>

      <group position={[0, 0.1, 0]}>
        <Suspense fallback={null}>
          {HAT_MODEL_URL ? (
            <HatGLBModel felt={felt} autoRotate={interactive} />
          ) : (
            <HatModel
              felt={felt}
              brim={brim}
              band={band}
              charm={charm}
              initials={initials}
              autoRotate={interactive}
            />
          )}
        </Suspense>
      </group>

      <ContactShadows position={[0, -1.05, 0]} opacity={0.55} scale={7} blur={2.6} far={3.2} color="#1c1109" />

      {interactive && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI * 0.18}
          maxPolarAngle={Math.PI * 0.62}
          enableDamping
          dampingFactor={0.08}
        />
      )}
    </Canvas>
  );
}
