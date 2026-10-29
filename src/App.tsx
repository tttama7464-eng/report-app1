import { Fragment, useEffect, useMemo, useState } from "react";
import "./App.css";

type Grade = "S" | "A" | "B" | "C";

const GRADES: Grade[] = ["S", "A", "B", "C"];

// AI が作った評価の下書き
type Draft = {
  id: string;
  filename: string;
  student_id: string;
  name: string;
  title: string;
  grade: Grade;
  reason: string;
  summary: string;
  missing: string[];
  pages: number;
};

// 開発中は別ポートのサーバー、本番は画面と同じサーバー（server.js が画面も返す）
const API_BASE_URL = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL || "http://localhost:8787"
  : "";

type AppState = {
  assignmentName: string;
  submitted: number[];
  grades: Record<number, Grade>;
  memos: Record<number, string>;
  late: Record<number, boolean>;
  // 出席番号を割り当て済みの AI 下書き
  drafts: Record<number, Draft>;
  // AI が読み終わったが、まだ出席番号を割り当てていない下書き
  pendingDrafts: Draft[];
  criteria: Record<Grade, string>;
};

const STORAGE_KEY = "report-app:v1";

// 中間課題「人間のためのみち」の評価基準（最重要：テーマについての論述と独創性）
const DEFAULT_CRITERIA: Record<Grade, string> = {
  S: "テーマについての論述が深く、独創性が際立つ。授業で紹介したくなるレベル。",
  A: "テーマについてしっかり論述できている。ほとんどの人はここ（S+Aで全体の約半分が目安）。",
  B: "課題の最低限は満たしているが、テーマについての論述・独創性がA に届かない。",
  C: "空欄・未提出・内容が課題と全く関係ないなど、最低限が守れていないもののみ。",
};

// 課題表に書かれている要件（評価時の確認用）
const REQUIREMENTS = [
  "実際の都市空間の中から「人間らしさ」がまちの表情に表れている「みち」を探している",
  "写真（またはスケッチ等）がある。WEB写真・ストリートビューなら出典を明示、撮影時期も明示",
  "立地のレポートがある",
  "まちの表情をつくっているもの・何がデザインされているかを分析している",
  "A4 1枚以上・PDF形式・冒頭に①学籍番号 ②氏名 ③タイトル",
  "提出期間 11/18(火)〜11/24(月)。遅れ提出は 12/1(月)12:00 まで受付・減点、講評対象外",
];

const EMPTY_STATE: AppState = {
  assignmentName: "",
  submitted: [],
  grades: {},
  memos: {},
  late: {},
  drafts: {},
  pendingDrafts: [],
  criteria: DEFAULT_CRITERIA,
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const saved = { ...EMPTY_STATE, ...JSON.parse(raw) } as AppState;
    // 空欄のままの基準は既定の基準で埋める
    for (const g of GRADES) {
      if (!saved.criteria[g]) saved.criteria = { ...saved.criteria, [g]: DEFAULT_CRITERIA[g] };
    }
    return saved;
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

  const setSubmitted = (numbers: number[]) => {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const keep = new Set(sorted);
    // 提出を取り消した番号の評価・メモは消す
    const grades = Object.fromEntries(
      Object.entries(state.grades).filter(([n]) => keep.has(Number(n)))
    );
    const memos = Object.fromEntries(
      Object.entries(state.memos).filter(([n]) => keep.has(Number(n)))
    );
    const late = Object.fromEntries(
      Object.entries(state.late).filter(([n]) => keep.has(Number(n)))
    );
    const drafts = Object.fromEntries(
      Object.entries(state.drafts).filter(([n]) => keep.has(Number(n)))
    );
    update({ submitted: sorted, grades, memos, late, drafts });
  };

  const removeSubmitted = (n: number) => {
    const hasData = state.grades[n] || state.drafts[n] || state.memos[n];
    if (hasData && !confirm(`${n}番の評価・メモ・AIの下書きも消えます。削除しますか？`)) return;
    setSubmitted(state.submitted.filter((x) => x !== n));
  };

  const resetAll = () => {
    if (confirm("提出記録・評価をすべて消去します。よろしいですか？")) {
      setState({
        ...EMPTY_STATE,
        criteria: state.criteria,
        pendingDrafts: [],
      });
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [["出席番号", "評価", "AI案", "遅れ提出", "メモ", "AIの理由"]];
    for (const n of state.submitted) {
      rows.push([
        String(n),
        state.grades[n] ?? "",
        state.drafts[n]?.grade ?? "",
        state.late[n] ? "遅れ" : "",
        state.memos[n] ?? "",
        state.drafts[n]?.reason ?? "",
      ]);
    }
    downloadCsv(`${state.assignmentName || "レポート"}_提出評価.csv`, rows);
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
          onAdd={(nums) => setSubmitted([...state.submitted, ...nums])}
          onRemove={removeSubmitted}
        />
      ) : (
        <GradingTab
          state={state}
          onGrade={(n, g) => {
            const grades = { ...state.grades };
            if (g) grades[n] = g;
            else delete grades[n];
            update({ grades });
          }}
          onMemo={(n, memo) => update({ memos: { ...state.memos, [n]: memo } })}
          onLate={(n, late) => update({ late: { ...state.late, [n]: late } })}
          onDrafts={(drafts) =>
            setState((s) => ({ ...s, pendingDrafts: [...s.pendingDrafts, ...drafts] }))
          }
          onAssign={(id, n) => {
            const draft = state.pendingDrafts.find((d) => d.id === id);
            if (!draft) return;
            if (
              state.drafts[n] &&
              !confirm(`${n}番にはすでにAIの下書きがあります。置き換えますか？`)
            ) {
              return;
            }
            update({
              submitted: [...new Set([...state.submitted, n])].sort((a, b) => a - b),
              drafts: { ...state.drafts, [n]: draft },
              pendingDrafts: state.pendingDrafts.filter((d) => d.id !== id),
            });
          }}
          onDiscard={(id) =>
            update({ pendingDrafts: state.pendingDrafts.filter((d) => d.id !== id) })
          }
          onAdoptAll={() => {
            const grades = { ...state.grades };
            for (const n of state.submitted) {
              if (!grades[n] && state.drafts[n]) grades[n] = state.drafts[n].grade;
            }
            update({ grades });
          }}
          onCriteria={(g, text) =>
            update({ criteria: { ...state.criteria, [g]: text } })
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
  state: AppState;
  onGrade: (n: number, g: Grade | null) => void;
  onMemo: (n: number, memo: string) => void;
  onLate: (n: number, late: boolean) => void;
  onCriteria: (g: Grade, text: string) => void;
  onDrafts: (drafts: Draft[]) => void;
  onAssign: (id: string, n: number) => void;
  onDiscard: (id: string) => void;
  onAdoptAll: () => void;
}) {
  const { state } = props;
  const [filter, setFilter] = useState<Grade | "all" | "none" | "diff">("all");
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  const counts = useMemo(() => {
    const c: Record<Grade | "none", number> = { S: 0, A: 0, B: 0, C: 0, none: 0 };
    state.submitted.forEach((n) => c[state.grades[n] ?? "none"]++);
    return c;
  }, [state.submitted, state.grades]);

  const rows = state.submitted.filter((n) => {
    if (filter === "all") return true;
    if (filter === "none") return !state.grades[n];
    if (filter === "diff") return !!state.drafts[n] && state.drafts[n].grade !== state.grades[n];
    return state.grades[n] === filter;
  });

  const adoptable = state.submitted.filter((n) => !state.grades[n] && state.drafts[n]).length;

  // S+A の割合は提出者全体に対して出す
  const total = state.submitted.length;
  const saRatio = total ? (counts.S + counts.A) / total : 0;

  const toggleRow = (n: number) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  return (
    <section>
      <AiDraftPanel
        pendingDrafts={state.pendingDrafts}
        drafts={state.drafts}
        onDrafts={props.onDrafts}
        onAssign={props.onAssign}
        onDiscard={props.onDiscard}
      />

      {state.submitted.length === 0 ? (
        <section className="card">
          <p className="hint">
            「① 提出チェック」で提出した出席番号を入力するか、上でAIの下書きに出席番号を割り当てると、ここに評価表が出ます。
          </p>
        </section>
      ) : (
        <>
          <div className="stats">
            {GRADES.map((g) => (
              <div key={g} className={`stat grade-${g}`}>
                <span className="stat-label">{g}</span>
                <span className="stat-value">{counts[g]}</span>
              </div>
            ))}
            <div className="stat">
              <span className="stat-label">未評価</span>
              <span className="stat-value">{counts.none}</span>
            </div>
          </div>

          <div className="card ratio">
            <div className="ratio-label">
              S+A の割合：<b>{Math.round(saRatio * 100)}%</b>
              <span className="hint">
                （提出者 {total}人中 {counts.S + counts.A}人・目安は約半分）
              </span>
            </div>
            <div className="ratio-bar">
              <div
                className="ratio-fill"
                style={{ width: `${Math.min(100, saRatio * 100)}%` }}
              />
              <div className="ratio-target" />
            </div>
          </div>

          <details className="card criteria">
            <summary>評価基準（最重要：テーマについての論述と独創性）</summary>
            <div className="criteria-grid">
              {GRADES.map((g) => (
                <label key={g}>
                  <span className={`badge grade-${g}`}>{g}</span>
                  <textarea
                    rows={2}
                    value={state.criteria[g]}
                    placeholder="（評価基準を入力）"
                    onChange={(e) => props.onCriteria(g, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="hint">
              ※ ここを書き換えても画面上のメモが変わるだけで、AIへの指示（server.js）は変わりません。
            </p>
            <h3>課題の要件（確認用）</h3>
            <ul className="requirements">
              {REQUIREMENTS.map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </details>

          <div className="card">
            <div className="card-title-row">
              <h2>評価</h2>
              <div className="title-actions">
                {adoptable > 0 && (
                  <button className="secondary small" onClick={props.onAdoptAll}>
                    未評価の{adoptable}人にAI案をまとめて採用
                  </button>
                )}
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                >
                  <option value="all">すべて表示</option>
                  <option value="none">未評価のみ</option>
                  <option value="diff">AI案と違う／未確認</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g} のみ
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="hint">
              最終的な評価は先生が決めます。AI案は「採用」を押すか、S/A/B/C を直接選んでください。
            </p>
            <table className="grade-table">
              <thead>
                <tr>
                  <th>出席番号</th>
                  <th>AI案</th>
                  <th>評価</th>
                  <th>遅れ</th>
                  <th>メモ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n) => {
                  const draft = state.drafts[n];
                  return (
                    <Fragment key={n}>
                      <tr>
                        <td className="num">{n}</td>
                        <td>
                          {draft ? (
                            <div className="ai-cell">
                              <button
                                className={`badge grade-${draft.grade} badge-btn`}
                                title="AIの理由・要約を表示"
                                onClick={() => toggleRow(n)}
                              >
                                {draft.grade}
                              </button>
                              {state.grades[n] !== draft.grade && (
                                <button
                                  className="secondary small"
                                  onClick={() => props.onGrade(n, draft.grade)}
                                >
                                  採用
                                </button>
                              )}
                              <button className="link" onClick={() => toggleRow(n)}>
                                {openRows.has(n) ? "閉じる" : "詳細"}
                              </button>
                            </div>
                          ) : (
                            <span className="hint">—</span>
                          )}
                        </td>
                        <td>
                          <div className="grade-buttons">
                            {GRADES.map((g) => (
                              <button
                                key={g}
                                className={`grade-btn grade-${g} ${
                                  state.grades[n] === g ? "selected" : ""
                                }`}
                                onClick={() =>
                                  props.onGrade(n, state.grades[n] === g ? null : g)
                                }
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            title="遅れ提出（減点・講評対象外）"
                            checked={!!state.late[n]}
                            onChange={(e) => props.onLate(n, e.target.checked)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="memo"
                            value={state.memos[n] ?? ""}
                            placeholder="コメント"
                            onChange={(e) => props.onMemo(n, e.target.value)}
                          />
                        </td>
                      </tr>
                      {draft && openRows.has(n) && (
                        <tr className="detail-row">
                          <td colSpan={5}>
                            <DraftDetail draft={draft} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="hint">
                      該当する提出者はいません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function DraftDetail({ draft }: { draft: Draft }) {
  return (
    <div className="draft-detail">
      <div className="draft-meta">
        {draft.filename}
        {draft.pages > 0 && ` ・ ${draft.pages}ページ`}
        {(draft.student_id || draft.name) && ` ・ ${draft.student_id} ${draft.name}`}
      </div>
      {draft.title && <div className="draft-title">{draft.title}</div>}
      <p>
        <b>理由：</b>
        {draft.reason}
      </p>
      <p>
        <b>要約：</b>
        {draft.summary}
      </p>
      {draft.missing.length > 0 && (
        <p className="draft-missing">
          <b>足りない要件：</b>
          {draft.missing.join("／")}
        </p>
      )}
    </div>
  );
}

function AiDraftPanel(props: {
  pendingDrafts: Draft[];
  drafts: Record<number, Draft>;
  onDrafts: (drafts: Draft[]) => void;
  onAssign: (id: string, n: number) => void;
  onDiscard: (id: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});

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
        props.onDrafts([
          {
            id: `${Date.now()}-${i}-${file.name}`,
            filename: d.filename ?? file.name,
            student_id: d.student_id ?? "",
            name: d.name ?? "",
            title: d.title ?? "",
            grade: GRADES.includes(d.grade) ? d.grade : "B",
            reason: d.reason ?? "",
            summary: d.summary ?? "",
            missing: Array.isArray(d.missing) ? d.missing : [],
            pages: d.pages ?? 0,
          },
        ]);
      } catch (e) {
        setErrors((prev) => [...prev, `${file.name}：${e instanceof Error ? e.message : e}`]);
      }
      setProgress({ done: i + 1, total: targets.length });
    }
    setFiles([]);
    setProgress(null);
  };

  const assign = (id: string) => {
    const n = Number(numbers[id]);
    if (!Number.isInteger(n) || n <= 0) {
      alert("出席番号を入力してください");
      return;
    }
    props.onAssign(id, n);
  };

  const busy = progress !== null;

  return (
    <div className="card ai-panel">
      <h2>AIで評価の下書きを作る</h2>
      <p className="hint">
        提出されたPDFをまとめて選ぶと、AIが1件ずつ読んで S/A/B/C の案・理由・要約を作ります（写真も読みます）。1件あたり数円程度の利用料がかかります。
      </p>
      <div className="input-row">
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

      {props.pendingDrafts.length > 0 && (
        <>
          <h3>出席番号の割り当て待ち（{props.pendingDrafts.length}件）</h3>
          <p className="hint">
            レポートの学籍番号・氏名を見て出席番号を入れてください。割り当てると提出済みになり、評価表にAI案が出ます。
          </p>
          <ul className="pending-list">
            {props.pendingDrafts.map((d) => (
              <li key={d.id}>
                <span className={`badge grade-${d.grade}`}>{d.grade}</span>
                <div className="pending-info">
                  <div className="pending-name">
                    {d.student_id || "学籍番号不明"} {d.name || "氏名不明"}
                  </div>
                  <div className="hint">{d.filename}</div>
                </div>
                <input
                  type="number"
                  min={1}
                  className="pending-number"
                  placeholder="出席番号"
                  value={numbers[d.id] ?? ""}
                  onChange={(e) => setNumbers({ ...numbers, [d.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && assign(d.id)}
                />
                <button className="secondary small" onClick={() => assign(d.id)}>
                  割り当て
                </button>
                <button
                  className="link danger"
                  onClick={() => confirm("この下書きを破棄しますか？") && props.onDiscard(d.id)}
                >
                  破棄
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
