type DebriefLike = {
  total?: number;
  branchPath?: string;
  outcome?: { title?: string; text?: string };
  scores?: Record<string, number>;
  max?: Record<string, number>;
  evidence?: Array<{ dim: string; points: number; rule: string; evidence: string }>;
  suggestions?: string[];
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
      return `<tr><td>${esc(k)} ${esc(DIM_LABEL[k] || "")}</td><td>${esc(v)} / ${esc(max)}</td></tr>`;
    })
    .join("");
  const evidence = (report.evidence || [])
    .map(
      (item) =>
        `<li>${esc(item.dim)} +${esc(item.points)} ${esc(item.rule)}：${esc(item.evidence)}</li>`
    )
    .join("");
  const suggestions = (report.suggestions || []).map((s) => `<li>${esc(s)}</li>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"></head><body>
<h1>ER-Think 训练复盘</h1>
<p>病例：${esc(caseTitle)}</p>
<p>总分：${esc(report.total)} / 100</p>
<p>结局：Path ${esc(report.branchPath)} ${esc(report.outcome?.title || "")}</p>
<p>${esc(report.outcome?.text || "")}</p>
<h2>六维得分</h2>
<table border="1" cellpadding="6">${scores}</table>
<h2>得分依据</h2>
<ul>${evidence || "<li>无</li>"}</ul>
<h2>改进建议</h2>
<ul>${suggestions || "<li>无</li>"}</ul>
</body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ER-Think复盘.doc";
  a.click();
  URL.revokeObjectURL(url);
}
