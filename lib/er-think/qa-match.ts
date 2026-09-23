import type { QaNode } from "@/types";

export type MatchResult =
  | { hit: true; node: QaNode; score: number }
  | { hit: false; guide: string };

const EXTRA_INTENTS: Array<{ test: (node: QaNode) => boolean; intents: string[] }> = [
  {
    test: (n) => n.category.includes("主诉") || n.id === "Q1",
    intents: ["怎么了", "什么情况", "哪儿不舒服", "主诉", "怎么回事", "今天怎么来的"],
  },
  {
    test: (n) => n.category.includes("部位") || n.id === "Q2",
    intents: ["哪里疼", "痛在哪", "哪个位置", "具体哪儿疼", "胸骨后", "胸口哪里"],
  },
  {
    test: (n) => n.category.includes("性质") || n.id === "Q3",
    intents: ["怎么疼", "什么感觉", "压榨", "闷痛", "撕裂样吗", "是不是撕裂"],
  },
  {
    test: (n) => n.category.includes("程度") || n.id === "Q4",
    intents: ["多严重", "几分疼", "疼痛评分", "能不能忍受"],
  },
  {
    test: (n) => n.category.includes("放射") || n.id === "Q5",
    intents: ["放射痛", "肩膀疼吗", "左臂", "窜到哪", "别的地方疼", "下颌", "后背也疼吗"],
  },
  {
    test: (n) => n.category.includes("时间") || n.id === "Q6",
    intents: ["多长时间", "持续多久", "什么时候开始的", "起病多久"],
  },
  {
    test: (n) => n.category.includes("诱因") || n.category.includes("缓解") || n.id === "Q7",
    intents: ["什么诱因", "硝酸甘油", "休息能好吗", "怎么引起的", "含服有用吗"],
  },
  {
    test: (n) => n.category.includes("出汗") || n.id === "Q8",
    intents: ["出汗吗", "冷汗", "盗汗", "湿冷"],
  },
  {
    test: (n) => n.category.includes("消化道") || n.id === "Q9",
    intents: ["恶心吗", "呕吐", "想吐"],
  },
  {
    test: (n) => n.category.includes("呼吸") || n.category.includes("循环") || n.id === "Q10",
    intents: ["气短吗", "呼吸困难", "心慌吗", "咯血吗", "喘不上气"],
  },
  {
    test: (n) => n.category.includes("高血压") || n.id === "Q13",
    intents: ["高血压吗", "以前有什么病", "既往病史", "慢性病", "危险因素"],
  },
  {
    test: (n) => n.category.includes("糖尿病") || n.id === "Q14",
    intents: ["糖尿病吗", "血糖高吗"],
  },
  {
    test: (n) => n.category.includes("社会") || n.id === "Q16",
    intents: ["吸烟吗", "抽烟吗", "喝酒吗", "烟酒"],
  },
  {
    test: (n) => n.category.includes("家族") || n.id === "Q18",
    intents: ["家族史", "父母得过吗", "家里有人心梗", "父亲有没有"],
  },
  {
    test: (n) => n.safety || n.category.includes("安全") || n.id === "Q19",
    intents: ["过敏史", "药物过敏", "在吃什么药", "目前用药", "有没有过敏", "正在吃什么药"],
  },
];

const MORE_INTENTS: Array<{ test: (node: QaNode) => boolean; intents: string[] }> = [
  {
    test: (n) => n.category.includes("主诉") || n.id === "Q1",
    intents: ["今天怎么来的", "什么症状", "哪里不舒服", "您怎么了", "为啥来医院"],
  },
  {
    test: (n) => n.category.includes("部位") || n.id === "Q2",
    intents: ["疼痛位置", "胸口哪里", "疼的位置", "具体部位"],
  },
  {
    test: (n) => n.category.includes("性质") || n.id === "Q3",
    intents: ["什么样的疼痛", "压着疼吗", "刺痛还是闷痛", "疼痛性质"],
  },
  {
    test: (n) => n.category.includes("程度") || n.id === "Q4",
    intents: ["疼痛评分", "能不能忍", "有多痛", "VAS"],
  },
  {
    test: (n) => n.category.includes("放射") || n.id === "Q5",
    intents: ["有没有放射", "左胳膊", "后背疼吗", "放射到哪"],
  },
  {
    test: (n) => n.category.includes("时间") || n.id === "Q6",
    intents: ["发病多久", "从什么时候", "持续了多久", "起病时间"],
  },
  {
    test: (n) => n.category.includes("诱因") || n.category.includes("缓解") || n.id === "Q7",
    intents: ["活动后", "休息后缓解", "怎么缓解", "有没有诱因"],
  },
  {
    test: (n) => n.category.includes("出汗") || n.id === "Q8",
    intents: ["有没有出汗", "冒汗", "出冷汗吗"],
  },
  {
    test: (n) => n.category.includes("消化道") || n.id === "Q9",
    intents: ["有没有恶心", "呕吐吗", "恶心呕吐"],
  },
  {
    test: (n) => n.category.includes("呼吸") || n.category.includes("循环") || n.id === "Q10",
    intents: ["胸闷气短", "呼吸费力", "有没有气短", "心慌气短"],
  },
  {
    test: (n) => n.category.includes("高血压") || n.id === "Q13",
    intents: ["以前得过什么病", "有没有高血压", "既往有什么病"],
  },
  {
    test: (n) => n.category.includes("糖尿病") || n.id === "Q14",
    intents: ["有没有糖尿病", "血糖怎么样"],
  },
  {
    test: (n) => n.category.includes("社会") || n.id === "Q16",
    intents: ["吸烟史", "饮酒史", "抽烟喝酒", "有没有吸烟"],
  },
  {
    test: (n) => n.category.includes("家族") || n.id === "Q18",
    intents: ["家里人有没有心脏病", "家族有心梗吗", "父母心脏病"],
  },
];

function intentsOf(node: QaNode) {
  const extra = [...EXTRA_INTENTS, ...MORE_INTENTS]
    .filter((item) => item.test(node))
    .flatMap((item) => item.intents);
  return [...node.intents, ...extra];
}

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[？?！!。，,、.\s]/g, "");
}

/** 三层意图匹配：精确 > 前缀 > 包含；取最高分节点 */
export function matchQaIntent(
  input: string,
  nodes: QaNode[],
  unlockedIds: string[],
  allAsked: boolean
): MatchResult {
  const text = normalize(input);
  if (!text) {
    return { hit: false, guide: "请先描述需要了解的患者信息，例如疼痛部位。" };
  }

  let best: { node: QaNode; score: number } | null = null;

  for (const node of nodes) {
    for (const intent of intentsOf(node)) {
      const key = normalize(intent);
      if (key.length < 2) continue;
      if (key === "几分" && /分钟|小时/.test(text) && !/疼|痛|评分/.test(text)) continue;
      let score = 0;
      if (text === key) score = 200 + key.length;
      else if (text.includes(key)) score = 120 + key.length;
      else if (key.includes(text) && text.length >= 4) score = 70 + text.length;
      else if (text.startsWith(key) || (key.startsWith(text) && text.length >= 4)) score = 90 + key.length;
      if (score > 0 && (!best || score > best.score)) {
        best = { node, score };
      }
    }
  }

  if (best) {
    return { hit: true, node: best.node, score: best.score };
  }

  if (allAsked) {
    return {
      hit: false,
      guide: "该说的我都说了，您看还有什么需要了解的吗？",
    };
  }

  const remaining = nodes.filter((n) => !unlockedIds.includes(n.id));
  const hint = remaining[0]?.category || "疼痛部位或伴随症状";
  return {
    hit: false,
    guide: `您可以询问尚未了解的内容，例如：${hint}。`,
  };
}
