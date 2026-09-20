# AGENTS.md — ER-Think

## 产品

- 名称：ER-Think 急诊临床思维训练
- 形态：Coze 云端 **Web**（非纯对话 Bot）
- 角色：`student` 训练台 / `teacher` 看板
- 一期病例：`stemi-03`（附录 A/B 验收）

## 强制约定

1. Next.js 15 **App Router**；禁止 Pages Router / custom server / `output: "standalone"`
2. 端口 **5000**，监听 **0.0.0.0**
3. 数据库仅通过 `DATABASE_URL`；禁止硬编码连接串
4. API 返回 `{ data }` / `{ error }`；SQL 必须参数化
5. 多租户查询必须带 `tenant_id`
6. 鉴权：**Opaque Session**（见 `lib/auth.ts`），不要改成散落 JWT
7. 评分必须规则化可追溯；禁止模型直接给黑盒总分
8. CSP 需放行 `unsafe-eval` 与 `https://lf-cdn.coze.cn`（见 `next.config.ts`）

## 关键路径

- 问诊匹配：`lib/er-think/qa-match.ts`
- 评分/分支：`lib/er-think/scoring.ts`
- 病例配置：`data/cases/*.json` + 表 `cases.config`
- 会话状态：`training_sessions.state`（jsonb）
