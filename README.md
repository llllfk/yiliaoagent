# ER-Think 急诊临床思维训练系统

Coze（扣子）AI 编程兼容的 **Next.js 15 App Router** 全栈项目骨架。  
同一 Web：**学生训练台** + **教师看板**；一期病例 **STEMI #03**。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL（`DATABASE_URL`）
- Opaque Session（HttpOnly Cookie）
- 多租户：`tenant_id` 行级隔离

## 目录要点

```
app/
  login/                 登录
  train/                 学生三列训练台
  history/               学生训练记录（详情用 ?id=）
  dashboard/             教师看板
  cases/                 病例导入
  students/              学生管理
  sessions/              教师查看单次训练（?id=）
  api/                   REST API
components/              UI 与业务组件
lib/                     db / auth / er-think 引擎
data/cases/stemi-03.json 病例配置（附录 A 话术）
sql/schema.sql           建表
scripts/init-db.mjs      建表 + 种子账号
```

## 鉴权选型

采用 **Opaque Session**（随机 token + `auth_sessions` 存 SHA-256），便于踢人/退出立即失效。  
未采用 JWT。

## 本地 / Coze 启动

1. 安装依赖：`npm install`
2. 复制环境变量：`cp .env.example .env.local`，填入 `DATABASE_URL`、`SESSION_SECRET`
3. 初始化库：`npm run db:init`
4. 开发：`npm run dev`（`0.0.0.0:5000`，适配 Coze）
5. 构建：`npm run build && npm start`

### 种子账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 教师 | teacher | Teacher123! |
| 学生 | student1 | Student123! |

## 导入 Coze 步骤（给你）

1. 把本目录推到 GitHub
2. 在扣子编程中「从 GitHub 导入」
3. 启用 PostgreSQL，执行 `sql/schema.sql` 或在沙箱跑 `npm run db:init`
4. 配置环境变量：`DATABASE_URL`、`SESSION_SECRET`；公网预览建议加 `APP_ORIGINS`、`TRUST_PROXY=true`
5. 把连接信息发回开发侧（**不要**把密码贴到公开群，可私发）

## 生产最小环境变量

| 变量 | 是否必需 | 说明 |
|------|----------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `SESSION_SECRET` | 是 | 会话相关密钥（长随机串） |
| `APP_ORIGINS` | 建议 | Coze 预览/生产域名（含 https，无尾斜杠） |
| `TRUST_PROXY` | 建议 | Coze 反代设 `true` |
| `ENFORCE_APP_ORIGINS` | 可选 | 默认 false；开启后严格校验 Origin |

## 框架已具备 / 待迭代

**已具备：** 登录与角色分流、训练会话 CRUD、问诊规则匹配、检查开立与时钟、P1–P8 记录、结束复盘占位、教师列表与详情、多租户表结构。

**待迭代：** 六维评分细则补全（对照三视角说明书 4.2）、分支文案、报告导出、LLM 同义兜底、更多病例（附录 D）。

## 规范依据

- `Coze项目代码结构规范_多租户.md`
- 客户确认：云端 Web + 师生两端 + STEMI MVP
