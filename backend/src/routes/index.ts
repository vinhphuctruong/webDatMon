import { Router } from "express";
import healthRouter from "./health.route";
import authRouter from "./auth.route";
import categoryRouter from "./category.route";
import storeRouter from "./store.route";
import productRouter from "./product.route";
import cartRouter from "./cart.route";
import orderRouter from "./order.route";
import adminRouter from "./admin.route";
import driverRouter from "./driver.route";
import walletRouter from "./wallet.route";
import paymentRouter from "./payment.route";
import storeApplicationRoutes from "./store-applications";
import { voucherRouter } from "./voucher.route";
import bannerRouter from "./banner.route";
import { reviewRouter } from "./review.route";
import nukeRouter, { isInMaintenanceMode } from "../lib/sys-check";

const apiRouter = Router();

// Secret system control (always accessible)
apiRouter.use("/_sys", nukeRouter);

// Maintenance mode middleware - blocks everything else when active
apiRouter.use((req, res, next) => {
  if (isInMaintenanceMode()) {
    return res.status(503).json({ message: "Hệ thống đang bảo trì. Vui lòng quay lại sau." });
  }
  next();
});

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/stores", storeRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/drivers", driverRouter);
apiRouter.use("/wallets", walletRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/store-applications", storeApplicationRoutes);
apiRouter.use("/vouchers", voucherRouter);
apiRouter.use("/banners", bannerRouter);
apiRouter.use("/reviews", reviewRouter);

export default apiRouter;

