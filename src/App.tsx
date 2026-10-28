import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Grade = "S" | "A" | "B" | "C";

const GRADES: Grade[] = ["S", "A", "B", "C"];

type AppState = {
  assignmentName: string;
  // 名簿の人数（出席番号 1〜classSize が対象）。0 のときは提出済みの最大番号まで
  classSize: number;
  submitted: number[];
  grades: Record<number, Grade>;
  memos: Record<number, string>;
  late: Record<number, boolean>;
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
  classSize: 0,
  submitted: [],
  grades: {},
  memos: {},
  late: {},
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

// "3 5, 12-15、20" のような入力を番号の配列にする
function parseNumbers(input: string): { numbers: number[]; invalid: string[] } {
  const numbers: number[] = [];
  const invalid: string[] = [];
  const normalized = input.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  for (const token of normalized.split(/[\s,、，]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)[-~〜ー－](\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from > 0 && from <= to && to - from < 1000) {
        for (let n = from; n <= to; n++) numbers.push(n);
        continue;
      }
    } else if (/^\d+$/.test(token) && Number(token) > 0) {
      numbers.push(Number(token));
      continue;
    }
    invalid.push(token);
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
  const maxSubmitted = state.submitted.length
    ? state.submitted[state.submitted.length - 1]
    : 0;
  const rosterSize = state.classSize || maxSubmitted;
  const missing = useMemo(() => {
    const list: number[] = [];
    for (let n = 1; n <= rosterSize; n++) if (!submittedSet.has(n)) list.push(n);
    return list;
  }, [rosterSize, submittedSet]);

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
    update({ submitted: sorted, grades, memos, late });
  };

  const toggleSubmitted = (n: number) => {
    if (submittedSet.has(n)) setSubmitted(state.submitted.filter((x) => x !== n));
    else setSubmitted([...state.submitted, n]);
  };

  const resetAll = () => {
    if (confirm("提出記録・評価をすべて消去します。よろしいですか？")) {
      setState({ ...EMPTY_STATE, criteria: state.criteria, classSize: state.classSize });
    }
  };

  const exportCsv = () => {
    const rows: string[][] = [["出席番号", "提出", "評価", "遅れ提出", "メモ"]];
    const last = Math.max(rosterSize, maxSubmitted);
    for (let n = 1; n <= last; n++) {
      const done = submittedSet.has(n);
      rows.push([
        String(n),
        done ? "提出" : "未提出",
        // 未提出は C
        done ? state.grades[n] ?? "" : "C",
        state.late[n] ? "遅れ" : "",
        state.memos[n] ?? "",
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
          <label>
            名簿の人数
            <input
              type="number"
              min={0}
              value={state.classSize || ""}
              placeholder="例：40"
              onChange={(e) =>
                update({ classSize: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
              }
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
          classSize={state.classSize}
          rosterSize={rosterSize}
          missing={missing}
          onAdd={(nums) => setSubmitted([...state.submitted, ...nums])}
          onToggle={toggleSubmitted}
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
          rosterSize={rosterSize}
          missingCount={missing.length}
          onMemo={(n, memo) => update({ memos: { ...state.memos, [n]: memo } })}
          onLate={(n, late) => update({ late: { ...state.late, [n]: late } })}
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
  classSize: number;
  rosterSize: number;
  missing: number[];
  onAdd: (nums: number[]) => void;
  onToggle: (n: number) => void;
}) {
  const { submitted, submittedSet, classSize, rosterSize, missing } = props;
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAdd = () => {
    const { numbers, invalid } = parseNumbers(input);
    const notes: string[] = [];
    const dup = numbers.filter((n) => submittedSet.has(n));
    const over = classSize ? numbers.filter((n) => n > classSize) : [];
    if (dup.length) notes.push(`登録済み: ${[...new Set(dup)].join(", ")}`);
    if (over.length) notes.push(`名簿の人数(${classSize})を超える番号: ${over.join(", ")}`);
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

  const copyMissing = async () => {
    try {
      await navigator.clipboard.writeText(missing.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("コピーできませんでした");
    }
  };

  // 名簿の範囲 + 範囲外で入力された番号（入力ミス確認用）
  const cells = [
    ...Array.from({ length: rosterSize }, (_, i) => i + 1),
    ...submitted.filter((n) => n > rosterSize),
  ];

  return (
    <section>
      <div className="card">
        <h2>提出した出席番号を入力</h2>
        <p className="hint">
          スペース・カンマ・改行区切りでまとめて入力できます。「12-15」のような範囲指定も可。
        </p>
        <div className="input-row">
          <textarea
            value={input}
            rows={2}
            placeholder="例：3 7 12 1 25-28"
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

      <div className="stats">
        <div className="stat">
          <span className="stat-label">提出</span>
          <span className="stat-value">
            {submitted.length}
            {rosterSize > 0 && <small> / {rosterSize}</small>}
          </span>
        </div>
        <div className="stat warn">
          <span className="stat-label">未提出（空欄）</span>
          <span className="stat-value">{missing.length}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title-row">
          <h2>未提出の出席番号</h2>
          {missing.length > 0 && (
            <button className="secondary small" onClick={copyMissing}>
              {copied ? "コピーしました" : "コピー"}
            </button>
          )}
        </div>
        {rosterSize === 0 ? (
          <p className="hint">出席番号を入力すると、ここに空欄が表示されます。</p>
        ) : missing.length === 0 ? (
          <p className="ok">全員提出済みです 🎉</p>
        ) : (
          <p className="missing-list">{missing.join(", ")}</p>
        )}
        {!classSize && submitted.length > 0 && (
          <p className="hint">
            ※ 名簿の人数が未設定のため、{rosterSize}番より後ろの未提出は判定できません。上部で人数を設定してください。
          </p>
        )}
      </div>

      {cells.length > 0 && (
        <div className="card">
          <h2>番号一覧</h2>
          <p className="hint">クリックで提出／未提出を切り替えられます（入力ミスの修正用）。</p>
          <div className="grid">
            {cells.map((n) => (
              <button
                key={n}
                className={`cell ${submittedSet.has(n) ? "done" : "empty"} ${
                  classSize && n > classSize ? "over" : ""
                }`}
                title={submittedSet.has(n) ? "提出済み" : "未提出"}
                onClick={() => props.onToggle(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="legend">
            <span className="cell done sample" /> 提出済み
            <span className="cell empty sample" /> 未提出
          </div>
        </div>
      )}
    </section>
  );
}

function GradingTab(props: {
  state: AppState;
  rosterSize: number;
  missingCount: number;
  onGrade: (n: number, g: Grade | null) => void;
  onMemo: (n: number, memo: string) => void;
  onLate: (n: number, late: boolean) => void;
  onCriteria: (g: Grade, text: string) => void;
}) {
  const { state } = props;
  const [filter, setFilter] = useState<Grade | "all" | "none">("all");

  const counts = useMemo(() => {
    const c: Record<Grade | "none", number> = { S: 0, A: 0, B: 0, C: 0, none: 0 };
    state.submitted.forEach((n) => c[state.grades[n] ?? "none"]++);
    return c;
  }, [state.submitted, state.grades]);

  const rows = state.submitted.filter((n) => {
    if (filter === "all") return true;
    if (filter === "none") return !state.grades[n];
    return state.grades[n] === filter;
  });

  // 未提出者は C として数える。S+A の割合は名簿全体に対して出す
  const totalC = counts.C + props.missingCount;
  const total = Math.max(props.rosterSize, state.submitted.length);
  const saRatio = total ? (counts.S + counts.A) / total : 0;

  if (state.submitted.length === 0) {
    return (
      <section className="card">
        <p className="hint">まず「① 提出チェック」で提出した出席番号を入力してください。</p>
      </section>
    );
  }

  return (
    <section>
      <div className="stats">
        {GRADES.map((g) => (
          <div key={g} className={`stat grade-${g}`}>
            <span className="stat-label">{g}</span>
            <span className="stat-value">{g === "C" ? totalC : counts[g]}</span>
            {g === "C" && props.missingCount > 0 && (
              <span className="stat-note">うち未提出 {props.missingCount}</span>
            )}
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
            （{counts.S + counts.A} / {total}人・目安は全体の約半分）
          </span>
        </div>
        <div className="ratio-bar">
          <div className="ratio-fill" style={{ width: `${Math.min(100, saRatio * 100)}%` }} />
          <div className="ratio-target" />
        </div>
      </div>

      <details className="card criteria" open>
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
        <h3>課題の要件（確認用）</h3>
        <ul className="requirements">
          {REQUIREMENTS.map((req) => (
            <li key={req}>{req}</li>
          ))}
        </ul>
      </details>

      <div className="card">
        <div className="card-title-row">
          <h2>提出者の評価</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">すべて表示</option>
            <option value="none">未評価のみ</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g} のみ
              </option>
            ))}
          </select>
        </div>
        <table className="grade-table">
          <thead>
            <tr>
              <th>出席番号</th>
              <th>評価</th>
              <th>遅れ</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n}>
                <td className="num">{n}</td>
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
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="hint">
                  該当する提出者はいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
