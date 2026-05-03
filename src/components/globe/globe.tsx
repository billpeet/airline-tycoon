"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { Earth } from "./earth";
import { AirportsLayer, type GlobeAirport } from "./airports-layer";

export function Globe({ airports }: { airports: GlobeAirport[] }) {
  // Defensive copy so React/R3F doesn't try to mutate the server payload.
  const data = useMemo<GlobeAirport[]>(() => airports, [airports]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 2.6], fov: 38, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      {/* Light: warm key + cool fill, matching the paper-cream globe */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 2, 4]} intensity={1.0} />
      <directionalLight position={[-2, -1, -2]} intensity={0.25} color="#A9B7C6" />

      <Suspense fallback={null}>
        <Earth />
        <AirportsLayer airports={data} />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.6}
        minDistance={1.4}
        maxDistance={6}
        autoRotate
        autoRotateSpeed={0.25}
      />
    </Canvas>
  );
}
