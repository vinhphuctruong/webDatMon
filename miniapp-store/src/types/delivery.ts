export interface Store {
  id: number;
  backendId?: string;
  name: string;
  address: string;
  phone?: string;
  lat: number;
  long: number;
  rating?: number;
  eta?: string;
  distance?: number;
}
