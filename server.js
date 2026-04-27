require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const analyzeRoute = require("./routes/analyze");
const humanizeRoute = require("./routes/humanize");
const summarizeRoute = require("./routes/summarize");
const { getApiKey } = require("./utils/aiClient");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static frontend files
// Make sure index.html is inside the frontend folder
app.use(express.static(path.join(__dirname, "../frontend")));

// Home route (important for Render)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname,"../index.html"));
});

// API Routes
app.use("/analyze", analyzeRoute);
app.use("/humanize", humanizeRoute);
app.use("/summarize", summarizeRoute);

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!getApiKey()
  });
});

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found."
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Server Error Handling
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing server or set another PORT.`
    );
    process.exit(1);
  }

  console.error("[Server Listen Error]", err);
  process.exit(1);
});
