import serverEntry from "../dist/server/server.js";

type ServerEntry = {
  fetch: (
    request: Request,
    env: Record<string, string | undefined>,
    ctx: { waitUntil?: (promise: Promise<unknown>) => void },
  ) => Promise<Response> | Response;
};

type EdgeContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export const config = {
  runtime: "edge",
};

const server = serverEntry as ServerEntry;

function createOriginalRequest(request: Request): Request {
  const rewrittenUrl = new URL(request.url);
  const originalPathname = rewrittenUrl.searchParams.get("pathname") ?? "/";

  rewrittenUrl.pathname = originalPathname;
  rewrittenUrl.searchParams.delete("pathname");

  return new Request(rewrittenUrl, request);
}

export default async function handler(request: Request, context: EdgeContext): Promise<Response> {
  return server.fetch(createOriginalRequest(request), process.env, {
    waitUntil: context.waitUntil?.bind(context),
  });
}
