import type { QaNode } from "@/types";

export type MatchResult =
  | { hit: true; node: QaNode; score: number }
  | { hit: false; guide: string };

/** 三层意图匹配：精确 > 前缀 > 包含；取最高分节点 */
export function matchQaIntent(
  input: string,
  nodes: QaNode[],
  unlockedIds: string[],
  allAsked: boolean
): MatchResult {
  const text = input.trim().toLowerCase();
  if (!text) {
    return { hit: false, guide: "请先描述需要了解的患者信息，例如疼痛部位。" };
  }

  let best: { node: QaNode; score: number } | null = null;

  for (const node of nodes) {
    for (const intent of node.intents) {
      const key = intent.toLowerCase();
      let score = 0;
      if (text === key) score = 100;
      else if (text.startsWith(key) || key.startsWith(text)) score = 80;
      else if (text.includes(key) || key.includes(text)) score = 60;
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
