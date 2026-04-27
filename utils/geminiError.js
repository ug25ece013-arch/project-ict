function handleGeminiError(err, label, res) {
  const msg = (err?.message || "").toLowerCase();
  const status = err?.status;
  const code = err?.code;

  console.error(`[${label} Error]`, err?.message || err);

  if (code === "MISSING_API_KEY") {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it in backend/.env and restart the server."
    });
  }

  if (
    msg.includes("api_key_invalid") ||
    msg.includes("api key not valid") ||
    msg.includes("invalid api key") ||
    msg.includes("permission_denied") ||
    status === 401 ||
    status === 403
  ) {
    return res.status(401).json({
      error: "Gemini API key is invalid or has no permission. Check backend/.env and Google AI Studio key access."
    });
  }

  if (
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    status === 429
  ) {
    return res.status(429).json({
      error: "Gemini quota/rate limit reached. Please wait and try again."
    });
  }

  if (
    msg.includes("fetch failed") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("timed out")
  ) {
    return res.status(503).json({
      error: "Cannot reach Gemini API. Check internet connection and firewall settings."
    });
  }

  if (
    msg.includes("not found") ||
    msg.includes("model") && msg.includes("not")
  ) {
    return res.status(500).json({
      error: "Gemini model configuration failed. Update model name in backend/utils/aiClient.js."
    });
  }

  if (status === 400) {
    return res.status(400).json({
      error: "Request to Gemini was rejected. Try shorter input or different wording."
    });
  }

  if (msg.includes("safety") || msg.includes("blocked")) {
    return res.status(400).json({
      error: "Content was blocked by Gemini safety filters. Please modify the text and retry."
    });
  }

  return res.status(500).json({
    error: "AI service failed. Please try again."
  });
}

module.exports = { handleGeminiError };
