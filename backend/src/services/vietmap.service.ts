// Node.js v22+ has native fetch — no external package needed

const VIETMAP_API_KEY = process.env.VIETMAP_API_KEY || process.env.VITE_VIETMAP_API_KEY || "";

export interface RouteResult {
  distanceKm: number;
  timeMinutes: number;
}

/**
 * Calculates real driving distance and time between two points using VietMap API.
 */
export async function calculateRouteWithVietmap(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  if (!VIETMAP_API_KEY) {
    console.warn("Missing VIETMAP_API_KEY, falling back to null.");
    return null;
  }

  try {
    const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}&vehicle=car&point=${fromLat},${fromLng}&point=${toLat},${toLng}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`VietMap Route API Error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();
    
    if (data && data.paths && data.paths.length > 0) {
      const path = data.paths[0];
      return {
        distanceKm: path.distance / 1000, // API returns meters
        timeMinutes: path.time / 60000, // API returns milliseconds
      };
    }
    
    return null;
  } catch (error) {
    console.error("VietMap Route API Request Failed", error);
    return null;
  }
}
