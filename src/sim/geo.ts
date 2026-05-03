/** Great-circle distance between two lat/lon points, in km. */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Daily flight-time (hours) a route consumes on its assigned aircraft. */
export function routeFlightHoursPerDay(
  distanceKm: number,
  frequencyPerWeek: number,
  cruiseSpeedKts: number,
): number {
  const KTS_TO_KMH = 1.852;
  const legHours = distanceKm / (cruiseSpeedKts * KTS_TO_KMH);
  return legHours * 2 * (frequencyPerWeek / 7); // 2 legs per round trip
}

/** Maximum daily flight-hours a single aircraft can fly (hard cap, all classes). */
export const MAX_DAILY_FLIGHT_HOURS = 14;
