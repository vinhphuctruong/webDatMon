# TODO: Exclusive Dispatch + Multi-way Cancel (Startup-friendly)

## Backend
- [ ] Add request-cancel endpoints in `backend/src/routes/order.route.ts`
  - [ ] `POST /orders/:orderId/request-cancel` (CUSTOMER) -> set `cancelRequestStatus=PENDING`, store `cancelReason`
  - [ ] `POST /orders/:orderId/cancel-request/approve` (STORE_MANAGER) -> set `APPROVED`, run `cancelOrderWithSettlementRollback`, set `Order.status=CANCELLED`
  - [ ] `POST /orders/:orderId/cancel-request/reject` (STORE_MANAGER) -> set `REJECTED`, keep order status unchanged
- [ ] Extend `cancelOrderWithSettlementRollback` in `backend/src/services/finance.ts`:
  - [ ] Rollback voucherUsage + decrement `voucher.usedCount` when cancel becomes final (APPROVED/direct cancel)
- [ ] Enforce exclusive dispatch never offers cancelled orders in `backend/src/services/dispatch-engine.ts`
  - [ ] Guard in `startDispatch`, `offerToNextDriver`, `processExpiredOffers`
- [ ] Add safety guards in `backend/src/routes/driver.route.ts` for accept/claim/reject paths:
  - [ ] Reject if `order.status === CANCELLED`

## Driver miniapp (exclusive-only)
- [ ] Update `miniapp-driver/src/components/incoming-order-alert.tsx`:
  - [ ] Disable broadcast fallback:
    - [ ] stop `fetchAvailableOrders` polling
    - [ ] remove/disable `broadcastOrder` modal and `new_order_to_driver` listener
  - [ ] Keep exclusive `dispatch_offer` modal + accept/reject

## Customer miniapp (cancel UX)
- [ ] After backend endpoints exist, update customer UI where needed:
  - [ ] For order states `CONFIRMED`/`PREPARING`: show “request cancel” calling `/request-cancel`
  - [ ] For `PICKED_UP`: show “CSKH” (no cancel request)
  - [ ] Handle `cancelRequestStatus` UI for pending/rejected

## Testing checklist
- [ ] Customer direct cancel while `PENDING` refunds correctly
- [ ] Customer request cancel -> store approve -> refund/voucher rollback -> dispatch offers stop
- [ ] Customer request cancel -> store reject -> order continues, no refunds/voucher rollback
- [ ] Race test: approve cancel during dispatch offer timeout window
  - [ ] ensure cancelled order never appears in driver offer modal
