import { atom } from "recoil";

export const driverProfileState = atom<any | null>({
  key: "driverProfile",
  default: null,
});

export const isOnlineState = atom<boolean>({
  key: "isOnline",
  default: false,
});

export const availableOrdersState = atom<any[]>({
  key: "availableOrders",
  default: [],
});

export const myOrdersState = atom<any[]>({
  key: "myOrders",
  default: [],
});

export const walletsState = atom<any[]>({
  key: "wallets",
  default: [],
});
