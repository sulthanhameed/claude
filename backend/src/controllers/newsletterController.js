import Subscriber from "../models/Subscriber.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST /api/newsletter — public
export async function subscribe(req, res, next) {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const existing = await Subscriber.findOne({ email });
    if (existing) {
      if (!existing.active) {
        existing.active = true;
        existing.unsubscribedAt = undefined;
        await existing.save();
        return res.json({
          message: "Welcome back! You're subscribed again.",
          subscriber: { email: existing.email },
        });
      }
      return res.json({
        message: "You're already on the list — see you at the next special.",
        subscriber: { email: existing.email },
      });
    }

    const subscriber = await Subscriber.create({
      email,
      source: req.body?.source || "footer",
    });

    res.status(201).json({
      message: "Subscribed! You are on the list for chef specials and offers.",
      subscriber: { email: subscriber.email },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/newsletter — admin
export async function listSubscribers(_req, res, next) {
  try {
    const subscribers = await Subscriber.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json({ count: subscribers.length, subscribers });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/newsletter/:id — admin
export async function deleteSubscriber(req, res, next) {
  try {
    const deleted = await Subscriber.findByIdAndUpdate(
      req.params.id,
      { active: false, unsubscribedAt: new Date() },
      { new: true },
    );
    if (!deleted) {
      return res.status(404).json({ message: "Subscriber not found" });
    }
    res.json({ message: "Unsubscribed", subscriber: deleted });
  } catch (err) {
    next(err);
  }
}
