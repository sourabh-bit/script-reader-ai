import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import server from "../src/server";

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

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method ?? "GET",
    headers,
    body: body ? Buffer.from(body) : undefined,
    duplex: body ? "half" : undefined,
  };

  return new Request(url, init);
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

  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(webResponse.body as unknown as Parameters<typeof Readable.fromWeb>[0])
      .on("error", reject)
      .pipe(res)
      .on("finish", resolve)
      .on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.url === "/favicon.ico") {
    res.statusCode = 308;
    res.setHeader("location", "/logo.svg");
    res.end();
    return;
  }

  const body = await readRequestBody(req);
  const request = toWebRequest(req, body);
  const response = await server.fetch(request, process.env, {});
  await sendWebResponse(response, res);
}
