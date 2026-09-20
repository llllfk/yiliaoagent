import { ok } from "@/lib/api";

export async function GET() {
  return ok({
    service: "er-think",
    status: "ok",
    time: new Date().toISOString(),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
  });
}
