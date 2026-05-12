import { getLocation } from "zmp-sdk";

export const LOCATION_TIMEOUT_MS = 6000;
const LOCATION_MIN_CALL_INTERVAL_MS = 5000;
const LOCATION_RATE_LIMIT_BASE_COOLDOWN_MS = 20000;
const LOCATION_RATE_LIMIT_MAX_COOLDOWN_MS = 120000;

type CachedDriverLocation = {
  latitude: number;
  longitude: number;
  timestamp: number;
  source: "zalo" | "html5";
};

type DriverLocationResult = {
  latitude: number;
  longitude: number;
  source: "zalo" | "html5" | "cache";
};

const driverLocationCache: {
  lastGood: CachedDriverLocation | null;
  lastAttemptAt: number;
  rateLimitedUntil: number;
  rateLimitHits: number;
} = {
  lastGood: null,
  lastAttemptAt: 0,
  rateLimitedUntil: 0,
  rateLimitHits: 0,
};

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
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

function parseCoordinate(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseLocationErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : Number.isFinite(Number(code)) ? Number(code) : null;
}

function updateLocationCache(latitude: number, longitude: number, source: "zalo" | "html5") {
  driverLocationCache.lastGood = {
    latitude,
    longitude,
    timestamp: Date.now(),
    source,
  };
  driverLocationCache.rateLimitHits = 0;
}

function readFromCache(maxAgeMs: number): DriverLocationResult | null {
  const last = driverLocationCache.lastGood;
  if (!last) {
    return null;
  }
  if (Date.now() - last.timestamp > maxAgeMs) {
    return null;
  }
  return {
    latitude: last.latitude,
    longitude: last.longitude,
    source: "cache",
  };
}

function readHtml5Location() {
  return new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  });
}

export async function getDriverLocationSafe(options?: {
  maxAgeMs?: number;
  allowStale?: boolean;
  forceRefresh?: boolean;
  quiet?: boolean;
}): Promise<DriverLocationResult | null> {
  const maxAgeMs = options?.maxAgeMs ?? 15000;
  const allowStale = options?.allowStale ?? true;
  const forceRefresh = options?.forceRefresh ?? false;
  const quiet = options?.quiet ?? true;
  const now = Date.now();

  if (!forceRefresh) {
    const fromCache = readFromCache(maxAgeMs);
    if (fromCache) {
      return fromCache;
    }
  }

  if (!forceRefresh && now < driverLocationCache.rateLimitedUntil) {
    return allowStale ? readFromCache(Number.MAX_SAFE_INTEGER) : null;
  }

  if (!forceRefresh && now - driverLocationCache.lastAttemptAt < LOCATION_MIN_CALL_INTERVAL_MS) {
    return allowStale ? readFromCache(Number.MAX_SAFE_INTEGER) : null;
  }
  driverLocationCache.lastAttemptAt = now;

  try {
    const result = (await Promise.race([
      getLocation({}),
      new Promise((_, reject) => setTimeout(() => reject(new Error("GPS timeout")), LOCATION_TIMEOUT_MS)),
    ])) as { latitude?: unknown; longitude?: unknown };

    const latitude = parseCoordinate(result?.latitude);
    const longitude = parseCoordinate(result?.longitude);
    if (latitude != null && longitude != null) {
      updateLocationCache(latitude, longitude, "zalo");
      return { latitude, longitude, source: "zalo" };
    }
  } catch (error) {
    const code = parseLocationErrorCode(error);
    if (code === -1409) {
      driverLocationCache.rateLimitHits += 1;
      const cooldown = Math.min(
        LOCATION_RATE_LIMIT_MAX_COOLDOWN_MS,
        LOCATION_RATE_LIMIT_BASE_COOLDOWN_MS * Math.max(1, driverLocationCache.rateLimitHits),
      );
      driverLocationCache.rateLimitedUntil = Date.now() + cooldown;
    } else if (!quiet) {
      console.warn("getLocation failed", error);
    }
  }

  const html5 = await readHtml5Location();
  if (html5) {
    updateLocationCache(html5.latitude, html5.longitude, "html5");
    return { ...html5, source: "html5" };
  }

  return allowStale ? readFromCache(Number.MAX_SAFE_INTEGER) : null;
}

export function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function displayDistance(d) {
  return `${d.toFixed(1)} km`;
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
  
  const prepTime = 10;
  const travelTime = Math.ceil(distanceKm * 2);
  const minTime = prepTime + travelTime;
  
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
