"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { latLonToVec3 } from "./geo-utils";

export type GlobeAirport = {
  id: string;
  iata: string | null;
  lat: number;
  lon: number;
  size: "small" | "medium" | "large";
  slot_constrained: boolean;
};

const PERSIMMON = new THREE.Color("#D8451B");
const RUNWAY = new THREE.Color("#E8B339");
const INK = new THREE.Color("#0F1B2D");

const RADIUS = 1;
const LIFT = 1.005;

/**
 * Renders airports as a single Points draw call. Slot-constrained hubs get
 * a separate, larger persimmon overlay; medium airports are subtle ink dots.
 */
export function AirportsLayer({ airports }: { airports: GlobeAirport[] }) {
  const { large, medium, slot } = useMemo(() => {
    const large = makeBuffer(airports.filter((a) => a.size === "large" && !a.slot_constrained), RUNWAY, LIFT);
    const medium = makeBuffer(airports.filter((a) => a.size === "medium"), INK, LIFT);
    const slot = makeBuffer(airports.filter((a) => a.slot_constrained), PERSIMMON, LIFT + 0.001);
    return { large, medium, slot };
  }, [airports]);

  return (
    <group>
      <points geometry={medium.geom}>
        <pointsMaterial
          size={0.008}
          sizeAttenuation
          color="#0F1B2D"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </points>
      <points geometry={large.geom}>
        <pointsMaterial
          size={0.014}
          sizeAttenuation
          color="#E8B339"
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </points>
      <points geometry={slot.geom}>
        <pointsMaterial
          size={0.022}
          sizeAttenuation
          color="#D8451B"
          transparent
          opacity={1}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function makeBuffer(rows: GlobeAirport[], _color: THREE.Color, lift: number) {
  const positions = new Float32Array(rows.length * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < rows.length; i++) {
    latLonToVec3(rows[i].lat, rows[i].lon, RADIUS * lift, v);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return { geom, count: rows.length };
}
