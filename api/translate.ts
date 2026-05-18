import type { IncomingMessage, ServerResponse } from "node:http";
import { translatePrescriptionServer } from "../src/lib/translate.server.js";
import type { LanguageCode, PrescriptionAnalysis } from "../src/lib/prescription-types.js";
import { normalizeError, readJsonBody, sendJson, sendMethodNotAllowed } from "./_shared.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    sendMethodNotAllowed(res, "POST");
    return;
  }

  try {
    const body = await readJsonBody<{ analysis: PrescriptionAnalysis; language: LanguageCode }>(req);
    const result = await translatePrescriptionServer(body);
    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, 400, { error: normalizeError(error) });
  }
}
