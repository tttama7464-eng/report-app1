// server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse-fixed");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();

// CORS（なんでも許可）
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// /ingest に PDF をまとめて投げる
app.post("/ingest", upload.array("files", 50), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.json({ ok: false, error: "ファイルがありません" });
    }

    const reports = [];

    for (const file of files) {
      // PDF だけ対象
      const isPdf =
        file.mimetype === "application/pdf" ||
        file.originalname.toLowerCase().endsWith(".pdf");

      if (!isPdf) continue;

      const pdfData = await pdfParse(file.buffer);
      const text = (pdfData.text || "").trim();

      if (!text) continue;

      reports.push({
        filename: file.originalname,
        text,
      });
    }

    if (!reports.length) {
      return res.json({
        ok: false,
        error: "PDF からテキストが読み取れませんでした（スキャン画像かも）",
      });
    }

    // 最大10件まで
    const limited = reports.slice(0, 10);

    // GPTへのプロンプト
    const userPrompt =
      `あなたは大学の授業を手伝うティーチングアシスタントです。\n` +
      `これから最大10件のレポート本文を与えます。\n` +
      `各レポートごとに以下の情報を出してください。\n\n` +
      `1. title: レポートの内容から推測されるタイトル（30文字以内、日本語）\n` +
      `2. theme: 次のどれか1つ（必要なら「その他（○○）」のように括弧内に説明）\n` +
      `   - 都市デザイン・空間構造\n` +
      `   - 社会・文化論\n` +
      `   - 心理・認知\n` +
      `   - 芸術・表現\n` +
      `   - メディア・技術\n` +
      `   - 歴史・思想・倫理\n` +
      `   - その他（理由付き）\n` +
      `3. grade: "A" | "B" | "C"\n` +
      `   - A = 授業で紹介したくなるレベルでとても優秀\n` +
      `   - B = 普通、よく頑張っている\n` +
      `   - C = 浅い／論点がずれている／整理不足\n` +
      `4. summary: 要約（300字以内、日本語）\n` +
      `5. points: 重要ポイントを日本語で5つ（配列）\n\n` +
      `必ず次の JSON 形式だけ を返してください。余計な文章は一切書かないでください。\n\n` +
      `{\n` +
      `  "reports": [\n` +
      `    {\n` +
      `      "index": 1,\n` +
      `      "filename": "～～.pdf",\n` +
      `      "title": "…",\n` +
      `      "theme": "…",\n` +
      `      "grade": "A",\n` +
      `      "summary": "…",\n` +
      `      "points": ["…", "…", "…", "…", "…"]\n` +
      `    }\n` +
      `  ]\n` +
      `}\n\n` +
      `=== レポート本文 ===\n` +
      limited
        .map(
          (r, i) =>
            `[REPORT ${i + 1}]\nfilename: ${r.filename}\n本文:\n${r.text}\n`
        )
        .join("\n");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: userPrompt,
    });

    const raw = (response.output_text || "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse error:", e);
      console.error("RAW:", raw.slice(0, 500));
      return res.json({
        ok: false,
        error: "AIの返したJSONの解析に失敗しました",
        result: raw,
      });
    }

    const reportsResult = Array.isArray(parsed.reports) ? parsed.reports : [];

    res.json({
      ok: true,
      reports: reportsResult,
    });
  } catch (err) {
    console.error("ingest error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 一番下のほう

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ★ ここだけ変える
const PORT = process.env.PORT || process.env.RENDER_INTERNAL_PORT || 8787;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});