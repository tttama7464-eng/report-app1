import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Grade = "S" | "A" | "B" | "C";

const GRADES: Grade[] = ["S", "A", "B", "C"];

// AI が PDF を読んだ結果
type Result = {
  id: string;
  filename: string;
  name: string;
  // 出席番号（例：236A343）。読み取れなかったときは null
  studentNo: string | null;
  grade: Grade;
  summary: string;
};

// 開発中は別ポートのサーバー、本番は画面と同じサーバー（server.js が画面も返す）
const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL || "http://localhost:8787"
  : "";

type AppState = {
  assignmentName: string;
  // 提出者の出席番号（番号順）
  submitted: string[];
  results: Result[];
};

const STORAGE_KEY = "report-app:v1";
const PASSWORD_KEY = "report-app:password";

function savedPassword(): string {
  try {
    return localStorage.getItem(PASSWORD_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePassword(password: string) {
  try {
    if (password) localStorage.setItem(PASSWORD_KEY, password);
    else localStorage.removeItem(PASSWORD_KEY);
  } catch {
    // 保存できなくても、その画面を開いている間は使える
  }
}

// 日本語の合言葉も送れるよう、ヘッダーに入れる前にエンコードする
const authHeaders = (password: string) => ({
  "X-App-Password": encodeURIComponent(password),
});

async function checkPassword(password: string): Promise<{ required: boolean; ok: boolean }> {
  const resp = await fetch(`${API_BASE_URL}/auth`, { headers: authHeaders(password) });
  return resp.json();
}

const EMPTY_STATE: AppState = {
  assignmentName: "",
  submitted: [],
  results: [],
};

// 出席番号は「英字1文字を含む7文字」（例：236A343）
const STUDENT_NO = /^(?=[0-9]*[A-Z][0-9]*$)[0-9A-Z]{7}$/;
// 番号の途中に入りうる区切り文字（23-6A343、236 A343 など）
const SEPARATOR = /[-‐ー−_\s.・]/;

// 全角→半角・大文字にそろえる
function normalize(text: string): string {
  return text.normalize("NFKC").toUpperCase();
}

// 1つの入力（例："23-6a343"）を出席番号の形にそろえる。形式が違えば null
function toStudentNo(token: string): string | null {
  const s = normalize(token).replace(new RegExp(SEPARATOR, "g"), "");
  return STUDENT_NO.test(s) ? s : null;
}

// ファイル名などの文章から出席番号を探す。区切り文字が間に入っていてもよい
function findStudentNo(text: string): string | null {
  const s = normalize(text);
  const isAlnum = (c: string | undefined) => !!c && /[0-9A-Z]/.test(c);
  for (let start = 0; start < s.length; start++) {
    if (!isAlnum(s[start]) || isAlnum(s[start - 1])) continue;
    let picked = "";
    let i = start;
    while (i < s.length && picked.length < 7) {
      if (isAlnum(s[i])) {
        picked += s[i++];
      } else if (SEPARATOR.test(s[i]) && picked && isAlnum(s[i + 1])) {
        i++;
      } else {
        break;
      }
    }
    if (picked.length === 7 && !isAlnum(s[i]) && STUDENT_NO.test(picked)) return picked;
  }
  return null;
}

const compareNo = (a: string, b: string) =>
  a.localeCompare(b, "ja", { numeric: true });

const sortNos = (nos: string[]) => [...new Set(nos)].sort(compareNo);

type OldDraft = { id: string; filename: string; name: string; grade: Grade; summary: string };

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const saved = JSON.parse(raw);
    // 以前の形式（drafts / pendingDrafts、number）で保存されたデータを引き継ぐ
    const oldResults = (saved.results ?? [
      ...Object.entries((saved.drafts ?? {}) as Record<string, OldDraft>).map(([n, d]) => ({
        ...d,
        number: n,
      })),
      ...((saved.pendingDrafts ?? []) as OldDraft[]),
    ]) as (OldDraft & { studentNo?: string | null; number?: number | string | null })[];
    const results: Result[] = oldResults.map((r) => ({
      id: r.id,
      filename: r.filename,
      name: r.name,
      studentNo: r.studentNo ?? (r.number != null ? String(r.number) : null),
      grade: r.grade,
      summary: r.summary,
    }));
    return {
      assignmentName: saved.assignmentName ?? "",
      submitted: sortNos(((saved.submitted ?? []) as (number | string)[]).map(String)),
      results,
    };
  } catch {
    return EMPTY_STATE;
  }
}

// "236A343 23-6B001, 236c120" のような入力を出席番号の配列にする
function parseStudentNos(input: string): { nos: string[]; invalid: string[] } {
  const nos: string[] = [];
  const invalid: string[] = [];
  for (const token of normalize(input).split(/[\s,、，]+/).filter(Boolean)) {
    const no = toStudentNo(token);
    if (no) nos.push(no);
    else invalid.push(token);
  }
  return { nos, invalid };
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
  const [password, setPassword] = useState(savedPassword);
  const [status, setStatus] = useState<"checking" | "login" | "ready">("checking");

  useEffect(() => {
    checkPassword(savedPassword())
      .then(({ required, ok }) => setStatus(required && !ok ? "login" : "ready"))
      // サーバーに届かないときも画面は出す（AI の読み込みはサーバー側で合言葉を確かめる）
      .catch(() => setStatus("ready"));
  }, []);

  if (status === "checking") return null;
  if (status === "login") {
    return (
      <LoginScreen
        onLogin={(pw) => {
          savePassword(pw);
          setPassword(pw);
          setStatus("ready");
        }}
      />
    );
  }
  return (
    <MainApp
      password={password}
      onUnauthorized={() => {
        savePassword("");
        setStatus("login");
      }}
    />
  );
}

function LoginScreen(props: { onLogin: (password: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const { ok } = await checkPassword(input);
      if (ok) props.onLogin(input);
      else setError("合言葉が違います");
    } catch {
      setError("サーバーにつながりませんでした。少し待ってからもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="card login">
        <h1>レポート提出・評価管理</h1>
        <p className="hint">合言葉を入力してください。この端末では次回から入力不要です。</p>
        <div className="input-row">
          <input
            type="password"
            value={input}
            autoFocus
            placeholder="合言葉"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && input) submit();
            }}
          />
          <button className="primary" onClick={submit} disabled={busy || !input}>
            {busy ? "確認中…" : "はじめる"}
          </button>
        </div>
        {error && <p className="errors">{error}</p>}
      </div>
    </div>
  );
}

function MainApp(props: { password: string; onUnauthorized: () => void }) {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<"submission" | "grading">("submission");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = (patch: Partial<AppState>) =>
    setState((s) => ({ ...s, ...patch }));

  // 出席番号 → AI が読み取った名前
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of state.results) {
      if (r.studentNo && r.name && !map.has(r.studentNo)) map.set(r.studentNo, r.name);
    }
    return map;
  }, [state.results]);

  const resetAll = () => {
    if (confirm("提出記録・AIの評価をすべて消去します。よろしいですか？")) {
      setState(EMPTY_STATE);
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [["出席番号", "名前", "AIの評価", "要約", "ファイル名"]];
    const sorted = [...state.results].sort((a, b) =>
      compareNo(a.studentNo ?? "￿", b.studentNo ?? "￿")
    );
    for (const r of sorted) {
      rows.push([r.studentNo ?? "", r.name, r.grade, r.summary, r.filename]);
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
          names={names}
          onAdd={(nos) => update({ submitted: sortNos([...state.submitted, ...nos]) })}
          onRemove={(no) => update({ submitted: state.submitted.filter((x) => x !== no) })}
        />
      ) : (
        <GradingTab
          results={state.results}
          password={props.password}
          onUnauthorized={props.onUnauthorized}
          // 出席番号が分かった結果は ① の提出者にも加える
          onAdd={(result) =>
            setState((s) => ({
              ...s,
              results: [...s.results, result],
              submitted: result.studentNo
                ? sortNos([...s.submitted, result.studentNo])
                : s.submitted,
            }))
          }
          onStudentNo={(id, studentNo) =>
            setState((s) => ({
              ...s,
              results: s.results.map((r) => (r.id === id ? { ...r, studentNo } : r)),
              submitted: studentNo ? sortNos([...s.submitted, studentNo]) : s.submitted,
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
  submitted: string[];
  names: Map<string, string>;
  onAdd: (nos: string[]) => void;
  onRemove: (no: string) => void;
}) {
  const { submitted, names } = props;
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAdd = () => {
    const { nos, invalid } = parseStudentNos(input);
    const notes: string[] = [];
    const dup = nos.filter((n) => submitted.includes(n));
    if (dup.length) notes.push(`登録済み: ${[...new Set(dup)].join(", ")}`);
    if (invalid.length) notes.push(`出席番号の形ではない入力: ${invalid.join(" ")}`);
    const added = nos.filter((n) => !submitted.includes(n));
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
      await navigator.clipboard.writeText(
        submitted.map((no) => `${no}\t${names.get(no) ?? ""}`).join("\n")
      );
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
        <p className="hint">
          英字1文字を含む7文字の番号（例：236A343）。スペース・カンマ・改行区切りでまとめて入力できます。②でAIに読ませた分は自動で追加されます。
        </p>
        <div className="input-row">
          <textarea
            value={input}
            rows={2}
            placeholder="例：236A343 236A350"
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
          <table className="roster">
            <thead>
              <tr>
                <th>出席番号</th>
                <th>名前</th>
                <th aria-label="削除" />
              </tr>
            </thead>
            <tbody>
              {submitted.map((no) => (
                <tr key={no}>
                  <td className="roster-no">{no}</td>
                  <td>{names.get(no) ?? <span className="hint">—</span>}</td>
                  <td className="roster-del">
                    <button
                      className="link danger"
                      title="削除"
                      onClick={() => props.onRemove(no)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {submitted.length > 0 && (
          <p className="hint">名前は②でAIが読み取ったものです。入力ミスは × で削除できます。</p>
        )}
      </div>
    </section>
  );
}

function GradingTab(props: {
  results: Result[];
  password: string;
  onUnauthorized: () => void;
  onAdd: (result: Result) => void;
  onStudentNo: (id: string, studentNo: string | null) => void;
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
        const resp = await fetch(`${API_BASE_URL}/grade`, {
          method: "POST",
          headers: authHeaders(props.password),
          body: fd,
        });
        if (resp.status === 401) {
          // 合言葉が変わった場合など。入力し直してもらう
          alert("合言葉が違います。もう一度入力してください。");
          props.onUnauthorized();
          return;
        }
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || String(resp.status));
        const d = data.draft;
        props.onAdd({
          id: `${Date.now()}-${i}-${file.name}`,
          filename: d.filename ?? file.name,
          name: d.name ?? "",
          // ファイル名から探し、なければレポート冒頭の学籍番号（AI が読み取ったもの）から
          studentNo: findStudentNo(file.name) ?? findStudentNo(d.student_id ?? ""),
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
  const unknown = props.results.filter((r) => !r.studentNo).length;

  return (
    <section>
      <div className="card">
        <h2>PDFをAIで読み込む</h2>
        <p className="hint">
          提出されたPDFをまとめて選ぶと、AIが1件ずつ読んで評価（S/A/B/C）と要約を出します。出席番号はファイル名から自動で読み取ります。1件あたり数円程度の利用料がかかります。
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
        {unknown > 0 && (
          <p className="warn-text">
            出席番号を読み取れなかったものが{unknown}件あります。ファイル名を見て入力してください。
          </p>
        )}
        {props.results.length === 0 ? (
          <p className="hint">AIに読ませると、ここに結果が並びます。</p>
        ) : (
          <ul className="result-list">
            {props.results.map((r) => (
              <li key={r.id} className={r.studentNo ? "" : "no-number"}>
                <div className="result-head">
                  <span className={`badge grade-${r.grade}`}>{r.grade}</span>
                  <span className="result-name">{r.name || r.filename}</span>
                  <input
                    type="text"
                    className="result-number"
                    placeholder="出席番号"
                    defaultValue={r.studentNo ?? ""}
                    key={r.studentNo ?? ""}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      const no = value ? toStudentNo(value) : null;
                      if (value && !no) {
                        alert("英字1文字を含む7文字の番号を入力してください（例：236A343）");
                        e.target.value = r.studentNo ?? "";
                        return;
                      }
                      if (no !== r.studentNo) props.onStudentNo(r.id, no);
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
                {!r.studentNo && <p className="result-file">{r.filename}</p>}
                <p className="result-summary">{r.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
