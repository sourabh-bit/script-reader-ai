import type { IncomingMessage, ServerResponse } from "node:http";
import { analyzePrescriptionServer } from "../src/lib/analyze.server.js";
import { normalizeError, readJsonBody, sendJson, sendMethodNotAllowed } from "./_shared.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return;
  }

  try {
    const body = await readJsonBody<{ imageBase64: string; mimeType: string }>(req);
    const result = await analyzePrescriptionServer(body);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { error: normalizeError(error) });
  }
}
