import serverEntry from "../dist/server/server.js";

type ServerEntry = {
  fetch: (
    request: Request,
    env: Record<string, string | undefined>,
    ctx: { waitUntil?: (promise: Promise<unknown>) => void },
  ) => Promise<Response> | Response;
};

const server = serverEntry as ServerEntry;

export default async function handler(request: Request): Promise<Response> {
  return server.fetch(request, process.env, {});
}
