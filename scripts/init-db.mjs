import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const casesDir = path.join(root, "data/cases");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("请先设置 DATABASE_URL");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl:
      databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false },
  });

  const schema = fs.readFileSync(path.join(root, "sql/schema.sql"), "utf8");
  await pool.query(schema);
  console.log("schema applied");

  const teacherHash = await bcrypt.hash("Teacher123!", 12);
  const studentHash = await bcrypt.hash("Student123!", 12);

  await pool.query(
    `INSERT INTO tenants (code, name, config)
     VALUES ('demo', '演示租户（吉大急诊试点）', '{"product":"ER-Think"}'::jsonb)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );

  const tenant = await pool.query(`SELECT id FROM tenants WHERE code = 'demo'`);
  const tenantId = tenant.rows[0].id;

  await pool.query(
    `INSERT INTO users (tenant_id, username, password_hash, display_name, role, student_no)
     VALUES
       ($1, 'teacher', $2, '尚老师', 'teacher', NULL),
       ($1, 'student1', $3, '李明', 'student', 'S2026001')
     ON CONFLICT (tenant_id, username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role`,
    [tenantId, teacherHash, studentHash]
  );

  const files = fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_") && !f.startsWith("test-"));

  for (const file of files) {
    const caseJson = fs.readFileSync(path.join(casesDir, file), "utf8");
    const caseObj = JSON.parse(caseJson);
    if (!caseObj.code || !caseObj.title) {
      console.warn("skip invalid", file);
      continue;
    }
    await pool.query(
      `INSERT INTO cases (tenant_id, code, title, difficulty, target_minutes, config, is_published)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, TRUE)
       ON CONFLICT (tenant_id, code) DO UPDATE
         SET title = EXCLUDED.title,
             difficulty = EXCLUDED.difficulty,
             target_minutes = EXCLUDED.target_minutes,
             config = EXCLUDED.config,
             is_published = TRUE,
             updated_at = NOW()`,
      [
        tenantId,
        caseObj.code,
        caseObj.title,
        caseObj.difficulty || null,
        caseObj.targetMinutes || null,
        caseJson,
      ]
    );
    console.log("seed case", caseObj.code);
  }

  console.log("seed ok,", files.length, "cases");
  console.log("accounts: teacher / Teacher123! ; student1 / Student123!");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
