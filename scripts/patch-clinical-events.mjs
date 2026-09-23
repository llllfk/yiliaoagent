/**
 * 为 Demo 导入病例补全多波病情演变（恶化→好转→再恶化）。
 * node scripts/patch-clinical-events.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../data/cases");

const EVENTS = {
  "organophosphate-01": [
    {
      id: "op-wave-1",
      title: "病情波动：毒蕈碱样症状加重",
      description:
        "洗胃/解毒过程中，患者流涎、出汗、肺部啰音增多，呼吸费力——有机磷中毒常在治疗后仍波动。",
      severity: "warn",
      afterMinute: 14,
      vitals: "HR 偏慢，分泌物增多，SpO2 下降",
      options: [
        { id: "op1a", text: "加大阿托品并评估阿托品化指标，同时加强吸痰/气道管理", correct: true },
        { id: "op1b", text: "认为已经解毒完成，停止观察", correct: false },
        { id: "op1c", text: "继续联用复能剂，监测胆碱酯酶与呼吸", correct: true },
        { id: "op1d", text: "立即大剂量利尿「减轻肺水肿」", correct: false },
      ],
      resolveOk: "第一波分泌物/呼吸波动得到控制。",
      resolveBad: "解毒不足或气道管理不当，可能进展为呼吸衰竭。",
    },
    {
      id: "op-wave-2",
      title: "病情恶化：呼吸衰竭",
      description:
        "一度好转后，患者突发呼吸浅慢、意识变差、血氧继续下降——中毒病程可再次恶化为呼吸衰竭。",
      severity: "critical",
      afterMinute: 36,
      afterEventId: "op-wave-1",
      vitals: "SpO2 明显下降，呼吸衰竭征象，意识变差",
      options: [
        { id: "op2a", text: "立即气管插管机械通气，充分吸痰保持气道通畅", correct: true },
        { id: "op2b", text: "吗啡镇静观察", correct: false },
        { id: "op2c", text: "加大阿托品拮抗分泌物，同时升级气道支持", correct: true },
        { id: "op2d", text: "β 阻滞剂减慢心率", correct: false },
      ],
      resolveOk: "气道与解毒并进，呼吸衰竭暂控。",
      resolveBad: "延误插管或错误用药，危及生命。",
    },
    {
      id: "op-wave-3",
      title: "再次波动：中间综合征/肌无力风险",
      description:
        "呼吸支持后病情似乎稳定，随后再次出现肌力下降、呼吸机对抗或脱机困难，提示中间期综合征可能，需要持续评估。",
      severity: "critical",
      afterMinute: 58,
      afterEventId: "op-wave-2",
      vitals: "肌力下降，呼吸机参数需求上升",
      options: [
        { id: "op3a", text: "维持呼吸支持，复查胆碱酯酶，按方案调整解毒与复能剂", correct: true },
        { id: "op3b", text: "强行脱机转普通病房", correct: false },
        { id: "op3c", text: "警惕反跳与中间综合征，延长监护与动态评估", correct: true },
        { id: "op3d", text: "停用所有解毒药观察「自然恢复」", correct: false },
      ],
      resolveOk: "识别反复病程并维持支持治疗。",
      resolveBad: "过早降级监护，可能再次呼吸衰竭。",
    },
  ],
  "appendicitis-01": [
    {
      id: "ap-wave-1",
      title: "病情波动：疼痛与发热加重",
      description: "观察期间右下腹痛加重、低热升高，压痛反跳痛更明显——急腹症可在短时间内进展。",
      severity: "warn",
      afterMinute: 14,
      vitals: "T 升高，HR 增快，右下腹压痛加重",
      options: [
        { id: "ap1a", text: "禁食、补液、完善血常规/影像，外科会诊评估手术时机", correct: true },
        { id: "ap1b", text: "给止痛药后让患者回家观察", correct: false },
        { id: "ap1c", text: "经验性抗感染并持续复评估表体征", correct: true },
        { id: "ap1d", text: "灌肠通便「缓解腹痛」", correct: false },
      ],
      resolveOk: "及时升级评估，避免延误。",
      resolveBad: "掩盖症状或延误外科处置。",
    },
    {
      id: "ap-wave-2",
      title: "病情恶化：穿孔/腹膜炎征象",
      description: "一度症状略缓后，腹痛变为全腹，腹肌紧张，提示可能穿孔并腹膜炎。",
      severity: "critical",
      afterMinute: 38,
      afterEventId: "ap-wave-1",
      vitals: "全腹压痛反跳痛，HR 更快，可能低血压",
      options: [
        { id: "ap2a", text: "立即外科急诊手术评估，抗休克/抗感染并行", correct: true },
        { id: "ap2b", text: "继续门诊随访", correct: false },
        { id: "ap2c", text: "复苏、备血、术前准备并缩短术前时间", correct: true },
        { id: "ap2d", text: "仅口服抗生素观察 24 小时", correct: false },
      ],
      resolveOk: "识别穿孔腹膜炎并推进确定性治疗。",
      resolveBad: "延误手术可导致脓毒症。",
    },
  ],
  "abdominal-pain-01": [
    {
      id: "abd-wave-1",
      title: "病情波动：黄疸与腹痛加重",
      description: "胆源性急腹症过程中腹痛、黄疸、发热可反复加重（Charcot 表现波动）。",
      severity: "warn",
      afterMinute: 14,
      vitals: "发热，HR 增快，黄疸加深",
      options: [
        { id: "ab1a", text: "禁食补液，完善肝功/血常规/影像，评估胆管炎/胰腺炎", correct: true },
        { id: "ab1b", text: "按普通胃炎给促消化药回家", correct: false },
        { id: "ab1c", text: "广谱抗感染并请消化/胆道专科评估引流指征", correct: true },
        { id: "ab1d", text: "强力按摩腹部「通气」", correct: false },
      ],
      resolveOk: "识别高危胆道感染路径。",
      resolveBad: "可能进展为脓毒症。",
    },
    {
      id: "abd-wave-2",
      title: "病情恶化：感染性休克倾向",
      description: "治疗后一度好转，随后血压下降、意识变差，提示重症胆管炎/胰腺炎相关休克。",
      severity: "critical",
      afterMinute: 40,
      afterEventId: "abd-wave-1",
      vitals: "低血压，乳酸可能升高，尿量减少",
      options: [
        { id: "ab2a", text: "液体复苏、血管活性药、早期有效抗感染，急诊胆道减压评估", correct: true },
        { id: "ab2b", text: "继续观察不做引流", correct: false },
        { id: "ab2c", text: "按脓毒症集束化处理并动态复查器官功能", correct: true },
        { id: "ab2d", text: "大剂量吗啡镇静等待", correct: false },
      ],
      resolveOk: "休克与源控并进。",
      resolveBad: "未解除梗阻/感染源，休克难逆。",
    },
  ],
  "polytrauma-01": [
    {
      id: "pt-wave-1",
      title: "病情波动：血压再降",
      description: "初步复苏后血压短暂回升，随后再次下降——多发伤出血/休克常反复。",
      severity: "warn",
      afterMinute: 12,
      vitals: "BP 再次下降，HR 增快，意识波动",
      options: [
        { id: "pt1a", text: "ABCDE 再评估，控制外出血，加速输血/手术止血决策", correct: true },
        { id: "pt1b", text: "认为已经稳定，减少监测", correct: false },
        { id: "pt1c", text: "床旁超声/胸腹评估定位出血，同步复苏", correct: true },
        { id: "pt1d", text: "仅给大量晶体液不顾凝血", correct: false },
      ],
      resolveOk: "识别再休克并推进止血。",
      resolveBad: "延误止血可致命。",
    },
    {
      id: "pt-wave-2",
      title: "病情恶化：创伤性凝血病/酸中毒",
      description: "持续低灌注后出现凝血异常、乳酸升高，进入「死亡三联征」风险。",
      severity: "critical",
      afterMinute: 34,
      afterEventId: "pt-wave-1",
      vitals: "凝血差，低体温风险，乳酸升高",
      options: [
        { id: "pt2a", text: "损伤控制复苏：限制性液体、血液制品、保温、尽快手术止血", correct: true },
        { id: "pt2b", text: "长时间完善全部影像再进手术室", correct: false },
        { id: "pt2c", text: "纠正低体温酸中毒凝血病，并行确定性/损伤控制手术", correct: true },
        { id: "pt2d", text: "单用升压药维持血压，不处理出血源", correct: false },
      ],
      resolveOk: "损伤控制策略到位。",
      resolveBad: "忽视死亡三联征将迅速恶化。",
    },
  ],
  "septic-shock-01": [
    {
      id: "ss-wave-1",
      title: "病情波动：灌注再恶化",
      description: "初始补液后血压短暂改善，随后再次低血压、乳酸不降——脓毒症休克常反复。",
      severity: "warn",
      afterMinute: 12,
      vitals: "MAP 下降，乳酸偏高，尿量少",
      options: [
        { id: "ss1a", text: "继续目标导向复苏，必要时去甲肾上腺素维持 MAP≥65", correct: true },
        { id: "ss1b", text: "停止补液与升压，观察自然恢复", correct: false },
        { id: "ss1c", text: "1 小时内有效抗感染，复查乳酸与尿量", correct: true },
        { id: "ss1d", text: "大剂量利尿减轻「水肿」", correct: false },
      ],
      resolveOk: "集束化治疗持续推进。",
      resolveBad: "灌注与抗感染中断。",
    },
    {
      id: "ss-wave-2",
      title: "病情恶化：器官功能障碍加重",
      description: "一度稳定后出现呼吸衰竭/肾损伤加重，提示多器官功能障碍进展。",
      severity: "critical",
      afterMinute: 38,
      afterEventId: "ss-wave-1",
      vitals: "氧合下降，肌酐上升，意识变差",
      options: [
        { id: "ss2a", text: "升级呼吸支持，维持灌注，寻找并控制感染源", correct: true },
        { id: "ss2b", text: "转出 ICU 普通病房", correct: false },
        { id: "ss2c", text: "按脓毒症指南动态调整抗感染与器官支持", correct: true },
        { id: "ss2d", text: "停抗生素「减少耐药」", correct: false },
      ],
      resolveOk: "器官支持与源控并进。",
      resolveBad: "降级治疗可导致不可逆损害。",
    },
  ],
  "chest-pain-03": null, // copy from stemi with renamed ids
  "stemi-typical-01": null,
};

function stemiLike(prefix) {
  return [
    {
      id: `${prefix}-wave-1`,
      title: "病情波动：胸痛再发加重",
      description: "评估中胸痛再次加重、大汗——STEMI 病程很少一帆风顺。",
      severity: "warn",
      afterMinute: 12,
      skipIfDecisions: ["P5", "P6"],
      vitals: "HR 增快，疼痛加重，出汗",
      options: [
        { id: `${prefix}1a`, text: "复查生命体征与心电图，加快抗栓/再灌注", correct: true },
        { id: `${prefix}1b`, text: "先做完全部非紧急检查再处理", correct: false },
        { id: `${prefix}1c`, text: "启动/加速胸痛绿色通道", correct: true },
        { id: `${prefix}1d`, text: "劝患者再忍忍", correct: false },
      ],
      resolveOk: "第一波波动得到响应。",
      resolveBad: "延误再灌注。",
    },
    {
      id: `${prefix}-wave-2`,
      title: "病情恶化：心源性休克",
      description: "突发低血压、意识变差、湿冷——即使治疗已开始，仍可能进展为休克。",
      severity: "critical",
      afterMinute: 34,
      afterEventId: `${prefix}-wave-1`,
      vitals: "BP 明显下降，意识模糊",
      options: [
        { id: `${prefix}2a`, text: "休克抢救 + 紧急 PCI/血运重建", correct: true },
        { id: `${prefix}2b`, text: "加大硝酸甘油观察", correct: false },
        { id: `${prefix}2c`, text: "升压维持灌注并推进再灌注", correct: true },
        { id: `${prefix}2d`, text: "长时间等待溶栓效果", correct: false },
      ],
      resolveOk: "休克与再灌注并行。",
      resolveBad: "低灌注加重。",
    },
    {
      id: `${prefix}-wave-3`,
      title: "再次恶化：合并心衰倾向",
      description: "一度好转后又出现呼吸困难、肺淤血——泵功能可反复恶化。",
      severity: "critical",
      afterMinute: 54,
      afterEventId: `${prefix}-wave-2`,
      vitals: "呼吸困难，湿啰音，氧饱和度下降",
      options: [
        { id: `${prefix}3a`, text: "半卧位、氧疗/通气支持，继续血运重建", correct: true },
        { id: `${prefix}3b`, text: "认为已愈，转普通病房停监护", correct: false },
        { id: `${prefix}3c`, text: "床旁评估并准备升级循环支持", correct: true },
        { id: `${prefix}3d`, text: "静脉 β 阻滞剂强行降心率", correct: false },
      ],
      resolveOk: "识别再恶化并支持泵功能。",
      resolveBad: "忽视再恶化。",
    },
  ];
}

EVENTS["chest-pain-03"] = stemiLike("cp");
EVENTS["stemi-typical-01"] = stemiLike("st");

for (const [code, events] of Object.entries(EVENTS)) {
  const file = path.join(dir, `${code}.json`);
  if (!fs.existsSync(file)) {
    console.warn("missing", code);
    continue;
  }
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  obj.clinicalEvents = events;
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
  console.log("patched", code, "events=", events.length);
}

console.log("done");
