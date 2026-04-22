import React, { FC, useState } from "react";
import { Box, Input, useNavigate } from "zmp-ui";
import { useSetRecoilState } from "recoil";
import { atom } from "recoil";

export type FilterType = "near" | "freeship" | "sale" | "new" | "best" | null;

export const activeFilterState = atom<FilterType>({
  key: "activeFilter",
  default: null,
});

const quickFilters = [
  { id: "near" as FilterType, label: "📍 Gần bạn" },
  { id: "freeship" as FilterType, label: "🚚 Freeship" },
  { id: "sale" as FilterType, label: "🔥 Giảm giá" },
  { id: "new" as FilterType, label: "✨ Mới" },
  { id: "best" as FilterType, label: "⭐ Bán chạy" },
];

export const Inquiry: FC = () => {
  const navigate = useNavigate();
  const setActiveFilter = useSetRecoilState(activeFilterState);
  const [localFilter, setLocalFilter] = useState<FilterType>(null);

  const handleFilterClick = (filterId: FilterType) => {
    const newFilter = localFilter === filterId ? null : filterId;
    setLocalFilter(newFilter);
    setActiveFilter(newFilter);
  };

  return (
    <Box className="bg-white" style={{ paddingBottom: 12 }}>
      <Box style={{ padding: '12px 16px 0' }}>
        <Input.Search
          onFocus={() => navigate("/search")}
          placeholder="Tìm món ngon, quán gần bạn..."
        />
      </Box>
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '10px 16px 0',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {quickFilters.map((filter) => (
          <button
            key={filter.id}
            className={`tm-chip ${localFilter === filter.id ? 'tm-chip-active' : ''}`}
            onClick={() => handleFilterClick(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </Box>
  );
};
