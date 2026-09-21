export type StudentAccountInput = {
  displayName?: string;
  username?: string;
  password?: string;
};

export function normalizeStudentAccount(
  input: StudentAccountInput,
  mode: "create" | "update"
):
  | { ok: true; displayName: string; username: string; password?: string }
  | { ok: false; error: string } {
  const displayName = (input.displayName || "").trim();
  const username = (input.username || "").trim();
  const password = input.password || "";

  if (!displayName || displayName.length > 100) {
    return { ok: false, error: "姓名不能为空，且不超过 100 字" };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/.test(username)) {
    return {
      ok: false,
      error: "账号需为 2–32 位字母、数字、下划线或中划线，且以字母或数字开头",
    };
  }
  if (mode === "create" && password.length < 6) {
    return { ok: false, error: "新建账号时密码至少 6 位" };
  }
  if (mode === "update" && password && password.length < 6) {
    return { ok: false, error: "新密码至少 6 位；不修改请留空" };
  }

  return {
    ok: true,
    displayName,
    username,
    password: password || undefined,
  };
}
