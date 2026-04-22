import React, { FC, Suspense, useState } from "react";
import { Box, Header, Page, Text } from "zmp-ui";
import { useToBeImplemented } from "hooks";
import { useRecoilCallback, useRecoilValue, useRecoilValueLoadable } from "recoil";
import { userState } from "state";
import { DisplayPrice } from "components/display/price";
import {
  favoriteIdsState,
  orderHistoryState,
  OrderHistoryItem,
  vouchersState,
} from "services/features";

const ProfileHeader: FC = () => {
  const user = useRecoilValueLoadable(userState);
  const userName =
    user.state === "hasValue" && user.contents?.name
      ? user.contents.name
      : "Thành viên TM Food";
  const avatarUrl =
    user.state === "hasValue" && user.contents?.avatar
      ? user.contents.avatar
      : null;

  return (
    <div className="tm-header-gradient" style={{ paddingBottom: 24, textAlign: "center" }}>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            border: "3px solid rgba(255,255,255,0.6)",
            margin: "0 auto", overflow: "hidden",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div
              style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </div>
      </div>
      <Text.Title style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>
        {userName}
      </Text.Title>
      <Text size="xxSmall" style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
        Thành viên FoodPass 🏅
      </Text>
    </div>
  );
};

const StatsRow: FC = () => {
  const orders = useRecoilValue(orderHistoryState);
  const favorites = useRecoilValue(favoriteIdsState);
  const vouchers = useRecoilValue(vouchersState);

  const stats = [
    { label: "Đơn hàng", value: String(orders.length), icon: "📦" },
    { label: "Yêu thích", value: String(favorites.length), icon: "❤️" },
    { label: "Voucher", value: String(vouchers.filter((v) => !v.used).length), icon: "🎫" },
  ];

  return (
    <div
      style={{
        display: "flex", margin: "-20px 16px 0",
        background: "#fff", borderRadius: 16,
        boxShadow: "var(--tm-shadow-md)", position: "relative", zIndex: 2,
      }}
    >
      {stats.map((stat, i) => (
        <div
          key={i}
          style={{
            flex: 1, textAlign: "center", padding: "16px 8px",
            borderRight: i < stats.length - 1 ? "1px solid var(--tm-border)" : "none",
          }}
        >
          <Text style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</Text>
          <Text style={{ fontWeight: 700, fontSize: 18, color: "var(--tm-text-primary)" }}>
            {stat.value}
          </Text>
          <Text size="xxxSmall" style={{ color: "var(--tm-text-secondary)", marginTop: 2 }}>
            {stat.label}
          </Text>
        </div>
      ))}
    </div>
  );
};

const OrderHistorySection: FC = () => {
  const orders = useRecoilValue(orderHistoryState);
  const [showAll, setShowAll] = useState(false);
  const displayOrders = showAll ? orders : orders.slice(0, 3);

  if (orders.length === 0) return null;

  return (
    <Box style={{ padding: "16px" }}>
      <div className="tm-section-header" style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0 }}>
        <span className="tm-section-title">📦 Đơn hàng gần đây</span>
        {orders.length > 3 && (
          <span
            className="tm-section-link"
            onClick={() => setShowAll(!showAll)}
            style={{ cursor: "pointer" }}
          >
            {showAll ? "Thu gọn" : `Xem tất cả (${orders.length})`}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {displayOrders.map((order, i) => (
          <OrderCard key={`${order.id}-${i}`} order={order} />
        ))}
      </div>
    </Box>
  );
};

const OrderCard: FC<{ order: OrderHistoryItem }> = ({ order }) => {
  const statusConfig = {
    success: { label: "Thành công", color: "var(--tm-primary)", bg: "var(--tm-primary-light)" },
    failed: { label: "Thất bại", color: "var(--tm-danger)", bg: "#fef2f2" },
    pending: { label: "Đang xử lý", color: "var(--tm-warning)", bg: "#fef9e7" },
  };
  const status = statusConfig[order.status];
  const date = new Date(order.date);
  const dateStr = date.toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="tm-card" style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <Text style={{ fontWeight: 600, fontSize: 14, color: "var(--tm-text-primary)" }}>
            #{order.id}
          </Text>
          <Text size="xxxSmall" style={{ color: "var(--tm-text-tertiary)" }}>
            {dateStr}
          </Text>
        </div>
        <span
          style={{
            background: status.bg, color: status.color,
            padding: "3px 10px", borderRadius: 12,
            fontSize: 11, fontWeight: 600,
          }}
        >
          {status.label}
        </span>
      </div>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)", marginBottom: 4 }}>
        {order.storeName} · {order.items.length} món
      </Text>
      <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
        {order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}
      </Text>
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--tm-border)",
        }}
      >
        <Text style={{ fontWeight: 700, color: "var(--tm-primary)", fontSize: 15 }}>
          <DisplayPrice>{order.total}</DisplayPrice>
        </Text>
        <button
          style={{
            background: "var(--tm-primary-light)", color: "var(--tm-primary)",
            border: "none", borderRadius: 12, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Đặt lại
        </button>
      </div>
    </div>
  );
};

const MembershipCard: FC = () => {
  const orders = useRecoilValue(orderHistoryState);
  const points = orders.filter((o) => o.status === "success").length * 100 + 50;

  return (
    <Box style={{ padding: "16px 16px 0" }}>
      <div className="tm-membership">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>👑</span>
            <div>
              <Text.Title style={{ color: "#fff", fontWeight: 700 }}>
                FoodPass Thành viên
              </Text.Title>
              <Text size="xxxSmall" style={{ color: "rgba(255,255,255,0.7)" }}>
                Tích điểm, ưu đãi freeship & voucher độc quyền
              </Text>
            </div>
          </div>
          <div
            style={{
              marginTop: 12, background: "rgba(0,169,109,0.3)",
              borderRadius: 8, padding: "8px 12px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <div>
              <Text size="xxxSmall" style={{ color: "rgba(255,255,255,0.7)" }}>
                Điểm tích lũy
              </Text>
              <Text style={{ color: "#00e68a", fontWeight: 700, fontSize: 18 }}>
                {points.toLocaleString()}
              </Text>
            </div>
            <span
              style={{
                background: "var(--tm-primary)", color: "#fff",
                borderRadius: 20, padding: "6px 16px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Đổi thưởng →
            </span>
          </div>
        </div>
      </div>
    </Box>
  );
};

interface MenuItemData {
  icon: string;
  label: string;
}

const MenuItem: FC<{ item: MenuItemData; onClick: () => void }> = ({ item, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", padding: "14px 0",
      borderBottom: "1px solid var(--tm-border)", cursor: "pointer",
    }}
  >
    <span style={{ fontSize: 18, marginRight: 12, width: 24, textAlign: "center" }}>
      {item.icon}
    </span>
    <Text style={{ flex: 1, fontWeight: 500, color: "var(--tm-text-primary)", fontSize: 14 }}>
      {item.label}
    </Text>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--tm-text-tertiary)">
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    </svg>
  </div>
);

const MenuSections: FC = () => {
  const onClick = useToBeImplemented();

  const personalItems: MenuItemData[] = [
    { icon: "👤", label: "Thông tin tài khoản" },
    { icon: "📦", label: "Đơn hàng gần đây" },
    { icon: "📍", label: "Địa chỉ đã lưu" },
    { icon: "💳", label: "Phương thức thanh toán" },
  ];

  const otherItems: MenuItemData[] = [
    { icon: "⭐", label: "Đánh giá quán & tài xế" },
    { icon: "📞", label: "Hỗ trợ & góp ý" },
    { icon: "📄", label: "Điều khoản sử dụng" },
    { icon: "ℹ️", label: "Về TM Food" },
  ];

  return (
    <Box style={{ padding: "16px 16px 32px" }}>
      <div className="tm-card" style={{ padding: "4px 16px", marginBottom: 16 }}>
        <Text
          size="xSmall"
          style={{
            fontWeight: 700, color: "var(--tm-text-secondary)",
            textTransform: "uppercase", letterSpacing: 0.5,
            paddingTop: 14, paddingBottom: 4, fontSize: 11,
          }}
        >
          Cá nhân
        </Text>
        {personalItems.map((item, i) => (
          <MenuItem key={i} item={item} onClick={onClick} />
        ))}
      </div>
      <div className="tm-card" style={{ padding: "4px 16px" }}>
        <Text
          size="xSmall"
          style={{
            fontWeight: 700, color: "var(--tm-text-secondary)",
            textTransform: "uppercase", letterSpacing: 0.5,
            paddingTop: 14, paddingBottom: 4, fontSize: 11,
          }}
        >
          Khác
        </Text>
        {otherItems.map((item, i) => (
          <MenuItem key={i} item={item} onClick={onClick} />
        ))}
      </div>
    </Box>
  );
};

const ProfilePage: FC = () => {
  return (
    <Page style={{ background: "var(--tm-bg)" }}>
      <Suspense>
        <ProfileHeader />
      </Suspense>
      <StatsRow />
      <MembershipCard />
      <OrderHistorySection />
      <MenuSections />
    </Page>
  );
};

export default ProfilePage;
