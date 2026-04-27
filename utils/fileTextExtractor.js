const path = require("path");

function extractAsciiRuns(buffer, minLen = 4) {
  let out = "";
  let run = "";

  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    const printable =
      (b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13;

    if (printable) {
      run += String.fromCharCode(b);
    } else {
      if (run.length >= minLen) out += run + "\n";
      run = "";
    }
  }
  if (run.length >= minLen) out += run + "\n";
  return out;
}

function extractUtf16LeRuns(buffer, minLen = 4) {
  let out = "";
  let run = "";

  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const lo = buffer[i];
    const hi = buffer[i + 1];
    const printable =
      hi === 0 &&
      ((lo >= 32 && lo <= 126) || lo === 9 || lo === 10 || lo === 13);

    if (printable) {
      run += String.fromCharCode(lo);
    } else {
      if (run.length >= minLen) out += run + "\n";
      run = "";
    }
  }
  if (run.length >= minLen) out += run + "\n";
  return out;
}

function sanitizeExtractedText(text) {
  return String(text || "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractLikelyTextFromBinary(buffer) {
  const asciiText = extractAsciiRuns(buffer, 5);
  const utf16Text = extractUtf16LeRuns(buffer, 5);
  return sanitizeExtractedText(`${asciiText}\n${utf16Text}`);
}

function extractTextByType(buffer, originalName = "", mimeType = "") {
  const ext = path.extname(originalName || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();

  // Plain text-like formats.
  const textLikeExt = new Set([
    ".txt", ".md", ".csv", ".json", ".html", ".htm", ".xml", ".rtf", ".log"
  ]);
  const isTextLikeMime = mime.startsWith("text/") || mime.includes("json") || mime.includes("xml");
  if (textLikeExt.has(ext) || isTextLikeMime) {
    return sanitizeExtractedText(buffer.toString("utf8"));
  }

  // For binary office/PDF assets, perform best-effort string extraction.
  const binaryDocExt = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);
  if (binaryDocExt.has(ext) || mime.includes("pdf") || mime.includes("officedocument")) {
    return extractLikelyTextFromBinary(buffer);
  }

  // Fallback: try utf8 first, then binary extraction.
  const utf8 = sanitizeExtractedText(buffer.toString("utf8"));
  if (utf8.length >= 80) return utf8;
  return extractLikelyTextFromBinary(buffer);
}

module.exports = { extractTextByType };
