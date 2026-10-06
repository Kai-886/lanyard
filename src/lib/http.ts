import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { RequestError } from "@/lib/api";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(status: number, message: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: { message, fields } }, { status });
}

function fieldsFromZod(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Validate an already-parsed body against a schema. */
export function parseWith<T>(
  schema: ZodType<T>,
  raw: unknown,
): { data: T; error?: never } | { data?: never; error: NextResponse } {
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: fail(422, "Check the highlighted fields", fieldsFromZod(result.error)) };
  }
  return { data: result.data };
}

/** Parse + validate a JSON body, returning either data or a ready-to-return response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: fail(400, "Request body must be valid JSON") };
  }
  return parseWith(schema, raw);
}

/**
 * Turn any thrown value into a consistent JSON error response.
 * `RequestError` and anything carrying an explicit numeric `status` (how the
 * domain layer reports 404/409/422) keep their status code.
 */
export function handleError(err: unknown) {
  if (err instanceof RequestError) return fail(err.status, err.message, err.fields);
  if (err instanceof ZodError) return fail(422, "Invalid input", fieldsFromZod(err));

  const e = err as { status?: unknown; message?: unknown; fields?: unknown };
  if (typeof e?.status === "number") {
    return fail(
      e.status,
      typeof e.message === "string" ? e.message : "Request failed",
      typeof e.fields === "object" && e.fields !== null
        ? (e.fields as Record<string, string>)
        : undefined,
    );
  }

  console.error("[api]", err);
  return fail(500, "Something went wrong on our side. Try again.");
}
