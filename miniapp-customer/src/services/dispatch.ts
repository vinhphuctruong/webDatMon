import { wait } from "utils/async";
import { calculateDistance } from "utils/location";

export interface DispatchDriver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  currentLat: number;
  currentLng: number;
}

export interface DispatchOrderInfo {
  id: string;
  code: string;
  total: number;
  itemCount: number;
  items?: string[];
  note?: string;
}

export interface DispatchPartyInfo {
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
}

export interface DriverDispatchPayload {
  order: DispatchOrderInfo;
  store: DispatchPartyInfo;
  customer: DispatchPartyInfo;
}

export interface DriverDispatchResult {
  driver: DispatchDriver;
  notifiedAt: string;
  distanceToStoreKm: number;
  dispatchMessage: string;
  storeNotice: string;
  customerNotice: string;
}

const ACTIVE_DRIVERS: DispatchDriver[] = [
  {
    id: "drv-tdm-001",
    name: "Nguyễn Văn Minh",
    phone: "0909 100 001",
    vehicleType: "Xe máy",
    licensePlate: "61B2-118.88",
    currentLat: 10.9875,
    currentLng: 106.6481,
  },
  {
    id: "drv-tdm-002",
    name: "Trần Quốc Nam",
    phone: "0909 100 002",
    vehicleType: "Xe máy",
    licensePlate: "61F1-239.77",
    currentLat: 10.9701,
    currentLng: 106.6674,
  },
  {
    id: "drv-tdm-003",
    name: "Phạm Thành Đạt",
    phone: "0909 100 003",
    vehicleType: "Xe máy",
    licensePlate: "61C1-552.66",
    currentLat: 10.9962,
    currentLng: 106.6373,
  },
];

function selectNearestDriver(lat: number, lng: number) {
  const ranked = ACTIVE_DRIVERS.map((driver) => ({
    driver,
    distanceKm: calculateDistance(lat, lng, driver.currentLat, driver.currentLng),
  })).sort((a, b) => a.distanceKm - b.distanceKm);

  if (!ranked.length) {
    throw new Error("No active drivers available");
  }

  return ranked[0];
}

export async function notifyNearestActiveDriver(
  payload: DriverDispatchPayload,
): Promise<DriverDispatchResult> {
  const nearest = selectNearestDriver(payload.store.lat, payload.store.lng);
  await wait(300);

  const dispatchMessage = [
    `Đơn ${payload.order.code} (${payload.order.itemCount} món, ${payload.order.total}đ).`,
    ...(payload.order.items?.length
      ? [`Món: ${payload.order.items.join(", ")}.`]
      : []),
    ...(payload.order.note?.trim() ? [`Ghi chú: ${payload.order.note.trim()}.`] : []),
    `Lấy tại ${payload.store.name} - ${payload.store.address} - ${payload.store.phone}.`,
    `Giao đến ${payload.customer.name} - ${payload.customer.address} - ${payload.customer.phone}.`,
  ].join(" ");

  return {
    driver: nearest.driver,
    notifiedAt: new Date().toISOString(),
    distanceToStoreKm: Number(nearest.distanceKm.toFixed(2)),
    dispatchMessage,
    storeNotice: `Tài xế ${nearest.driver.name} (${nearest.driver.phone}) sẽ đến lấy đơn.`,
    customerNotice: `Tài xế ${nearest.driver.name} (${nearest.driver.phone}) đang nhận đơn của bạn.`,
  };
}
