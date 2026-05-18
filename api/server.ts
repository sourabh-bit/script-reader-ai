import serverEntry from "../dist/server/server.js";

type ServerEntry = {
  fetch: (
    request: Request,
    env: Record<string, string | undefined>,
    ctx: { waitUntil?: (promise: Promise<unknown>) => void },
  ) => Promise<Response> | Response;
};

const server = serverEntry as ServerEntry;

function toAbsoluteRequest(request: Request): Request {
  try {
    new URL(request.url);
    return request;
  } catch {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") ?? "https";
    const absoluteUrl = new URL(request.url, `${protocol}://${host}`);
    return new Request(absoluteUrl, request);
  }
}

export default async function handler(request: Request): Promise<Response> {
  return server.fetch(toAbsoluteRequest(request), process.env, {});
}
