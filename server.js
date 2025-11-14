import dotenv from "dotenv";
dotenv.config();   // ← 必ず一番上！！

import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs/promises";
import OpenAI from "openai";
import pdfParse from "pdf-parse-fixed";

console.log("ENV KEY:", process.env.OPENAI_API_KEY);  // ここに値が出てればOK

const app = express();
const PORT = 8787;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// アップロード先
const upload = multer({ dest: "uploads/" });

// OpenAI クライアント（環境変数読む）
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ingest
app.post("/ingest", upload.array("files"), async (req, res) => {
  try {
    const results = [];

    for (const file of req.files) {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(dataBuffer);

      const completion = await client.responses.create({
        model: "gpt-4.1-mini",
        input: `以下の文章を要約し、重要ポイントを抽出してください：\n\n${pdfData.text}`,
      });

      results.push({
        id: file.filename,
        title: file.originalname,
        theme: completion.output_text,
        grade: completion.usage.total_tokens,
      });
    }

    res.json({ ok: true, count: results.length, top10: results });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Classifier API on http://localhost:${PORT}`);
});