import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { FELTS, shade } from "./data.js";

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
  return useMemo(() => {
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
}

// Premium fabric look — physical sheen so felt catches the light like wool.
function FeltMaterial({ color, side }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.95}
      metalness={0}
      sheen={1}
      sheenRoughness={0.55}
      sheenColor={shade(color, 0.35)}
      clearcoat={0.04}
      side={side ?? THREE.FrontSide}
    />
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
        {Array.from({ length: 28 }, (_, k) => {
          const a = (k / 28) * Math.PI * 2;
          return (
            <mesh key={k} position={[Math.cos(a) * 1.0, y, Math.sin(a) * 1.0]} castShadow>
              <sphereGeometry args={[0.05, 12, 10]} />
              <meshStandardMaterial color={k % 2 ? "#c25b34" : "#efe6d2"} roughness={0.4} />
            </mesh>
          );
        })}
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

function Charm({ id }) {
  if (id === "none") return null;
  // front-left of the band
  const base = [0.84, 0.26, 0.52];

  if (id === "feather")
    return (
      <group position={base} rotation={[0.2, 0.5, 0.25]}>
        <mesh castShadow>
          <coneGeometry args={[0.18, 1.0, 20]} />
          <meshStandardMaterial color="#b8451f" roughness={0.6} />
        </mesh>
        <mesh scale={[1, 1, 0.18]} position={[0, 0, 0]} castShadow>
          <coneGeometry args={[0.2, 1.05, 20]} />
          <meshStandardMaterial color="#c25b34" roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
          <meshStandardMaterial color="#6f2a12" />
        </mesh>
      </group>
    );

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

  if (id === "bloom")
    return (
      <group position={base}>
        {Array.from({ length: 6 }, (_, k) => {
          const a = (k * Math.PI) / 3;
          return (
            <mesh key={k} position={[Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0]} castShadow>
              <sphereGeometry args={[0.085, 16, 12]} />
              <meshStandardMaterial color="#d98c9a" roughness={0.45} />
            </mesh>
          );
        })}
        <mesh castShadow>
          <sphereGeometry args={[0.08, 16, 12]} />
          <meshStandardMaterial color={BRASS} metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    );

  if (id === "star") return <StarCharm position={base} />;

  return null;
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

function HatModel({ felt, brim, band, charm, initials, autoRotate }) {
  const group = useRef();
  const feltColor = FELTS.find((f) => f.id === felt).color;
  const brimColor = shade(feltColor, -0.16);
  const crown = useCrownGeometry();
  const brimGeo = useBrimGeometry(brim);

  useFrame((state, dt) => {
    if (group.current && autoRotate) group.current.rotation.y += dt * 0.25;
  });

  const mono = (initials || "").toUpperCase().slice(0, 3);

  return (
    <group ref={group} rotation={[0, -0.5, 0]} position={[0, -0.35, 0]}>
      {/* crown */}
      <mesh geometry={crown} castShadow receiveShadow>
        <FeltMaterial color={feltColor} />
      </mesh>
      {/* brim (thin sheet -> double sided) */}
      <mesh geometry={brimGeo} castShadow receiveShadow>
        <FeltMaterial color={brimColor} side={THREE.DoubleSide} />
      </mesh>
      <Band id={band} crownColor={feltColor} />
      <Charm id={charm} />
      {mono && (
        <Suspense fallback={null}>
          <Text
            position={[1.02, 0.2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            fontSize={0.22}
            letterSpacing={0.12}
            color={BRASS}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.004}
            outlineColor="#7a5a16"
          >
            {mono}
          </Text>
        </Suspense>
      )}
    </group>
  );
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
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-5, 3, -3]} intensity={0.8} color="#e0905f" />
      <directionalLight position={[0, 2, -6]} intensity={1.1} color="#9fd6cd" />

      <group position={[0, 0.1, 0]}>
        <HatModel
          felt={felt}
          brim={brim}
          band={band}
          charm={charm}
          initials={initials}
          autoRotate={interactive}
        />
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
