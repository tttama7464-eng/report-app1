// src/App.tsx
import React, { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Report = {
  index: number;
  filename: string;
  title: string;
  theme: string;
  grade: string; // "A" | "B" | "C"
  summary: string;
  points: string[];
};

const GRADE_COLORS: Record<string, string> = {
  A: "#e3f2fd", // 水色
  B: "#e8f5e9", // 薄い緑
  C: "#ffebee", // 薄い赤
};

const PIE_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8a65",
  "#4db6ac",
  "#ba68c8",
  "#90a4ae",
];

export default function App() {
  // ---- 状態 ----
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // ---- PDF 取り込み ----
  const handleIngest = async () => {
    const el = document.getElementById("ing-files") as HTMLInputElement | null;

    if (!el || !el.files || !el.files.length) {
      alert("ファイルが選ばれていません");
      return;
    }

    const fd = new FormData();
    Array.from(el.files).forEach((f) => fd.append("files", f));

    try {
      setBusy(true);

      const resp = await fetch("http://localhost:8787/ingest", {
        method: "POST",
        body: fd,
      });

      const data = await resp.json();
      if (!data.ok) {
        alert("取り込み失敗: " + (data.error || resp.status));
        return;
      }

      const newReports: Report[] = (data.reports || []).map(
        (r: any, idx: number) => ({
          index: r.index ?? idx + 1,
          filename: r.filename ?? "",
          title: r.title ?? "",
          theme: r.theme ?? "",
          grade: r.grade ?? "",
          summary: r.summary ?? "",
          points: Array.isArray(r.points) ? r.points : [],
        })
      );

      setReports(newReports);
      setSelectedIndex(newReports.length ? newReports[0].index : null);
    } catch (e: any) {
      alert("取り込みエラー: " + String(e));
    } finally {
      setBusy(false);
      const input = document.getElementById("ing-files") as HTMLInputElement;
      if (input) input.value = "";
    }
  };

  // ---- 集計（テーマ別） ----
  const themeData = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => {
      const key = r.theme || "未分類";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [reports]);

  // ---- 集計（評価別） ----
  const gradeData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    reports.forEach((r) => {
      if (r.grade === "A" || r.grade === "B" || r.grade === "C") {
        counts[r.grade]++;
      }
    });
    return Object.entries(counts).map(([grade, value]) => ({ grade, value }));
  }, [reports]);

  const selectedReport =
    reports.find((r) => r.index === selectedIndex) || null;

  // =========================
  // CSV 出力
  // =========================
  const handleExportCSV = () => {
    if (!reports.length) {
      alert("まだレポートがありません");
      return;
    }

    const header = [
      "index",
      "filename",
      "title",
      "theme",
      "grade",
      "summary",
      "points",
    ];

    const rows = reports.map((r) => [
      r.index,
      r.filename,
      r.title,
      r.theme,
      r.grade,
      r.summary.replace(/\r?\n/g, " "),
      r.points.join(" / "),
    ]);

    const csv =
      header.join(",") +
      "\n" +
      rows
        .map((cols) =>
          cols
            .map((v) => {
              const s = String(v ?? "");
              return `"${s.replace(/"/g, '""')}"`;
            })
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    a.href = url;
    a.download = `reports-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================
  // PDF 出力（印刷→PDF保存）
  // =========================
  const handleExportPDF = () => {
    if (!reports.length) {
      alert("まだレポートがありません");
      return;
    }

    const w = window.open("", "_blank");
    if (!w) {
      alert("ポップアップがブロックされました（ブラウザ設定を確認してください）");
      return;
    }

    const htmlRows = reports
      .map(
        (r) => `
        <tr>
          <td>${r.index}</td>
          <td>${r.filename}</td>
          <td>${r.title}</td>
          <td>${r.theme}</td>
          <td>${r.grade}</td>
          <td>${r.summary}</td>
        </tr>
      `
      )
      .join("");

    w.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>レポート評価一覧</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>レポート評価一覧</h1>
          <p>件数: ${reports.length}</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ファイル名</th>
                <th>タイトル</th>
                <th>テーマ</th>
                <th>評価</th>
                <th>要約</th>
              </tr>
            </thead>
            <tbody>
              ${htmlRows}
            </tbody>
          </table>
        </body>
      </html>
    `);

    w.document.close();
    w.focus();
    w.print();
  };

    // ---- UI -------------------------------------------------
  return (
    <div
      style={{
        padding: 20,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <h1>レポート評価アプリ（試作）</h1>

      {/* アップロードブロック */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 6,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>
          PDFをまとめて取り込み → 要約＋重要ポイント＋A/B/C評価＋テーマ分類
        </div>

        <input
          id="ing-files"
          type="file"
          multiple
          accept="application/pdf"
        />
        <button
          style={{ marginLeft: 8 }}
          onClick={handleIngest}
          disabled={busy}
        >
          {busy ? "解析中…" : "取り込む"}
        </button>

        <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          ※ 最大10件まで解析。画像は現状非対応（必要ならOCR追加）。
        </div>
      </div>

      {/* 一覧テーブル & ボタン */}
      {reports.length > 0 && (
        <div>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              解析結果：{reports.length}件
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleExportCSV}>CSVダウンロード</button>
              <button onClick={handleExportPDF}>PDFレポート生成</button>
            </div>
          </div>

          {/* テーブル */}
          <div
            style={{
              marginTop: 12,
              border: "1px solid #eee",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>#</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>評価</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>タイトル</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>テーマ</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>ファイル名</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>要約（冒頭）</th>
                </tr>
              </thead>

              <tbody>
                {reports.map((r) => {
                  const bg = GRADE_COLORS[r.grade] || "transparent";
                  return (
                    <tr
                      key={r.index}
                      style={{
                        background: selectedIndex === r.index ? "#fffde7" : bg,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedIndex(r.index)}
                    >
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        {r.index}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        {r.grade}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        {r.title}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        {r.theme}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                        {r.filename}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 6, color: "#555" }}>
                        {r.summary.length > 60
                          ? r.summary.slice(0, 60) + "…"
                          : r.summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 下段：詳細 & グラフ */}
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
              gap: 24,
            }}
          >
            {/* 詳細パネル */}
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 6,
                padding: 12,
                minHeight: 200,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                選択中のレポート詳細
              </div>

              {selectedReport ? (
                <>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <b>タイトル:</b> {selectedReport.title}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <b>ファイル名:</b> {selectedReport.filename}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    <b>テーマ:</b> {selectedReport.theme}
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    <b>評価:</b> {selectedReport.grade}
                  </div>

                  <div style={{ fontSize: 13, marginBottom: 8, whiteSpace: "pre-wrap" }}>
                    <b>要約:</b>
                    <br />
                    {selectedReport.summary}
                  </div>

                  <div style={{ fontSize: 13 }}>
                    <b>重要ポイント:</b>
                    <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                      {selectedReport.points.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "#777" }}>
                  テーブルからレポートを選択するとここに詳細が表示されます。
                </div>
              )}
            </div>

            {/* グラフ */}
            <div
              style={{
                border: "1px solid #eee",
                borderRadius: 6,
                padding: 12,
                minHeight: 200,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                テーマ分布 & 評価分布
              </div>

              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      dataKey="value"
                      data={themeData}
                      innerRadius={30}
                      outerRadius={60}
                      label
                    >
                      {themeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ height: 160, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="grade" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value">
                      {gradeData.map((entry, index) => (
                        <Cell
                          key={`bar-${index}`}
                          fill={
                            entry.grade === "A"
                              ? "#42a5f5"
                              : entry.grade === "B"
                              ? "#66bb6a"
                              : "#ef5350"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}