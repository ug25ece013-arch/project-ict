const express = require("express");
const { generateWithRetry } = require("../utils/aiClient");
const { handleGeminiError }  = require("../utils/geminiError");
const {
  humanizeText,
  isQuotaOrTransientError,
  normalizeText
} = require("../utils/textFallback");

const router = express.Router();

const VALID_TONES = ["casual", "friendly", "professional", "witty", "simple"];

router.post("/", async (req, res) => {
  const { text, tone } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "No text provided to humanize." });
  }
  if (text.trim().length < 10) {
    return res.status(400).json({ error: "Text is too short. Please enter at least 10 characters." });
  }
  if (text.length > 8000) {
    return res.status(400).json({ error: "Text is too long. Please keep it under 8000 characters." });
  }

  const safeTone = VALID_TONES.includes(tone) ? tone : "casual";

  try {
    const prompt = `Rewrite the following text in a ${safeTone}, natural human style. Keep the original meaning intact but remove any robotic, overly formal, or AI-typical phrasing. Do not add commentary — just rewrite the text.\n\n${text.trim()}`;

    const aiHumanized = await generateWithRetry(prompt);
    const finalHumanized =
      normalizeText(aiHumanized) === normalizeText(text)
        ? humanizeText(aiHumanized, safeTone)
        : aiHumanized;

    res.json({ humanized: finalHumanized });

  } catch (err) {
    if (isQuotaOrTransientError(err)) {
      return res.json({
        humanized: humanizeText(text, safeTone),
        fallback: true,
        note: "Gemini is rate-limited right now, so local fallback mode was used."
      });
    }
    handleGeminiError(err, "Humanize", res);
  }
});

module.exports = router;
