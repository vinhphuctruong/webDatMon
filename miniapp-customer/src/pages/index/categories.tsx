import React, { FC } from "react";
import { Box, Text } from "zmp-ui";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { categoriesState, selectedCategoryIdState } from "state";
import { useNavigate } from "react-router";

const pastelColors = [
  "tm-pastel-green",
  "tm-pastel-orange",
  "tm-pastel-blue",
  "tm-pastel-pink",
  "tm-pastel-purple",
  "tm-pastel-yellow",
  "tm-pastel-teal",
];

export const Categories: FC = () => {
  const categories = useRecoilValue(categoriesState);
  const navigate = useNavigate();
  const setSelectedCategoryId = useSetRecoilState(selectedCategoryIdState);

  const gotoCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    navigate("/category");
  };

  return (
    <Box className="bg-white" style={{ padding: '16px 0' }}>
      {/* Section header */}
      <div className="tm-section-header" style={{ paddingTop: 0, paddingBottom: 4 }}>
        <span className="tm-section-title">Danh mục</span>
        <span className="tm-section-link" onClick={() => navigate("/category")}>
          Tất cả →
        </span>
      </div>
      {/* Scrollable categories */}
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '8px 16px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {categories.map((category, i) => (
          <div
            key={i}
            onClick={() => gotoCategory(category.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              minWidth: 64,
              cursor: 'pointer',
            }}
          >
            <div className={`tm-category-icon ${pastelColors[i % pastelColors.length]}`}>
              {category.icon && category.icon.length <= 5 && !category.icon.startsWith('http') && !category.icon.startsWith('/') && !category.icon.startsWith('data:') ? (
                <span style={{ fontSize: 24, lineHeight: 1 }}>{category.icon}</span>
              ) : category.icon ? (
                <img
                  src={category.icon}
                  style={{ width: 28, height: 28, objectFit: 'contain' }}
                  alt={category.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span style={{ fontSize: 16, fontWeight: 'bold', color: 'rgba(0,0,0,0.3)' }}>{category.name.charAt(0)}</span>
              )}
            </div>
            <Text
              size="xxSmall"
              style={{
                color: 'var(--tm-text-primary)',
                fontWeight: 500,
                fontSize: 11,
                textAlign: 'center',
                lineHeight: '14px',
              }}
            >
              {category.name}
            </Text>
          </div>
        ))}
      </div>
    </Box>
  );
};
