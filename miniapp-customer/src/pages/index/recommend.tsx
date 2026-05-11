import { FinalPrice } from "components/display/final-price";
import { DisplayPrice } from "components/display/price";
import { ProductPicker } from "components/product/picker";
import { ProductSlideSkeleton } from "components/skeletons";
import React, { Suspense, FC } from "react";
import { useRecoilValue } from "recoil";
import { recommendProductsState } from "state";
import { Swiper, SwiperSlide } from "swiper/react";
import { Box, Text } from "zmp-ui";

export const RecommendContent: FC = () => {
  const recommendProducts = useRecoilValue(recommendProductsState);

  return (
    <Box className="bg-white" style={{ padding: '16px 0' }}>
      <div className="tm-section-header" style={{ paddingTop: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}></span>
          <span className="tm-section-title">Deal hot hôm nay</span>
        </div>
        <span className="tm-section-link">Xem tất cả →</span>
      </div>
      <Swiper slidesPerView={1.35} spaceBetween={12} className="px-4" style={{ paddingLeft: 16, paddingRight: 16 }}>
        {recommendProducts.map((product) => (
          <SwiperSlide key={product.id}>
            <ProductPicker product={product}>
              {({ open }) => (
                <div onClick={open} className="tm-card animate-fade-in" style={{ cursor: 'pointer' }}>
                  {/* Image section */}
                  <div style={{ position: 'relative' }}>
                    <Box
                      className="aspect-video bg-cover bg-center bg-skeleton"
                      style={{
                        backgroundImage: `url(${product.image})`,
                        borderRadius: '16px 16px 0 0',
                      }}
                    />
                    {/* Sale badge */}
                    {product.sale && (
                      <span
                        className="tm-badge tm-badge-sale"
                        style={{ position: 'absolute', top: 8, left: 8 }}
                      >
                        Giảm{" "}
                        {product.sale.type === "percent"
                          ? `${product.sale.percent * 100}%`
                          : <DisplayPrice>{product.sale.amount}</DisplayPrice>}
                      </span>
                    )}
                    {/* Rating overlay */}
                    <div style={{
                      position: 'absolute', bottom: 8, right: 8,
                      background: 'rgba(0,0,0,0.6)',
                      borderRadius: 20, padding: '3px 8px',
                      display: 'flex', alignItems: 'center', gap: 3,
                      backdropFilter: 'blur(4px)',
                    }}>
                    {(product.rating ?? 0) > 0 ? (
                      <>
                        <span style={{ color: '#ffb800', fontSize: 11 }}></span>
                        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
                          {product.rating}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>Mới</span>
                    )}
                    </div>
                  </div>
                  {/* Info section */}
                  <Box style={{ padding: '10px 12px 12px' }}>
                    <Text
                      size="small"
                      style={{
                        fontWeight: 600,
                        color: 'var(--tm-text-primary)',
                        marginBottom: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {product.name}
                    </Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--tm-primary), #00c97d)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 8, fontWeight: 700,
                      }}>
                        {(product.storeName ?? 'Q').charAt(0).toUpperCase()}
                      </div>
                      <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.storeName ?? "Quán đối tác"}
                      </Text>
                    </div>
                    <Box flex justifyContent="space-between" alignItems="center">
                      <div>
                        {product.sale && (
                          <Text
                            size="xxxSmall"
                            style={{
                              color: 'var(--tm-text-tertiary)',
                              textDecoration: 'line-through',
                              fontSize: 11,
                            }}
                          >
                            <DisplayPrice>{product.price}</DisplayPrice>
                          </Text>
                        )}
                        <Text
                          size="small"
                          style={{ color: 'var(--tm-accent)', fontWeight: 700, fontSize: 15 }}
                        >
                          <FinalPrice>{product}</FinalPrice>
                        </Text>
                      </div>
                      <button className="tm-add-btn">+</button>
                    </Box>
                    {/* Meta info */}
                    <div className="tm-stats-row" style={{ marginTop: 6 }}>
                      <span>{product.eta ?? "20-30 phút"}</span>
                      <span className="tm-dot" />
                      <span>
                        Phí giao <DisplayPrice>{product.deliveryFee ?? 15000}</DisplayPrice>
                      </span>
                    </div>
                  </Box>
                </div>
              )}
            </ProductPicker>
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
};

export const RecommendFallback: FC = () => {
  return (
    <Box className="bg-white" style={{ padding: '16px 0' }}>
      <div className="tm-section-header" style={{ paddingTop: 0 }}>
        <span className="tm-section-title"> Deal hot hôm nay</span>
      </div>
      <Swiper slidesPerView={1.35} spaceBetween={12} style={{ paddingLeft: 16, paddingRight: 16 }}>
        {[...new Array(3)].map((_, i) => (
          <SwiperSlide key={i}>
            <ProductSlideSkeleton />
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
};

export const Recommend: FC = () => {
  return (
    <Suspense fallback={<RecommendFallback />}>
      <RecommendContent />
    </Suspense>
  );
};
