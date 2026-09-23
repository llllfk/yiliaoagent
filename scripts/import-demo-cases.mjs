/**
 * 从客户 Demo HTML 抽取病例，转换为 ER-Think CaseConfig JSON。
 * 运行：node scripts/import-demo-cases.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const demoPath = path.join(
  root,
  "..",
  "ER-Think_参赛提交包(1)",
  "ER-Think_完善版_Demo.html"
);
const outDir = path.join(root, "data", "cases");

const DIFF = {
  beginner: "入门级",
  intermediate: "进阶级",
  advanced: "挑战级",
};

const TARGET = {
  beginner: "15–20",
  intermediate: "20–25",
  advanced: "30–40",
};

function parseMinutes(raw) {
  if (raw == null) return 15;
  const s = String(raw);
  const m = s.match(/(\d+)\s*(分钟|min|Min)?/i);
  if (m) return Number(m[1]);
  if (/稳定|择期|术后/.test(s)) return 60;
  return 15;
}

function slugId(id, fallback) {
  const s = String(id || fallback || "case")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 60) || "case";
}

function buildQaNodes(demo) {
  const nodes = [];
  const seen = new Set();
  let n = 1;

  const push = (category, intents, answer, flags = {}) => {
    const key = answer.slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    const id = `Q${n++}`;
    nodes.push({
      id,
      category,
      intents: [...new Set(intents.map((x) => String(x).trim()).filter(Boolean))].slice(0, 12),
      answer: String(answer).trim(),
      ...flags,
    });
  };

  for (const row of demo.chatResponses || []) {
    const intents = Array.isArray(row.keywords) ? row.keywords : [];
    if (!row.response || intents.length === 0) continue;
    const cat =
      intents.some((k) => /过敏|用药|吃药/.test(k))
        ? "安全史"
        : intents.some((k) => /既往|高血压|糖尿病|吸烟|危险因素|病史/.test(k))
          ? "既往与危险因素"
          : intents.some((k) => /疼|痛|部位|性质|放射/.test(k))
            ? "疼痛相关"
            : intents.some((k) => /多久|时间|持续/.test(k))
              ? "时间病程"
              : "问诊";
    const flags = {};
    if (/放射|大汗|冷汗|硝酸甘油|关键/.test(intents.join("") + row.response)) {
      flags.critical = true;
    }
    if (/过敏/.test(intents.join(""))) flags.safety = true;
    push(cat, intents, row.response, flags);
  }

  for (const q of demo.presetQuestions || []) {
    if (!q.text || !q.answer) continue;
    const intents = [q.text, ...(String(q.text).match(/[\u4e00-\u9fa5]{2,8}/g) || [])].slice(0, 6);
    push(q.id ? `预设·${q.id}` : "预设问诊", intents, q.answer);
  }

  if (nodes.length === 0) {
    push("主诉", ["你怎么了", "哪里不舒服"], demo.openingMessage || "大夫，我不太舒服。");
  }
  return nodes;
}

function buildPhysical(demo) {
  const pe = {};
  if (demo.vitals) {
    const parts = [];
    for (const [k, v] of Object.entries(demo.vitals)) {
      if (v && typeof v === "object" && "value" in v) {
        parts.push(`${k.toUpperCase()} ${v.value}${v.unit ? " " + v.unit : ""}`);
      }
    }
    if (parts.length) pe.vitals = parts.join("；");
  }
  for (const ex of demo.examOptions || []) {
    // 把「心电图」等辅助检查留给 exams；体格相关进 physicalExam
    const name = String(ex.name || "");
    if (/心电图|超声|X线|CT|检验|血|肌钙|胆碱|血气/.test(name)) continue;
    const key = String(ex.id || name)
      .replace(/[^\w\u4e00-\u9fa5]+/g, "_")
      .slice(0, 24);
    pe[key || `exam_${Object.keys(pe).length}`] = `${name}：${ex.finding || ""}`;
  }
  if (Object.keys(pe).length === 0) {
    pe.general = "一般情况见病例描述";
  }
  return pe;
}

function buildExams(demo) {
  const exams = [];
  const used = new Set();

  const add = (id, label, costMinutes, result, critical) => {
    let eid = slugId(id, label);
    if (used.has(eid)) eid = `${eid}-${used.size}`;
    used.add(eid);
    exams.push({
      id: eid,
      label,
      costMinutes,
      costFee: critical ? 100 : 60,
      critical: Boolean(critical),
      result: String(result || "").trim() || "结果待回报",
    });
  };

  for (const ex of demo.examOptions || []) {
    const name = String(ex.name || "");
    if (!/心电图|超声|X线|CT|影像/.test(name)) continue;
    add(ex.id, name, parseMinutes(ex.time) || (/心电图/.test(name) ? 5 : 15), ex.finding || ex.result, /心电图|ECG/.test(name) || ex.essential);
  }
  for (const lab of demo.labOptions || []) {
    add(
      lab.id,
      lab.name,
      parseMinutes(lab.time),
      lab.result,
      Boolean(lab.essential) || /肌钙|危急|胆碱酯酶/.test(String(lab.name || ""))
    );
  }

  // Demo 里有些把 ECG 放在 examOptions 当查体
  if (exams.length === 0) {
    add("basic-lab", "基础化验", 15, "按临床常规回报", false);
  }
  return exams;
}

function buildDecisions(demo) {
  const title = demo.title || "";
  const strategies = demo.management?.strategies || [];
  const recommended = strategies.find((s) => s.recommended) || strategies[0];
  const meds = (demo.medicationOptions || [])
    .filter((m) => m.essential)
    .map((m) => m.name)
    .slice(0, 4)
    .join("；");
  const dx = demo.management?.diagnosis || title;

  return [
    {
      id: "P1",
      name: "分诊分级",
      hint: demo.phase1?.triageCorrectFeedback
        ? String(demo.phase1.triageCorrectFeedback).slice(0, 80)
        : "根据主诉与生命体征判断分诊级别并写明理由",
    },
    {
      id: "P2",
      name: "关键检查时机",
      hint: "优先完成对本病最关键的床旁/紧急检查（如心电图、血气、床旁超声等）",
    },
    {
      id: "P3",
      name: "病史完整性",
      hint: "覆盖主诉、时间、诱因、伴随、既往/用药/过敏等核心问诊类别",
    },
    {
      id: "P4",
      name: "鉴别诊断",
      hint: demo.phase1?.diagnosisPlaceholder
        ? `参考：${String(demo.phase1.diagnosisPlaceholder).replace(/\n/g, " / ").slice(0, 100)}`
        : `写出首位诊断与主要鉴别（本案：${dx.slice(0, 40)}）`,
    },
    {
      id: "P5",
      name: "初始药物治疗",
      hint: meds || "写下关键药物（种类、剂量/途径如适用）",
    },
    {
      id: "P6",
      name: "关键处置策略",
      hint: recommended
        ? `优先考虑：${recommended.name}${recommended.desc ? " — " + String(recommended.desc).slice(0, 60) : ""}`
        : "选择并说明关键处置/再灌注/手术/解毒等策略",
    },
    {
      id: "P7",
      name: "动态监测",
      hint: demo.deterioration
        ? `制定监测计划；警惕恶化：${demo.deterioration.title || "病情变化"}`
        : "写明生命体征与关键指标复查计划，以及并发症预警",
    },
    {
      id: "P8",
      name: "循证表达",
      hint: "引用相关指南/共识名称与关键时间或剂量目标",
    },
  ];
}

function buildKnowledge(demo) {
  const cards = [];
  for (const c of demo.knowledgeCards || []) {
    if (!c?.title || !Array.isArray(c.items)) continue;
    cards.push({
      title: String(c.title),
      items: c.items.map(String).filter(Boolean),
    });
  }
  if (demo.management?.learningObjectives?.length) {
    cards.push({
      title: "学习目标",
      items: demo.management.learningObjectives.map(String),
    });
  }
  return cards.length ? cards : undefined;
}

function buildComplication(demo) {
  const d = demo.deterioration;
  if (!d) return undefined;
  const correct = (d.options || []).filter((o) => o.correct).map((o) => o.text);
  const wrong = (d.options || []).filter((o) => !o.correct).map((o) => o.text);
  const vitals = d.vitals
    ? Object.entries(d.vitals)
        .map(([k, v]) => `${k} ${v}`)
        .join("；")
    : "";
  return {
    title: d.title || "病情恶化提示",
    signs: [d.description, vitals].filter(Boolean).join(" "),
    actions: correct.slice(0, 3).join("；") || "按急危重症流程处理并及时升级处置。",
    wrongMoves: wrong.slice(0, 2).join("；") || undefined,
  };
}

function buildClinicalEvents(demo) {
  const d = demo.deterioration;
  const events = [];

  // 第一波：病情波动（尚未到极端恶化）
  events.push({
    id: "wave-1",
    title: "病情波动：症状再加重",
    description:
      "经过初期评估后，患者症状并未一帆风顺——疼痛/不适再次加重，出汗增多，焦虑明显，生命体征开始波动。需要立刻再评估并加快关键处置。",
    severity: "warn",
    afterMinute: 18,
    skipIfDecisions: ["P5", "P6"],
    vitals: "血压波动、心率增快、症状评分升高",
    options: [
      {
        id: "w1-a",
        text: "立即复查生命体征与关键床旁检查，加快完成关键药物/策略决策",
        correct: true,
      },
      {
        id: "w1-b",
        text: "安慰患者「再观察一会儿」，暂不调整处置",
        correct: false,
      },
      {
        id: "w1-c",
        text: "向患者说明当前风险，同时推进再灌注/解毒/手术等关键路径",
        correct: true,
      },
      {
        id: "w1-d",
        text: "先去做非紧急的全面检查清单，关键处置可以延后",
        correct: false,
      },
    ],
    resolveOk: "及时再评估并推进关键路径，第一波波动得到控制。",
    resolveBad: "延误关键处置，病情可能进一步恶化。",
  });

  if (d) {
    const vitals = d.vitals
      ? Object.entries(d.vitals)
          .map(([k, v]) => `${k} ${v}`)
          .join("；")
      : undefined;
    const options = (d.options || []).map((o, i) => ({
      id: String(o.id || `d${i + 1}`),
      text: String(o.text || ""),
      correct: Boolean(o.correct),
    }));
    events.push({
      id: "wave-2-deterioration",
      title: d.title || "病情恶化",
      description: String(d.description || "患者出现危急变化，需要紧急处置。"),
      severity: "critical",
      afterMinute: 42,
      afterEventId: "wave-1",
      skipIfDecisions: ["P6"],
      vitals,
      options: options.length
        ? options
        : [
            { id: "d1", text: "立即启动急危重症抢救流程并升级处置", correct: true },
            { id: "d2", text: "继续常规观察等待", correct: false },
          ],
      resolveOk: "危急变化处置到位，暂时稳住灌注/通气。",
      resolveBad: "危急变化处置不足，器官低灌注风险升高。",
    });
  }

  // 第三波：好转后再恶化（贴合「反反复复」）
  events.push({
    id: "wave-3-relapse",
    title: "再次波动：短暂稳定后再度恶化",
    description:
      "关键处置后病情一度好转，但随后再次出现恶化迹象（如再发胸痛/呼吸困难/血压不稳）。急诊疾病很少「一帆风顺」，需要持续动态评估。",
    severity: "critical",
    afterMinute: 65,
    afterEventId: d ? "wave-2-deterioration" : "wave-1",
    vitals: "再次出现低灌注或呼吸窘迫倾向",
    options: [
      {
        id: "r1",
        text: "立即复查生命体征与关键指标，排查机械并发症/再缺血/毒性反跳等",
        correct: true,
      },
      {
        id: "r2",
        text: "认为已经「治好了」，转普通病房观察即可",
        correct: false,
      },
      {
        id: "r3",
        text: "按恶化原因调整方案（升压/通气/再灌注/解毒加量等）并持续监测",
        correct: true,
      },
      {
        id: "r4",
        text: "加大镇静剂量让患者「安静下来」即可",
        correct: false,
      },
    ],
    resolveOk: "识别到再恶化并及时调整，体现动态评估能力。",
    resolveBad: "忽略再恶化信号，可能错失二次干预窗口。",
  });

  return events;
}

function buildScoringHints(demo) {
  const keywords = [];
  for (const g of demo.scoring?.diagnosisKeywords || []) {
    if (Array.isArray(g.keywords)) keywords.push(...g.keywords.map(String));
  }
  const meds = (demo.medicationOptions || [])
    .filter((m) => m.essential)
    .map((m) => String(m.name || ""))
    .filter(Boolean);
  const strategy = (demo.management?.strategies || [])
    .filter((s) => s.recommended)
    .map((s) => String(s.name || ""))
    .filter(Boolean);
  const profile =
    /stemi|chest-pain|胸痛|心梗/i.test(String(demo.id || "") + String(demo.title || ""))
      ? "stemi"
      : "generic";
  return {
    profile,
    diagnosisKeywords: [...new Set(keywords)].slice(0, 20),
    essentialMedNames: meds.slice(0, 8),
    recommendedStrategies: strategy.slice(0, 4),
  };
}

function convertOne(demo) {
  const level = demo.difficulty || "intermediate";
  const code = slugId(demo.id, demo.title);
  const patient = demo.patient || {};
  return {
    code,
    title: demo.title || code,
    difficulty: DIFF[level] || String(level),
    targetMinutes: TARGET[level] || "20–25",
    patient: {
      name: patient.name || "患者",
      age: patient.age ?? null,
      gender: patient.gender || "",
      occupation: patient.occupation || "",
      chief: patient.chiefComplaint || patient.chief || demo.openingMessage || "",
      history: patient.history || "",
    },
    qaNodes: buildQaNodes(demo),
    exams: buildExams(demo),
    physicalExam: buildPhysical(demo),
    decisionNodes: buildDecisions(demo),
    knowledgeCards: buildKnowledge(demo),
    complicationTeaching: buildComplication(demo),
    clinicalEvents: buildClinicalEvents(demo),
    scoringHints: buildScoringHints(demo),
    source: "demo-html",
    category: demo.category || "",
  };
}

function extractCasesArray(html) {
  const start = html.indexOf("const cases = [");
  if (start < 0) throw new Error("未找到 const cases = [");
  const from = start + "const cases = ".length;
  // 找到与 cases 数组匹配的结尾：`]` 后紧跟 `;` 且下一关键声明是 const phases
  const phases = html.indexOf("\n    const phases = [", from);
  if (phases < 0) throw new Error("未找到 const phases");
  let end = phases;
  while (end > from && html[end] !== "]") end -= 1;
  const literal = html.slice(from, end + 1);
  // eslint-disable-next-line no-new-func
  const cases = new Function(`return (${literal});`)();
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error("cases 解析为空");
  }
  return cases;
}

function main() {
  const html = fs.readFileSync(demoPath, "utf8");
  const demos = extractCasesArray(html);
  fs.mkdirSync(outDir, { recursive: true });

  // 保留客户确认验收病例 stemi-03，不覆盖
  const keep = new Set(["stemi-03.json", "test-appendicitis-01.json"]);
  const written = [];

  for (const demo of demos) {
    const cfg = convertOne(demo);
    // Demo 的 chest-pain-03 / stemi-typical-01 与验收 stemi-03 并存
    if (cfg.code === "stemi-03") cfg.code = "stemi-from-demo";
    const file = `${cfg.code}.json`;
    if (keep.has(file) && cfg.code === "stemi-03") continue;
    const outPath = path.join(outDir, file);
    // 去掉 undefined 字段
    const cleaned = JSON.parse(JSON.stringify(cfg));
    fs.writeFileSync(outPath, JSON.stringify(cleaned, null, 2), "utf8");
    written.push({ code: cleaned.code, title: cleaned.title, qa: cleaned.qaNodes.length, exams: cleaned.exams.length });
    console.log(`wrote ${file}  qa=${cleaned.qaNodes.length} exams=${cleaned.exams.length}`);
  }

  const indexPath = path.join(outDir, "_demo_import_index.json");
  fs.writeFileSync(indexPath, JSON.stringify(written, null, 2), "utf8");
  console.log(`done: ${written.length} cases`);
}

main();
