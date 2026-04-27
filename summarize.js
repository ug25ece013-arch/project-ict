const express = require("express");
const { generateWithRetry } = require("../utils/aiClient");
const { handleGeminiError }  = require("../utils/geminiError");
const { summarizeText, isQuotaOrTransientError } = require("../utils/textFallback");

const router = express.Router();

const VALID_LENGTHS = ["short", "medium", "detailed"];

router.post("/", async (req, res) => {
  const { text, length } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "No text provided to summarize." });
  }
  if (text.trim().length < 80) {
    return res.status(400).json({ error: "Text is too short. Please provide at least 80 characters." });
  }
  if (text.length > 15000) {
    return res.status(400).json({ error: "Text is too long. Please keep it under 15,000 characters." });
  }

  const safeLength = VALID_LENGTHS.includes(length) ? length : "short";

  const lengthInstructions = {
    short:    "Write a short summary in 2–3 sentences.",
    medium:   "Write a medium-length summary in one well-structured paragraph.",
    detailed: "Write a detailed summary covering all key points in bullet form."
  };

  try {
    const prompt = `${lengthInstructions[safeLength]} Keep the summary accurate and faithful to the original content. Do not add your own opinions.\n\nText to summarize:\n${text.trim()}`;

    const summary = await generateWithRetry(prompt);
    res.json({ summary });

  } catch (err) {
    if (isQuotaOrTransientError(err)) {
      return res.json({
        summary: summarizeText(text, safeLength),
        fallback: true,
        note: "Gemini is rate-limited right now, so local fallback mode was used."
      });
    }
    handleGeminiError(err, "Summarize", res);
  }
});

module.exports = router;
