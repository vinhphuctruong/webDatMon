/**
 * Delivery Fee Calculator — Mô hình giống Shopee Food / Grab Food
 *
 * Tính phí ship dựa trên khoảng cách thực tế giữa cửa hàng và khách hàng
 * sử dụng công thức Haversine + hệ số đường đi (road factor).
 */

/* ── Policy ─────────────────────────────────────────────── */

export const DELIVERY_FEE_POLICY = {
  /** Phí cơ bản cho khoảng cách ≤ baseTierMaxKm */
  baseFee: 15_000,
  /** Khoảng cách tối đa cho phí cơ bản (km) */
  baseTierMaxKm: 3,

  /** Phí mỗi km thêm từ baseTierMaxKm → midTierMaxKm */
  midTierPerKm: 5_000,
  /** Khoảng cách tối đa cho tier giữa (km) */
  midTierMaxKm: 10,

  /** Phí mỗi km thêm trên midTierMaxKm */
  farTierPerKm: 8_000,

  /** Phí ship tối thiểu */
  minFee: 10_000,
  /** Phí ship tối đa (cap) */
  maxFee: 80_000,

  /**
   * Hệ số đường đi — nhân với khoảng cách đường chim bay
   * để ước tính khoảng cách thực tế đi đường.
   * Trong nội thành VN, hệ số 1.3–1.5 là phù hợp.
   */
  roadFactor: 1.4,

  /** Phí mặc định khi không có tọa độ */
  defaultFee: 15_000,
} as const;

/* ── Haversine ──────────────────────────────────────────── */

const EARTH_RADIUS_KM = 6_371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Tính khoảng cách đường chim bay giữa 2 tọa độ GPS (km)
 * bằng công thức Haversine.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/* ── Fee Calculator ─────────────────────────────────────── */

export interface DeliveryFeeEstimate {
  /** Phí ship cuối cùng (VNĐ, đã làm tròn) */
  fee: number;
  /** Khoảng cách đường chim bay (km) */
  straightLineKm: number;
  /** Khoảng cách ước tính đi đường (km) */
  roadDistanceKm: number;
  /** Chi tiết từng bậc tính phí */
  breakdown: {
    baseFee: number;
    midTierFee: number;
    farTierFee: number;
    rawTotal: number;
  };
}

/**
 * Tính phí ship dựa trên khoảng cách ước tính đi đường.
 */
export function calculateDeliveryFeeFromDistance(roadDistanceKm: number): {
  fee: number;
  breakdown: DeliveryFeeEstimate["breakdown"];
} {
  const p = DELIVERY_FEE_POLICY;
  const d = Math.max(0, roadDistanceKm);

  // Base tier: 0 → baseTierMaxKm
  const baseFee = p.baseFee;

  // Mid tier: baseTierMaxKm → midTierMaxKm
  let midTierFee = 0;
  if (d > p.baseTierMaxKm) {
    const midKm = Math.min(d - p.baseTierMaxKm, p.midTierMaxKm - p.baseTierMaxKm);
    midTierFee = Math.round(midKm * p.midTierPerKm);
  }

  // Far tier: > midTierMaxKm
  let farTierFee = 0;
  if (d > p.midTierMaxKm) {
    const farKm = d - p.midTierMaxKm;
    farTierFee = Math.round(farKm * p.farTierPerKm);
  }

  const rawTotal = baseFee + midTierFee + farTierFee;

  // Clamp: min ≤ fee ≤ max
  const fee = Math.min(p.maxFee, Math.max(p.minFee, rawTotal));

  // Làm tròn lên bội 1.000đ
  const roundedFee = Math.ceil(fee / 1_000) * 1_000;

  return {
    fee: roundedFee,
    breakdown: { baseFee, midTierFee, farTierFee, rawTotal },
  };
}

/**
 * Tính phí ship từ tọa độ cửa hàng và khách hàng.
 * Trả về phí mặc định nếu thiếu tọa độ.
 */
export function estimateDeliveryFee(
  store: { latitude?: number | null; longitude?: number | null },
  customer: { latitude?: number | null; longitude?: number | null },
): DeliveryFeeEstimate {
  const p = DELIVERY_FEE_POLICY;

  // Fallback nếu thiếu tọa độ
  if (
    store.latitude == null ||
    store.longitude == null ||
    customer.latitude == null ||
    customer.longitude == null
  ) {
    return {
      fee: p.defaultFee,
      straightLineKm: 0,
      roadDistanceKm: 0,
      breakdown: {
        baseFee: p.defaultFee,
        midTierFee: 0,
        farTierFee: 0,
        rawTotal: p.defaultFee,
      },
    };
  }

  const straightLineKm = haversineDistanceKm(
    store.latitude,
    store.longitude,
    customer.latitude,
    customer.longitude,
  );

  const roadDistanceKm = straightLineKm * p.roadFactor;

  const { fee, breakdown } = calculateDeliveryFeeFromDistance(roadDistanceKm);

  return {
    fee,
    straightLineKm: Math.round(straightLineKm * 100) / 100,
    roadDistanceKm: Math.round(roadDistanceKm * 100) / 100,
    breakdown,
  };
}
