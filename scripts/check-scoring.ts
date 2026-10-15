import { matchQaIntent } from "../lib/er-think/qa-match";
import { determineBranch, recomputeScores } from "../lib/er-think/scoring";
import { createInitialSessionState } from "../types";
import type { CaseConfig, QaNode, SessionState } from "../types";
import stemi from "../data/cases/stemi-03.json";

const caseConfig = stemi as unknown as CaseConfig;
const nodes = stemi.qaNodes as QaNode[];
const samples: Array<[string, string]> = [
  ["您哪里不舒服", "Q1"],
  ["疼痛具体在哪个位置", "Q2"],
  ["是什么样的疼", "Q3"],
  ["疼痛有多严重，大概几分", "Q4"],
  ["疼痛有没有放射到别的地方", "Q5"],
  ["这个疼持续了多久", "Q6"],
  ["有什么诱因，硝酸甘油有用吗", "Q7"],
  ["有没有出汗", "Q8"],
  ["恶心呕吐吗", "Q9"],
  ["有没有气短心慌", "Q10"],
  ["以前有没有高血压", "Q13"],
  ["有没有糖尿病", "Q14"],
  ["吸烟吗", "Q16"],
  ["家里人有没有心梗", "Q18"],
  ["有没有药物过敏", "Q19"],
];

let hit = 0;
for (const [q, id] of samples) {
  const m = matchQaIntent(q, nodes, [], false);
  const got = m.hit ? m.node.id : "MISS";
  if (got === id) hit += 1;
  else console.log("MISS", q, "expected", id, "got", got);
}
console.log(`qa ${hit}/${samples.length} = ${((hit / samples.length) * 100).toFixed(1)}%`);

function base(): SessionState {
  return createInitialSessionState();
}

const onTime = base();
onTime.unlockedQaIds = nodes.slice(0, 8).map((n) => n.id);
onTime.physicalKeys = ["general", "heart"];
onTime.examsOrdered = [
  { examId: "ecg", orderedAtMinute: 2, readyAtMinute: 7, revealed: true },
  { examId: "troponin", orderedAtMinute: 6, readyAtMinute: 36, revealed: false },
];
onTime.eventLog = (caseConfig.clinicalEvents || []).map((ev, i) => ({
  eventId: ev.id,
  triggeredAt: 12 + i * 8,
  selectedOptionIds: [],
  correctCount: 2,
  totalCorrect: 2,
  resolvedAt: 14 + i * 8,
  avoided: false,
  allCorrect: true,
}));
console.log("on-time path", determineBranch(onTime, caseConfig));

const late = base();
late.examsOrdered = [
  { examId: "ecg", orderedAtMinute: 18, readyAtMinute: 23, revealed: true },
];
console.log("late ecg path", determineBranch(late, caseConfig));

const over = {
  ...onTime,
  examsOrdered: [
    ...onTime.examsOrdered,
    { examId: "cta", orderedAtMinute: 5, readyAtMinute: 20, revealed: false },
    { examId: "cxr", orderedAtMinute: 5, readyAtMinute: 15, revealed: false },
    { examId: "e4", orderedAtMinute: 6, readyAtMinute: 16, revealed: false },
  ],
};
console.log("overcheck path", determineBranch(over, caseConfig));

const scored = recomputeScores(onTime, nodes, caseConfig);
console.log("scores", scored.scores, "evidence", scored.scoreEvidence.length);
