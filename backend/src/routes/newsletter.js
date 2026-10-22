import { Router } from "express";
import {
  subscribe,
  listSubscribers,
  deleteSubscriber,
} from "../controllers/newsletterController.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

router.post("/", subscribe); // public footer form
router.get("/", protect, adminOnly, listSubscribers);
router.delete("/:id", protect, adminOnly, deleteSubscriber);

export default router;
