"use client";

import { useMemo } from "react";
import * as THREE from "three";
import topology from "world-atlas/countries-110m.json";
import { feature, mesh } from "topojson-client";
import type { Topology } from "topojson-specification";
import { latLonToVec3 } from "./geo-utils";

const RADIUS = 1;

// World-atlas TopoJSON typed loosely (the package ships JSON without types).
const topo = topology as unknown as Topology;
const countriesObj = topo.objects.countries as never;

/** Build LineSegments BufferGeometry for every coastline / border. */
function buildCountryLines(): THREE.BufferGeometry {
  // Use mesh() to get internal + external borders as a MultiLineString.
  const meshFc = mesh(topo, countriesObj) as unknown as {
    coordinates: [number, number][][];
  };

  const positions: number[] = [];
  const v = new THREE.Vector3();

  for (const line of meshFc.coordinates) {
    for (let i = 0; i < line.length - 1; i++) {
      const [lon1, lat1] = line[i];
      const [lon2, lat2] = line[i + 1];
      latLonToVec3(lat1, lon1, RADIUS * 1.001, v);
      positions.push(v.x, v.y, v.z);
      latLonToVec3(lat2, lon2, RADIUS * 1.001, v);
      positions.push(v.x, v.y, v.z);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

/**
 * Build a flat-shaded mesh of every country polygon, slightly inset from
 * the surface, so land reads as a darker tone over the cream sphere.
 */
function buildLandMesh(): THREE.BufferGeometry {
  const fc = feature(topo, countriesObj) as unknown as {
    features: { geometry: { type: string; coordinates: unknown } }[];
  };

  const positions: number[] = [];
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const inflate = RADIUS * 1.0005;

  // Triangulate each polygon ring with a fan (poor for concave shapes but
  // good enough at 110m resolution for a stylised paper-globe look).
  function emitRing(ring: [number, number][]) {
    if (ring.length < 3) return;
    const [lon0, lat0] = ring[0];
    latLonToVec3(lat0, lon0, inflate, v0);
    for (let i = 1; i < ring.length - 1; i++) {
      const [lonA, latA] = ring[i];
      const [lonB, latB] = ring[i + 1];
      latLonToVec3(latA, lonA, inflate, v1);
      latLonToVec3(latB, lonB, inflate, v2);
      positions.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    }
  }

  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === "Polygon") {
      emitRing((g.coordinates as [number, number][][])[0]);
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as [number, number][][][]) {
        emitRing(poly[0]);
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  return geom;
}

export function Earth() {
  const lineGeom = useMemo(() => buildCountryLines(), []);
  const landGeom = useMemo(() => buildLandMesh(), []);
  const graticule = useMemo(() => buildGraticule(), []);

  return (
    <group>
      {/* Cream ocean sphere */}
      <mesh>
        <sphereGeometry args={[RADIUS, 96, 64]} />
        <meshStandardMaterial
          color="#F4EDE0"
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Slightly darker land flat-shaded under the lines */}
      <mesh geometry={landGeom}>
        <meshStandardMaterial
          color="#E5DAC0"
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ink coastlines + borders */}
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial color="#0F1B2D" transparent opacity={0.85} />
      </lineSegments>

      {/* Graticule: equator + tropics + polar circles + meridians every 30° */}
      <lineSegments geometry={graticule}>
        <lineBasicMaterial color="#0F1B2D" transparent opacity={0.18} />
      </lineSegments>
    </group>
  );
}

function buildGraticule(): THREE.BufferGeometry {
  const positions: number[] = [];
  const v = new THREE.Vector3();
  const r = RADIUS * 1.0008;

  // Latitude circles
  const lats = [-66.5, -23.4, 0, 23.4, 66.5];
  for (const lat of lats) {
    const segs = 96;
    for (let i = 0; i < segs; i++) {
      const lon1 = -180 + (360 * i) / segs;
      const lon2 = -180 + (360 * (i + 1)) / segs;
      latLonToVec3(lat, lon1, r, v);
      positions.push(v.x, v.y, v.z);
      latLonToVec3(lat, lon2, r, v);
      positions.push(v.x, v.y, v.z);
    }
  }

  // Meridians every 30°
  for (let lon = -180; lon < 180; lon += 30) {
    const segs = 64;
    for (let i = 0; i < segs; i++) {
      const lat1 = -90 + (180 * i) / segs;
      const lat2 = -90 + (180 * (i + 1)) / segs;
      latLonToVec3(lat1, lon, r, v);
      positions.push(v.x, v.y, v.z);
      latLonToVec3(lat2, lon, r, v);
      positions.push(v.x, v.y, v.z);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}
