import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = await pool.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1"
);
console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));

const users = await pool.query(
  "select username, role, display_name from users order by id"
);
console.log("users:", users.rows);

const cases = await pool.query("select code, title from cases");
console.log("cases:", cases.rows);

await pool.end();
