const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse-fixed");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

// --- CORS を完全許可 ---
app.use(cors());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// JSON 有効化
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ======/ingest=====
app.post("/ingest", upload.array("files"), async (req, res) => {
  try {
    const reports = [];

    for (const file of req.files) {
      if (file.mimetype === "application/pdf") {
        const pdfData = await pdfParse(file.buffer);
        const text = (pdfData.text || "").trim();
        if (text.length > 0) {
          reports.push({
            filename: file.originalname,
            text,
          });
        }
      }
    }

    if (reports.length === 0) {
      return res.json({
        ok: false,
        error: "有効な PDF テキストが読めませんでした",
      });
    }

    // GPT に投げるプロンプト作成 ----（省略）----

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: userPrompt,
    });

    const raw = response.output_text;
    let parsed = null;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {}

    res.json({
      ok: true,
      result: raw,
      reports: parsed?.reports || [],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ====== ポート ======
app.listen(10000, () => {
  console.log("Server running on port 10000");
});