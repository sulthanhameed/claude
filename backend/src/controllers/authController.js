import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { sendWelcomeEmail } from "../utils/notifications.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST /api/auth/signup
export async function signup(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const phone = String(req.body?.phone || "").trim() || undefined;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }
    if (name.length < 2) {
      return res.status(400).json({ message: "Please enter your full name" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email }).select("_id").lean();
    if (exists) {
      return res
        .status(409)
        .json({ message: "Email already registered — please sign in" });
    }

    const user = await User.create({ name, email, password, phone });
    const token = generateToken(user._id);

    // Fire-and-forget; never blocks account creation.
    sendWelcomeEmail(user).catch(() => {});

    console.log(`👤 New signup stored → ${email}`);

    res.status(201).json({
      message: "Account created",
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.json({
      message: "Logged in",
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
export async function getMe(req, res) {
  res.json({ user: req.user });
}

// PUT /api/auth/me
export async function updateMe(req, res, next) {
  try {
    const updates = {};
    if (typeof req.body?.name === "string") updates.name = req.body.name.trim();
    if (typeof req.body?.phone === "string")
      updates.phone = req.body.phone.trim();

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout (JWT is stateless — the client clears its token)
export function logout(_req, res) {
  res.json({ message: "Logged out" });
}
