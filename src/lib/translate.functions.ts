import { createServerFn } from "@tanstack/react-start";
import type { PrescriptionAnalysis } from "./analyze.functions";
import { generateStructuredJson } from "./gemini";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "Urdu", native: "اردو" },
  { code: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export type TranslatedPrescription = {
  language: LanguageCode;
  language_label: string;
  diagnosis?: string;
  advice?: string;
  follow_up?: string;
  medications: Array<{
    index: number;
    name: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
    duration?: string;
    instructions?: string;
  }>;
  summary: string;
};

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    diagnosis: { type: "string" },
    advice: { type: "string" },
    follow_up: { type: "string" },
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          name: { type: "string", description: "Keep brand name in original script; you may add native script in parentheses." },
          dosage: { type: "string" },
          frequency: { type: "string" },
          timing: { type: "string" },
          duration: { type: "string" },
          instructions: { type: "string" },
        },
        required: ["index", "name"],
      },
    },
    summary: {
      type: "string",
      description: "2-4 short sentences telling the patient what to take, when, and any cautions.",
    },
  },
  required: ["medications", "summary"],
} as const;

export const translatePrescription = createServerFn({ method: "POST" })
  .inputValidator((data: { analysis: PrescriptionAnalysis; language: LanguageCode }) => {
    if (!data?.analysis || !data?.language) throw new Error("analysis and language required");
    return data;
  })
  .handler(async ({ data }): Promise<TranslatedPrescription> => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === data.language);
    if (!lang) throw new Error("Unsupported language");

    if (lang.code === "en") {
      return {
        language: "en",
        language_label: "English",
        diagnosis: data.analysis.diagnosis,
        advice: data.analysis.advice,
        follow_up: data.analysis.follow_up,
        medications: data.analysis.medications.map((m, i) => ({
          index: i,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          timing: m.timing,
          duration: m.duration,
          instructions: m.instructions,
        })),
        summary: buildEnglishSummary(data.analysis),
      };
    }

    const parsed = await generateStructuredJson<{
      diagnosis?: string;
      advice?: string;
      follow_up?: string;
      medications?: TranslatedPrescription["medications"];
      summary?: string;
    }>({
      systemInstruction: `You are a medical translator helping Indian patients understand prescriptions. Translate into ${lang.label} (${lang.native}). Use simple words a non-medical reader understands. Do NOT translate medicine brand names - keep them in the original Latin script (you may add the native script in parentheses). Translate dosing, timing, instructions, advice fully.`,
      userText: `Translate this prescription data into ${lang.label} and return structured JSON matching the provided schema.\n\n${JSON.stringify(
        {
          diagnosis: data.analysis.diagnosis,
          advice: data.analysis.advice,
          follow_up: data.analysis.follow_up,
          medications: data.analysis.medications.map((m, i) => ({
            index: i,
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            timing: m.timing,
            duration: m.duration,
            instructions: m.instructions,
          })),
        },
        null,
        2,
      )}`,
      schema: TRANSLATION_SCHEMA,
      thinkingBudget: 0,
    });

    return {
      language: lang.code,
      language_label: `${lang.label} (${lang.native})`,
      diagnosis: parsed.diagnosis,
      advice: parsed.advice,
      follow_up: parsed.follow_up,
      medications: parsed.medications ?? [],
      summary: parsed.summary ?? "",
    };
  });

function buildEnglishSummary(a: PrescriptionAnalysis): string {
  if (!a.medications.length) return "No medications detected.";
  const parts = a.medications.map((m, i) => {
    const bits = [
      `${i + 1}. ${m.name}${m.strength ? ` ${m.strength}` : ""}`,
      m.dosage,
      m.frequency,
      m.timing,
      m.duration,
    ].filter(Boolean);
    return bits.join(" - ");
  });
  return parts.join("\n");
}
