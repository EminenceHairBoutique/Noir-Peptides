// src/components/product3d/VialScene.jsx
// LAZY-LOADED r3f scene: procedural 10 mL serum vial (borosilicate glass via
// MeshPhysicalMaterial transmission, bromobutyl stopper, aluminum crimp with
// accent flip-cap, lyophilized cake) with the label wrapped as an arc cylinder
// textured from the SVG engine. All three.js imports are isolated here so the
// vendor chunk stays out of the initial bundle.
//
// Units: 1 world unit = 1 mm. Environment: procedural RoomEnvironment (CSP-safe
// — no external HDR). frameloop="demand"; auto-rotate invalidates per frame and
// pauses on interaction / prefers-reduced-motion.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, useFrame, extend } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RotateCcw, Plus, Minus } from "lucide-react";
import useVialTexture from "./useVialTexture";
import { VIAL_10ML, LABEL_PRESETS, wrapArcRadians } from "../../lib/labels/presets";

extend({ OrbitControls });

const GLASS_R = VIAL_10ML.diameterMm / 2; // 12.25
const BODY_H = 44;
const CAM_POS = [0, 30, 92];
const TARGET = [0, 26, 0];

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = rt.texture;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Controls({ controlsRef, autoRotate }) {
  const { camera, gl, invalidate } = useThree();
  const [interacting, setInteracting] = useState(false);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return undefined;
    const onChange = () => invalidate();
    const onStart = () => setInteracting(true);
    const onEnd = () => setInteracting(false);
    c.addEventListener("change", onChange);
    c.addEventListener("start", onStart);
    c.addEventListener("end", onEnd);
    return () => {
      c.removeEventListener("change", onChange);
      c.removeEventListener("start", onStart);
      c.removeEventListener("end", onEnd);
    };
  }, [controlsRef, invalidate]);

  useFrame(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.autoRotate = autoRotate && !interacting;
    c.update();
    if (c.autoRotate) invalidate(); // keep demand-loop alive only while rotating
  });

  return (
    <orbitControls
      ref={controlsRef}
      args={[camera, gl.domElement]}
      enablePan={false}
      enableZoom={false} // wheel zoom off — page scroll never traps; zoom via buttons
      autoRotateSpeed={1.2}
      minPolarAngle={Math.PI * 0.32}
      maxPolarAngle={Math.PI * 0.62}
      target={new THREE.Vector3(...TARGET)}
    />
  );
}

function Vial({ texture, accent = "#00c2ff", showCake = true }) {
  // Glass profile (lathe): base → wall → shoulder → neck lip.
  const glassPoints = useMemo(() => {
    const pts = [
      [0, 0.6], [9.5, 0.6], [11.6, 1.2], [GLASS_R, 3],
      [GLASS_R, BODY_H - 4], [11.4, BODY_H], [8.2, BODY_H + 3.5], [7.0, BODY_H + 5.5], [7.0, BODY_H + 7],
    ];
    return pts.map(([x, y]) => new THREE.Vector2(x, y));
  }, []);

  return (
    <group>
      {/* Glass body */}
      <mesh>
        <latheGeometry args={[glassPoints, 72]} />
        <meshPhysicalMaterial
          transmission={1}
          thickness={3}
          roughness={0.08}
          ior={1.47}
          metalness={0}
          attenuationColor="#f4f8ff"
          attenuationDistance={80}
          envMapIntensity={1}
        />
      </mesh>

      {/* Lyophilized cake */}
      {showCake && (
        <mesh position={[0, 4.2, 0]}>
          <cylinderGeometry args={[10.2, 10.4, 6.5, 48]} />
          <meshStandardMaterial color="#ece7dc" roughness={0.92} />
        </mesh>
      )}

      {/* Stopper */}
      <mesh position={[0, BODY_H + 7.5, 0]}>
        <cylinderGeometry args={[6.9, 6.9, 4.5, 40]} />
        <meshStandardMaterial color="#4a4f57" roughness={0.6} />
      </mesh>

      {/* Aluminum crimp */}
      <mesh position={[0, BODY_H + 8.2, 0]}>
        <cylinderGeometry args={[7.7, 7.7, 6, 48]} />
        <meshStandardMaterial color="#c8ccd4" metalness={1} roughness={0.28} />
      </mesh>

      {/* Flip cap (accent) */}
      <mesh position={[0, BODY_H + 12, 0]}>
        <cylinderGeometry args={[6.9, 6.9, 1.8, 48]} />
        <meshStandardMaterial color={accent} metalness={0.35} roughness={0.35} />
      </mesh>

      {/* Wrapped label — arc cylinder just outside the glass; seam at back */}
      {texture && <LabelWrap texture={texture} />}
    </group>
  );
}

function LabelWrap({ texture }) {
  const preset = LABEL_PRESETS.full_wrap;
  const arc = wrapArcRadians(preset); // ≈ 5.876 rad (336.7°)
  const r = GLASS_R + 0.18;
  const h = preset.heightMm;
  // Center the arc on +Z (camera side); gap faces −Z (back).
  const thetaStart = -arc / 2;
  return (
    <mesh position={[0, 6 + h / 2, 0]}>
      <cylinderGeometry args={[r, r, h, 96, 1, true, thetaStart, arc]} />
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0} side={THREE.FrontSide} />
    </mesh>
  );
}

export default function VialScene({ config, templateId, accent, reducedMotion = false }) {
  const controlsRef = useRef(null);
  const [autoRotate, setAutoRotate] = useState(!reducedMotion);
  const texture = useVialTexture(config, templateId, "full_wrap");

  const setView = (azimuthDeg) => {
    const c = controlsRef.current;
    if (!c) return;
    const dist = c.object.position.distanceTo(c.target);
    const a = (azimuthDeg * Math.PI) / 180;
    c.object.position.set(
      c.target.x + dist * Math.sin(a) * Math.cos(0.25),
      CAM_POS[1],
      c.target.z + dist * Math.cos(a) * Math.cos(0.25)
    );
    c.update();
  };

  const zoom = (factor) => {
    const c = controlsRef.current;
    if (!c) return;
    const dir = c.object.position.clone().sub(c.target);
    const len = THREE.MathUtils.clamp(dir.length() * factor, 55, 150);
    c.object.position.copy(c.target.clone().add(dir.setLength(len)));
    c.update();
  };

  const reset = () => {
    const c = controlsRef.current;
    if (!c) return;
    c.object.position.set(...CAM_POS);
    c.target.set(...TARGET);
    c.update();
  };

  const btn =
    "inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-white/12 bg-white/[0.04] text-se-bone/70 hover:text-se-gold hover:border-se-gold/40 transition text-[11px] font-accent uppercase tracking-wide px-3";

  return (
    <div>
      <div className="relative rounded-xl border border-white/10 bg-gradient-to-b from-[#0d1118] to-[#070a10] overflow-hidden" style={{ height: 420, touchAction: "pan-y" }}>
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          camera={{ position: CAM_POS, fov: 32 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
          }}
        >
          <Env />
          <ambientLight intensity={0.25} />
          <directionalLight position={[40, 80, 60]} intensity={1.1} />
          <directionalLight position={[-50, 30, -40]} intensity={0.35} color="#bcd8ff" />
          <Vial texture={texture} accent={accent} />
          {/* Soft ground shadow disc */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
            <circleGeometry args={[26, 48]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.35} />
          </mesh>
          <Controls controlsRef={controlsRef} autoRotate={autoRotate} />
        </Canvas>
        {!texture && (
          <p className="absolute inset-x-0 bottom-3 text-center text-[11px] text-se-steel font-accent">
            Rendering label texture…
          </p>
        )}
      </div>

      {/* 3D controls — 44px targets, accessible labels */}
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button type="button" className={btn} onClick={() => setView(0)} aria-label="Front view">Front</button>
        <button type="button" className={btn} onClick={() => setView(180)} aria-label="Back view">Back</button>
        <button type="button" className={btn} onClick={() => zoom(0.82)} aria-label="Zoom in"><Plus size={15} /></button>
        <button type="button" className={btn} onClick={() => zoom(1.22)} aria-label="Zoom out"><Minus size={15} /></button>
        <button type="button" className={btn} onClick={reset} aria-label="Reset view"><RotateCcw size={14} /></button>
        <label className="ml-2 flex items-center gap-2 text-[11px] text-se-bone/60 font-accent uppercase tracking-wide">
          <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} disabled={reducedMotion} />
          Auto-rotate
        </label>
      </div>
    </div>
  );
}
