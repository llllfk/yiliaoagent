import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(error: string, status = 400, detail?: unknown) {
  return NextResponse.json(
    detail === undefined ? { error } : { error, detail },
    { status }
  );
}
