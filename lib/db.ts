import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __erThinkPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not defined。请在 Coze 启用数据库或配置环境变量后再连接。"
    );
  }

  return new Pool({
    connectionString,
    ssl:
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
    max: 10,
  });
}

export function getPool(): Pool {
  if (!global.__erThinkPool) {
    global.__erThinkPool = createPool();
  }
  return global.__erThinkPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

const pool = {
  query,
  getPool,
};

export default pool;
