"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

type CategoryKey = "interior" | "gaming";

const categories: {
  key: CategoryKey;
  label: string;
  accent: string;
  prompt: string;
  swatches: string[];
  meta: string;
  total: string;
}[] = [
  {
    key: "interior",
    label: "Interior",
    accent: "#7A8B6F",
    prompt: "cozy Japandi reading nook under $800",
    swatches: ["#C9A27A", "#E8E1D5", "#7A8B6F", "#B9A58B"],
    meta: "5 items",
    total: "$612",
  },
  {
    key: "gaming",
    label: "Gaming",
    accent: "#8B6CFF",
    prompt: "clean white-and-violet battlestation under $1,500",
    swatches: ["#1E1B18", "#8B6CFF", "#E8E1D5", "#2F3E5C"],
    meta: "7 items",
    total: "$1,420",
  },
];

const placeholders = [
  "Describe what you want to shop for…",
  ...categories.map((c) => c.prompt),
  "a warm, moody bedroom inspired by this photo…",
];

const sparkles: [string, string][] = [
  ["6%", "62%"], ["12%", "88%"], ["22%", "74%"], ["34%", "92%"],
  ["66%", "90%"], ["78%", "76%"], ["88%", "86%"], ["94%", "64%"],
  ["80%", "34%"], ["20%", "30%"],
];

/* ------------------------------------------------------------------ */
/* Floating tilted boards (decorative, large screens only)             */
/* ------------------------------------------------------------------ */

type Shape = { x: number; y: number; w: number; h: number; c: string; r: number };

function MiniBoard({
  title,
  accent,
  bg,
  shapes,
  rows,
  footer,
  total,
  dark,
  transform,
}: {
  title: string;
  accent: string;
  bg: [string, string];
  shapes: Shape[];
  rows: [string, string][];
  footer: string;
  total: string;
  dark?: boolean;
  transform: string;
}) {
  return (
    <div
      className={`w-[212px] rounded-3xl border p-3 shadow-[0_30px_60px_-25px_rgba(30,27,24,0.45)] ${
        dark ? "border-white/10 bg-[#1E1B18] text-[#F2EDE3]" : "border-[#DDD4C4] bg-white text-[#1E1B18]"
      }`}
      style={{ transform }}
    >
      <div className="mb-2.5 flex items-center gap-1.5 px-1 text-[11px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {title}
      </div>
      <div
        className="relative h-28 overflow-hidden rounded-2xl"
        style={{ background: `linear-gradient(135deg, ${bg[0]}, ${bg[1]})` }}
      >
        {shapes.map((s, i) => (
          <span
            key={i}
            className="absolute"
            style={{ left: s.x, top: s.y, width: s.w, height: s.h, background: s.c, borderRadius: s.r }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map(([name, price], i) => (
          <li key={name} className="flex items-center gap-2 text-[11px]">
            <span className="h-5 w-5 shrink-0 rounded-md" style={{ background: shapes[i % shapes.length].c }} />
            <span className="flex-1 truncate">{name}</span>
            <span className="font-[family-name:var(--font-mono)] opacity-70">{price}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] ${dark ? "border-white/10" : "border-[#E8E1D5]"}`}>
        <span className="opacity-55">{footer}</span>
        <span className="font-[family-name:var(--font-mono)] text-xs">{total}</span>
      </div>
    </div>
  );
}

function FloatingBoards() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden select-none xl:block" aria-hidden>
      <div className="absolute -left-20 top-[17rem] 2xl:left-[2%]">
        <MiniBoard
          title="Japandi nook"
          accent="#7A8B6F"
          bg={["#E8E1D5", "#D8CDBA"]}
          shapes={[
            { x: 14, y: 46, w: 90, h: 46, c: "#C9A27A", r: 16 },
            { x: 118, y: 18, w: 14, h: 76, c: "#1E1B18", r: 7 },
            { x: 62, y: 12, w: 50, h: 26, c: "#7A8B6F", r: 99 },
          ]}
          rows={[["Lounge chair", "$289"], ["Floor lamp", "$148"], ["Linen throw", "$64"]]}
          footer="+2 more"
          total="$612"
          transform="perspective(1100px) rotateY(28deg) rotateZ(-3deg)"
        />
      </div>

      <div className="absolute left-[16%] top-[12rem] hidden 2xl:block">
        <MiniBoard
          title="Streamer desk"
          accent="#8B6CFF"
          bg={["#14120F", "#2A2250"]}
          shapes={[
            { x: 18, y: 16, w: 100, h: 56, c: "#8B6CFF", r: 10 },
            { x: 130, y: 24, w: 34, h: 52, c: "#E8E1D5", r: 8 },
            { x: 30, y: 82, w: 74, h: 8, c: "#2F3E5C", r: 4 },
          ]}
          rows={[["Condenser mic", "$129"], ["Ring light", "$54"], ["Capture card", "$99"]]}
          footer="+5 more"
          total="$1,180"
          dark
          transform="perspective(1100px) rotateY(22deg) rotateZ(-2deg)"
        />
      </div>

      <div className="absolute right-[16%] top-[12rem] hidden 2xl:block">
        <MiniBoard
          title="White & violet rig"
          accent="#8B6CFF"
          bg={["#2A2250", "#14120F"]}
          shapes={[
            { x: 14, y: 14, w: 120, h: 62, c: "#8B6CFF", r: 10 },
            { x: 64, y: 82, w: 22, h: 12, c: "#E8E1D5", r: 4 },
            { x: 146, y: 30, w: 30, h: 60, c: "#E8E1D5", r: 8 },
          ]}
          rows={[["Ultrawide monitor", "$549"], ["Mech keyboard", "$129"], ["Desk mat", "$39"]]}
          footer="+4 more"
          total="$1,420"
          dark
          transform="perspective(1100px) rotateY(-22deg) rotateZ(2deg)"
        />
      </div>

      <div className="absolute -right-20 top-[17rem] 2xl:right-[2%]">
        <MiniBoard
          title="Calm home office"
          accent="#2F3E5C"
          bg={["#F6F2EA", "#E8E1D5"]}
          shapes={[
            { x: 10, y: 62, w: 160, h: 10, c: "#C9A27A", r: 4 },
            { x: 28, y: 22, w: 70, h: 40, c: "#2F3E5C", r: 8 },
            { x: 120, y: 30, w: 34, h: 32, c: "#7A8B6F", r: 99 },
          ]}
          rows={[["Standing desk", "$420"], ["Task lamp", "$58"], ["Desk shelf", "$74"]]}
          footer="+3 more"
          total="$846"
          transform="perspective(1100px) rotateY(-28deg) rotateZ(3deg)"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Prompt box                                                          */
/* ------------------------------------------------------------------ */

function PromptBox({
  prompt,
  setPrompt,
  category,
  setCategory,
  textareaRef,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  category: CategoryKey;
  setCategory: (v: CategoryKey) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [budget, setBudget] = useState("");
  const [phIndex, setPhIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhIndex((i) => (i + 1) % placeholders.length), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function attach(f: File | undefined | null) {
    setFileError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setFileError("Please choose an image file.");
    if (f.size > 8 * 1024 * 1024) return setFileError("Image is too large (8 MB max).");
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  function removeFile() {
    setFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLFormElement>) {
    e.preventDefault();
    setDragging(false);
    attach(e.dataTransfer.files?.[0]);
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!prompt.trim() && !file) {
      textareaRef.current?.focus();
      return;
    }
    const params = new URLSearchParams({ category });
    if (prompt.trim()) params.set("prompt", prompt.trim());
    if (budget) params.set("budget", budget);
    // TODO: an image can't travel in a query string. Upload it (e.g. to Supabase Storage)
    // and pass its URL/path here once the user is signed in.
    router.push(`/register?${params.toString()}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  }

  return (
    <form
      id="hero-prompt"
      onSubmit={submit}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative scroll-mt-28 rounded-[28px] border bg-white text-left shadow-[0_30px_80px_-30px_rgba(30,27,24,0.35)] transition ${
        dragging ? "border-[#D9623B] ring-4 ring-[#D9623B]/15" : "border-[#DDD4C4] focus-within:border-[#D9623B]/60"
      }`}
    >
      {previewUrl && (
        <div className="px-5 pt-5">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Your inspiration image" className="h-20 w-20 rounded-2xl object-cover" />
            <button
              type="button"
              onClick={removeFile}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#1E1B18] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#D9623B]"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <label htmlFor="prompt" className="sr-only">
        Describe what you want to shop for
      </label>
      <textarea
        id="prompt"
        ref={textareaRef}
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholders[phIndex]}
        className="block w-full resize-none rounded-t-[28px] bg-transparent px-6 pb-2 pt-6 text-[17px] leading-relaxed text-[#1E1B18] outline-none placeholder:text-[#1E1B18]/35"
      />

      {fileError && (
        <p role="alert" className="px-6 pb-2 text-sm text-red-700">
          {fileError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => attach(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload an inspiration image"
          title="Upload an inspiration image"
          className="grid h-10 w-10 place-items-center rounded-full border border-[#E8E1D5] text-[#1E1B18]/65 outline-none transition hover:bg-[#F6F2EA] hover:text-[#1E1B18] focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <div role="radiogroup" aria-label="Category" className="flex max-w-full gap-1 overflow-x-auto">
          {categories.map((c) => {
            const active = c.key === category;
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCategory(c.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 ${
                  active ? "bg-[#1E1B18] text-[#F6F2EA]" : "text-[#1E1B18]/60 hover:bg-[#F6F2EA]"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.accent }} aria-hidden />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="submit"
            aria-label="Generate my board"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D9623B] text-white shadow-[0_8px_20px_-8px_rgba(217,98,59,0.8)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[28px] bg-white/90 text-base font-medium text-[#D9623B]">
          Drop your inspiration image
        </div>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export default function Hero() {
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<CategoryKey>("interior");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <section className="relative overflow-hidden">
      {/* warm haze */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%] bg-[radial-gradient(ellipse_at_bottom,rgba(217,98,59,0.22),rgba(139,108,255,0.10)_45%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden>
        {sparkles.map(([left, top], i) => (
          <span key={i} className="absolute text-lg leading-none text-[#D9623B]/35" style={{ left, top }}>
            +
          </span>
        ))}
      </div>

      <FloatingBoards />

      <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-14 text-center sm:pt-20 lg:pb-28">
        <h1 className="font-[family-name:var(--font-display)] text-[2.9rem] font-medium leading-[0.98] tracking-tight text-[#1E1B18] sm:text-7xl lg:text-[5.5rem]">
          Describe the vibe.
          <br />
          Get the <em className="italic text-[#D9623B]">whole look.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#1E1B18]/65 sm:text-xl">
          Nakami curates real items across retailers into one shoppable board, then lets you check
          out once.
        </p>

        <div className="mt-10">
          <PromptBox
            prompt={prompt}
            setPrompt={setPrompt}
            category={category}
            setCategory={setCategory}
            textareaRef={textareaRef}
          />
          <p className="mt-3 hidden text-xs text-[#1E1B18]/45 sm:block">
            Type a prompt or drop in a photo · Press Ctrl/⌘ + Enter to generate
          </p>
        </div>
      </div>
    </section>
  );
}