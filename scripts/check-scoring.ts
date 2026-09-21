import { matchQaIntent } from "../lib/er-think/qa-match";
import { determineBranch, recomputeScores } from "../lib/er-think/scoring";
import { createInitialSessionState } from "../types";
import type { QaNode, SessionState } from "../types";
import stemi from "../data/cases/stemi-03.json";

const nodes = stemi.qaNodes as QaNode[];
const samples: Array<[string, string]> = [
  ["您哪里不舒服", "Q1"],
  ["今天怎么来的", "Q1"],
  ["疼痛具体在哪个位置", "Q2"],
  ["胸口哪里疼", "Q2"],
  ["是什么样的疼", "Q3"],
  ["压榨感吗", "Q3"],
  ["疼痛有多严重，大概几分", "Q4"],
  ["能不能忍受", "Q4"],
  ["疼痛有没有放射到别的地方", "Q5"],
  ["左胳膊麻吗", "Q5"],
  ["这个疼持续了多久", "Q6"],
  ["什么时候开始的", "Q6"],
  ["有什么诱因，硝酸甘油有用吗", "Q7"],
  ["休息后能缓解吗", "Q7"],
  ["有没有出汗", "Q8"],
  ["出冷汗吗", "Q8"],
  ["恶心呕吐吗", "Q9"],
  ["有没有恶心", "Q9"],
  ["有没有气短心慌", "Q10"],
  ["呼吸费力吗", "Q10"],
  ["以前有没有高血压", "Q13"],
  ["既往有什么病", "Q13"],
  ["有没有糖尿病", "Q14"],
  ["血糖怎么样", "Q14"],
  ["吸烟吗", "Q16"],
  ["有没有吸烟饮酒", "Q16"],
  ["家里人有没有心梗", "Q18"],
  ["父母有没有心脏病", "Q18"],
  ["有没有药物过敏", "Q19"],
  ["现在在吃什么药", "Q19"],
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
onTime.decisions.P2 = { reason: "10分钟内完成心电图，符合指南时间窗", atMinute: 4 };
onTime.decisions.P5 = { reason: "阿司匹林 300 加替格瑞洛 180 加低分子肝素", atMinute: 8 };
onTime.decisions.P6 = { reason: "优先PCI，90分钟内送导管室", atMinute: 9 };
onTime.examsOrdered = [
  { examId: "ecg", orderedAtMinute: 2, readyAtMinute: 7, revealed: true },
  { examId: "echo", orderedAtMinute: 6, readyAtMinute: 21, revealed: false },
];
console.log("echo not overtest", determineBranch(onTime));

const warfarin = base();
warfarin.decisions.P2 = { reason: "10分钟内心电图", atMinute: 3 };
warfarin.decisions.P5 = { reason: "先给华法林", atMinute: 6 };
warfarin.decisions.P6 = { reason: "优先PCI", atMinute: 8 };
warfarin.examsOrdered = [{ examId: "ecg", orderedAtMinute: 2, readyAtMinute: 7, revealed: true }];
console.log("warfarin path", determineBranch(warfarin));

const over = { ...onTime, examsOrdered: [...onTime.examsOrdered, { examId: "cta", orderedAtMinute: 5, readyAtMinute: 20, revealed: false }] };
console.log("cta path", determineBranch(over));

const scored = recomputeScores(
  {
    ...onTime,
    unlockedQaIds: nodes.map((n) => n.id),
    decisions: {
      ...onTime.decisions,
      P1: { reason: "胸痛伴大汗，按II级立即处理", atMinute: 1 },
      P4: { reason: "首位STEMI，排查主动脉夹层和肺栓塞，鉴别胆绞痛与胃食管反流", atMinute: 7 },
      P7: { reason: "术前每15分钟复查生命体征和心电图，肌钙蛋白2小时复查，警惕出血和造影剂肾病", atMinute: 10 },
      P8: { reason: "依据ESC 2023指南，D2B小于90分钟，优先PCI", atMinute: 11 },
    },
  },
  nodes
);
console.log("scores", scored.scores, "evidence", scored.scoreEvidence.length);
