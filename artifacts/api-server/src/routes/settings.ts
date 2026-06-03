import { Router } from "express";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

let currentSettings = {
  loiteringThresholdMinutes: 5,
  crowdThreshold: 5,
  runningVelocityThreshold: 3.5,
  abandonedObjectMinutes: 10,
  defaultModel: "gemini-2.5-flash",
  enableMotionDetection: true,
  enableFaceDetection: false,
  riskScoreLoitering: 40,
  riskScoreRestrictedArea: 80,
  riskScoreAbandonedBag: 95,
  riskScoreCrowd: 55,
  riskScoreRunning: 35,
};

router.get("/settings", (_req, res) => {
  res.json(currentSettings);
});

router.put("/settings", (req, res) => {
  const body = UpdateSettingsBody.parse(req.body);
  currentSettings = { ...currentSettings, ...body };
  res.json(currentSettings);
});

export default router;
