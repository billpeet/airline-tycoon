#!/usr/bin/env bun
/**
 * One-shot fetcher for the airport seed file.
 *
 * Pulls the OurAirports CSV (public domain, https://ourairports.com/data/),
 * filters to a focused set, and writes
 *   src/data/seeds/airports.json
 *
 * Filtering policy:
 *   - Always include large_airport with an IATA code (global hubs).
 *   - For "focus regions" (Australia, NZ, North America, Europe), also include
 *     medium_airport with an IATA code.
 *   - Skip closed and heliport entries.
 *
 * Re-run with `bun run scripts/fetch-airports.ts` whenever you want a fresher
 * snapshot. Commit the resulting JSON.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SOURCE = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const OUT = "src/data/seeds/airports.json";

// ISO-3166-1 alpha-2 codes for our focus regions.
const FOCUS_COUNTRIES = new Set([
  // Oceania (focus subset)
  "AU", "NZ",
  // North America (NA + key Latin gateways)
  "US", "CA", "MX",
  // Europe (EU + EFTA + UK + nearby)
  "GB", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "LU", "PT", "AT", "CH",
  "DK", "NO", "SE", "FI", "IS", "EE", "LV", "LT", "PL", "CZ", "SK", "HU",
  "GR", "BG", "RO", "HR", "SI", "RS", "AL", "MK", "BA", "ME", "MD", "UA",
  "CY", "MT", "TR",
]);

// Slot-constrained airports — major hubs where slots are a real currency.
const SLOT_CONSTRAINED = new Set([
  "LHR", "LGW", "STN", "CDG", "ORY", "FRA", "MUC", "AMS", "FCO", "MAD",
  "BCN", "ZRH", "VIE", "JFK", "LGA", "EWR", "DCA", "SFO", "ORD", "ATL",
  "LAX", "BOS", "SYD", "MEL", "BNE", "PER", "HND", "NRT", "PEK", "PVG",
  "HKG", "SIN", "ICN", "DXB", "DOH", "IST",
]);

type Row = Record<string, string>;

function parseCsvLine(line: string): string[] {
  // Naive CSV parse handling quoted fields with commas + escaped quotes.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

function classifySize(type: string): "small" | "medium" | "large" | null {
  if (type === "large_airport") return "large";
  if (type === "medium_airport") return "medium";
  if (type === "small_airport") return "small";
  return null;
}

function continentFromIso(iso: string | undefined): string | null {
  // OurAirports uses 2-letter continent codes already (AF/AN/AS/EU/NA/OC/SA);
  // pass through if present.
  if (iso && iso.length === 2) return iso;
  return null;
}

async function main() {
  console.log(`Fetching ${SOURCE} …`);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status} from OurAirports`);
  const csv = await res.text();
  console.log(`Got ${(csv.length / 1024 / 1024).toFixed(1)}MB`);

  const lines = csv.split(/\r?\n/);
  const header = parseCsvLine(lines.shift()!);

  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Missing column "${name}" in CSV header`);
    return i;
  };
  const cIdent = idx("ident");
  const cType = idx("type");
  const cName = idx("name");
  const cLat = idx("latitude_deg");
  const cLon = idx("longitude_deg");
  const cElev = idx("elevation_ft");
  const cContinent = idx("continent");
  const cCountry = idx("iso_country");
  const cMunicipality = idx("municipality");
  const cIata = idx("iata_code");
  const cIcao = header.indexOf("icao_code"); // newer files have this; older only have `ident`
  const cTz = header.indexOf("scheduled_service"); // proxy for "is this commercial-ish"
  const cTzName = header.indexOf("scheduled_service");

  const out: Array<{
    id: string;
    iata: string | null;
    icao: string | null;
    name: string;
    city: string | null;
    country: string;
    continent: string | null;
    lat: number;
    lon: number;
    elevation_ft: number | null;
    size: "small" | "medium" | "large";
    slot_constrained: boolean;
    timezone: string | null;
  }> = [];

  let kept = 0;
  let scanned = 0;
  for (const raw of lines) {
    if (!raw.trim()) continue;
    scanned++;
    const cols = parseCsvLine(raw);

    const type = cols[cType];
    const size = classifySize(type);
    if (!size) continue;

    const iata = cols[cIata]?.trim() || null;
    const ident = cols[cIdent]?.trim() || null;
    const icaoCol = cIcao >= 0 ? cols[cIcao]?.trim() || null : null;
    const icao = icaoCol || (ident && ident.length === 4 && /^[A-Z]{4}$/.test(ident) ? ident : null);

    // Must have a usable code
    if (!iata && !icao) continue;

    const country = cols[cCountry]?.trim();
    if (!country) continue;

    // Filtering: large always; medium only in focus regions
    if (size === "large") {
      if (!iata) continue;
    } else if (size === "medium") {
      if (!iata) continue;
      if (!FOCUS_COUNTRIES.has(country)) continue;
    } else {
      continue; // skip small airports entirely
    }

    const lat = parseFloat(cols[cLat]);
    const lon = parseFloat(cols[cLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const elev = cols[cElev] ? parseInt(cols[cElev], 10) : null;
    const id = iata ?? `ICAO:${icao}`;
    const continent = continentFromIso(cols[cContinent]?.trim() || undefined);

    out.push({
      id,
      iata,
      icao,
      name: cols[cName]?.trim() ?? id,
      city: cols[cMunicipality]?.trim() || null,
      country,
      continent,
      lat,
      lon,
      elevation_ft: Number.isFinite(elev as number) ? (elev as number) : null,
      size,
      slot_constrained: !!iata && SLOT_CONSTRAINED.has(iata),
      timezone: null,
    });
    kept++;
  }

  out.sort((a, b) => (a.iata ?? a.id).localeCompare(b.iata ?? b.id));

  mkdirSync(dirname(OUT), { recursive: true });
  const payload = {
    $source: SOURCE,
    $license: "OurAirports data is in the public domain (https://ourairports.com/about.html)",
    $updated: new Date().toISOString().slice(0, 10),
    $count: out.length,
    airports: out,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2));

  console.log(
    `Scanned ${scanned} rows; kept ${kept}; ${out.filter((a) => a.size === "large").length} large + ${out.filter((a) => a.size === "medium").length} medium.`,
  );
  console.log(`Wrote ${OUT}`);
}

await main();
