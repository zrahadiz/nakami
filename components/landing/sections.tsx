import Link from "next/link";

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */
const steps = [
  {
    n: "01",
    title: "Describe the room you want",
    body: "Tell us the style, the space and your budget, like “a cozy Japandi living room under $2,000.” No filters, no searching store by store.",
  },
  {
    n: "02",
    title: "Get a board of real products",
    body: "Nakami searches real retailers and gathers matching furniture on one board, with prices and links to each item.",
  },
  {
    n: "03",
    title: "Preview it in 3D",
    body: "Pick the pieces you like and see them together in a 3D room. Lock or remove items, or ask for changes until it feels right.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-5 py-20 sm:py-28">
      <div id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24">
        <p className="text-sm font-medium text-[#D9623B]">How it works</p>
        <h2 className="mt-3 max-w-2xl font-(family-name:--font-display) text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          From one sentence to a shoppable board
        </h2>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-3xl border border-[#E8E1D5] bg-white/60 p-7"
            >
              <span className="font-(family-name:--font-display) text-5xl text-[#D9623B]/80">
                {s.n}
              </span>
              <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#1E1B18]/65">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features (bento)                                                    */
/* ------------------------------------------------------------------ */
const featureSlots = [
  {
    name: "Oak lounge chair",
    shop: "Hale & Co",
    price: "$289",
    locked: true,
    color: "#C9A27A",
  },
  {
    name: "Paper floor lamp",
    shop: "Soma Home",
    price: "$148",
    locked: false,
    color: "#E8E1D5",
  },
  {
    name: "Linen throw",
    shop: "Fieldnote",
    price: "$64",
    locked: false,
    color: "#7A8B6F",
  },
];

/** A decorative mini room, drawn with plain divs. */
function RoomPreview() {
  return (
    <div
      aria-hidden
      className="relative mt-6 h-56 overflow-hidden rounded-2xl border border-[#E8E1D5] sm:h-72"
      style={{ background: "linear-gradient(#F1EBDF 0 62%, #D9CFBC 62% 100%)" }}
    >
      {/* window */}
      <span className="absolute left-[8%] top-[10%] h-[30%] w-[22%] rounded-md border-4 border-white bg-[#DCE9F2]" />

      {/* rug */}
      <span className="absolute left-[18%] top-[74%] h-[16%] w-[58%] rounded-full bg-[#B9A58B]/80" />

      {/* sofa */}
      <span className="absolute left-[28%] top-[36%] h-[16%] w-[40%] rounded-2xl bg-[#C4B8A2]" />
      <span className="absolute left-[26%] top-[46%] h-[20%] w-[44%] rounded-2xl bg-[#D8CDBA] shadow-[0_10px_20px_-10px_rgba(30,27,24,0.4)]" />

      {/* armchair */}
      <span className="absolute left-[6%] top-[50%] h-[24%] w-[18%] rounded-b-lg rounded-t-3xl bg-[#C9A27A] shadow-[0_10px_20px_-10px_rgba(30,27,24,0.4)]" />

      {/* side table */}
      <span className="absolute left-[72%] top-[62%] h-[12%] w-[10%] rounded-lg bg-[#8B6B4A]" />

      {/* floor lamp */}
      <span className="absolute left-[84%] top-[14%] flex flex-col items-center">
        <span className="h-7 w-10 rounded-t-full bg-[#F5E9C6]" />
        <span className="h-24 w-0.75 bg-[#1E1B18] sm:h-32" />
        <span className="h-1.5 w-8 rounded bg-[#1E1B18]" />
      </span>

      {/* plant */}
      <span className="absolute bottom-[8%] right-[3%] flex flex-col items-center">
        <span className="size-8 rounded-full bg-[#5C6B52]" />
        <span className="-mt-2 h-7 w-7 rounded-b-lg bg-[#7A8B6F]" />
      </span>

      {/* labels */}
      <span className="absolute left-[4%] top-[40%] inline-flex items-center gap-1.5 rounded-full bg-[#1E1B18]/80 px-2.5 py-1 text-[11px] text-white backdrop-blur">
        Oak lounge chair
        <span className="text-[#A9B49E]">✓ 3D ready</span>
      </span>
      <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-medium text-[#1E1B18]/70 backdrop-blur">
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
        Drag to rotate
      </span>
    </div>
  );
}

export function Features() {
  return (
    <section className="bg-[#EFE9DD] px-5 py-20 sm:py-28">
      <div id="features" className="mx-auto max-w-6xl scroll-mt-24">
        <p className="text-sm font-medium text-[#D9623B]">Features</p>
        <h2 className="mt-3 max-w-2xl font-(family-name:--font-display) text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          Furnish a whole room in one conversation
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[#1E1B18]/65">
          Describe what you want, shop real products from different stores, and
          see how it all looks together before you buy.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {/* 3D preview (the headline feature) */}
          <div className="rounded-3xl border border-[#E8E1D5] bg-[#F6F2EA] p-7 md:col-span-2">
            <span className="inline-block rounded-full bg-[#D9623B]/12 px-3 py-1 text-xs font-medium text-[#B84A25]">
              3D preview
            </span>
            <h3 className="mt-4 text-xl font-semibold">
              See your picks together before you buy
            </h3>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-[#1E1B18]/65">
              Select the pieces you like and Nakami turns them into 3D models,
              then places them in one room you can rotate and zoom. Check that
              the style works together, not just one item at a time.
            </p>
            <RoomPreview />
          </div>

          {/* Refine by chatting (replaces the budget slider) */}
          <div className="flex flex-col rounded-3xl border border-[#E8E1D5] bg-[#F6F2EA] p-7">
            <h3 className="text-xl font-semibold">Change it by just asking</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[#1E1B18]/65">
              Want it cheaper, warmer or simpler? Tell Nakami in your own words
              and the board updates.
            </p>

            <div
              className="mt-6 flex flex-1 flex-col justify-end gap-3"
              aria-hidden
            >
              <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#E8E1D5] px-4 py-2.5 text-sm">
                Make it cheaper, under $1,500
              </p>

              <div className="flex gap-2.5">
                <span className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-[#1E1B18]">
                  <span className="font-(family-name:--font-display) text-sm leading-none text-[#F6F2EA]">
                    N
                  </span>
                  <span className="absolute right-1 top-1 size-1 rounded-full bg-[#D9623B]" />
                </span>
                <p className="text-sm leading-relaxed">
                  Done! I found cheaper options for 2 pieces. Your board is now{" "}
                  <span className="font-mono">$1,430</span>.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pl-9">
                {["Warmer tones", "Add a rug"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-[#D9623B]/10 px-3 py-1 text-xs text-[#B84A25]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Lock & remove */}
          <div className="grid gap-8 rounded-3xl border border-[#E8E1D5] bg-[#F6F2EA] p-7 md:col-span-3 md:grid-cols-2 md:items-center md:p-10">
            <div>
              <h3 className="text-xl font-semibold">
                Lock what you love, refine the rest
              </h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#1E1B18]/65">
                Found a favorite? Lock it, and it stays put every time you ask
                for changes. Not sure about a piece? Remove it and ask me to
                find something else.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#1E1B18]/75">
                {[
                  "Real products with prices and links to each store",
                  "Cheaper options suggested when you ask",
                  "Remove anything with one click",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#7A8B6F]/20 text-[#5C6B52]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <ul className="space-y-2.5" aria-label="Example board items">
              {featureSlots.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center gap-3 rounded-2xl border border-[#E8E1D5] bg-white p-3 pr-4"
                >
                  <span
                    className="h-11 w-11 shrink-0 rounded-xl"
                    style={{ background: s.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.name}
                    </span>
                    <span className="mt-0.5 inline-block rounded-full bg-[#F6F2EA] px-2 py-0.5 text-[11px] text-[#1E1B18]/60">
                      {s.shop}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{s.price}</span>
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full ${
                      s.locked
                        ? "bg-[#D9623B] text-white"
                        : "bg-[#F6F2EA] text-[#1E1B18]/50"
                    }`}
                    aria-label={s.locked ? "Locked" : "Unlocked"}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      {s.locked ? (
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      ) : (
                        <path d="M8 11V8a4 4 0 0 1 7-2.6" />
                      )}
                    </svg>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Coming soon: checkout (honest: payments are not built yet) */}
          <div
            id="checkout"
            className="relative flex scroll-mt-24 flex-col gap-3 overflow-hidden rounded-3xl bg-[#1E1B18] p-7 text-[#F2EDE3] sm:flex-row sm:items-center sm:justify-between md:col-span-3 md:p-10"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D9623B]/20 blur-3xl" />

            <div className="relative max-w-xl">
              {/* <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-[#F2EDE3]/80">
                Coming soon
              </span> */}
              <h3 className="mt-4 font-(family-name:--font-display) text-2xl font-medium leading-tight sm:text-3xl">
                One checkout for every store
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#F2EDE3]/65">
                We&apos;re building a single payment for items from different
                retailers, so you won&apos;t have to check out store by store.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[#E8E1D5] px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-[#1E1B18]/55 sm:flex-row">
        <span className="font-(family-name:--font-display) text-lg text-[#1E1B18]">
          Nakami
        </span>
        <nav className="flex gap-6" aria-label="Footer">
          <a href="#how-it-works" className="transition hover:text-[#1E1B18]">
            How it works
          </a>
          <a href="#features" className="transition hover:text-[#1E1B18]">
            Features
          </a>
          <Link href="/sign-in" className="transition hover:text-[#1E1B18]">
            Sign in
          </Link>
        </nav>
        <span>© 2026 Nakami</span>
      </div>
    </footer>
  );
}
