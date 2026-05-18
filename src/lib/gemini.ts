const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type JsonSchema = Record<string, unknown>;

type GenerateStructuredJsonOptions = {
  systemInstruction: string;
  userText: string;
  schema: JsonSchema;
  thinkingBudget?: number;
  image?: {
    base64: string;
    mimeType: string;
  };
};

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return apiKey;
}

export async function generateStructuredJson<T>({
  systemInstruction,
  userText,
  schema,
  thinkingBudget,
  image,
}: GenerateStructuredJsonOptions): Promise<T> {
  const apiKey = getGeminiApiKey();

  const parts: Array<Record<string, unknown>> = [{ text: userText }];
  if (image) {
    parts.unshift({
      inline_data: {
        mime_type: image.mimeType,
        data: image.base64,
      },
    });
  }

  const res = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        thinkingConfig: thinkingBudget === undefined ? undefined : { thinkingBudget },
      },
    }),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    let message = bodyText;

    try {
      const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
      message = parsed.error?.message ?? bodyText;
    } catch {
      // Keep the raw response when it is not JSON.
    }

    if (res.status === 400) throw new Error(`Gemini request invalid: ${message}`);
    if (res.status === 401 || res.status === 403) {
      throw new Error("Gemini API key rejected. Check GEMINI_API_KEY and API access.");
    }
    if (res.status === 429) throw new Error("Gemini rate limit exceeded. Please wait and try again.");
    throw new Error(`Gemini API error ${res.status}: ${message}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      finishReason?: string;
    }>;
  };

  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    const finishReason = json.candidates?.[0]?.finishReason;
    throw new Error(
      finishReason
        ? `Gemini returned no structured output (${finishReason}). Try again with a clearer image.`
        : "Gemini returned no structured output. Try again with a clearer image.",
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini returned malformed JSON. Try again.");
  }
}
