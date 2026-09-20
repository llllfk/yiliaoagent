/**
 * AI 调用封装占位。
 * 一期问诊以规则匹配（附录 A）为主；LLM 仅作同义兜底，后续在此接入 Coze/外部模型。
 */
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chatCompletion(_messages: ChatMessage[]): Promise<string> {
  // TODO: 接入平台 LLM；当前返回空表示「未启用模型兜底」
  return "";
}
