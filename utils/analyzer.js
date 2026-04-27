/**
 * utils/analyzer.js
 * Rule-based AI detection heuristics.
 * Separate scoring logic for prose, code, and image content.
 */

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Prose / text analysis
function detectAIProse(text) {
  const clean = String(text || "").trim();
  if (!clean) return 0;

  const lower = clean.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const sentences = splitSentences(clean);

  // Very short human text should not be punished.
  if (words.length <= 22) return 0;

  let score = 0;

  // Strong AI-transition/template markers.
  const strongAiPhrases = [
    "in conclusion", "to summarize", "in summary", "it is important to note",
    "it is worth noting", "it should be noted", "first and foremost"
  ];
  strongAiPhrases.forEach((p) => {
    if (lower.includes(p)) score += 14;
  });

  // Medium AI markers.
  const mediumAiPhrases = [
    "moreover", "furthermore", "therefore", "as a result", "in addition",
    "on the other hand", "needless to say", "overall,"
  ];
  mediumAiPhrases.forEach((p) => {
    if (lower.includes(p)) score += 8;
  });

  // Formal/robotic vocabulary.
  const formalWords = [
    "utilize", "methodology", "comprehensive", "robust", "multifaceted",
    "optimize", "implement", "significant", "objective", "consequently"
  ];
  formalWords.forEach((w) => {
    if (lower.includes(w)) score += 4;
  });

  // Sentence-level structure checks.
  const sentenceLens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgLen = avg(sentenceLens);
  const variance = sentenceLens.length >= 3
    ? avg(sentenceLens.map((n) => Math.pow(n - avgLen, 2)))
    : 0;

  if (avgLen >= 24) score += 12;
  if (sentences.length >= 6 && variance <= 10) score += 20; // unnaturally uniform sentence rhythm
  if (sentences.length >= 8 && clean.length >= 700) score += 10;

  // Paragraph uniformity.
  const paragraphs = clean.split(/\n+/).filter((p) => p.trim().length > 40);
  if (paragraphs.length >= 3) {
    const pLens = paragraphs.map((p) => p.length);
    const pAvg = avg(pLens);
    const pVariance = avg(pLens.map((n) => Math.pow(n - pAvg, 2)));
    if (pVariance < 1800) score += 12;
  }

  // Low lexical diversity suggests templated generation.
  if (words.length >= 60) {
    const diversity = new Set(words).size / words.length;
    if (diversity < 0.44) score += 18;
    else if (diversity < 0.50) score += 8;
  }

  // Human signals (subtract score).
  const contractions = (
    lower.match(/\b(don't|won't|can't|i'm|it's|didn't|wouldn't|couldn't|i've|i'll|isn't|aren't|wasn't|weren't|that's|there's|we're|they're)\b/g) || []
  ).length;
  if (words.length >= 45 && contractions === 0) score += 18;
  if (contractions >= 2) score -= 14;
  if (contractions >= 5) score -= 8;

  const firstPerson = (
    lower.match(/\b(i|we|my|our|me|us)\b/g) || []
  ).length;
  if (words.length >= 45 && firstPerson === 0) score += 8;
  if (firstPerson >= 3) score -= 10;

  const expressive = (
    clean.match(/[!?]/g) || []
  ).length;
  if (expressive >= 2) score -= 6;

  const humanPhrases = [
    "to be honest", "frankly", "i think", "i feel", "from my experience",
    "in my opinion", "honestly", "personally"
  ];
  humanPhrases.forEach((p) => {
    if (lower.includes(p)) score -= 5;
  });

  return clamp(Math.round(score));
}

// Code analysis
function detectAICode(text) {
  let score = 20;
  const lower = text.toLowerCase();
  const lines = text.split("\n");

  const commentLines = lines.filter(
    (l) =>
      l.trim().startsWith("//") ||
      l.trim().startsWith("#") ||
      l.trim().startsWith("*")
  );
  if (lines.length > 0 && commentLines.length / lines.length > 0.25) score += 20;

  const verboseNames = [
    "userData", "userInput", "userInfo", "resultData", "responseData",
    "errorMessage", "isValid", "isLoading", "handleClick", "handleChange",
    "handleSubmit", "processData", "fetchData", "getData", "setData"
  ];
  verboseNames.forEach((n) => {
    if (lower.includes(n.toLowerCase())) score += 5;
  });

  const patterns = [
    "try {", "catch (", "async function", "await fetch",
    "console.log(", "return res.json(", "res.status("
  ];
  let patternHits = 0;
  patterns.forEach((p) => {
    if (text.includes(p)) patternHits++;
  });
  if (patternHits >= 4) score += 15;

  if (text.length > 1000) score += 10;
  if (lines.length > 40) score += 10;

  return clamp(score);
}

// Image placeholder
function detectAIImage() {
  return {
    aiUsage: 50,
    level: "Medium",
    note: "Deep image analysis requires an AI vision model. Score is indicative only."
  };
}

// Main export
function detectAI(text, type = "text") {
  if (type === "image") return detectAIImage();

  const rawScore = type === "code" ? detectAICode(text) : detectAIProse(text);

  let level = "Low";
  if (rawScore >= 70) level = "High";
  else if (rawScore >= 30) level = "Medium";

  return { aiUsage: rawScore, level };
}

module.exports = detectAI;
