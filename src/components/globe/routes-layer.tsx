"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { greatCircleArc } from "./geo-utils";

export type GlobeRoute = {
  id: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  /** Tone hint: "good" (profitable) | "warn" (loss-making) | "neutral" */
  tone?: "good" | "warn" | "neutral";
};

const COLOR_GOOD = new THREE.Color("#2F5D4F");      // hangar green
const COLOR_WARN = new THREE.Color("#D8451B");      // persimmon
const COLOR_NEUTRAL = new THREE.Color("#0F1B2D");   // ink

/**
 * Player routes drawn as great-circle splines lifted slightly off the surface.
 * One LineSegments draw per tone bucket to keep things cheap.
 */
export function RoutesLayer({ routes }: { routes: GlobeRoute[] }) {
  const buckets = useMemo(() => {
    const good: GlobeRoute[] = [];
    const warn: GlobeRoute[] = [];
    const neutral: GlobeRoute[] = [];
    for (const r of routes) {
      if (r.tone === "good") good.push(r);
      else if (r.tone === "warn") warn.push(r);
      else neutral.push(r);
    }
    return {
      good: build(good),
      warn: build(warn),
      neutral: build(neutral),
    };
  }, [routes]);

  return (
    <group>
      <lineSegments geometry={buckets.neutral}>
        <lineBasicMaterial color={COLOR_NEUTRAL} transparent opacity={0.7} linewidth={1} />
      </lineSegments>
      <lineSegments geometry={buckets.warn}>
        <lineBasicMaterial color={COLOR_WARN} transparent opacity={0.95} linewidth={1.5} />
      </lineSegments>
      <lineSegments geometry={buckets.good}>
        <lineBasicMaterial color={COLOR_GOOD} transparent opacity={0.95} linewidth={1.5} />
      </lineSegments>
    </group>
  );
}

function build(routes: GlobeRoute[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const r of routes) {
    const arc = greatCircleArc(r.fromLat, r.fromLon, r.toLat, r.toLon, 1, 48, 0.05);
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i]!;
      const b = arc[i + 1]!;
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}
