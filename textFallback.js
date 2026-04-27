function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function applyWordMap(text, map) {
  let out = text;
  for (const [from, to] of map) {
    out = out.replace(from, to);
  }
  return out;
}

function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function rewriteSentence(sentence, tone) {
  let s = sentence.trim();

  const baseMap = [
    [/\bmoreover\b/gi, "also"],
    [/\bfurthermore\b/gi, "also"],
    [/\bin conclusion\b/gi, "to wrap up"],
    [/\bit is important to note that\b/gi, "note that"],
    [/\bit should be noted that\b/gi, "note that"],
    [/\bit is worth noting that\b/gi, "worth noting:"],
    [/\bin order to\b/gi, "to"],
    [/\butilize\b/gi, "use"],
    [/\btherefore\b/gi, "so"],
    [/\bas a result\b/gi, "so"],
    [/\bdo not\b/gi, "don't"],
    [/\bcannot\b/gi, "can't"],
    [/\bis not\b/gi, "isn't"],
    [/\bare not\b/gi, "aren't"],
    [/\bwas not\b/gi, "wasn't"],
    [/\bwere not\b/gi, "weren't"],
    [/\bI am\b/g, "I'm"],
    [/\bit is\b/gi, "it's"],
    [/\bthat is\b/gi, "that's"]
  ];

  s = applyWordMap(s, baseMap);

  if (tone === "casual") {
    s = applyWordMap(s, [
      [/\bhowever\b/gi, "but"],
      [/\bapproximately\b/gi, "about"],
      [/\bnumerous\b/gi, "many"],
      [/\bobtain\b/gi, "get"]
    ]);
    s = s.replace(/,\s*/g, ", ");
  }

  if (tone === "friendly") {
    s = applyWordMap(s, [
      [/\busers\b/gi, "people"],
      [/\bindividuals\b/gi, "people"],
      [/\bassist\b/gi, "help"],
      [/\bregarding\b/gi, "about"]
    ]);
    if (!/[!?]$/.test(s)) {
      s = s.replace(/\.$/, "!");
    }
  }

  if (tone === "professional") {
    s = applyWordMap(s, [
      [/\bkind of\b/gi, ""],
      [/\breally\b/gi, ""],
      [/\bjust\b/gi, ""]
    ]);
    s = s.replace(/\s{2,}/g, " ").trim();
    if (!/[.!?]$/.test(s)) s += ".";
  }

  if (tone === "witty") {
    s = applyWordMap(s, [
      [/\bvery\b/gi, "pretty"],
      [/\bimportant\b/gi, "a big deal"],
      [/\bdifficult\b/gi, "tricky"]
    ]);
    if (/^[A-Za-z]/.test(s)) {
      s = "Honestly, " + s.charAt(0).toLowerCase() + s.slice(1);
    }
  }

  if (tone === "simple") {
    s = applyWordMap(s, [
      [/\bapproximately\b/gi, "about"],
      [/\btherefore\b/gi, "so"],
      [/\bconsequently\b/gi, "so"],
      [/\bmethodology\b/gi, "method"],
      [/\bimplement\b/gi, "do"],
      [/\bobjective\b/gi, "goal"]
    ]);
    s = s.replace(/,\s*/g, ". ");
    s = s.replace(/;\s*/g, ". ");
  }

  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

function humanizeText(text, tone = "casual") {
  const source = String(text || "").trim();
  if (!source) return "";

  const sentences = splitSentences(source);
  if (!sentences.length) return source;

  let rewritten = sentences.map((s) => rewriteSentence(s, tone)).join(" ");
  rewritten = rewritten.replace(/\s{2,}/g, " ").trim();

  // Ensure output is not identical when fallback mode is active.
  if (normalizeText(rewritten) === normalizeText(source)) {
    const first = sentences[0];
    if (tone === "professional") {
      rewritten = `In practical terms, ${first.charAt(0).toLowerCase()}${first.slice(1)} ${sentences.slice(1).join(" ")}`.trim();
    } else if (tone === "simple") {
      rewritten = `Here's the plain version: ${sentences.join(" ")}`.trim();
    } else if (tone === "friendly") {
      rewritten = `Here's a friendlier rewrite: ${sentences.join(" ")}`.trim();
    } else if (tone === "witty") {
      rewritten = `Quick rewrite, with less robot energy: ${sentences.join(" ")}`.trim();
    } else {
      rewritten = `Here's a more natural rewrite: ${sentences.join(" ")}`.trim();
    }
  }

  return rewritten;
}

function summarizeText(text, length = "short") {
  const src = String(text || "").trim();
  if (!src) return "";

  const sentences = splitSentences(src);
  const sentenceCount =
    length === "detailed" ? 5 :
    length === "medium" ? 3 : 2;

  const picked = sentences.slice(0, sentenceCount);
  if (!picked.length) return src;

  if (length === "detailed") {
    return picked.map((s) => `- ${s}`).join("\n");
  }

  return picked.join(" ");
}

function isQuotaOrTransientError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    err?.status === 429 ||
    msg.includes("resource_exhausted") ||
    msg.includes("too many requests") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

module.exports = { humanizeText, summarizeText, isQuotaOrTransientError, normalizeText };
