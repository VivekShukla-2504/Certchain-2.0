require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const certificateRoutes = require("./routes/certificates");
const verifyRoutes = require("./routes/verify");
const institutionRoutes = require("./routes/institution");
const auditRoutes = require("./routes/audit");
const platformRoutes = require("./routes/platform");
const { authLimiter, verifyLimiter, platformAdminLimiter } = require("./middleware/security");

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  credentials: false
}));
app.use(express.json({ limit: "100kb", strict: true }));
app.use((req, res, next) => {
  req.requestId = require("crypto").randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/verify", verifyLimiter, verifyRoutes);
app.use("/api/institution", institutionRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/platform", platformAdminLimiter, platformRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || (err.type === "entity.too.large" ? 413 : 500);
  const message = status === 413
    ? "Request body is too large"
    : status >= 500
      ? "Internal server error"
      : err.message || "Request failed";
  console.error(`[${req.requestId || "no-request-id"}] ${err.message}`);
  res.status(status).json({ message, requestId: req.requestId });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
