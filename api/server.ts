import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import serverEntry from "../dist/server/server.js";

type ServerEntry = {
  fetch: (
    request: Request,
    env: Record<string, string | undefined>,
    ctx: { waitUntil?: (promise: Promise<unknown>) => void },
  ) => Promise<Response> | Response;
};

const server = serverEntry as ServerEntry;

async function readRequestBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) return undefined;
  return new Uint8Array(Buffer.concat(chunks));
}

function toWebRequest(req: IncomingMessage, body?: Uint8Array): Request {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:3000";
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const url = new URL(req.url ?? "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else {
      headers.set(key, value);
    }
  }

  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    body,
    duplex: body ? "half" : undefined,
  });
}

async function sendWebResponse(webResponse: Response, res: ServerResponse): Promise<void> {
  res.statusCode = webResponse.status;
  res.statusMessage = webResponse.statusText;

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const existing = res.getHeader("set-cookie");
      const next = existing
        ? Array.isArray(existing)
          ? [...existing, value]
          : [String(existing), value]
        : [value];
      res.setHeader("set-cookie", next);
      return;
    }

    res.setHeader(key, value);
  });

  if (!webResponse.body) {
    res.end();
    return;
  }

  Readable.fromWeb(webResponse.body as globalThis.ReadableStream<Uint8Array>).pipe(res);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readRequestBody(req);
  const request = toWebRequest(req, body);
  const response = await server.fetch(request, process.env, {});
  await sendWebResponse(response, res);
}
