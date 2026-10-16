import { Router } from "express";
import { requireAuth, requireAuthFlexible, type AuthedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { Notification } from "../models/Notification";
import { toNotificationDto } from "../utils/mappers";
import { addSseClient, sseHeartbeat } from "../utils/sse";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const notifications = await Notification.find({ humanId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications.map(toNotificationDto));
  })
);

router.post(
  "/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : [];
    const filter =
      ids.length > 0
        ? { humanId, _id: { $in: ids }, readAt: { $exists: false } }
        : { humanId, readAt: { $exists: false } };

    await Notification.updateMany(filter, { readAt: new Date() });
    res.json({ ok: true });
  })
);

router.get(
  "/stream",
  requireAuthFlexible,
  asyncHandler(async (req, res) => {
    const { humanId } = req as AuthedRequest;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`event: connected\ndata: ${JSON.stringify({ humanId })}\n\n`);

    const remove = addSseClient(humanId, res);
    const heartbeat = setInterval(() => {
      res.write(`: ping\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      remove();
    });
  })
);

// Keep heartbeat utility referenced for potential global use
void sseHeartbeat;

export default router;
