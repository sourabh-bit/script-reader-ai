import { postJson } from "./api-client";
import type { PrescriptionAnalysis } from "./prescription-types";

export type { Medication, PrescriptionAnalysis } from "./prescription-types";

export async function analyzePrescription(input: {
  data: { imageBase64: string; mimeType: string };
}): Promise<PrescriptionAnalysis> {
  return postJson<PrescriptionAnalysis, { imageBase64: string; mimeType: string }>(
    "/api/analyze",
    input.data,
  );
}
