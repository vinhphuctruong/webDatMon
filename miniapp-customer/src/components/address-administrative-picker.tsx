import React, { FC, useEffect, useState } from "react";
import { Sheet, Box, Text, Input, Icon, Button, useSnackbar } from "zmp-ui";
import { getLocation } from "zmp-sdk";

export interface AdministrativeLocation {
  province: string;
  district: string;
  ward: string;
}

interface AddressAdministrativePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: AdministrativeLocation) => void;
}

// In-memory cache
let adminDataCache: any[] | null = null;

export const AddressAdministrativePicker: FC<AddressAdministrativePickerProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const [data, setData] = useState<any[]>(adminDataCache || []);
  const [loading, setLoading] = useState(!adminDataCache);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [step, setStep] = useState<"province" | "district" | "ward">("province");
  
  const [selectedProvince, setSelectedProvince] = useState<any>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<any>(null);

  const snackbar = useSnackbar();

  useEffect(() => {
    if (visible && !adminDataCache) {
      setLoading(true);
      fetch("https://provinces.open-api.vn/api/?depth=3")
        .then((res) => res.json())
        .then((json) => {
          adminDataCache = json;
          setData(json);
        })
        .catch((err) => {
          console.error("Failed to fetch administrative data", err);
          snackbar.openSnackbar({ type: "error", text: "Không thể tải dữ liệu hành chính" });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible]);

  // Reset state when opened
  useEffect(() => {
    if (visible) {
      setStep("province");
      setSelectedProvince(null);
      setSelectedDistrict(null);
      setSearchQuery("");
    }
  }, [visible]);

  const handleUseCurrentLocation = async () => {
    snackbar.openSnackbar({ type: "info", text: "Đang lấy vị trí..." });

    const fetchReverse = async (lat: number, lng: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        snackbar.openSnackbar({ type: "error", text: "Tọa độ không hợp lệ" });
        return;
      }
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, {
          headers: { "User-Agent": "TMFoodApp/1.0" }
        });
        const data = await res.json();
        if (data && data.address) {
          onConfirm({
            province: data.address.city || data.address.state || data.address.province || "",
            district: data.address.suburb || data.address.county || data.address.district || "",
            ward: data.address.quarter || data.address.neighbourhood || data.address.village || "",
          });
          snackbar.openSnackbar({ type: "success", text: "Đã điền vị trí hiện tại" });
        } else {
          snackbar.openSnackbar({ type: "error", text: "Không nhận diện được địa chỉ" });
        }
      } catch (err) {
        snackbar.openSnackbar({ type: "error", text: "Lỗi kết nối định vị" });
      }
    };

    const getHtml5Location = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchReverse(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            console.error("HTML5 Geo Error", err);
            snackbar.openSnackbar({ type: "error", text: "Không thể lấy vị trí. Vui lòng bật GPS." });
          },
          { timeout: 5000, maximumAge: 0, enableHighAccuracy: true }
        );
      } else {
        snackbar.openSnackbar({ type: "error", text: "Thiết bị không hỗ trợ định vị." });
      }
    };

    try {
      let isResolved = false;
      const result = await Promise.race([
        getLocation({
          fail: (error) => {
            console.error("Zalo Geo Error:", error);
            if (!isResolved) getHtml5Location();
          }
        }),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 3000))
      ]);
      
      isResolved = true;
      if (result && result.latitude && result.longitude) {
        const lat = Number(result.latitude);
        const lng = Number(result.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          fetchReverse(lat, lng);
        } else {
          getHtml5Location();
        }
      } else {
        getHtml5Location();
      }
    } catch (err) {
      console.warn("Zalo getLocation failed or timed out", err);
      getHtml5Location();
    }
  };

  const getFilteredList = () => {
    let list: any[] = [];
    if (step === "province") {
      list = data;
    } else if (step === "district" && selectedProvince) {
      list = selectedProvince.districts || [];
    } else if (step === "ward" && selectedDistrict) {
      list = selectedDistrict.wards || [];
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(query));
  };

  const handleSelectItem = (item: any) => {
    setSearchQuery("");
    if (step === "province") {
      setSelectedProvince(item);
      setStep("district");
    } else if (step === "district") {
      setSelectedDistrict(item);
      setStep("ward");
    } else if (step === "ward") {
      onConfirm({
        province: selectedProvince.name,
        district: selectedDistrict.name,
        ward: item.name,
      });
    }
  };

  const getTitle = () => {
    if (step === "province") return "Tỉnh/Thành phố";
    if (step === "district") return "Quận/Huyện";
    return "Phường/Xã";
  };

  const getSearchPlaceholder = () => {
    if (step === "province") return "Tìm kiếm Tỉnh/Thành phố";
    if (step === "district") return "Tìm kiếm Quận/Huyện";
    return "Tìm kiếm Phường/Xã";
  };

  const filteredList = getFilteredList();

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      autoHeight={false}
      style={{ height: "90vh" }}
    >
      <Box style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <Box style={{ display: "flex", alignItems: "center", padding: "16px", borderBottom: "1px solid #eee" }}>
          <div onClick={() => {
            if (step === "ward") setStep("district");
            else if (step === "district") setStep("province");
            else onClose();
          }} style={{ padding: "4px 8px 4px 0", cursor: "pointer" }}>
            <Icon icon="zi-arrow-left" style={{ fontSize: 24, color: "#e53935" }} />
          </div>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: 600, marginRight: 32 }}>
            {getTitle()}
          </Text>
        </Box>

        {/* Search */}
        <Box style={{ padding: "12px 16px", background: "#fff", zIndex: 10 }}>
          <div style={{ background: "#f5f5f5", borderRadius: 8, display: "flex", alignItems: "center", padding: "0 12px" }}>
            <Icon icon="zi-search" style={{ color: "#999" }} />
            <input
              type="text"
              placeholder={getSearchPlaceholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, border: "none", background: "transparent", padding: "12px 8px", outline: "none", fontSize: 15 }}
            />
          </div>
        </Box>

        {/* Current Location Button (Only on Province step) */}
        {step === "province" && !searchQuery && (
          <Box style={{ padding: "0 16px 16px" }}>
            <div 
              onClick={handleUseCurrentLocation}
              style={{ 
                border: "1px solid #ddd", borderRadius: 8, padding: "12px", 
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" 
              }}
            >
              <Icon icon="zi-location" style={{ color: "#e53935" }} />
              <Text style={{ fontWeight: 600 }}>Sử dụng vị trí hiện tại của tôi</Text>
            </div>
          </Box>
        )}

        <Box style={{ padding: "8px 16px", background: "#f9f9f9" }}>
          <Text size="small" style={{ color: "#666" }}>
            {step === "province" ? "Tỉnh/Thành phố" : step === "district" ? "Quận/Huyện" : "Phường/Xã"}
          </Text>
        </Box>

        {/* List */}
        <Box style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: "#999" }}>Đang tải dữ liệu...</div>
          ) : (
            filteredList.map((item, index) => (
              <div
                key={item.code}
                onClick={() => handleSelectItem(item)}
                style={{
                  padding: "16px 24px",
                  borderBottom: "1px solid #f0f0f0",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {item.name}
              </div>
            ))
          )}
          {filteredList.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: "#999" }}>Không tìm thấy kết quả</div>
          )}
        </Box>
      </Box>
    </Sheet>
  );
};
