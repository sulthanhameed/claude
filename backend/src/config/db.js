import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI is not defined in the environment");
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠  MongoDB disconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB error:", err.message);
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15_000,
      // Unique indexes (email, orderId) are essential. Set
      // MONGO_AUTO_INDEX=false only if you manage indexes manually.
      autoIndex: process.env.MONGO_AUTO_INDEX !== "false",
    });

    console.log(
      `🗄  MongoDB connected → ${conn.connection.host}/${conn.connection.name}`,
    );
    return conn;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error(
      "   Check MONGO_URI, the Atlas network allow-list (0.0.0.0/0) and the DB user password.",
    );
    process.exit(1);
  }
}
