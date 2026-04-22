import React, { FC, useEffect, useState } from "react";
import { Pagination } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";
import { getDummyImage } from "utils/product";
import { Box, Text } from "zmp-ui";

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
  const promoTexts = [
    "Giảm 50% cho đơn đầu tiên 🎉",
    "Freeship đơn từ 49K 🚚",
    "Combo trưa chỉ từ 39K 🍱",
    "Mã TMFOOD giảm 30K 🎁",
    "Deal cuối tuần giảm sốc 🔥",
  ];

  return (
    <Box className="bg-white">
      <Swiper
        modules={[Pagination]}
        pagination={{ clickable: true }}
        autoplay
        loop
        cssMode
      >
        {[1, 2, 3, 4, 5]
          .map((i) => getDummyImage(`banner-${i}.webp`))
          .map((banner, i) => (
            <SwiperSlide key={i} className="px-4">
              <Box
                className="w-full rounded-2xl aspect-[2/1] bg-cover bg-center bg-skeleton relative overflow-hidden"
                style={{ backgroundImage: `url(${banner})`, borderRadius: 16 }}
              >
                {/* Gradient overlay with promo text */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  padding: '24px 14px 12px',
                  borderRadius: '0 0 16px 16px',
                }}>
                  <Text size="small" style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
                    {promoTexts[i]}
                  </Text>
                </div>
              </Box>
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
