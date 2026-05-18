declare module "*/dist/server/server.js" {
  type ServerEntry = {
    fetch: (
      request: Request,
      env: Record<string, string | undefined>,
      ctx: { waitUntil?: (promise: Promise<unknown>) => void },
    ) => Promise<Response> | Response;
  };

  const serverEntry: ServerEntry;

  export default serverEntry;
}
