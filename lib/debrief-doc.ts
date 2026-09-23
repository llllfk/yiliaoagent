type DebriefLike = {
  total?: number;
  branchPath?: string;
  outcome?: { title?: string; text?: string };
  scores?: Record<string, number>;
  max?: Record<string, number>;
  comments?: Record<string, string>;
  evidence?: Array<{ dim: string; points: number; rule: string; evidence: string }>;
  suggestions?: string[];
  recommendedModules?: string[];
  timeline?: Array<{
    atMinute: number;
    nodeId: string;
    label: string;
    ok: boolean;
    note: string;
  }>;
  pathComparison?: Array<{
    timeLabel: string;
    standard: string;
    student: string;
    correct: boolean;
  }>;
  nodeReviews?: Array<{
    title: string;
    ok: boolean;
    comment: string;
    evidence: string;
  }>;
};

const DIM_LABEL: Record<string, string> = {
  TRI: "分诊与时机",
  INF: "病史采集",
  DIA: "鉴别诊断",
  MAN: "用药与处置",
  DYN: "动态监测",
  EBM: "循证表达",
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 下载 Word 可打开的复盘文档 */
export function downloadDebrief(report: DebriefLike, caseTitle: string) {
  const scores = Object.entries(report.scores || {})
    .map(([k, v]) => {
      const max = report.max?.[k] ?? "";
      const comment = report.comments?.[k] || "";
      return `<tr><td>${esc(k)} ${esc(DIM_LABEL[k] || "")}</td><td>${esc(v)} / ${esc(max)}</td><td>${esc(comment)}</td></tr>`;
    })
    .join("");
  const evidence = (report.evidence || [])
    .map(
      (item) =>
        `<li>${esc(item.dim)} +${esc(item.points)} ${esc(item.rule)}：${esc(item.evidence)}</li>`
    )
    .join("");
  const suggestions = (report.suggestions || []).map((s) => `<li>${esc(s)}</li>`).join("");
  const modules = (report.recommendedModules || [])
    .map((m) => `<li>${esc(m)}</li>`)
    .join("");
  const timeline = (report.timeline || [])
    .map(
      (t) =>
        `<li>T+${esc(t.atMinute)} ${esc(t.nodeId)} ${esc(t.label)} — ${esc(t.note)}${t.ok ? "" : " ⚠"}</li>`
    )
    .join("");
  const pathRows = (report.pathComparison || [])
    .map(
      (r) =>
        `<tr><td>${esc(r.timeLabel)}</td><td>${esc(r.standard)}</td><td>${esc(r.student)}</td><td>${r.correct ? "达标" : "偏离"}</td></tr>`
    )
    .join("");
  const nodeRows = (report.nodeReviews || [])
    .map(
      (n) =>
        `<tr><td>${esc(n.title)}</td><td>${n.ok ? "达标" : "待加强"}</td><td>${esc(n.comment)}</td><td>${esc(n.evidence)}</td></tr>`
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"></head><body>
<h1>ER-Think 训练复盘</h1>
<p>病例：${esc(caseTitle)}</p>
<p>总分：${esc(report.total)} / 100</p>
<p>结局：Path ${esc(report.branchPath)} ${esc(report.outcome?.title || "")}</p>
<p>${esc(report.outcome?.text || "")}</p>
<h2>六维得分与评语</h2>
<table border="1" cellpadding="6"><tr><th>维度</th><th>得分</th><th>评语</th></tr>${scores}</table>
<h2>标准路径 vs 你的路径</h2>
<table border="1" cellpadding="6"><tr><th>时间</th><th>标准</th><th>你的操作</th><th>判定</th></tr>${pathRows || "<tr><td colspan=4>无</td></tr>"}</table>
<h2>逐节点复盘评语</h2>
<table border="1" cellpadding="6"><tr><th>节点</th><th>判定</th><th>评语</th><th>依据</th></tr>${nodeRows || "<tr><td colspan=4>无</td></tr>"}</table>
<h2>决策时间轴</h2>
<ul>${timeline || "<li>无</li>"}</ul>
<h2>得分依据</h2>
<ul>${evidence || "<li>无</li>"}</ul>
<h2>改进建议</h2>
<ul>${suggestions || "<li>无</li>"}</ul>
<h2>推荐强化训练模块</h2>
<ul>${modules || "<li>无</li>"}</ul>
</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ER-Think复盘.doc";
  a.click();
  URL.revokeObjectURL(url);
}
