// server.js

const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse-fixed"); // ← ここポイント
const OpenAI = require("openai");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors()); // フロント(5173)→サーバー(8787) 用

const upload = multer({ storage: multer.memoryStorage() });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// /ingest に PDF をまとめて投げる
app.post("/ingest", upload.array("files"), async (req, res) => {
  try {
    // まず PDF だけを抜き出してテキスト化
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
      } else if (file.mimetype.startsWith("image/")) {
        // 今はスキップ（必要になったら OCR を足す）
      }
    }

    if (reports.length === 0) {
      return res.json({
        ok: false,
        error: "有効な PDF テキストが見つかりませんでした。",
      });
    }

    // 最大10件までに制限
    const limited = reports.slice(0, 10);

    // モデルに投げるプロンプトを組み立て
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
  `   評価基準:\n` +
  `   A評価（授業で紹介したいレベルで優秀）:\n` +
  `     - 要約が正確、理解が深い\n` +
  `     - 論点が明確でテーマに正しく向き合っている\n` +
  `     - 独自性や深い考察がある\n` +
  `     - 論理構造が整っていて読みやすい\n` +
  `     - 他学生に例として紹介したいレベル\n` +
  `   B評価（普通・よくがんばったね）:\n` +
  `     - 内容理解は概ね正しい\n` +
  `     - 要点はまとめられている\n` +
  `     - 誤解は一部あるが致命的ではない\n` +
  `     - レポートとして成立している\n` +
  `   C評価（浅い・論点ズレ・微妙）:\n` +
  `     - 要約が不十分 or 誤解がある\n` +
  `     - 論点がズレている or 曖昧\n` +
  `     - 考察が浅い／具体性がない\n` +
  `     - 文章構成が弱い or 読みにくい\n` +
  `     - 最低限の基準を満たしていない\n` +

  `4. summary: 要約（300字以内、日本語）\n` +
  `5. points: 重要ポイントを日本語で5つ（配列）\n` +
  `6. reason: なぜその評価になったのか（150字以内）\n\n` +

  `必ず **次の JSON 形式だけ** を返してください。\n` +
  `他の文章は一切書かないでください。\n\n` +
  `{\n` +
  `  "reports": [\n` +
  `    {\n` +
  `      "index": 1,\n` +
  `      "filename": "～～.pdf",\n` +
  `      "title": "…",\n` +
  `      "theme": "…",\n` +
  `      "grade": "A",\n` +
  `      "summary": "…",\n` +
  `      "points": ["…", "…", "…", "…", "…"],\n` +
  `      "reason": "…"\n` +
  `    }\n` +
  `  ]\n` +
  `}\n\n` +
  `=== レポート本文 ===\n` +
  limited
    .map(
      (r, i) =>
        `\n[REPORT ${i + 1}]\nfilename: ${r.filename}\n本文:\n${r.text}\n`
    )
    .join("\n");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: userPrompt,
    });

    const raw = response.output_text;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse error:", e);
    }

    const reportsResult = parsed && Array.isArray(parsed.reports)
      ? parsed.reports
      : [];

    res.json({
      ok: true,
      result: raw,          // 生テキスト（デバッグ用）
      reports: reportsResult, // フロント用（最大10件）
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(8787, () => {
  console.log("Classifier API on http://localhost:8787");
});