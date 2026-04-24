export interface StoreInfo {
  id: string;
  name: string;
  address: string;
  isOpen: boolean;
  rating: number;
  etaMinutesMin: number;
  etaMinutesMax: number;
}

export interface DashboardSummary {
  todayRevenue: number;
  todayGross: number;
  todayOrders: number;
  weekRevenue: number;
  weekGross: number;
  weekOrders: number;
  monthRevenue: number;
  monthGross: number;
  monthOrders: number;
  totalRevenue: number;
  totalGross: number;
  totalDeliveredOrders: number;
  cashlessOrders: number;
  codOrders: number;
}

export interface DashboardData {
  store: StoreInfo;
  summary: DashboardSummary;
  trend7Days: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; productName: string; quantitySold: number; grossSales: number; orderLines: number }[];
  recentOrders: any[];
}
