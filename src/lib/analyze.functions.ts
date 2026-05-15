import { createServerFn } from "@tanstack/react-start";

export type Medication = {
  name: string;
  generic_name?: string;
  strength?: string;
  form?: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
  route?: string;
  instructions?: string;
  confidence?: "high" | "medium" | "low";
};

export type PrescriptionAnalysis = {
  patient_name?: string;
  patient_age?: string;
  patient_gender?: string;
  doctor_name?: string;
  clinic_name?: string;
  date?: string;
  diagnosis?: string;
  medications: Medication[];
  advice?: string;
  follow_up?: string;
  raw_text: string;
  warnings?: string[];
  overall_confidence?: "high" | "medium" | "low";
};

const SYSTEM_PROMPT = `You are an expert medical prescription analyzer with deep knowledge of pharmacology, common drug names (brand and generic), abbreviations, and handwriting patterns of physicians worldwide.

Your task: meticulously read the provided prescription image (often handwritten) and extract every piece of information.

Rules:
- Decode common Rx abbreviations: OD (once daily), BD/BID (twice daily), TDS/TID (thrice daily), QID (4x daily), HS (at bedtime), SOS (if needed), AC (before meals), PC (after meals), STAT (immediately), PO (oral), IV, IM, SC, q4h, q6h, q8h, etc.
- Expand frequencies into plain English: "1-0-1" => "Morning and Night", "1-1-1" => "Morning, Afternoon, Night".
- Identify the medicine even if the handwriting is messy — use medical context (dose forms, strengths) to disambiguate.
- For each medicine: name, strength (e.g. 500mg), dose form (tablet/syrup/capsule), how much per dose, frequency, timing relative to meals, duration, route.
- Extract patient details, doctor, date, diagnosis, advice, follow-up if present.
- Mark confidence per medicine and overall.
- If something is illegible, set confidence "low" and add a warning instead of guessing wildly.
- Always return at least the raw transcribed text.

This is for informational decoding only — always advise the user to verify with their pharmacist or physician.`;

export const analyzePrescription = createServerFn({ method: "POST" })
  .inputValidator((data: { imageBase64: string; mimeType: string }) => {
    if (!data?.imageBase64 || !data?.mimeType) {
      throw new Error("imageBase64 and mimeType are required");
    }
    return data;
  })
  .handler(async ({ data }): Promise<PrescriptionAnalysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const tool = {
      type: "function" as const,
      function: {
        name: "return_prescription_analysis",
        description: "Return the fully extracted prescription data",
        parameters: {
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
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this prescription image thoroughly and return structured data via the tool." },
              { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_prescription_analysis" } },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit exceeded. Please wait and try again.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      throw new Error(`AI gateway error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error("Model did not return structured analysis. Try a clearer image.");
    }
    const parsed = JSON.parse(call.function.arguments) as PrescriptionAnalysis;
    if (!Array.isArray(parsed.medications)) parsed.medications = [];
    return parsed;
  });
