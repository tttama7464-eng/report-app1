// server.js

const path = require("path");
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// 中間課題「人間のためのみち」の課題表と評価基準
const GRADING_PROMPT = `あなたは大学の授業「都市デザイン」のティーチングアシスタントです。
添付の PDF は学生が提出した中間課題のレポートです。文章だけでなく写真・スケッチなどの図も確認し、教員が最終判断するための「評価の下書き」を作成してください。

## 課題表
中間課題：「人間のためのみち」— 人間のための「みち」探し
「人間らしさ」がまちの表情に表れている「みち」を実際の都市空間の中から探してレポートする。
写真（又はスケッチ）、立地のレポートと、まちの表情をつくっているものが何なのか、何がデザインされているのかを分析してレポートにする（最低A4 1枚、pdf）。
写真は以前に撮ったものでも良いが、できれば最近自身で撮影したものを推奨。WEB写真やストリートビューなどから探した場合は出典を明示。スケッチやコラージュなど表現は自由。撮影時期も明示。
レポート冒頭に ①学籍番号 ②氏名 ③タイトル を明記。
ヒント：歩行空間、交通とランドスケープ（ヤン・ゲールに学ぶ）

## 評価基準
最も重要なのは「テーマについての論述」と「独創性」。
- S：テーマについての論述が深く、独創性が際立つ。授業で紹介したくなるレベル。
- A：テーマについてしっかり論述できている。ほとんどの学生はA。
- B：課題の最低限は満たしているが、テーマについての論述・独創性がAに届かない。
- C：空欄、内容が課題と全く関係ないなど、最低限が守れていないもののみ。
S〜Bは内容によるグラデーション。全体の分布の目安は「Aが最も多く、SとAを合わせて全体の約半分」。Sは本当に優れたものだけに付けること。
写真の出典・撮影時期の書き忘れなど形式面の不足は、それだけでCにはせず missing に書き出すこと。

## 出力
- student_id / name / title：レポート冒頭から読み取る。見つからなければ空文字。
- grade：S / A / B / C のいずれか。
- reason：その評価にした理由（150字以内、日本語）。テーマの論述と独創性に触れること。
- summary：レポートの要約（200字以内、日本語）。取り上げた「みち」の場所も含める。
- missing：課題表の要件のうち満たしていないもの（例：「撮影時期の記載なし」「立地の説明なし」「冒頭に学籍番号なし」）。なければ空配列。`;

const GRADING_SCHEMA = {
  type: "object",
  properties: {
    student_id: { type: "string" },
    name: { type: "string" },
    title: { type: "string" },
    grade: { type: "string", enum: ["S", "A", "B", "C"] },
    reason: { type: "string" },
    summary: { type: "string" },
    missing: { type: "array", items: { type: "string" } },
  },
  required: ["student_id", "name", "title", "grade", "reason", "summary", "missing"],
  additionalProperties: false,
};

// /grade に PDF を1件ずつ投げると、評価の下書きを返す
app.post("/grade", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.json({ ok: false, error: "ファイルがありません" });
    }

    // multer はファイル名を latin1 として扱うので UTF-8 に戻す
    const filename = Buffer.from(file.originalname, "latin1").toString("utf8");

    const isPdf =
      file.mimetype === "application/pdf" ||
      filename.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return res.json({ ok: false, error: "PDF ではありません", filename });
    }

    let pages = 0;
    try {
      pages = (await pdfParse(file.buffer)).numpages || 0;
    } catch (e) {
      console.error("pdf-parse error:", e.message);
    }

    const response = await client.responses.create({
      model: MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename,
              file_data: `data:application/pdf;base64,${file.buffer.toString("base64")}`,
            },
            {
              type: "input_text",
              text: `${GRADING_PROMPT}\n\n（参考）このPDFのページ数：${pages || "不明"}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "report_grading",
          schema: GRADING_SCHEMA,
          strict: true,
        },
      },
    });

    let draft;
    try {
      draft = JSON.parse(response.output_text || "");
    } catch (e) {
      console.error("JSON parse error:", e);
      console.error("RAW:", (response.output_text || "").slice(0, 500));
      return res.json({
        ok: false,
        error: "AIの返したJSONの解析に失敗しました",
        filename,
      });
    }

    res.json({ ok: true, draft: { ...draft, filename, pages } });
  } catch (err) {
    console.error("grade error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ビルド済みの画面（npm run build で dist/ にできる）も同じサーバーから返す
const DIST_DIR = path.join(__dirname, "dist");
app.use(express.static(DIST_DIR));
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(DIST_DIR, "index.html"), (err) => err && next());
});

const PORT = process.env.PORT || process.env.RENDER_INTERNAL_PORT || 8787;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
