const NON_DIGIT_REGEX = /\D+/g;

const onlyDigits = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).replace(NON_DIGIT_REGEX, "");
};

const takeLastDigits = (value: unknown, length: number) => {
  const digits = onlyDigits(value);
  if (!digits) return "".padStart(length, "0");
  const normalized = digits.slice(-length);
  return normalized.padStart(length, "0");
};

export const formatStoreOrderCode = (order: {
  id?: unknown;
  orderId?: unknown;
  storeId?: unknown;
  store?: {
    id?: unknown;
  } | null;
}) => {
  const storeSource = order.storeId ?? order.store?.id ?? "";
  const orderSource = order.orderId ?? order.id ?? "";
  const storeSegment = takeLastDigits(storeSource, 5);
  const orderSegment = takeLastDigits(orderSource, 9);
  return `${storeSegment}-${orderSegment}`;
};

export const getPickupOrderCodeLast4Digits = (orderCode: string) => {
  const normalized = String(orderCode || "").trim();
  const orderSegment = normalized.includes("-")
    ? normalized.split("-").pop() || normalized
    : normalized;
  return takeLastDigits(orderSegment, 4);
};
