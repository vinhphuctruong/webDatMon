import { FinalPrice } from "components/display/final-price";
import { DisplayPrice } from "components/display/price";
import { ProductPicker } from "components/product/picker";
import { ProductSearchResultSkeleton } from "components/skeletons";
import React, { FC, Suspense } from "react";
import { useRecoilValue } from "recoil";
import { resultState } from "state";
import { Box, Text } from "zmp-ui";

const SearchResultContent: FC = () => {
  const result = useRecoilValue(resultState);
  return (
    <Box flex flexDirection="column" className="flex-1 min-h-0" style={{ background: 'var(--tm-bg)' }}>
      <Text size="xSmall" style={{
        padding: '12px 16px 8px',
        fontWeight: 600,
        color: 'var(--tm-text-secondary)',
      }}>
        Kết quả ({result.length})
      </Text>
      {result.length > 0 ? (
        <Box className="flex-1 overflow-y-auto" style={{ padding: '0 16px 16px' }}>
          <div className="space-y-3">
            {result.map((product) => (
              <ProductPicker key={product.id} product={product}>
                {({ open }) => (
                  <div
                    onClick={open}
                    className="tm-card animate-fade-in"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <img
                        src={product.image}
                        style={{
                          width: 80, height: 80,
                          borderRadius: 12,
                          objectFit: 'cover',
                        }}
                      />
                      {product.sale && (
                        <span
                          className="tm-badge tm-badge-sale"
                          style={{
                            position: 'absolute', top: 4, left: 4,
                            fontSize: 8, padding: '1px 5px',
                          }}
                        >
                          Sale
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontWeight: 600,
                          color: 'var(--tm-text-primary)',
                          fontSize: 14,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginBottom: 2,
                        }}
                      >
                        {product.name}
                      </Text>
                      <Text size="xxxSmall" style={{ color: 'var(--tm-text-secondary)', marginBottom: 4 }}>
                        {product.storeName ?? "Quán đối tác"}
                      </Text>
                      <Text size="small" style={{ color: 'var(--tm-primary)', fontWeight: 700 }}>
                        <FinalPrice>{product}</FinalPrice>
                      </Text>
                      <div className="tm-stats-row" style={{ marginTop: 4 }}>
                        <span style={{ color: '#ffb800' }}></span>
                        <span>{product.rating ?? 4.7}</span>
                        <span className="tm-dot" />
                        <span>{product.eta ?? "20-30 phút"}</span>
                        <span className="tm-dot" />
                        <span>
                          <DisplayPrice>{product.deliveryFee ?? 15000}</DisplayPrice>
                        </span>
                      </div>
                    </div>
                    <button className="tm-add-btn" onClick={(e) => { e.stopPropagation(); open(); }}>
                      +
                    </button>
                  </div>
                )}
              </ProductPicker>
            ))}
          </div>
        </Box>
      ) : (
        <div className="tm-empty-state" style={{ flex: 1 }}>
          <span className="tm-empty-icon"></span>
          <Text style={{ fontWeight: 600, color: 'var(--tm-text-primary)', marginBottom: 4 }}>
            Không tìm thấy kết quả
          </Text>
          <Text size="xSmall" style={{ color: 'var(--tm-text-secondary)' }}>
            Thử tìm với từ khóa khác nhé!
          </Text>
        </div>
      )}
    </Box>
  );
};

const SearchResultFallback: FC = () => {
  return (
    <Box flex flexDirection="column" className="flex-1 min-h-0" style={{ background: 'var(--tm-bg)' }}>
      <Text size="xSmall" style={{
        padding: '12px 16px 8px',
        fontWeight: 600,
        color: 'var(--tm-text-secondary)',
      }}>
        Đang tìm kiếm...
      </Text>
      <Box style={{ padding: '0 16px' }} className="space-y-3">
        {[...new Array(5)].map((_, i) => (
          <ProductSearchResultSkeleton key={i} />
        ))}
      </Box>
    </Box>
  );
};

export const SearchResult: FC = () => {
  return (
    <Suspense fallback={<SearchResultFallback />}>
      <SearchResultContent />
    </Suspense>
  );
};
