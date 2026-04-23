import React, { FC, useEffect, useState } from "react";
import { Page, Header, Box, Text, Input, Button, Icon, useSnackbar, useNavigate } from "zmp-ui";
import { getMyStoreApplication, submitStoreApplication } from "services/backend";
import { getLocation, chooseImage } from "zmp-sdk";
import { reverseGeocode } from "utils/location";

const RegisterStorePage: FC = () => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [frontImage, setFrontImage] = useState("");
  const [licenseImage, setLicenseImage] = useState("");

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const app = await getMyStoreApplication();
      if (app) {
        setExistingApp(app);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = async () => {
    snackbar.openSnackbar({ type: "info", text: "Đang lấy vị trí...", duration: 2000 });
    try {
      const res = await getLocation({});
      if (res && res.latitude && res.longitude) {
        const parsedLat = parseFloat(res.latitude as string);
        const parsedLng = parseFloat(res.longitude as string);
        setLat(parsedLat);
        setLng(parsedLng);
        const address = await reverseGeocode(parsedLat, parsedLng);
        if (address) setStoreAddress(address);
      }
    } catch (error) {
      snackbar.openSnackbar({ type: "error", text: "Không thể lấy vị trí" });
    }
  };

  const handleChooseImage = async (setImage: (url: string) => void) => {
    try {
      const res = await chooseImage({
        sourceType: ["album", "camera"],
        count: 1,
      });
      const filePaths = JSON.parse(res.filePaths);
      if (filePaths && filePaths.length > 0) {
        // In a real app, you would upload this to your server and get a URL back.
        // For demonstration, we just use the local temp path (which won't work across sessions)
        // or base64. Let's mock a success URL for now.
        setImage("https://placehold.co/600x400/EEE/31343C?text=Uploaded+Image");
        snackbar.openSnackbar({ type: "success", text: "Đã chọn ảnh thành công (Mock)" });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async () => {
    if (!storeName || !storePhone || !storeAddress) {
      snackbar.openSnackbar({ type: "error", text: "Vui lòng nhập đầy đủ Tên, SĐT và Địa chỉ" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newApp = await submitStoreApplication({
        storeName,
        storePhone,
        storeAddress,
        storeLatitude: lat,
        storeLongitude: lng,
        frontStoreImageData: frontImage,
        businessLicenseImageData: licenseImage,
      });
      setExistingApp(newApp);
      snackbar.openSnackbar({ type: "success", text: "Đã gửi hồ sơ thành công!" });
    } catch (error: any) {
      snackbar.openSnackbar({ type: "error", text: error.message || "Lỗi khi gửi hồ sơ" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Page className="bg-background">
        <Header title="Đăng ký bán hàng" showBackIcon />
        <Box className="p-4 flex justify-center mt-10">
          <Text>Đang tải dữ liệu...</Text>
        </Box>
      </Page>
    );
  }

  // If there's an existing application in PENDING state
  if (existingApp && existingApp.status === "PENDING") {
    return (
      <Page className="bg-background">
        <Header title="Đăng ký bán hàng" showBackIcon />
        <Box className="p-6 flex flex-col items-center justify-center text-center mt-10">
          <Icon icon="zi-clock-1" style={{ fontSize: 64, color: "var(--tm-primary)", marginBottom: 16 }} />
          <Text size="large" className="font-semibold mb-2">Hồ sơ đang được duyệt</Text>
          <Text className="text-gray-500">
            Hồ sơ đăng ký cửa hàng "{existingApp.storeName}" của bạn đã được gửi và đang trong quá trình xét duyệt. Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.
          </Text>
          <Button className="mt-8 w-full" onClick={() => navigate(-1)}>Quay lại</Button>
        </Box>
      </Page>
    );
  }

  // If rejected, show the note
  if (existingApp && existingApp.status === "REJECTED") {
    return (
      <Page className="bg-background">
        <Header title="Đăng ký bán hàng" showBackIcon />
        <Box className="p-6 flex flex-col items-center justify-center text-center mt-10">
          <Icon icon="zi-warning" style={{ fontSize: 64, color: "var(--tm-danger)", marginBottom: 16 }} />
          <Text size="large" className="font-semibold mb-2">Hồ sơ bị từ chối</Text>
          <Text className="text-gray-500 mb-4">
            Rất tiếc, hồ sơ của bạn chưa đủ điều kiện.
          </Text>
          <Box className="bg-red-50 p-4 rounded-lg w-full mb-6">
            <Text className="text-red-700 italic">Lý do: {existingApp.adminNote || "Không xác định"}</Text>
          </Box>
          <Button className="w-full" onClick={() => setExistingApp(null)}>Gửi lại hồ sơ khác</Button>
        </Box>
      </Page>
    );
  }

  return (
    <Page className="bg-background">
      <Header title="Đăng ký mở Cửa hàng" showBackIcon />
      <Box className="p-4 space-y-4 pb-24">
        <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
          <Icon icon="zi-info-circle" className="text-blue-600 mt-1" />
          <Text size="small" className="text-blue-800">
            Trở thành đối tác nhà hàng của chúng tôi để tiếp cận hàng ngàn khách hàng mới mỗi ngày.
          </Text>
        </div>

        <Box className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <Text className="font-semibold text-lg border-b pb-2">Thông tin cơ bản</Text>
          <Input 
            label="Tên Cửa hàng / Quán ăn (*)" 
            placeholder="VD: Cơm Tấm Sài Gòn" 
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
          <Input 
            label="Số điện thoại chủ quán (*)" 
            type="text" 
            placeholder="VD: 0912345678" 
            value={storePhone}
            onChange={(e) => setStorePhone(e.target.value)}
          />
        </Box>

        <Box className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <Text className="font-semibold text-lg border-b pb-2">Vị trí & Địa chỉ (*)</Text>
          <Button 
            size="small" 
            variant="secondary" 
            onClick={handleGetLocation} 
            className="w-full mb-2"
          >
            <Icon icon="zi-location" className="mr-2" />
            {lat ? "Cập nhật lại GPS" : "Lấy định vị GPS tự động"}
          </Button>
          {lat && (
            <Text size="xSmall" className="text-green-600 mb-2 italic">✓ Đã lấy tọa độ: {lat.toFixed(4)}, {lng?.toFixed(4)}</Text>
          )}
          <Input 
            type="text" 
            placeholder="Số nhà, Tên đường, Phường/Xã..." 
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
          />
        </Box>

        <Box className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <Text className="font-semibold text-lg border-b pb-2">Hình ảnh xác thực</Text>
          
          <Box>
            <Text className="font-medium mb-2">Ảnh mặt tiền quán</Text>
            {frontImage ? (
              <div className="relative">
                <img src={frontImage} alt="Mặt tiền" className="w-full h-40 object-cover rounded-lg border" />
                <Button size="small" variant="secondary" className="absolute top-2 right-2" onClick={() => setFrontImage("")}>Xóa</Button>
              </div>
            ) : (
              <div 
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 cursor-pointer"
                onClick={() => handleChooseImage(setFrontImage)}
              >
                <Icon icon="zi-camera" style={{ fontSize: 32, color: "#9ca3af" }} />
                <Text size="small" className="text-gray-500 mt-2">Nhấn để chụp/chọn ảnh</Text>
              </div>
            )}
          </Box>

          <Box>
            <Text className="font-medium mb-2">Giấy phép kinh doanh (Tùy chọn)</Text>
            {licenseImage ? (
              <div className="relative">
                <img src={licenseImage} alt="GPKD" className="w-full h-40 object-cover rounded-lg border" />
                <Button size="small" variant="secondary" className="absolute top-2 right-2" onClick={() => setLicenseImage("")}>Xóa</Button>
              </div>
            ) : (
              <div 
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 cursor-pointer"
                onClick={() => handleChooseImage(setLicenseImage)}
              >
                <Icon icon="zi-gallery" style={{ fontSize: 32, color: "#9ca3af" }} />
                <Text size="small" className="text-gray-500 mt-2">Chọn ảnh từ thư viện</Text>
              </div>
            )}
          </Box>
        </Box>

        <Box className="pt-4 pb-8">
          <Button 
            className="w-full h-12 text-lg font-semibold shadow-md"
            onClick={handleSubmit}
            loading={isSubmitting}
            style={{ background: "var(--tm-primary)", color: "#fff" }}
          >
            Gửi yêu cầu đăng ký
          </Button>
        </Box>
      </Box>
    </Page>
  );
};

export default RegisterStorePage;
