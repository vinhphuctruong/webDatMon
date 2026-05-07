export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1); // deg2rad below
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function displayDistance(d) {
  return `${d.toFixed(1)} km`; // Return distance with 2 decimal places
}

export const THU_DAU_MOT_CENTER = {
  lat: 10.9804,
  lng: 106.6519,
};

export const THU_DAU_MOT_SERVICE_RADIUS_KM = 22;

/**
 * Vùng phục vụ hiện tại của hệ thống.
 * Bounds: [106.25, 10.417] -> [110.944, 12.786]
 */
export const TILE_SERVER_BOUNDS = {
  minLat: 10.417,
  maxLat: 12.786,
  minLng: 106.25,
  maxLng: 110.944,
};

/**
 * Kiểm tra vị trí có nằm trong vùng phục vụ hay không.
 */
export function isWithinServiceArea(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  return (
    lat >= TILE_SERVER_BOUNDS.minLat &&
    lat <= TILE_SERVER_BOUNDS.maxLat &&
    lng >= TILE_SERVER_BOUNDS.minLng &&
    lng <= TILE_SERVER_BOUNDS.maxLng
  );
}

/** @deprecated Use isWithinServiceArea instead — kept for backward compatibility */
export function isWithinThuDauMotServiceArea(lat: number, lng: number) {
  return isWithinServiceArea(lat, lng);
}

/**
 * Tính toán khung giờ giao dự kiến (ETA) dựa trên quãng đường
 * - Chuẩn bị món: 10 phút
 * - Di chuyển: 2 phút / 1 km
 * - Dự phòng (Buffer): 10 phút cho cận trên
 */
export function calculateETA(distanceKm?: number): string {
  if (distanceKm === undefined || !Number.isFinite(distanceKm)) {
    return "20 - 30 phút";
  }
  
  const prepTime = 10; // 10 minutes prep
  const travelTime = Math.ceil(distanceKm * 2); // 2 mins per km
  const minTime = prepTime + travelTime;
  
  // Làm tròn thời gian cho đẹp (bội số của 5)
  const roundedMin = Math.ceil(minTime / 5) * 5;
  const roundedMax = roundedMin + 10;
  
  return `${roundedMin} - ${roundedMax} phút`;
}

export function parseCoordinatePair(input: string) {
  if (!input?.trim()) {
    return null;
  }

  const normalized = input.trim().replace(/;/g, ",");
  const [latRaw, lngRaw] = normalized.split(",").map((segment) => segment.trim());

  if (!latRaw || !lngRaw) {
    return null;
  }

  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toValidCoordinatePair(latRaw: unknown, lngRaw: unknown) {
  const lat = toFiniteNumber(latRaw);
  const lng = toFiniteNumber(lngRaw);

  if (lat === null || lng === null) {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { lat, lng };
}

export function parseGoogleMapsCoordinates(input: string) {
  if (!input?.trim()) {
    return null;
  }

  const trimmed = input.trim();
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch (_error) {
    // Keep the original text if decodeURIComponent fails on malformed '%' sequences.
    decoded = trimmed;
  }

  const directPair = parseCoordinatePair(decoded);
  if (directPair) {
    return directPair;
  }

  const fromAtSegment = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (fromAtSegment) {
    const pair = toValidCoordinatePair(fromAtSegment[1], fromAtSegment[2]);
    if (pair) return pair;
  }

  const from3d4d = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (from3d4d) {
    const pair = toValidCoordinatePair(from3d4d[1], from3d4d[2]);
    if (pair) return pair;
  }

  const fromQuery = decoded.match(
    /[?&](?:q|query|ll|sll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
  );
  if (fromQuery) {
    const pair = toValidCoordinatePair(fromQuery[1], fromQuery[2]);
    if (pair) return pair;
  }

  const fromAnyPair = decoded.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (fromAnyPair) {
    const pair = toValidCoordinatePair(fromAnyPair[1], fromAnyPair[2]);
    if (pair) return pair;
  }

  return null;
}

export function normalizeStoredCoordinates(latitude: unknown, longitude: unknown) {
  const direct = toValidCoordinatePair(latitude, longitude);
  if (direct) {
    return { ...direct, wasSwapped: false };
  }

  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  if (lat === null || lng === null) {
    return null;
  }

  const swapped = toValidCoordinatePair(lng, lat);
  if (swapped) {
    return { ...swapped, wasSwapped: true };
  }

  return null;
}

function pickCoordinateFromPayload(payload: unknown): { lat: number; lng: number } | null {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = pickCoordinateFromPayload(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof payload !== "object") {
    return null;
  }

  const row = payload as Record<string, unknown>;
  const pair = toValidCoordinatePair(
    row.lat ?? row.latitude,
    row.lng ?? row.longitude ?? row.lon,
  );
  if (pair) {
    return pair;
  }

  const geometry = row.geometry;
  if (geometry && typeof geometry === "object" && !Array.isArray(geometry)) {
    const geometryRow = geometry as Record<string, unknown>;
    const coordinates = geometryRow.coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const fromGeometry = toValidCoordinatePair(coordinates[1], coordinates[0]);
      if (fromGeometry) {
        return fromGeometry;
      }
    }
  }

  for (const key of ["result", "data", "results", "items", "features", "place"]) {
    if (row[key] !== undefined) {
      const nested = pickCoordinateFromPayload(row[key]);
      if (nested) return nested;
    }
  }

  return null;
}

export async function geocodeAddress(address: string) {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return null;
  }

  const directCoordinates = parseGoogleMapsCoordinates(normalizedAddress);
  if (directCoordinates) {
    return directCoordinates;
  }

  const vietmapApiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();
  if (!vietmapApiKey) {
    return null;
  }

  try {
    const searchUrl = new URL("https://maps.vietmap.vn/api/search/v3");
    searchUrl.searchParams.set("apikey", vietmapApiKey);
    searchUrl.searchParams.set("text", normalizedAddress);
    searchUrl.searchParams.set("focus", `${THU_DAU_MOT_CENTER.lat},${THU_DAU_MOT_CENTER.lng}`);
    searchUrl.searchParams.set("layers", "ADDRESS,POI,STREET,DIST,CITY");

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      return null;
    }

    const searchPayload = await searchRes.json();
    const fromSearch = pickCoordinateFromPayload(searchPayload);
    if (fromSearch) {
      return fromSearch;
    }

    const firstResult = Array.isArray(searchPayload)
      ? searchPayload[0]
      : Array.isArray((searchPayload as { data?: unknown[] }).data)
        ? (searchPayload as { data: unknown[] }).data[0]
        : null;

    if (firstResult && typeof firstResult === "object") {
      const refId = (firstResult as { ref_id?: unknown; refId?: unknown }).ref_id
        ?? (firstResult as { ref_id?: unknown; refId?: unknown }).refId;
      if (typeof refId === "string" && refId.trim()) {
        const placeUrl = new URL("https://maps.vietmap.vn/api/place/v3");
        placeUrl.searchParams.set("apikey", vietmapApiKey);
        placeUrl.searchParams.set("refid", refId);
        const placeRes = await fetch(placeUrl.toString());
        if (placeRes.ok) {
          const placePayload = await placeRes.json();
          const fromPlace = pickCoordinateFromPayload(placePayload);
          if (fromPlace) {
            return fromPlace;
          }
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const apiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.vietmap.vn/api/reverse/v3?apikey=${apiKey}&lat=${lat}&lng=${lng}`,
    );
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (Array.isArray(payload) && payload[0]?.display) {
      return payload[0].display;
    }
  } catch {
    return null;
  }

  return null;
}
