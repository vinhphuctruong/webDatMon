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
