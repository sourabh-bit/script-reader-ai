import { createServerFn } from "@tanstack/react-start";
import type { PrescriptionAnalysis } from "./analyze.functions";

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

export const translatePrescription = createServerFn({ method: "POST" })
  .inputValidator((data: { analysis: PrescriptionAnalysis; language: LanguageCode }) => {
    if (!data?.analysis || !data?.language) throw new Error("analysis and language required");
    return data;
  })
  .handler(async ({ data }): Promise<TranslatedPrescription> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

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

    const tool = {
      type: "function" as const,
      function: {
        name: "return_translation",
        description: `Return a translation into ${lang.label} (${lang.native}). Keep medicine brand names in original script but translate dosage, frequency, timing, duration, instructions, advice into clear, simple ${lang.label} that a patient can understand. Also produce a friendly plain-language summary the patient can read.`,
        parameters: {
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
              description: `2-4 short sentences in ${lang.label}, telling the patient what to take, when, and any cautions.`,
            },
          },
          required: ["medications", "summary"],
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a medical translator helping Indian patients understand prescriptions. Translate into ${lang.label} (${lang.native}). Use simple words a non-medical reader understands. Do NOT translate medicine brand names — keep them in the original Latin script (you may add the native script in parentheses). Translate dosing, timing, instructions, advice fully.`,
          },
          {
            role: "user",
            content: `Translate this prescription data into ${lang.label} and return via the tool.\n\n${JSON.stringify(
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
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_translation" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit exceeded. Please wait and try again.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`Translation error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) throw new Error("Translation failed.");
    const parsed = JSON.parse(call.function.arguments);

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
    return bits.join(" — ");
  });
  return parts.join("\n");
}
