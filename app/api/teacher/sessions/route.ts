import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(["teacher"]);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const branch = searchParams.get("branch");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const params: unknown[] = [user.tenantId];
    let where = `WHERE s.tenant_id = $1`;
    if (status) {
      params.push(status);
      where += ` AND s.status = $${params.length}`;
    }
    if (branch) {
      params.push(branch);
      where += ` AND s.branch_path = $${params.length}`;
    }
    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND s.started_at::date >= $${params.length}::date`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND s.started_at::date <= $${params.length}::date`;
    }

    const result = await query(
      `SELECT s.id, s.status, s.score_total, s.branch_path, s.started_at, s.finished_at,
              u.display_name AS student_name, u.username, u.student_no,
              c.code AS case_code, c.title AS case_title
       FROM training_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN cases c ON c.id = s.case_id
       ${where}
       ORDER BY s.started_at DESC
       LIMIT 200`,
      params
    );

    return ok({ sessions: result.rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取班级训练数据失败", 500);
  }
}
