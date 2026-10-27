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
      className={`w-53 rounded-3xl border p-3 shadow-[0_30px_60px_-25px_rgba(30,27,24,0.45)] ${
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
            <span className="font-mono opacity-70">{price}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] ${dark ? "border-white/10" : "border-[#E8E1D5]"}`}>
        <span className="opacity-55">{footer}</span>
        <span className="font-mono text-xs">{total}</span>
      </div>
    </div>
  );
}

export default function FloatingBoards() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden select-none xl:block" aria-hidden>
      <div className="absolute -left-20 top-68 2xl:left-[2%]">
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

      <div className="absolute left-[16%] top-48 hidden 2xl:block">
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

      <div className="absolute right-[16%] top-48 hidden 2xl:block">
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

      <div className="absolute -right-20 top-68 2xl:right-[2%]">
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
