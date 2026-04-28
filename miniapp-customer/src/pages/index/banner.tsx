import React, { FC, useEffect, useState } from "react";
import { Autoplay, Pagination } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { Box, Text } from "zmp-ui";
import { apiFetch } from "services/api";

interface BannerItem {
  id: string;
  title: string | null;
  imageUrl: string;
  link: string | null;
  sortOrder: number;
  isActive: boolean;
}

const FALLBACK_BANNERS: BannerItem[] = [
  { id: "f1", title: "Giảm 50% cho đơn đầu tiên 🎉", imageUrl: "", link: null, sortOrder: 0, isActive: true },
  { id: "f2", title: "Freeship đơn từ 49K 🚚", imageUrl: "", link: null, sortOrder: 1, isActive: true },
  { id: "f3", title: "Combo trưa chỉ từ 39K 🍱", imageUrl: "", link: null, sortOrder: 2, isActive: true },
];

const GRADIENT_COLORS = [
  "linear-gradient(135deg, #00a96d 0%, #00c97d 60%, #34d399 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #f97316 60%, #fb923c 100%)",
  "linear-gradient(135deg, #6366f1 0%, #8b5cf6 60%, #a78bfa 100%)",
  "linear-gradient(135deg, #ec4899 0%, #f43f5e 60%, #fb7185 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 60%, #60a5fa 100%)",
];

const FlashDealTimer: FC = () => {
  const [timeLeft, setTimeLeft] = useState({ h: 2, m: 45, s: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 0; m = 0; s = 0; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="tm-flash-deal">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>⚡</span>
        <span style={{ fontWeight: 700 }}>Flash Deal</span>
        <span style={{ fontSize: 11, opacity: 0.9 }}>Kết thúc sau</span>
      </div>
      <div className="tm-flash-timer">
        <span className="tm-flash-timer-box">{pad(timeLeft.h)}</span>
        <span style={{ fontWeight: 700 }}>:</span>
        <span className="tm-flash-timer-box">{pad(timeLeft.m)}</span>
        <span style={{ fontWeight: 700 }}>:</span>
        <span className="tm-flash-timer-box">{pad(timeLeft.s)}</span>
      </div>
    </div>
  );
};

export const Banner: FC = () => {
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<{ data: BannerItem[] }>("/banners")
      .then((res) => {
        const active = (res.data || []).filter((b) => b.isActive);
        setBanners(active.length > 0 ? active : FALLBACK_BANNERS);
      })
      .catch(() => setBanners(FALLBACK_BANNERS))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <Box className="bg-white">
      <Swiper
        modules={[Pagination, Autoplay]}
        pagination={{ clickable: true }}
        autoplay={{ delay: 3500, disableOnInteraction: false }}
        loop={banners.length > 1}
        cssMode={false}
        style={{ paddingBottom: 6 }}
      >
        {banners.map((banner, i) => (
          <SwiperSlide key={banner.id} className="px-4">
            <div style={{
              position: 'relative', borderRadius: 16, overflow: 'hidden',
              width: '100%', aspectRatio: '2/1', minHeight: 140,
              background: banner.imageUrl ? '#f1f5f9' : GRADIENT_COLORS[i % GRADIENT_COLORS.length],
            }}>
              {banner.imageUrl && (
                <img
                  src={banner.imageUrl}
                  alt={banner.title || "Banner"}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
              {/* Gradient overlay with title */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: banner.imageUrl
                  ? 'linear-gradient(transparent, rgba(0,0,0,0.55))'
                  : 'linear-gradient(transparent, rgba(0,0,0,0.15))',
                padding: '28px 14px 12px',
              }}>
                {banner.title && (
                  <Text size="small" style={{ color: '#fff', fontWeight: 700, fontSize: 14, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                    {banner.title}
                  </Text>
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      {/* Flash Deal Timer */}
      <Box style={{ padding: '12px 16px 0' }}>
        <div style={{ borderRadius: 12, overflow: 'hidden' }}>
          <FlashDealTimer />
        </div>
      </Box>
    </Box>
  );
};
