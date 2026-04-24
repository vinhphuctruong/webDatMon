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

export function isWithinThuDauMotServiceArea(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  return (
    calculateDistance(lat, lng, THU_DAU_MOT_CENTER.lat, THU_DAU_MOT_CENTER.lng) <=
    THU_DAU_MOT_SERVICE_RADIUS_KM
  );
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

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // 1. Try Vietmap API (if key is configured and valid)
    const apiKey = import.meta.env.VITE_VIETMAP_API_KEY;
    if (apiKey) {
      try {
        const vmRes = await fetch(`https://maps.vietmap.vn/api/reverse/v3?apikey=${apiKey}&lat=${lat}&lng=${lng}`);
        const vmData = await vmRes.json();
        if (vmData && vmData.length > 0 && vmData[0].display) {
          return vmData[0].display;
        }
      } catch (e) {
        console.warn("Vietmap reverse geocoding failed, falling back to OSM", e);
      }
    }

    // 2. Fallback to OpenStreetMap (Nominatim)
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi&zoom=18`);
    const data = await res.json();
    if (data && data.display_name) {
      let shortAddress = data.display_name;
      if (data.address) {
        const house = data.address.house_number;
        const road = data.address.road || data.address.pedestrian || data.address.path;
        const quarter = data.address.quarter || data.address.neighbourhood || data.address.hamlet;
        const district = data.address.suburb || data.address.city_district || data.address.county;
        const city = data.address.city || data.address.town || data.address.state || data.address.province;
        
        if (road) {
          const locationStr = house ? `${house} ${road}` : `Gần ${road}`;
          const parts: string[] = [];
          if (quarter) parts.push(quarter);
          if (district) parts.push(district);
          if (city && city !== district) parts.push(city);
          
          const suffix = parts.join(", ");
          shortAddress = suffix ? `${locationStr}, ${suffix}` : locationStr;
        }
      }
      return shortAddress;
    }
  } catch (err) {
    console.error("Reverse geocoding totally failed", err);
  }
  return null;
}
