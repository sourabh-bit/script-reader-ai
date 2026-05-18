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
