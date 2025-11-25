import React, { useState, useMemo } from "react";

type Report = {
  index: number;
  filename: string;
  title: string;
  theme: string;
  grade: string;
  summary: string;
  points: string[];
};

const GRADE_COLORS: Record<string, string> = {
  A: "#e3f2fd",
  B: "#e8f5e9",
  C: "#ffebee",
};

// ★ ここが重要：環境変数があれば使う、なければ localhost
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export default function App() {
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // =============================
  // PDF を投げる（ここを修正版にした）
  // =============================
  const handleIngest = async () => {
    const el = document.getElementById("ing-files") as HTMLInputElement | null;
    if (!el || !el.files?.length) {
      alert("ファイルが選ばれていません");
      return;
    }

    const fd = new FormData();
    Array.from(el.files).forEach((f) => fd.append("files", f));

    try {
      setBusy(true);

      // ★ API_BASE_URL をここに反映している
      const resp = await fetch(`${API_BASE_URL}/ingest`, {
        method: "POST",
        body: fd,
      });

      const data = await resp.json();

      if (!data.ok) {
        alert("取り込みに失敗しました: " + (data.error || resp.status));
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
      alert("エラー発生: " + String(e));
    } finally {
      setBusy(false);
      const input = document.getElementById("ing-files") as HTMLInputElement;
      if (input) input.value = "";
    }
  };

  const selectedReport =
    reports.find((r) => r.index === selectedIndex) || null;

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
      counts[r.grade] = (counts[r.grade] ?? 0) + 1;
    }
  });

  return `A:${counts.A} / B:${counts.B} / C:${counts.C}`;
}, [reports]);
  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>レポート評価アプリ（試作 v1）</h1>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee" }}>
        <b>PDF をまとめて取り込み → 自動で A/B/C 評価＋テーマ分類</b>
        <br />
        <input id="ing-files" type="file" multiple accept="application/pdf" />
        <button style={{ marginLeft: 8 }} onClick={handleIngest} disabled={busy}>
          {busy ? "解析中…" : "取り込む"}
        </button>
        <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
          ※ 最大10件まで解析。スキャンPDFなどは文字として認識できない場合があります。
        </div>
      </div>

      {/* 結果テーブル */}
      {reports.length > 0 && (
        <>
          {/* 省略：ここから先は前と同じテーブル・詳細表示 */}
          {/* ↓↓↓ ここは変えていないのでそのまま使えるよ ↓↓↓ */}
          {/* --- 既存の一覧テーブル & 詳細表示コードを続けて貼り付けてOK --- */}
        </>
      )}
    </div>
  );
}