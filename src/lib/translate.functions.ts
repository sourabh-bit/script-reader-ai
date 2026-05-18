import { postJson } from "./api-client";
import type {
  LanguageCode,
  PrescriptionAnalysis,
  TranslatedPrescription,
} from "./prescription-types";
export {
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type TranslatedPrescription,
} from "./prescription-types";

export async function translatePrescription(input: {
  data: { analysis: PrescriptionAnalysis; language: LanguageCode };
}): Promise<TranslatedPrescription> {
  return postJson<TranslatedPrescription, { analysis: PrescriptionAnalysis; language: LanguageCode }>(
    "/api/translate",
    input.data,
  );
}
