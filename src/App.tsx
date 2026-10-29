import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Grade = "S" | "A" | "B" | "C";

const GRADES: Grade[] = ["S", "A", "B", "C"];

// AI が PDF を読んだ結果
type Result = {
  id: string;
  filename: string;
  name: string;
  // 先生が入力する出席番号（未入力は null）
  number: number | null;
  grade: Grade;
  summary: string;
};

// 開発中は別ポートのサーバー、本番は画面と同じサーバー（server.js が画面も返す）
const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL || "http://localhost:8787"
  : "";

type AppState = {
  assignmentName: string;
  submitted: number[];
  results: Result[];
};

const STORAGE_KEY = "report-app:v1";

const EMPTY_STATE: AppState = {
  assignmentName: "",
  submitted: [],
  results: [],
};

type OldDraft = { id: string; filename: string; name: string; grade: Grade; summary: string };

function toResult(d: OldDraft, number: number | null): Result {
  return { id: d.id, filename: d.filename, name: d.name, number, grade: d.grade, summary: d.summary };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const saved = JSON.parse(raw);
    // 以前の形式（drafts / pendingDrafts）で保存された AI の結果を引き継ぐ
    const results: Result[] = saved.results ?? [
      ...Object.entries((saved.drafts ?? {}) as Record<string, OldDraft>).map(([n, d]) =>
        toResult(d, Number(n))
      ),
      ...((saved.pendingDrafts ?? []) as OldDraft[]).map((d) => toResult(d, null)),
    ];
    return {
      assignmentName: saved.assignmentName ?? "",
      submitted: saved.submitted ?? [],
      results,
    };
  } catch {
    return EMPTY_STATE;
  }
}

// "236343 236350, 236401" のような入力を番号の配列にする
function parseNumbers(input: string): { numbers: number[]; invalid: string[] } {
  const numbers: number[] = [];
  const invalid: string[] = [];
  const normalized = input.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  for (const token of normalized.split(/[\s,、，]+/).filter(Boolean)) {
    if (/^\d+$/.test(token) && Number(token) > 0) numbers.push(Number(token));
    else invalid.push(token);
  }
  return { numbers, invalid };
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  // Excel で文字化けしないよう BOM を付ける
  const blob = new Blob(["﻿" + csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<"submission" | "grading">("submission");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = (patch: Partial<AppState>) =>
    setState((s) => ({ ...s, ...patch }));

  const submittedSet = useMemo(() => new Set(state.submitted), [state.submitted]);

  const sortNumbers = (numbers: number[]) =>
    [...new Set(numbers)].sort((a, b) => a - b);

  const resetAll = () => {
    if (confirm("提出記録・AIの評価をすべて消去します。よろしいですか？")) {
      setState(EMPTY_STATE);
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [["出席番号", "名前", "AIの評価", "要約", "ファイル名"]];
    const sorted = [...state.results].sort(
      (a, b) => (a.number ?? Infinity) - (b.number ?? Infinity)
    );
    for (const r of sorted) {
      rows.push([r.number ? String(r.number) : "", r.name, r.grade, r.summary, r.filename]);
    }
    downloadCsv(`${state.assignmentName || "レポート"}_AI評価.csv`, rows);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>レポート提出・評価管理</h1>
        <div className="header-fields">
          <label>
            課題名
            <input
              type="text"
              value={state.assignmentName}
              placeholder="例：第3回レポート"
              onChange={(e) => update({ assignmentName: e.target.value })}
            />
          </label>
          <button className="secondary" onClick={exportCsv}>
            CSV出力
          </button>
          <button className="danger" onClick={resetAll}>
            リセット
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={tab === "submission" ? "active" : ""}
          onClick={() => setTab("submission")}
        >
          ① 提出チェック
        </button>
        <button
          className={tab === "grading" ? "active" : ""}
          onClick={() => setTab("grading")}
        >
          ② 評価（S/A/B/C）
        </button>
      </nav>

      {tab === "submission" ? (
        <SubmissionTab
          submitted={state.submitted}
          submittedSet={submittedSet}
          onAdd={(nums) => update({ submitted: sortNumbers([...state.submitted, ...nums]) })}
          onRemove={(n) => update({ submitted: state.submitted.filter((x) => x !== n) })}
        />
      ) : (
        <GradingTab
          results={state.results}
          onAdd={(result) => setState((s) => ({ ...s, results: [...s.results, result] }))}
          onNumber={(id, number) =>
            setState((s) => ({
              ...s,
              results: s.results.map((r) => (r.id === id ? { ...r, number } : r)),
              // 出席番号を入れたら ① の提出者にも加える
              submitted: number ? sortNumbers([...s.submitted, number]) : s.submitted,
            }))
          }
          onRemove={(id) =>
            setState((s) => ({ ...s, results: s.results.filter((r) => r.id !== id) }))
          }
        />
      )}
    </div>
  );
}

function SubmissionTab(props: {
  submitted: number[];
  submittedSet: Set<number>;
  onAdd: (nums: number[]) => void;
  onRemove: (n: number) => void;
}) {
  const { submitted, submittedSet } = props;
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAdd = () => {
    const { numbers, invalid } = parseNumbers(input);
    const notes: string[] = [];
    const dup = numbers.filter((n) => submittedSet.has(n));
    if (dup.length) notes.push(`登録済み: ${[...new Set(dup)].join(", ")}`);
    if (invalid.length) notes.push(`読み取れない入力: ${invalid.join(" ")}`);
    const added = numbers.filter((n) => !submittedSet.has(n));
    if (added.length) props.onAdd(added);
    setMessage(
      [added.length ? `${new Set(added).size}件追加しました` : "", ...notes]
        .filter(Boolean)
        .join(" ／ ")
    );
    setInput(invalid.join(" "));
  };

  const copySubmitted = async () => {
    try {
      await navigator.clipboard.writeText(submitted.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("コピーできませんでした");
    }
  };

  return (
    <section>
      <div className="card">
        <h2>提出した出席番号を入力</h2>
        <p className="hint">スペース・カンマ・改行区切りでまとめて入力できます。</p>
        <div className="input-row">
          <textarea
            value={input}
            rows={2}
            placeholder="例：236343 236350 236401"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button className="primary" onClick={handleAdd} disabled={!input.trim()}>
            追加
          </button>
        </div>
        {message && <p className="message">{message}</p>}
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>提出者（番号順）：{submitted.length}人</h2>
          {submitted.length > 0 && (
            <button className="secondary small" onClick={copySubmitted}>
              {copied ? "コピーしました" : "コピー"}
            </button>
          )}
        </div>
        {submitted.length === 0 ? (
          <p className="hint">出席番号を入力すると、ここに番号順で並びます。</p>
        ) : (
          <>
            <p className="hint">入力ミスは × で削除できます。</p>
            <ol className="submitted-list">
              {submitted.map((n) => (
                <li key={n}>
                  <span className="submitted-num">{n}</span>
                  <button
                    className="link danger"
                    title="削除"
                    onClick={() => props.onRemove(n)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}

function GradingTab(props: {
  results: Result[];
  onAdd: (result: Result) => void;
  onNumber: (id: string, number: number | null) => void;
  onRemove: (id: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const run = async () => {
    const targets = files;
    setErrors([]);
    setProgress({ done: 0, total: targets.length });
    // 1件ずつ送る（サーバーのタイムアウト対策）
    for (let i = 0; i < targets.length; i++) {
      const file = targets[i];
      const fd = new FormData();
      fd.append("file", file);
      try {
        const resp = await fetch(`${API_BASE_URL}/grade`, { method: "POST", body: fd });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || String(resp.status));
        const d = data.draft;
        props.onAdd({
          id: `${Date.now()}-${i}-${file.name}`,
          filename: d.filename ?? file.name,
          name: d.name ?? "",
          number: null,
          grade: GRADES.includes(d.grade) ? d.grade : "B",
          summary: d.summary ?? "",
        });
      } catch (e) {
        setErrors((prev) => [...prev, `${file.name}：${e instanceof Error ? e.message : e}`]);
      }
      setProgress({ done: i + 1, total: targets.length });
    }
    setFiles([]);
    setProgress(null);
  };

  const busy = progress !== null;

  return (
    <section>
      <div className="card">
        <h2>PDFをAIで読み込む</h2>
        <p className="hint">
          提出されたPDFをまとめて選ぶと、AIが1件ずつ読んで評価（S/A/B/C）と要約を出します。1件あたり数円程度の利用料がかかります。
        </p>
        <div className="input-row file-row">
          <input
            type="file"
            multiple
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            key={busy ? "busy" : "idle"}
          />
          <button className="primary" onClick={run} disabled={busy || files.length === 0}>
            {busy
              ? `読んでいます… ${progress.done}/${progress.total}`
              : `AIに読ませる${files.length ? `（${files.length}件）` : ""}`}
          </button>
        </div>
        {errors.length > 0 && (
          <ul className="errors">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>結果：{props.results.length}件</h2>
        {props.results.length === 0 ? (
          <p className="hint">AIに読ませると、ここに結果が並びます。</p>
        ) : (
          <ul className="result-list">
            {props.results.map((r) => (
              <li key={r.id}>
                <div className="result-head">
                  <span className={`badge grade-${r.grade}`}>{r.grade}</span>
                  <span className="result-name">{r.name || r.filename}</span>
                  <input
                    type="number"
                    min={1}
                    className="result-number"
                    placeholder="出席番号"
                    defaultValue={r.number ?? ""}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      const number = Number.isInteger(n) && n > 0 ? n : null;
                      if (number !== r.number) props.onNumber(r.id, number);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                  <button
                    className="link danger"
                    title="この結果を削除"
                    onClick={() => confirm("この結果を削除しますか？") && props.onRemove(r.id)}
                  >
                    ×
                  </button>
                </div>
                <p className="result-summary">{r.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
