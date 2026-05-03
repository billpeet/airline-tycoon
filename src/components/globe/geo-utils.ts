/**
 * Helpers for projecting geographic coordinates onto a 3D sphere.
 */

import * as THREE from "three";

const DEG2RAD = Math.PI / 180;

/** lat/lon (deg) → 3D point on a sphere of given radius. */
export function latLonToVec3(
  lat: number,
  lon: number,
  radius = 1,
  out: THREE.Vector3 = new THREE.Vector3(),
): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = -lon * DEG2RAD;
  return out.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Sample a great-circle arc between two lat/lon points into N points
 * on a sphere of given radius. Useful later for route arcs (Phase 2).
 * Lifts the arc slightly above the surface for visibility.
 */
export function greatCircleArc(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  radius = 1,
  steps = 48,
  lift = 0.04,
): THREE.Vector3[] {
  const a = latLonToVec3(lat1, lon1, 1);
  const b = latLonToVec3(lat2, lon2, 1);
  const omega = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const sinOmega = Math.sin(omega);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let p: THREE.Vector3;
    if (sinOmega < 1e-6) {
      p = a.clone().lerp(b, t);
    } else {
      const sa = Math.sin((1 - t) * omega) / sinOmega;
      const sb = Math.sin(t * omega) / sinOmega;
      p = a.clone().multiplyScalar(sa).add(b.clone().multiplyScalar(sb));
    }
    // Lift to an arc whose apex sits `lift` above the surface (sin curve)
    const r = radius + Math.sin(t * Math.PI) * lift * radius;
    p.normalize().multiplyScalar(r);
    out.push(p);
  }
  return out;
}
