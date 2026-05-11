import React, { FC, useState, useRef, useCallback } from "react";
import { Sheet, Box, Text, Icon } from "zmp-ui";

export interface AddressSearchResult {
  lat: number;
  lng: number;
  streetName: string;
  fullName: string;
  // Bounding box or other metadata can be added if needed
}

interface AddressSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (result: AddressSearchResult) => void;
}

export const AddressSearchSheet: FC<AddressSearchSheetProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const apiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();
        if (!apiKey) throw new Error("Missing Vietmap API Key");

        const response = await fetch(
          `https://maps.vietmap.vn/api/search/v3?apikey=${apiKey}&text=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        setSearchResults(data || []);
      } catch (err) {
        console.error("VietMap search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  }, []);

  const handleSelect = async (res: any) => {
    let lat = Number(res.lat);
    let lng = Number(res.lng);
    let streetName = res.name || res.display?.split(',')[0] || "Unknown";
    let fullName = res.display || "";

    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && res.ref_id) {
      setIsSearching(true);
      try {
        const apiKey = (import.meta.env.VITE_VIETMAP_API_KEY || "").trim();
        const response = await fetch(
          `https://maps.vietmap.vn/api/place/v3?apikey=${apiKey}&refid=${res.ref_id}`
        );
        const data = await response.json();
        if (data && data.lat && data.lng) {
          lat = Number(data.lat);
          lng = Number(data.lng);
          if (data.display) fullName = data.display;
        }
      } catch (err) {
        console.error("VietMap place error", err);
      } finally {
        setIsSearching(false);
      }
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      onConfirm({
        lat,
        lng,
        streetName,
        fullName,
      });
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      autoHeight={false}
      style={{ height: "90vh" }}
    >
      <Box style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f4f5f6" }}>
        {/* Header */}
        <Box style={{ display: "flex", alignItems: "center", padding: "16px", background: "#fff", borderBottom: "1px solid #eee" }}>
          <div onClick={onClose} style={{ padding: "4px 8px 4px 0", cursor: "pointer" }}>
            <Icon icon="zi-arrow-left" style={{ fontSize: 24, color: "#e53935" }} />
          </div>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, marginRight: 32 }}>
            Địa chỉ mới
          </Text>
        </Box>

        {/* Search Input */}
        <Box style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #eee" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: 8, padding: "0 12px" }}>
            <input
              type="text"
              autoFocus
              placeholder="Tên đường, Toà nhà, Số nhà."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ flex: 1, border: "none", background: "transparent", padding: "12px 0", outline: "none", fontSize: 15 }}
            />
            {isSearching && <span style={{ fontSize: 12, color: "#999", marginRight: 8 }}>...</span>}
            {searchQuery && (
              <div 
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                style={{ background: "#ccc", color: "#fff", width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, cursor: "pointer" }}
              >
                
              </div>
            )}
          </div>
        </Box>

        {/* Results List */}
        <Box style={{ flex: 1, overflowY: "auto", background: "#f4f5f6" }}>
          {searchQuery && (
            <div style={{ padding: "16px 16px 8px", color: "#666", fontSize: 13 }}>
              Các địa điểm được đề xuất dựa trên địa chỉ bạn nhập vào
            </div>
          )}
          
          <div style={{ background: "#f4f5f6" }}>
            {searchResults.map((res, i) => (
              <div
                key={i}
                onClick={() => handleSelect(res)}
                style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
              >
                <div style={{ color: "#ccc", marginTop: 2 }}>
                  <Icon icon="zi-location" style={{ fontSize: 20 }} />
                </div>
                <div style={{ flex: 1, borderBottom: i === searchResults.length - 1 ? "none" : "1px solid #e0e0e0", paddingBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e", marginBottom: 4 }}>
                    {res.name || res.display.split(',')[0]}
                  </div>
                  <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>
                    {res.display}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isSearching && searchQuery && searchResults.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
              Không tìm thấy địa điểm nào khớp với từ khóa
            </div>
          )}
        </Box>
      </Box>
    </Sheet>
  );
};
