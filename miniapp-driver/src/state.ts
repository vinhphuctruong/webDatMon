import { atom, RecoilEnv } from "recoil";

// Suppress duplicate atom key warning during Vite HMR development
RecoilEnv.RECOIL_DUPLICATE_ATOM_KEY_CHECKING_ENABLED = false;

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
