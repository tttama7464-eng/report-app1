import React, { useState } from "react";

type KlassResult = { ok: boolean; theme: string; reason: string; confidence?: number; };

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<KlassResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function classify() {
    setErrMsg("");
    setResult(null);
    if (!text.trim()) return;
    setBusy(true);
    try {
      const resp = await fetch("http://localhost:8787/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "unknown");
      setResult({ ok: true, theme: data.theme, reason: data.reason, confidence: data.confidence });
    } catch (e: any) {
      setErrMsg(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 840, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>report-app</h1>
      <p style={{ color: "#0a0" }}>フロントは動いてる ✅</p>
      <hr style={{ margin: "16px 0" }} />
      <label style={{ fontWeight: 600 }}>本文（ペースト可）</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ここに学生レポート本文を貼り付け…"
        style={{ width: "100%", height: 180, marginTop: 8 }}
      />
      {/* === PDF / 画像 まとめ投入 (MVP) === */}
<div style={{marginTop: 20, padding: 12, border: "1px solid #eee", borderRadius: 8}}>
  <div style={{fontWeight: 600, marginBottom: 8}}>PDF / 画像をまとめて取り込み</div>
  <input id="ing-files" type="file" accept="application/pdf,image/*" multiple />
  <button
    style={{marginLeft: 8}}
    onClick={async () => {
      const el = document.getElementById("ing-files") as HTMLInputElement;
      if (!el || !el.files?.length) { alert("ファイルが選ばれていません"); return; }
      const fd = new FormData();
      Array.from(el.files).forEach(f => fd.append("files", f));
      try {
        const resp = await fetch("http://localhost:8787/ingest", { method: "POST", body: fd });
        const data = await resp.json();
        if (!data?.ok) { alert("取り込み失敗: " + (data?.error || resp.status)); return; }
        // ざっくり結果を画面に貼る（必要なら整形）
        const lines = data.top10.map((r:any,i:number)=>
          `${i+1}. ${r.id||"?"} ${r.title} / ${r.theme} / ${r.grade}`
        ).join("\n");
        alert(`取り込みOK: ${data.count}件\n上位10\n${lines}`);
      } catch (e:any) {
        alert("取り込みエラー: " + (e?.message || String(e)));
      } finally {
        (document.getElementById("ing-files") as HTMLInputElement).value = "";
      }
    }}
  >取り込む</button>
  <div style={{fontSize:12, color:"#666", marginTop:8}}>
    ※PDFはテキスト抽出。画像は暫定でOCR無し（必要なら後で追加）。
  </div>
</div>
      <div style={{ marginTop: 12 }}>
        <button onClick={classify} disabled={busy || !text.trim()} style={{ padding: "8px 16px", borderRadius: 8 }}>
          {busy ? "分類中…" : "分類する"}
        </button>
      </div>
      {errMsg && <p style={{ color: "crimson", marginTop: 12 }}>分類エラー: {errMsg}</p>}
      {result && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "#fafafa" }}>
          <div><b>テーマ</b>: {result.theme}</div>
          <div style={{ marginTop: 6 }}><b>理由</b>: {result.reason}</div>
          {typeof result.confidence === "number" && <div style={{ marginTop: 6 }}><b>確信度</b>: {result.confidence}</div>}
        </div>
      )}
    </div>
  );
}