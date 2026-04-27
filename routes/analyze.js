const express = require("express");
const multer = require("multer");
const fs = require("fs");
const detectAI = require("../utils/analyzer");
const { analyzeImageBuffer } = require("../utils/imageAnalyzer");
const { extractTextByType } = require("../utils/fileTextExtractor");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }
});

function cleanupFile(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err) console.warn("[Cleanup] Could not delete temp file:", filePath, err.message);
  });
}

function buildResponse(result) {
  const { aiUsage, level, note } = result;

  const suggestion =
    level === "Low"
      ? "Mostly human-written content. Looks good!"
      : level === "Medium"
      ? "Some AI patterns detected. Review and personalize the content."
      : "Heavy AI usage detected. Consider adding more originality and personal voice.";

  return {
    aiUsage,
    level,
    suggestion,
    declaration: `Estimated AI Usage: ${aiUsage}%`,
    breakdown: {
      ruleBasedScore: aiUsage,
      aiModelScore: null,
      reasoning: note || "Pattern-based analysis completed."
    }
  };
}

router.post("/", upload.single("file"), async (req, res) => {
  const tempPath = req.file?.path;

  try {
    const contentType = req.body.type || "text";
    let text = "";
    let analysisType = contentType;

    if (req.file) {
      const fileBuffer = fs.readFileSync(tempPath);

      if (contentType === "image") {
        const result = analyzeImageBuffer(fileBuffer, req.file.originalname);
        return res.json(buildResponse(result));
      }

      text = extractTextByType(fileBuffer, req.file.originalname, req.file.mimetype);
      if (!text || text.trim().length < 40) {
        return res.status(422).json({
          error: "Could not extract enough readable text from this file. Please upload a text-rich file or paste text directly."
        });
      }

      analysisType = "text";
    } else {
      text = (req.body.content || "").trim();
      if (!text) {
        return res.status(400).json({ error: "No content provided." });
      }
    }

    const result = detectAI(text, analysisType);
    res.json(buildResponse(result));
  } catch (err) {
    console.error("[Analyze Error]", err);
    res.status(500).json({ error: "Analysis failed. Please try again." });
  } finally {
    cleanupFile(tempPath);
  }
});

module.exports = router;
