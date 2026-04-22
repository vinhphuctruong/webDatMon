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

const apiRouter = Router();

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

export default apiRouter;
