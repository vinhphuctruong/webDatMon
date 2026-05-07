const fs = require('fs');
let content = fs.readFileSync('src/pages/active-orders.tsx', 'utf8');

const importTarget = `import { cancelOrder } from "services/api";`;
const importReplacement = `import { cancelOrder } from "services/api";
import { initSocket } from "services/socket";
import { VietMapView, MapMarker } from "components/vietmap";
import { THU_DAU_MOT_CENTER, normalizeStoredCoordinates } from "utils/location";`;

const trackingComponent = `
const OrderTrackingMap: FC<{ order: any }> = ({ order }) => {
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const socket = initSocket();
    if (!socket) return;
    
    // Join order room
    socket.emit("join_order", order.id);

    const handleLocationUpdate = (data: { latitude: number; longitude: number }) => {
      setDriverLoc({ lat: data.latitude, lng: data.longitude });
    };

    socket.on("driver_location_update", handleLocationUpdate);
    return () => {
      socket.off("driver_location_update", handleLocationUpdate);
    };
  }, [order.id]);

  const storeLoc = normalizeStoredCoordinates(order.store?.latitude, order.store?.longitude) || THU_DAU_MOT_CENTER;
  const customerLoc = normalizeStoredCoordinates(order.deliveryAddress?.latitude, order.deliveryAddress?.longitude) || { lat: storeLoc.lat - 0.01, lng: storeLoc.lng + 0.01 };

  const markers = [
    { lat: storeLoc.lat, lng: storeLoc.lng, label: order.store?.name || "Quán", type: "store" as any },
    { lat: customerLoc.lat, lng: customerLoc.lng, label: order.deliveryAddress?.receiverName || "Khách", type: "customer" as any },
  ];

  if (driverLoc) {
    markers.push({ lat: driverLoc.lat, lng: driverLoc.lng, label: "Tài xế", type: "driver" as any });
  }

  const center: [number, number] = driverLoc ? [driverLoc.lng, driverLoc.lat] : [storeLoc.lng, storeLoc.lat];

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      <VietMapView
        center={center}
        zoom={14}
        markers={markers}
        height={160}
        showRoute={true}
        style={{ borderRadius: 12, border: "1px solid var(--tm-border)" }}
      />
    </div>
  );
};
`;

content = content.replace(importTarget, importReplacement);
content = content.replace('const OrderCard:', trackingComponent + '\nconst OrderCard:');

const mapRenderTarget = `      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--tm-border)",
        }}
      >`;
const mapRenderReplacement = `      
      {order.status === "PICKED_UP" && <OrderTrackingMap order={order} />}

      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--tm-border)",
        }}
      >`;

content = content.replace(mapRenderTarget, mapRenderReplacement);

const orderSocketSyncTarget = `  useEffect(() => {
    loadOrders();
  }, []);`;
const orderSocketSyncReplacement = `  useEffect(() => {
    loadOrders();
    const socket = initSocket();
    if (socket) {
      socket.on("order_status_updated", () => {
        loadOrders();
      });
      return () => {
        socket.off("order_status_updated");
      };
    }
  }, []);`;

content = content.replace(orderSocketSyncTarget, orderSocketSyncReplacement);

fs.writeFileSync('src/pages/active-orders.tsx', content);
console.log("Patched active-orders.tsx");
