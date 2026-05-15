import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Languages,
  Volume2,
  Square,
  Copy,
  Check,
  Printer,
  Download,
  History,
  Search,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Trash2,
  LayoutGrid,
  CalendarClock,
  ScrollText,
} from "lucide-react";
import { analyzePrescription, type PrescriptionAnalysis, type Medication } from "@/lib/analyze.functions";
import {
  translatePrescription,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type TranslatedPrescription,
} from "@/lib/translate.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RxDecode — AI Prescription Analyzer with Indian Translations" },
      {
        name: "description",
        content:
          "Decode handwritten prescriptions in seconds. Extract medicines, doses, timing — translate to Hindi, Tamil, Bengali & more Indian languages. Daily schedule, read aloud, history.",
      },
    ],
  }),
});

type HistoryItem = {
  id: string;
  fileName: string;
  thumb: string;
  data: PrescriptionAnalysis;
  savedAt: number;
};

const HISTORY_KEY = "rxdecode.history.v1";

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

async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (file.size < 600 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b ?? file), "image/jpeg", quality),
    );
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function Index() {
  const analyze = useServerFn(analyzePrescription);
  const translate = useServerFn(translatePrescription);

  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<"overview" | "schedule" | "translate" | "raw">("overview");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [translation, setTranslation] = useState<TranslatedPrescription | null>(null);
  const [translating, setTranslating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  // Load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const saveToHistory = useCallback((item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, 10);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore quota
      }
      return next;
    });
  }, []);

  const removeHistory = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h.id !== id);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Loading timer
  useEffect(() => {
    if (loading) {
      const start = Date.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.round((Date.now() - start) / 100) / 10);
      }, 100);
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
    }
  }, [loading]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setResult(null);
      setTranslation(null);
      setLanguage("en");
      setTab("overview");

      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPG, PNG, WebP).");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setError("File too large. Max 15MB.");
        return;
      }

      const compressed = await compressImage(file);
      setFileName(file.name);
      const { base64, mimeType } = await fileToBase64(compressed);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      setPreview(dataUrl);
      setLoading(true);
      try {
        const data = await analyze({ data: { imageBase64: base64, mimeType } });
        setResult(data);
        saveToHistory({
          id: crypto.randomUUID(),
          fileName: file.name,
          thumb: dataUrl,
          data,
          savedAt: Date.now(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to analyze");
      } finally {
        setLoading(false);
      }
    },
    [analyze, saveToHistory],
  );

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    setFileName("");
    setTranslation(null);
    setLanguage("en");
    if (inputRef.current) inputRef.current.value = "";
  };

  // Trigger translation when language changes
  useEffect(() => {
    if (!result) return;
    if (language === "en") {
      setTranslation(null);
      return;
    }
    let cancelled = false;
    setTranslating(true);
    translate({ data: { analysis: result, language } })
      .then((t) => {
        if (!cancelled) setTranslation(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Translation failed");
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language, result, translate]);

  const loadHistoryItem = (item: HistoryItem) => {
    setResult(item.data);
    setPreview(item.thumb);
    setFileName(item.fileName);
    setError(null);
    setTranslation(null);
    setLanguage("en");
    setTab("overview");
    setShowHistory(false);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Header
        onOpenHistory={() => setShowHistory(true)}
        historyCount={history.length}
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <UploadCard
          preview={preview}
          loading={loading}
          elapsed={elapsed}
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

        <ResultsPanel
          loading={loading}
          error={error}
          result={result}
          hasImage={!!preview}
          tab={tab}
          setTab={setTab}
          language={language}
          setLanguage={setLanguage}
          translation={translation}
          translating={translating}
        />
      </section>

      <Disclaimer />

      {showHistory && (
        <HistoryDrawer
          items={history}
          onClose={() => setShowHistory(false)}
          onLoad={loadHistoryItem}
          onRemove={removeHistory}
        />
      )}
    </main>
  );
}

function Header({ onOpenHistory, historyCount }: { onOpenHistory: () => void; historyCount: number }) {
  return (
    <header className="relative">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
            <Pill className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">RxDecode</span>
        </div>
        <button
          onClick={onOpenHistory}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-muted"
        >
          <History className="h-3.5 w-3.5" /> History
          {historyCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {historyCount}
            </span>
          )}
        </button>
      </div>

      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Fast vision AI · 12 Indian languages · Daily schedule
        </div>
        <h1 className="mt-5 text-4xl font-bold leading-tight text-foreground sm:text-6xl">
          Decode any <span className="italic text-primary">prescription</span>
          <br className="hidden sm:block" /> in seconds
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Upload a photo. Get medicines, doses, timing, daily schedule, and translate it to your
          mother tongue — instantly.
        </p>
      </div>
    </header>
  );
}

function UploadCard(props: {
  preview: string | null;
  loading: boolean;
  elapsed: number;
  dragOver: boolean;
  fileName: string;
  onPick: () => void;
  onReset: () => void;
  onDrop: (f: File) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
}) {
  const { preview, loading, elapsed, dragOver, fileName, onPick, onReset, onDrop, onDragOver, onDragLeave } = props;

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
          <p className="mt-3 text-[11px] text-muted-foreground">
            Image is auto-compressed for faster analysis
          </p>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          <img src={preview} alt={fileName} className="max-h-[520px] w-full object-contain" />
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Reading prescription… {elapsed.toFixed(1)}s</p>
              <p className="text-xs text-muted-foreground">Decoding handwriting & matching medicines</p>
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
  tab,
  setTab,
  language,
  setLanguage,
  translation,
  translating,
}: {
  loading: boolean;
  error: string | null;
  result: PrescriptionAnalysis | null;
  hasImage: boolean;
  tab: "overview" | "schedule" | "translate" | "raw";
  setTab: (t: "overview" | "schedule" | "translate" | "raw") => void;
  language: LanguageCode;
  setLanguage: (l: LanguageCode) => void;
  translation: TranslatedPrescription | null;
  translating: boolean;
}) {
  if (error && !result) {
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
      <ResultsHeader data={result} />
      <Tabs tab={tab} setTab={setTab} />
      <div className="mt-5">
        {tab === "overview" && <OverviewTab data={result} />}
        {tab === "schedule" && <ScheduleTab data={result} />}
        {tab === "translate" && (
          <TranslateTab
            data={result}
            language={language}
            setLanguage={setLanguage}
            translation={translation}
            translating={translating}
          />
        )}
        {tab === "raw" && <RawTab data={result} />}
      </div>
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
      <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-2 text-left text-xs">
        <FeatureChip icon={<Languages className="h-3.5 w-3.5" />} label="12 Indian languages" />
        <FeatureChip icon={<CalendarClock className="h-3.5 w-3.5" />} label="Daily schedule" />
        <FeatureChip icon={<Volume2 className="h-3.5 w-3.5" />} label="Read aloud" />
        <FeatureChip icon={<History className="h-3.5 w-3.5" />} label="History saved locally" />
      </div>
    </div>
  );
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="text-primary">{icon}</span>
      <span className="text-foreground">{label}</span>
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

function ResultsHeader({ data }: { data: PrescriptionAnalysis }) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    const text = formatAsText(data);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => window.print();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Extracted prescription</h2>
        <ConfidenceBadge level={data.overall_confidence} />
      </div>
      <div className="flex items-center gap-1">
        <IconBtn onClick={copyAll} title="Copy as text">
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        </IconBtn>
        <IconBtn onClick={downloadJson} title="Download JSON">
          <Download className="h-3.5 w-3.5" />
        </IconBtn>
        <IconBtn onClick={print} title="Print">
          <Printer className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md border border-border bg-surface p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Tabs({
  tab,
  setTab,
}: {
  tab: "overview" | "schedule" | "translate" | "raw";
  setTab: (t: "overview" | "schedule" | "translate" | "raw") => void;
}) {
  const items: Array<{ id: typeof tab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: "schedule", label: "Schedule", icon: <CalendarClock className="h-3.5 w-3.5" /> },
    { id: "translate", label: "Translate", icon: <Languages className="h-3.5 w-3.5" /> },
    { id: "raw", label: "Raw text", icon: <ScrollText className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="mt-4 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setTab(it.id)}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            tab === it.id
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}

function OverviewTab({ data }: { data: PrescriptionAnalysis }) {
  return (
    <div className="space-y-5">
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
            <Field icon={<FileText className="h-3.5 w-3.5" />} label="Clinic" value={data.clinic_name} />
          )}
          {data.diagnosis && (
            <Field icon={<FileText className="h-3.5 w-3.5" />} label="Diagnosis" value={data.diagnosis} />
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
    </div>
  );
}

function MedCard({ med, index }: { med: Medication; index: number }) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    `${med.name} ${med.strength ?? ""} medicine uses side effects`,
  )}`;
  return (
    <li className="rounded-xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index}
            </span>
            <h4 className="truncate text-base font-semibold text-foreground">{med.name}</h4>
            {med.strength && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{med.strength}</span>
            )}
            <a
              href={searchUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Search className="h-3 w-3" /> Info
            </a>
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

// ---------- Schedule ----------

type Slot = "morning" | "afternoon" | "evening" | "night";

const SLOT_META: Record<Slot, { label: string; time: string; icon: React.ReactNode; color: string }> = {
  morning: { label: "Morning", time: "8:00 AM", icon: <Sunrise className="h-4 w-4" />, color: "from-amber-200 to-amber-50" },
  afternoon: { label: "Afternoon", time: "1:00 PM", icon: <Sun className="h-4 w-4" />, color: "from-orange-200 to-orange-50" },
  evening: { label: "Evening", time: "6:00 PM", icon: <Sunset className="h-4 w-4" />, color: "from-rose-200 to-rose-50" },
  night: { label: "Night", time: "10:00 PM", icon: <Moon className="h-4 w-4" />, color: "from-indigo-200 to-indigo-50" },
};

function inferSlots(med: Medication): { slots: Slot[]; withFood?: "before" | "after" | null } {
  const s = `${med.frequency ?? ""} ${med.timing ?? ""} ${med.instructions ?? ""}`.toLowerCase();
  const slots = new Set<Slot>();

  // Pattern 1-0-1, 1-1-1, etc.
  const pat = s.match(/(\d)\s*[-–]\s*(\d)\s*[-–]\s*(\d)/);
  if (pat) {
    if (Number(pat[1]) > 0) slots.add("morning");
    if (Number(pat[2]) > 0) slots.add("afternoon");
    if (Number(pat[3]) > 0) slots.add("night");
  }

  if (/\b(od|once daily|once a day|qd|daily)\b/.test(s) && slots.size === 0) slots.add("morning");
  if (/\b(bd|bid|twice|two times|2 times)\b/.test(s)) {
    slots.add("morning");
    slots.add("night");
  }
  if (/\b(tds|tid|thrice|three times|3 times)\b/.test(s)) {
    slots.add("morning");
    slots.add("afternoon");
    slots.add("night");
  }
  if (/\b(qid|four times|4 times)\b/.test(s)) {
    slots.add("morning");
    slots.add("afternoon");
    slots.add("evening");
    slots.add("night");
  }
  if (/morning|breakfast|am\b/.test(s)) slots.add("morning");
  if (/afternoon|lunch|noon/.test(s)) slots.add("afternoon");
  if (/evening|tea/.test(s)) slots.add("evening");
  if (/night|bedtime|hs\b|dinner|pm\b/.test(s)) slots.add("night");

  let withFood: "before" | "after" | null = null;
  if (/before food|before meal|empty stomach|\bac\b/.test(s)) withFood = "before";
  else if (/after food|after meal|with food|with meal|\bpc\b/.test(s)) withFood = "after";

  return { slots: Array.from(slots), withFood };
}

function ScheduleTab({ data }: { data: PrescriptionAnalysis }) {
  const grid = useMemo(() => {
    const map: Record<Slot, Array<{ med: Medication; index: number; withFood?: "before" | "after" | null }>> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    data.medications.forEach((m, i) => {
      const { slots, withFood } = inferSlots(m);
      slots.forEach((s) => map[s].push({ med: m, index: i + 1, withFood }));
    });
    return map;
  }, [data.medications]);

  const totalScheduled = (Object.keys(grid) as Slot[]).reduce((acc, s) => acc + grid[s].length, 0);

  if (totalScheduled === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Couldn't infer a daily schedule from this prescription. Check the Overview tab for raw timing.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Inferred from frequency & timing. Always confirm exact times with your doctor or pharmacist.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(SLOT_META) as Slot[]).map((s) => {
          const items = grid[s];
          const meta = SLOT_META[s];
          return (
            <div
              key={s}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${meta.color} text-foreground`}>
                    {meta.icon}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{meta.label}</div>
                    <div className="text-[11px] text-muted-foreground">~ {meta.time}</div>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">No medicines scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((it, idx) => (
                    <li key={idx} className="rounded-lg bg-muted/50 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {it.index}
                        </span>
                        <span className="font-medium text-foreground">
                          {it.med.name}
                          {it.med.strength ? ` ${it.med.strength}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 pl-7 text-muted-foreground">
                        {it.med.dosage ?? "1 dose"}
                        {it.withFood === "before" && " · before food"}
                        {it.withFood === "after" && " · after food"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Translate ----------

function TranslateTab({
  data,
  language,
  setLanguage,
  translation,
  translating,
}: {
  data: PrescriptionAnalysis;
  language: LanguageCode;
  setLanguage: (l: LanguageCode) => void;
  translation: TranslatedPrescription | null;
  translating: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text =
      language === "en"
        ? formatAsText(data)
        : translation
          ? `${translation.summary}\n\n${translation.medications
              .map((m) => `${m.name}. ${m.dosage ?? ""} ${m.frequency ?? ""} ${m.timing ?? ""} ${m.duration ?? ""}`)
              .join(". ")}`
          : "";
    if (!text) return;

    const u = new SpeechSynthesisUtterance(text);
    const langMap: Record<LanguageCode, string> = {
      en: "en-IN", hi: "hi-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN",
      mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN",
      ur: "ur-IN", or: "or-IN",
    };
    u.lang = langMap[language];
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(u.lang.split("-")[0]));
    if (match) u.voice = match;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const isRtl = language === "ur";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Languages className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Translate to:</span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          className="ml-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} — {l.native}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          {!speaking ? (
            <button
              onClick={speak}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <Volume2 className="h-3.5 w-3.5" /> Read aloud
            </button>
          ) : (
            <button
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          )}
        </div>
      </div>

      {translating && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Translating to {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.native}…
        </div>
      )}

      {language === "en" ? (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <pre className="whitespace-pre-wrap font-sans text-foreground">{formatAsText(data)}</pre>
        </div>
      ) : translation ? (
        <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </div>
            <p className="text-base leading-relaxed text-foreground">{translation.summary}</p>
          </div>

          <ul className="space-y-2">
            {translation.medications.map((m, i) => {
              const orig = data.medications[m.index];
              return (
                <li key={i} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-foreground">
                      {i + 1}. {m.name}
                      {orig?.strength ? ` ${orig.strength}` : ""}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {m.dosage && <KV label="•" value={m.dosage} />}
                    {m.frequency && <KV label="•" value={m.frequency} />}
                    {m.timing && <KV label="•" value={m.timing} />}
                    {m.duration && <KV label="•" value={m.duration} />}
                  </div>
                  {m.instructions && (
                    <p className="mt-2 rounded-md bg-accent/10 px-3 py-1.5 text-xs">{m.instructions}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {translation.advice && (
            <Block title="Advice" icon={<FileText className="h-4 w-4" />}>
              {translation.advice}
            </Block>
          )}
          {translation.follow_up && (
            <Block title="Follow-up" icon={<Calendar className="h-4 w-4" />}>
              {translation.follow_up}
            </Block>
          )}
        </div>
      ) : null}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5 text-foreground">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function RawTab({ data }: { data: PrescriptionAnalysis }) {
  return (
    <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
      {data.raw_text || "No raw text captured."}
    </pre>
  );
}

// ---------- Reusable bits ----------

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

function Block({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

// ---------- History drawer ----------

function HistoryDrawer({
  items,
  onClose,
  onLoad,
  onRemove,
}: {
  items: HistoryItem[];
  onClose: () => void;
  onLoad: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Recent prescriptions</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No prescriptions saved yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="group flex gap-3 rounded-lg border border-border bg-muted/30 p-2 transition hover:border-primary/40"
                >
                  <button onClick={() => onLoad(it)} className="flex flex-1 gap-3 text-left">
                    <img
                      src={it.thumb}
                      alt={it.fileName}
                      className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {it.data.medications.length} medicine{it.data.medications.length === 1 ? "" : "s"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {it.data.medications
                          .slice(0, 3)
                          .map((m) => m.name)
                          .join(", ")}
                        {it.data.medications.length > 3 ? "…" : ""}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(it.savedAt).toLocaleString()}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => onRemove(it.id)}
                    className="self-start rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------- helpers ----------

function formatAsText(data: PrescriptionAnalysis): string {
  const lines: string[] = [];
  if (data.patient_name) lines.push(`Patient: ${data.patient_name}`);
  if (data.doctor_name) lines.push(`Doctor: ${data.doctor_name}`);
  if (data.date) lines.push(`Date: ${data.date}`);
  if (data.diagnosis) lines.push(`Diagnosis: ${data.diagnosis}`);
  if (lines.length) lines.push("");
  lines.push("Medications:");
  data.medications.forEach((m, i) => {
    const parts = [
      `${i + 1}. ${m.name}${m.strength ? ` ${m.strength}` : ""}`,
      m.dosage,
      m.frequency,
      m.timing,
      m.duration,
    ]
      .filter(Boolean)
      .join(" — ");
    lines.push(parts);
    if (m.instructions) lines.push(`   Note: ${m.instructions}`);
  });
  if (data.advice) lines.push("", `Advice: ${data.advice}`);
  if (data.follow_up) lines.push(`Follow-up: ${data.follow_up}`);
  return lines.join("\n");
}
