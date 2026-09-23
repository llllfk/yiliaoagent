/**
 * 把各病例 clinicalEvents 调成更早、更密的「好转→再恶化」节奏，
 * 并确保至少 3 波（STEMI/中毒补第 4 波）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../data/cases");

const GENERIC_THIRD = {
  "abdominal-pain-01": {
    id: "abd-wave-3",
    title: "再次恶化：感染性休克倾向",
    description:
      "胆道感染/胰腺炎一度控制后，患者再次寒战、血压下降、意识变差，提示感染播散或休克。急腹症病程常反复加重。",
    severity: "critical",
    afterMinute: 24,
    vitals: "BP 下降，HR 增快，体温再升，尿量减少",
    options: [
      { id: "a3a", text: "按感染性休克集束：补液、早用广谱抗感染、监测乳酸与尿量", correct: true },
      { id: "a3b", text: "继续观察，等血培养结果再处理", correct: false },
      { id: "a3c", text: "评估手术/引流指征并升级监护", correct: true },
      { id: "a3d", text: "仅退热对症，不扩容不抗感染", correct: false },
    ],
    resolveOk: "识别感染再恶化并启动休克管理。",
    resolveBad: "延误抗感染与循环支持。",
  },
  "appendicitis-01": {
    id: "app-wave-3",
    title: "再次波动：穿孔/腹膜炎风险",
    description:
      "镇痛与观察后疼痛似乎减轻，随后全腹痛加重、反跳痛明显，提示可能穿孔或腹膜炎——阑尾炎也可「假缓解后再恶化」。",
    severity: "critical",
    afterMinute: 24,
    vitals: "全腹压痛反跳痛，体温升高，HR 增快",
    options: [
      { id: "ap3a", text: "立即外科会诊，禁食补液，完善手术前评估", correct: true },
      { id: "ap3b", text: "认为疼痛好转可以出院", correct: false },
      { id: "ap3c", text: "抗感染并动态复查腹部体征与炎症指标", correct: true },
      { id: "ap3d", text: "反复肌注强镇痛掩盖病情", correct: false },
    ],
    resolveOk: "识别穿孔风险并推进外科路径。",
    resolveBad: "假缓解后延误手术。",
  },
  "polytrauma-01": {
    id: "pt-wave-3",
    title: "再次恶化：创伤性凝血病 / 低体温三角",
    description:
      "初级复苏后一度血压回升，随后再次出血倾向、体温下降、凝血恶化——多发伤可进入「死亡三联征」方向。",
    severity: "critical",
    afterMinute: 24,
    vitals: "再发低血压，体温↓，凝血指标恶化",
    options: [
      { id: "pt3a", text: "损伤控制复苏：限制晶体、成分输血、保暖、尽快止血/手术", correct: true },
      { id: "pt3b", text: "大量晶体继续冲击至「正常血压」", correct: false },
      { id: "pt3c", text: "纠正酸中毒与低体温，同步外科止血", correct: true },
      { id: "pt3d", text: "暂停抢救观察自然恢复", correct: false },
    ],
    resolveOk: "识别再恶化并执行损伤控制策略。",
    resolveBad: "忽视死亡三联征。",
  },
  "septic-shock-01": {
    id: "ss-wave-3",
    title: "再次波动：液体复苏后仍低血压",
    description:
      "首轮补液与抗生素后生命体征短暂改善，随后 MAP 再次 <65 mmHg、乳酸仍高——脓毒症休克常需反复滴定升压与容量。",
    severity: "critical",
    afterMinute: 24,
    vitals: "MAP 再降，乳酸未降，尿量少",
    options: [
      { id: "ss3a", text: "启动/加用去甲肾上腺素，目标 MAP≥65，继续感染源控制", correct: true },
      { id: "ss3b", text: "停止治疗等待「自然好转」", correct: false },
      { id: "ss3c", text: "评估容量反应性，避免盲目过量补液，复查乳酸", correct: true },
      { id: "ss3d", text: "立即大剂量利尿减轻负荷", correct: false },
    ],
    resolveOk: "识别再休克并滴定升压与容量。",
    resolveBad: "遗漏升压或感染源控制。",
  },
};

const EXTRA_WAVES = {
  ...GENERIC_THIRD,
  "stemi-03": {
    id: "stemi-wave-4",
    title: "再次波动：再发胸痛 / 恶性心律失常风险",
    description:
      "左心衰倾向缓解后，患者再次出现胸痛加重，监护偶发室早、短阵室速倾向。STEMI 病程常反反复复：再缺血、再灌注损伤、心律失常可能接踵而来。",
    severity: "critical",
    afterMinute: 36,
    afterEventId: "stemi-wave-3",
    vitals: "胸痛再发，室早增多，血压波动",
    options: [
      {
        id: "sw4-a",
        text: "持续心电监护，准备除颤/抗心律失常，同时确认血运重建是否到位",
        correct: true,
      },
      {
        id: "sw4-b",
        text: "认为手术已做完，停止监护回病房",
        correct: false,
      },
      {
        id: "sw4-c",
        text: "复查心电图与电解质，评估再缺血并升级处理",
        correct: true,
      },
      {
        id: "sw4-d",
        text: "仅口头安慰，不调整监测级别",
        correct: false,
      },
    ],
    resolveOk: "识别再发缺血/心律失常风险并维持高危监护。",
    resolveBad: "过早降级监测，可能室颤或再梗。",
  },
  "organophosphate-01": {
    id: "op-wave-4",
    title: "再次好转后反跳：毒蕈碱样症状回潮",
    description:
      "中间综合征风险管控后，患者一度好转、分泌物减少；数十分钟后再次流涎、瞳孔缩小、肺部啰音回潮——有机磷可出现「假好转后反跳」。",
    severity: "warn",
    afterMinute: 40,
    afterEventId: "op-wave-3",
    vitals: "分泌物再增多，HR 变慢，SpO2 再次波动",
    options: [
      {
        id: "op4a",
        text: "按反跳处理：重新评估阿托品化，必要时追加阿托品并加强气道吸引",
        correct: true,
      },
      {
        id: "op4b",
        text: "认为已经痊愈，办理出院",
        correct: false,
      },
      {
        id: "op4c",
        text: "继续监护胆碱酯酶与呼吸，避免过早降级",
        correct: true,
      },
      {
        id: "op4d",
        text: "停药观察「自然恢复」",
        correct: false,
      },
    ],
    resolveOk: "识别反跳并重新滴定解毒与气道管理。",
    resolveBad: "忽视反跳，可能再次呼吸衰竭。",
  },
};

function retune(events) {
  if (!Array.isArray(events) || events.length === 0) return events;
  const schedule = [5, 14, 24, 34, 44];
  return events.map((ev, i) => ({
    ...ev,
    afterMinute: schedule[i] ?? 5 + i * 10,
    afterEventId: i === 0 ? undefined : events[i - 1]?.id || ev.afterEventId,
  }));
}

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".json") || file.startsWith("_") || file.startsWith("test-")) continue;
  const full = path.join(dir, file);
  const cfg = JSON.parse(fs.readFileSync(full, "utf8"));
  if (!Array.isArray(cfg.clinicalEvents)) cfg.clinicalEvents = [];

  const extra = EXTRA_WAVES[cfg.code];
  if (extra && !cfg.clinicalEvents.some((e) => e.id === extra.id)) {
    cfg.clinicalEvents.push(extra);
  }

  cfg.clinicalEvents = retune(cfg.clinicalEvents);

  // 首波文案强调「不会一帆风顺」
  if (cfg.clinicalEvents[0] && !/一帆风顺|反复|波动/.test(cfg.clinicalEvents[0].description)) {
    cfg.clinicalEvents[0].description +=
      " 急诊病程很少一帆风顺，今日好转不代表不会再次恶化。";
  }

  fs.writeFileSync(full, JSON.stringify(cfg, null, 2), "utf8");
  console.log(
    cfg.code,
    "waves=",
    cfg.clinicalEvents.length,
    "at",
    cfg.clinicalEvents.map((e) => e.afterMinute).join("/")
  );
}
