import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import {
  Upload,
  Pill,
  Clock,
  Calendar,
  User,
  Stethoscope,
  AlertTriangle,
  Loader2,
  FileText,
  Sparkles,
  ShieldAlert,
  X,
} from "lucide-react";
import { analyzePrescription, type PrescriptionAnalysis } from "@/lib/analyze.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RxDecode — AI Handwritten Prescription Analyzer" },
      {
        name: "description",
        content:
          "Upload a handwritten medical prescription and instantly extract medicines, dosage, timing, and instructions using AI.",
      },
    ],
  }),
});

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function Index() {
  const analyze = useServerFn(analyzePrescription);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPG, PNG, HEIC, WebP).");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError("File too large. Max 15MB.");
        return;
      }
      setFileName(file.name);
      const { base64, mimeType } = await fileToBase64(file);
      setPreview(`data:${mimeType};base64,${base64}`);
      setLoading(true);
      try {
        const data = await analyze({ data: { imageBase64: base64, mimeType } });
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to analyze");
      } finally {
        setLoading(false);
      }
    },
    [analyze],
  );

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Header />

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <UploadCard
          preview={preview}
          loading={loading}
          dragOver={dragOver}
          fileName={fileName}
          onPick={() => inputRef.current?.click()}
          onReset={reset}
          onDrop={(f) => {
            setDragOver(false);
            void handleFile(f);
          }}
          onDragOver={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        <ResultsPanel loading={loading} error={error} result={result} hasImage={!!preview} />
      </section>

      <Disclaimer />
    </main>
  );
}

function Header() {
  return (
    <header className="text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Powered by medical-grade vision AI
      </div>
      <h1 className="mt-5 text-4xl font-bold leading-tight text-foreground sm:text-6xl">
        Decode handwritten <span className="italic text-primary">prescriptions</span>
        <br className="hidden sm:block" /> in seconds
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Upload a photo of any prescription. We'll extract the medicines, doses, timing, route,
        duration, and doctor's notes — even from messy doctor handwriting.
      </p>
    </header>
  );
}

function UploadCard(props: {
  preview: string | null;
  loading: boolean;
  dragOver: boolean;
  fileName: string;
  onPick: () => void;
  onReset: () => void;
  onDrop: (f: File) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
}) {
  const { preview, loading, dragOver, fileName, onPick, onReset, onDrop, onDragOver, onDragLeave } =
    props;

  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prescription image</h2>
        {preview && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {!preview ? (
        <button
          onClick={onPick}
          onDragOver={(e) => {
            e.preventDefault();
            onDragOver();
          }}
          onDragLeave={onDragLeave}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onDrop(f);
          }}
          className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30 hover:bg-muted/50"
          }`}
        >
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <p className="mt-4 font-medium text-foreground">Drop your prescription here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse — JPG, PNG, WebP up to 15MB
          </p>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          <img src={preview} alt={fileName} className="max-h-[520px] w-full object-contain" />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Reading prescription…</p>
              <p className="text-xs text-muted-foreground">
                Decoding handwriting & matching medicines
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
        <Tip icon={<FileText className="h-4 w-4" />} label="Clear photo" />
        <Tip icon={<Sparkles className="h-4 w-4" />} label="Good lighting" />
        <Tip icon={<Pill className="h-4 w-4" />} label="Full page" />
      </div>
    </div>
  );
}

function Tip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/60 py-2">
      <span className="text-primary">{icon}</span>
      {label}
    </div>
  );
}

function ResultsPanel({
  loading,
  error,
  result,
  hasImage,
}: {
  loading: boolean;
  error: string | null;
  result: PrescriptionAnalysis | null;
  hasImage: boolean;
}) {
  if (error) {
    return (
      <Panel>
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Analysis failed</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
          </div>
        </div>
      </Panel>
    );
  }

  if (loading) {
    return (
      <Panel>
        <SkeletonResults />
      </Panel>
    );
  }

  if (!result) {
    return (
      <Panel>
        <EmptyState hasImage={hasImage} />
      </Panel>
    );
  }

  return (
    <Panel>
      <Results data={result} />
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-5 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}

function EmptyState({ hasImage }: { hasImage: boolean }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-accent/15 p-4">
        <Stethoscope className="h-8 w-8 text-accent-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">
        {hasImage ? "Ready when you are" : "Awaiting prescription"}
      </h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Upload a photo and we'll extract every medicine, dose, frequency and instruction.
      </p>
    </div>
  );
}

function SkeletonResults() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-20 animate-pulse rounded-lg bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function Results({ data }: { data: PrescriptionAnalysis }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Extracted prescription</h2>
        <ConfidenceBadge level={data.overall_confidence} />
      </div>

      {(data.patient_name || data.doctor_name || data.date || data.diagnosis) && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-4 text-sm">
          {data.patient_name && (
            <Field icon={<User className="h-3.5 w-3.5" />} label="Patient" value={data.patient_name} />
          )}
          {(data.patient_age || data.patient_gender) && (
            <Field
              icon={<User className="h-3.5 w-3.5" />}
              label="Age / Sex"
              value={[data.patient_age, data.patient_gender].filter(Boolean).join(" • ")}
            />
          )}
          {data.doctor_name && (
            <Field
              icon={<Stethoscope className="h-3.5 w-3.5" />}
              label="Doctor"
              value={data.doctor_name}
            />
          )}
          {data.date && (
            <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Date" value={data.date} />
          )}
          {data.clinic_name && (
            <Field
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Clinic"
              value={data.clinic_name}
            />
          )}
          {data.diagnosis && (
            <Field
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Diagnosis"
              value={data.diagnosis}
            />
          )}
        </div>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Pill className="h-4 w-4 text-primary" /> Medications ({data.medications.length})
        </h3>
        {data.medications.length === 0 ? (
          <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            No medications could be confidently identified.
          </p>
        ) : (
          <ul className="space-y-3">
            {data.medications.map((m, i) => (
              <MedCard key={i} med={m} index={i + 1} />
            ))}
          </ul>
        )}
      </div>

      {data.advice && (
        <Block title="Advice" icon={<FileText className="h-4 w-4" />}>
          {data.advice}
        </Block>
      )}
      {data.follow_up && (
        <Block title="Follow-up" icon={<Calendar className="h-4 w-4" />}>
          {data.follow_up}
        </Block>
      )}

      {data.warnings && data.warnings.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Notes from the analyzer
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {data.raw_text && (
        <details className="group rounded-xl border border-border bg-muted/30 p-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            View raw transcription
          </summary>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
            {data.raw_text}
          </pre>
        </details>
      )}
    </div>
  );
}

function MedCard({ med, index }: { med: import("@/lib/analyze.functions").Medication; index: number }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index}
            </span>
            <h4 className="truncate text-base font-semibold text-foreground">{med.name}</h4>
            {med.strength && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                {med.strength}
              </span>
            )}
          </div>
          {med.generic_name && med.generic_name !== med.name && (
            <p className="mt-0.5 pl-8 text-xs italic text-muted-foreground">{med.generic_name}</p>
          )}
        </div>
        <ConfidenceBadge level={med.confidence} small />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 pl-8 text-xs sm:grid-cols-3">
        {med.form && <Pair label="Form" value={med.form} />}
        {med.dosage && <Pair label="Dose" value={med.dosage} />}
        {med.route && <Pair label="Route" value={med.route} />}
        {med.frequency && <Pair label="Frequency" value={med.frequency} />}
        {med.timing && <Pair label="Timing" value={med.timing} icon={<Clock className="h-3 w-3" />} />}
        {med.duration && <Pair label="Duration" value={med.duration} />}
      </div>

      {med.instructions && (
        <p className="mt-3 ml-8 rounded-md bg-accent/10 px-3 py-2 text-xs text-foreground">
          <span className="font-semibold">Note:</span> {med.instructions}
        </p>
      )}
    </li>
  );
}

function Pair({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/60 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 font-medium text-foreground">{value}</div>
    </div>
  );
}

function Block({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      <p className="text-sm text-foreground">{children}</p>
    </div>
  );
}

function ConfidenceBadge({ level, small }: { level?: "high" | "medium" | "low"; small?: boolean }) {
  if (!level) return null;
  const styles =
    level === "high"
      ? "bg-success/15 text-success border-success/30"
      : level === "medium"
        ? "bg-warning/15 text-warning border-warning/40"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium capitalize ${styles} ${
        small ? "text-[10px]" : "text-xs"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {level} confidence
    </span>
  );
}

function Disclaimer() {
  return (
    <footer className="mx-auto mt-12 max-w-3xl rounded-2xl border border-border bg-surface/60 p-5 text-center text-xs text-muted-foreground backdrop-blur">
      <p className="flex items-center justify-center gap-2 font-medium text-foreground">
        <ShieldAlert className="h-4 w-4 text-warning" />
        Informational use only
      </p>
      <p className="mt-1">
        This tool helps you read prescriptions but is not a substitute for professional medical
        advice. Always confirm medicines, doses, and instructions with your pharmacist or doctor
        before taking any medication.
      </p>
    </footer>
  );
}
