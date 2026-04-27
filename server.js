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

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(express.static(path.join(__dirname, "index.html")));

app.use("/analyze", analyzeRoute);
app.use("/humanize", humanizeRoute);
app.use("/summarize", summarizeRoute);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: !!getApiKey()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

const server = app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing server or set another PORT.`);
    process.exit(1);
  }
  console.error("[Server Listen Error]", err);
  process.exit(1);
});
