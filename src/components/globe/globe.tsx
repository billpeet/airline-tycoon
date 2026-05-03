"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { Earth } from "./earth";
import { AirportsLayer, type GlobeAirport } from "./airports-layer";
import { RoutesLayer, type GlobeRoute } from "./routes-layer";

export function Globe({
  airports,
  routes = [],
}: {
  airports: GlobeAirport[];
  routes?: GlobeRoute[];
}) {
  const data = useMemo<GlobeAirport[]>(() => airports, [airports]);
  const routeData = useMemo<GlobeRoute[]>(() => routes, [routes]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.4, 2.6], fov: 38, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 2, 4]} intensity={1.0} />
      <directionalLight position={[-2, -1, -2]} intensity={0.25} color="#A9B7C6" />

      <Suspense fallback={null}>
        <Earth />
        <AirportsLayer airports={data} />
        {routeData.length > 0 && <RoutesLayer routes={routeData} />}
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
