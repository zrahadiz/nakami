import { Sparkles } from "lucide-react";

interface PromptHeroProps {
  variant?: "landing" | "dashboard";
  className?: string;
}

export function PromptHero({
  variant = "dashboard",
  className = "",
}: PromptHeroProps) {
  if (variant === "landing") {
    return (
      <div className={`text-center ${className}`}>
        {/* EYEBROW */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-px w-6 bg-[#D9623B]/50" />

          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#D9623B]">
            AI-Powered Shopping Workspace
          </span>

          <span className="h-px w-6 bg-[#D9623B]/50" />
        </div>

        {/* HEADING */}
        <h1 className="font-(family-name:--font-display) text-[2.9rem] font-medium leading-[0.98] tracking-tight text-foreground sm:text-7xl lg:text-[5.5rem]">
          Describe the vibe.
          <br />
          Get the <em className="italic text-[#D9623B]">whole look.</em>
        </h1>

        {/* DESCRIPTION */}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-xl">
          Nakami curates real items across retailers into one shoppable board,
          then lets you check out once.
        </p>
      </div>
    );
  }

  return (
    <div className={`text-center ${className}`}>
      {/* EYEBROW */}
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-foreground/70">
        <Sparkles className="size-3.5 text-[#D9623B]" />

        <span>Your ideas, made real</span>
      </div>

      {/* HEADING */}
      <h1 className="font-(family-name:--font-display) text-[2.6rem] font-medium leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
        What will you
        <br />
        <em className="italic text-[#D9623B]">create</em> today?
      </h1>

      {/* DESCRIPTION */}
      <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">
        Describe your dream space or gaming setup. Nakami curates the perfect
        pieces into one board.
      </p>
    </div>
  );
}
