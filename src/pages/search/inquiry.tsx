import React, { useCallback } from "react";
import { FC } from "react";
import { useRecoilState } from "recoil";
import { keywordState } from "state";
import { Box, Input, Text } from "zmp-ui";
import { debounce } from "lodash";

const popularSearches = ["Cơm gà", "Trà sữa", "Gà rán", "Phở bò", "Bún bò", "Tokbokki"];

export const Inquiry: FC = () => {
  const [keyword, setKeyword] = useRecoilState(keywordState);

  const handleChange = useCallback(
    debounce((keyword: string) => {
      setKeyword(keyword);
    }, 500),
    [],
  );

  return (
    <Box className="bg-white" style={{ paddingBottom: 12 }}>
      <Box
        p={4}
        pt={6}
        className="transition-all ease-out flex-none"
        ref={
          ((el: HTMLDivElement) => {
            setTimeout(() => {
              if (el) {
                el.style.paddingTop = "8px";
              }
            });
          }) as any
        }
      >
        <Input.Search
          ref={(el) => {
            if (!el?.input?.value) {
              el?.focus();
            }
          }}
          defaultValue={keyword}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Tìm món, tên quán hoặc combo..."
          clearable
          allowClear
        />
      </Box>
      {/* Popular search chips */}
      {!keyword && (
        <div style={{ padding: '0 16px' }}>
          <Text size="xxSmall" style={{
            color: 'var(--tm-text-secondary)',
            fontWeight: 600, marginBottom: 8,
            fontSize: 12,
          }}>
            Tìm kiếm phổ biến
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {popularSearches.map((term) => (
              <button
                key={term}
                className="tm-chip"
                onClick={() => {
                  setKeyword(term);
                  handleChange(term);
                }}
              >
                🔍 {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </Box>
  );
};
