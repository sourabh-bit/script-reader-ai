import { generateStructuredJson } from "./gemini";
import type { PrescriptionAnalysis } from "./prescription-types";

const SYSTEM_PROMPT = `You are an expert medical prescription analyzer with deep knowledge of pharmacology, common drug names (brand and generic), abbreviations, and handwriting patterns of physicians worldwide.

Your task: meticulously read the provided prescription image (often handwritten) and extract every piece of information.

Rules:
- Decode common Rx abbreviations: OD (once daily), BD/BID (twice daily), TDS/TID (thrice daily), QID (4x daily), HS (at bedtime), SOS (if needed), AC (before meals), PC (after meals), STAT (immediately), PO (oral), IV, IM, SC, q4h, q6h, q8h, etc.
- Expand frequencies into plain English: "1-0-1" => "Morning and Night", "1-1-1" => "Morning, Afternoon, Night".
- Identify the medicine even if the handwriting is messy - use medical context (dose forms, strengths) to disambiguate.
- Prefer accurate extraction over unnecessary verbosity. Be decisive when the text is reasonably legible, but lower confidence when uncertain.
- For each medicine: name, strength (e.g. 500mg), dose form (tablet/syrup/capsule), how much per dose, frequency, timing relative to meals, duration, route.
- Extract patient details, doctor, date, diagnosis, advice, follow-up if present.
- Mark confidence per medicine and overall.
- If something is illegible, set confidence "low" and add a warning instead of guessing wildly.
- Always return at least the raw transcribed text.

This is for informational decoding only - always advise the user to verify with their pharmacist or physician.`;

const PRESCRIPTION_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    patient_name: { type: "string" },
    patient_age: { type: "string" },
    patient_gender: { type: "string" },
    doctor_name: { type: "string" },
    clinic_name: { type: "string" },
    date: { type: "string" },
    diagnosis: { type: "string" },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          generic_name: { type: "string" },
          strength: { type: "string", description: "e.g. 500mg, 5ml" },
          form: { type: "string", description: "tablet, capsule, syrup, injection, drops, ointment" },
          dosage: { type: "string", description: "Amount per dose, e.g. 1 tablet, 5ml" },
          frequency: { type: "string", description: "Plain English: Once daily, Twice daily, Every 6 hours" },
          timing: { type: "string", description: "When to take: Morning, After meals, Bedtime, etc." },
          duration: { type: "string", description: "How long: 5 days, 1 month, continuous" },
          route: { type: "string", description: "Oral, IV, IM, Topical, Inhaled, etc." },
          instructions: { type: "string", description: "Any special notes" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["name", "confidence"],
      },
    },
    advice: { type: "string" },
    follow_up: { type: "string" },
    raw_text: { type: "string", description: "Full verbatim transcription of all text on the prescription" },
    warnings: { type: "array", items: { type: "string" } },
    overall_confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["medications", "raw_text", "overall_confidence"],
} as const;

export async function analyzePrescriptionServer(data: {
  imageBase64: string;
  mimeType: string;
}): Promise<PrescriptionAnalysis> {
  if (!data?.imageBase64 || !data?.mimeType) {
    throw new Error("imageBase64 and mimeType are required");
  }

  const parsed = await generateStructuredJson<PrescriptionAnalysis>({
    systemInstruction: SYSTEM_PROMPT,
    userText: "Analyze this prescription image thoroughly and return structured JSON matching the provided schema.",
    schema: PRESCRIPTION_ANALYSIS_SCHEMA,
    thinkingBudget: 512,
    image: {
      base64: data.imageBase64,
      mimeType: data.mimeType,
    },
  });

  if (!Array.isArray(parsed.medications)) parsed.medications = [];
  return parsed;
}
