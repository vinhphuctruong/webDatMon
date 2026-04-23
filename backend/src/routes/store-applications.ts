import express from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../middlewares/auth";

const router = express.Router();
const prisma = new PrismaClient();

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

    if (!storeName || !storeAddress || !storePhone) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ Tên, Địa chỉ và SĐT" });
    }

    const newApp = await prisma.storeApplication.create({
      data: {
        applicantId: userId,
        storeName,
        storeAddress,
        storeLatitude: storeLatitude ? parseFloat(storeLatitude) : null,
        storeLongitude: storeLongitude ? parseFloat(storeLongitude) : null,
        storePhone,
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
