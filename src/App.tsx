// API のベースURL
// ローカルでは http://localhost:8787
// 本番では Vercel の環境変数 VITE_API_BASE_URL から取る
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";
import React, { useState, useMemo } from "react";

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

export default function App() {
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

      const resp = await fetch(`${API_BASE_URL}/ingest`, {
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

  const selectedReport =
    reports.find((r) => r.index === selectedIndex) || null;

  // テーマごとの件数（ざっくり表示用）
  const themeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => {
      const key = r.theme || "未分類";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}件`)
      .join(" / ");
  }, [reports]);

  const gradeSummary = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    reports.forEach((r) => {
      if (r.grade === "A" || r.grade === "B" || r.grade === "C") {
        counts[r.grade]++;
      }
    });
    return `A:${counts.A} / B:${counts.B} / C:${counts.C}`;
  }, [reports]);

  return (
    <div
      style={{
        padding: 20,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <h1>レポート評価アプリ（試作 v1）</h1>

      {/* アップロード */}
      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 6,
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>
          PDF をまとめて取り込み → 自動で A/B/C 評価＋テーマ分類
        </div>

        <input id="ing-files" type="file" multiple accept="application/pdf" />
        <button
          style={{ marginLeft: 8 }}
          onClick={handleIngest}
          disabled={busy}
        >
          {busy ? "解析中…" : "取り込む"}
        </button>

        <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          ※ 最大10件まで解析。スキャンPDFなど、文字として認識できないものはエラーになります。
        </div>
      </div>

      {/* 結果テーブル */}
      {reports.length > 0 && (
        <>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: "bold" }}>
              解析結果：{reports.length}件
            </div>
            <div style={{ fontSize: 12, color: "#555" }}>
              <div>テーマ分布：{themeSummary}</div>
              <div>評価分布：{gradeSummary}</div>
            </div>
          </div>

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
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    #
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    評価
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    タイトル
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    テーマ
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    ファイル名
                  </th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: 6 }}>
                    要約（冒頭）
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const bg = GRADE_COLORS[r.grade] || "transparent";
                  return (
                    <tr
                      key={r.index}
                      style={{
                        background:
                          selectedIndex === r.index ? "#fffde7" : bg,
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedIndex(r.index)}
                    >
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: 6,
                        }}
                      >
                        {r.index}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: 6,
                        }}
                      >
                        {r.grade}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: 6,
                        }}
                      >
                        {r.title}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: 6,
                        }}
                      >
                        {r.theme}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: 6,
                        }}
                      >
                        {r.filename}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: 6,
                          color: "#555",
                        }}
                      >
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

          {/* 詳細パネル */}
          <div
            style={{
              marginTop: 24,
              border: "1px solid #eee",
              borderRadius: 6,
              padding: 12,
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
                <div
                  style={{
                    fontSize: 13,
                    marginBottom: 8,
                    whiteSpace: "pre-wrap",
                  }}
                >
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
        </>
      )}
    </div>
  );
}