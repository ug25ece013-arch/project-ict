const { GoogleGenerativeAI } = require("@google/generative-ai");

let genAI = null;
let cachedModelName = null;

function getApiKey() {
  return (process.env.GEMINI_API_KEY || "").trim();
}

function getModelCandidates() {
  const fromEnv = (process.env.GEMINI_MODEL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-lite"
  ];

  return [...new Set([...fromEnv, ...defaults])];
}

function getModel(modelName) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is missing in backend/.env.");
    err.code = "MISSING_API_KEY";
    throw err;
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  return genAI.getGenerativeModel({ model: modelName });
}

function isModelSelectionError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.status === 404 ||
    (err?.status === 400 && msg.includes("model")) ||
    msg.includes("model") && msg.includes("not found") ||
    msg.includes("unsupported model") ||
    msg.includes("is not found for api version")
  );
}

async function generateWithRetry(prompt, retries = 1, delayMs = 15000) {
  const modelNames = cachedModelName ? [cachedModelName] : getModelCandidates();
  let lastErr = null;

  for (const modelName of modelNames) {
    const model = getModel(modelName);

    try {
      const result = await model.generateContent(prompt);
      cachedModelName = modelName;
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const msg = (err?.message || "").toLowerCase();
      const is429 =
        err?.status === 429 ||
        msg.includes("resource_exhausted") ||
        msg.includes("too many requests") ||
        msg.includes("rate limit");

      if (is429 && retries > 0) {
        console.warn(`[Gemini] Rate limit hit. Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return generateWithRetry(prompt, retries - 1, delayMs);
      }

      if (isModelSelectionError(err)) {
        continue;
      }

      throw err;
    }
  }

  const modelErr = new Error(
    `No working Gemini model found. Tried: ${modelNames.join(", ")}`
  );
  modelErr.code = "MODEL_CONFIG_ERROR";
  modelErr.cause = lastErr;
  throw modelErr;
}

module.exports = { getModel, generateWithRetry, getApiKey };
