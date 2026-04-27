const jpeg = require("jpeg-js");
const { PNG } = require("pngjs");

function parsePng(buffer) {
  if (buffer.length < 24) return null;
  const sig = buffer.subarray(0, 8);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!sig.equals(pngSig)) return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const text = buffer.toString("latin1");

  return {
    format: "png",
    width,
    height,
    hasExif: text.includes("eXIf"),
    metadataText: text
  };
}

function parseJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  let width = null;
  let height = null;
  let hasExif = false;

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;

    if (marker === 0xe1 && offset + 10 < buffer.length) {
      const exif = buffer.subarray(offset + 4, offset + 10).toString("ascii");
      if (exif === "Exif\0\0") hasExif = true;
    }

    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (offset + 9 < buffer.length) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
      }
      break;
    }

    offset += 2 + length;
  }

  return {
    format: "jpeg",
    width,
    height,
    hasExif,
    metadataText: buffer.toString("latin1")
  };
}

function parseWebp(buffer) {
  if (buffer.length < 16) return null;
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF") return null;
  if (buffer.subarray(8, 12).toString("ascii") !== "WEBP") return null;

  const text = buffer.toString("latin1");
  return {
    format: "webp",
    width: null,
    height: null,
    hasExif: text.includes("EXIF"),
    metadataText: text
  };
}

function parseImageMeta(buffer) {
  return parsePng(buffer) || parseJpeg(buffer) || parseWebp(buffer) || null;
}

function containsAny(text, parts) {
  return parts.some((p) => text.includes(p));
}

function detectWatermarkHints(metadataText, filename) {
  const text = String(metadataText || "").toLowerCase();
  const name = String(filename || "").toLowerCase();

  const watermarkKeywords = [
    "watermark",
    "gemini",
    "shutterstock",
    "gettyimages",
    "getty images",
    "adobe stock",
    "istock",
    "dreamstime",
    "alamy",
    "canva",
    "freepik",
    "midjourney",
    "openai",
    "dall-e",
    "generated with ai"
  ];

  return containsAny(text, watermarkKeywords) || containsAny(name, watermarkKeywords);
}

function decodePixels(buffer, formatHint) {
  try {
    if (formatHint === "jpeg") {
      const out = jpeg.decode(buffer, { useTArray: true });
      return out && out.data ? out : null;
    }
    if (formatHint === "png") {
      const out = PNG.sync.read(buffer);
      return out && out.data ? out : null;
    }
  } catch {
    return null;
  }
  return null;
}

function luminanceAt(data, idx) {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Bottom-right watermark-like text heuristic:
// detect dark text strokes over lighter background near bottom-right corner.
function hasBottomRightWatermarkHeuristic(pixels) {
  if (!pixels || !pixels.data || !pixels.width || !pixels.height) return false;
  const { data, width, height } = pixels;
  const x0 = Math.floor(width * 0.70);
  const y0 = Math.floor(height * 0.82);
  const x1 = width;
  const y1 = height;

  let bright = 0;
  let dark = 0;
  let transitions = 0;
  let total = 0;

  for (let y = y0; y < y1; y++) {
    let prevDark = null;
    for (let x = x0; x < x1; x++) {
      const idx = (y * width + x) * 4;
      const lum = luminanceAt(data, idx);
      const isDark = lum < 85;
      const isBright = lum > 175;
      if (isDark) dark++;
      if (isBright) bright++;
      if (prevDark !== null && prevDark !== isDark) transitions++;
      prevDark = isDark;
      total++;
    }
  }

  const brightRatio = bright / Math.max(1, total);
  const darkRatio = dark / Math.max(1, total);
  const transRatio = transitions / Math.max(1, total);

  return (
    brightRatio > 0.45 &&
    darkRatio > 0.006 &&
    darkRatio < 0.14 &&
    transRatio > 0.010 &&
    transRatio < 0.09
  );
}

function analyzeImageBuffer(buffer, originalName = "") {
  const meta = parseImageMeta(buffer);
  const name = String(originalName || "").toLowerCase();
  const reasons = [];

  if (!meta) {
    return {
      aiUsage: 0,
      level: "Low",
      note: "Unknown image format. Treated as real by default."
    };
  }

  const text = (meta.metadataText || "").toLowerCase();
  const pixels = decodePixels(buffer, meta.format);

  const strongAiMarkers = [
    "stable diffusion", "midjourney", "comfyui", "automatic1111", "invokeai", "dall-e",
    "negative prompt", "cfg scale", "model hash", "steps:", "sampler:", "seed:"
  ];
  const weakAiMarkers = [
    "generated by ai", "ai image", "text-to-image", "prompt:"
  ];

  const realCameraMarkers = [
    "canon", "nikon", "sony", "fujifilm", "apple", "iphone", "samsung",
    "xiaomi", "oppo", "huawei", "google pixel"
  ];

  const filenameAiHint =
    name.includes("ai") ||
    name.includes("generated") ||
    name.includes("midjourney") ||
    name.includes("sdxl");

  const hasStrongAi = containsAny(text, strongAiMarkers);
  const hasWeakAi = containsAny(text, weakAiMarkers);
  const hasRealCamera = containsAny(text, realCameraMarkers);
  const hasExif = !!meta.hasExif;
  const hasWatermarkHint = detectWatermarkHints(text, name);
  const hasBottomRightWatermark = hasBottomRightWatermarkHeuristic(pixels);

  if (hasStrongAi) reasons.push("Strong AI generation metadata detected.");
  if (filenameAiHint) reasons.push("Filename hints at AI-generated content.");
  if (hasRealCamera) reasons.push("Camera/device metadata detected.");
  if (hasExif) reasons.push("EXIF metadata detected.");
  if (hasWatermarkHint) reasons.push("Watermark marker detected.");
  if (hasBottomRightWatermark) reasons.push("Bottom-right watermark-like text detected.");

  // Strict binary decision:
  // 100 with watermark/text overlay signal or strong AI evidence, else 0.
  let aiUsage = 0;
  if (hasWatermarkHint || hasBottomRightWatermark) {
    aiUsage = 100;
  } else if (hasStrongAi) {
    aiUsage = 100;
  } else if (filenameAiHint && hasWeakAi && !hasRealCamera && !hasExif) {
    aiUsage = 100;
  }

  const level = aiUsage === 100 ? "High" : "Low";
  if (!reasons.length) reasons.push("No strong AI metadata found.");

  return {
    aiUsage,
    level,
    note: reasons.join(" ")
  };
}

module.exports = { analyzeImageBuffer };
