import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import videosRouter from "./videos.js";
import detectionsRouter from "./detections.js";
import trackingRouter from "./tracking.js";
import eventsRouter from "./events.js";
import reportsRouter from "./reports.js";
import chatRouter from "./chat.js";
import dashboardRouter from "./dashboard.js";
import settingsRouter from "./settings.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(videosRouter);
router.use(detectionsRouter);
router.use(trackingRouter);
router.use(eventsRouter);
router.use(reportsRouter);
router.use(chatRouter);
router.use(dashboardRouter);
router.use(settingsRouter);

export default router;
