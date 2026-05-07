import express from "express";
import { prisma } from "../db/prisma";
import { requireAuth } from "../middlewares/auth";

const router = express.Router();

function parseOptionalCoordinate(
  value: unknown,
  kind: "latitude" | "longitude",
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `${kind} không hợp lệ` };
  }

  if (kind === "latitude" && (parsed < -90 || parsed > 90)) {
    return { ok: false, error: "latitude phải nằm trong khoảng -90 đến 90" };
  }

  if (kind === "longitude" && (parsed < -180 || parsed > 180)) {
    return { ok: false, error: "longitude phải nằm trong khoảng -180 đến 180" };
  }

  return { ok: true, value: parsed };
}

// Get current user's store application
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const application = await prisma.storeApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
    });

    if (!application) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ đăng ký" });
    }

    res.json(application);
  } catch (error) {
    console.error("Lỗi khi lấy hồ sơ đăng ký:", error);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
});

// Submit a new store application
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Check if user already has a PENDING application
    const existingApp = await prisma.storeApplication.findFirst({
      where: { 
        applicantId: userId,
        status: "PENDING"
      },
    });

    if (existingApp) {
      return res.status(400).json({ error: "Bạn đã có hồ sơ đang chờ duyệt" });
    }

    // Check if user is already a store manager
    const existingStore = await prisma.store.findFirst({
      where: { managerId: userId }
    });
    
    if (existingStore) {
      return res.status(400).json({ error: "Bạn đã là chủ cửa hàng" });
    }

    const {
      storeName,
      storeAddress,
      storeLatitude,
      storeLongitude,
      storePhone,
      frontStoreImageData,
      businessLicenseImageData,
    } = req.body;

    const normalizedName = typeof storeName === "string" ? storeName.trim() : "";
    const normalizedAddress = typeof storeAddress === "string" ? storeAddress.trim() : "";
    const normalizedPhone = typeof storePhone === "string" ? storePhone.trim() : "";

    if (!normalizedName || !normalizedAddress || !normalizedPhone) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ Tên, Địa chỉ và SĐT" });
    }

    const latitudeResult = parseOptionalCoordinate(storeLatitude, "latitude");
    if (!latitudeResult.ok) {
      return res.status(400).json({ error: latitudeResult.error });
    }

    const longitudeResult = parseOptionalCoordinate(storeLongitude, "longitude");
    if (!longitudeResult.ok) {
      return res.status(400).json({ error: longitudeResult.error });
    }

    const newApp = await prisma.storeApplication.create({
      data: {
        applicantId: userId,
        storeName: normalizedName,
        storeAddress: normalizedAddress,
        storeLatitude: latitudeResult.value,
        storeLongitude: longitudeResult.value,
        storePhone: normalizedPhone,
        frontStoreImageData,
        businessLicenseImageData,
        status: "PENDING",
      },
    });

    res.status(201).json(newApp);
  } catch (error) {
    console.error("Lỗi khi gửi hồ sơ đăng ký:", error);
    res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
  }
});

export default router;
// Trigger TS refresh
