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

export default async function handler(request: Request, context: EdgeContext): Promise<Response> {
  return server.fetch(request, process.env, {
    waitUntil: context.waitUntil?.bind(context),
  });
}
