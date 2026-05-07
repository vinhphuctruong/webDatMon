const DRIVER_PRESENCE_TTL_MS = 2 * 60 * 1000;

export interface DriverPresence {
  driverId: string;
  latitude: number;
  longitude: number;
  updatedAt: number;
  isOnline: boolean;
}

interface DriverPresenceUpdateInput {
  latitude: number;
  longitude: number;
  isOnline?: boolean;
}

const driverPresenceMap = new Map<string, DriverPresence>();

function isPresenceFresh(presence: DriverPresence) {
  return Date.now() - presence.updatedAt <= DRIVER_PRESENCE_TTL_MS;
}

function cleanupStalePresence() {
  for (const [driverId, presence] of driverPresenceMap.entries()) {
    if (!presence.isOnline || !isPresenceFresh(presence)) {
      driverPresenceMap.delete(driverId);
    }
  }
}

export function setDriverOnlineStatus(driverId: string, isOnline: boolean) {
  const existing = driverPresenceMap.get(driverId);
  if (!isOnline) {
    if (existing) {
      driverPresenceMap.set(driverId, {
        ...existing,
        isOnline: false,
      });
    }
    return;
  }

  if (existing) {
    driverPresenceMap.set(driverId, {
      ...existing,
      isOnline: true,
    });
  }
}

export function updateDriverPresence(
  driverId: string,
  input: DriverPresenceUpdateInput,
): DriverPresence {
  const existing = driverPresenceMap.get(driverId);
  const next: DriverPresence = {
    driverId,
    latitude: input.latitude,
    longitude: input.longitude,
    updatedAt: Date.now(),
    isOnline: input.isOnline ?? existing?.isOnline ?? true,
  };

  driverPresenceMap.set(driverId, next);
  return next;
}

export function getFreshDriverPresence(driverId: string): DriverPresence | null {
  const presence = driverPresenceMap.get(driverId);
  if (!presence || !presence.isOnline || !isPresenceFresh(presence)) {
    return null;
  }

  return presence;
}

export function listFreshDriverPresences(driverIds?: string[]): DriverPresence[] {
  cleanupStalePresence();
  const candidates = driverIds
    ? driverIds
        .map((driverId) => driverPresenceMap.get(driverId))
        .filter((presence): presence is DriverPresence => Boolean(presence))
    : Array.from(driverPresenceMap.values());

  return candidates.filter((presence) => presence.isOnline && isPresenceFresh(presence));
}
