import type { IncomingMessage, ServerResponse } from "node:http";

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    throw new Error("Request body is required");
  }

  return JSON.parse(raw) as T;
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function sendMethodNotAllowed(res: ServerResponse, allowed: string): void {
  res.statusCode = 405;
  res.setHeader("allow", allowed);
  sendJson(res, 405, { error: `Method not allowed. Use ${allowed}.` });
}

export function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error";
}
