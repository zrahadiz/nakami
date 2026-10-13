import Link from "next/link";

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const steps = [
  {
    n: "01",
    title: "Describe or upload",
    body: "Type a vibe, a style and a budget, or drop in a photo that inspires you. No filters, no tabs.",
  },
  {
    n: "02",
    title: "Nakami curates the board",
    body: "Real, in-stock items from different retailers are matched and staged into one cohesive scene.",
  },
  {
    n: "03",
    title: "Refine, then check out once",
    body: "Swap or lock items, rebalance to your budget, and pay with a single PayPal checkout.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-[#D9623B]">How it works</p>
        <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          From one sentence to a shoppable board
        </h2>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="rounded-3xl border border-[#E8E1D5] bg-white/60 p-7">
              <span className="font-[family-name:var(--font-display)] text-5xl text-[#D9623B]/80">{s.n}</span>
              <h3 className="mt-6 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#1E1B18]/65">{s.body}</p>
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

const slots = [
  { name: "Oak lounge chair", shop: "Hale & Co", price: "$289", locked: true, color: "#C9A27A" },
  { name: "Paper floor lamp", shop: "Soma Home", price: "$148", locked: false, color: "#E8E1D5" },
  { name: "Linen throw", shop: "Fieldnote", price: "$64", locked: false, color: "#7A8B6F" },
];

const retailers = [
  { name: "Hale & Co", detail: "2 items · arrives Oct 18–21 · 30-day returns", price: "$400" },
  { name: "Soma Home", detail: "1 item · arrives Oct 20–24 · 30-day returns", price: "$148" },
  { name: "Fieldnote", detail: "1 item · arrives Oct 16–18 · 14-day returns", price: "$64" },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 bg-[#EFE9DD] px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-[#D9623B]">Features</p>
        <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
          The board is the cart
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {/* Swap & lock */}
          <div className="rounded-3xl border border-[#E8E1D5] bg-[#F6F2EA] p-7 md:col-span-2">
            <h3 className="text-lg font-semibold">Swap what you don&apos;t love, lock what you do</h3>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#1E1B18]/65">
              Every slot offers close alternatives. Lock a favorite and regenerate the rest around it.
            </p>
            <ul className="mt-6 space-y-2.5" aria-label="Example board slots">
              {slots.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center gap-3 rounded-2xl border border-[#E8E1D5] bg-white p-3 pr-4"
                >
                  <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="mt-0.5 inline-block rounded-full bg-[#F6F2EA] px-2 py-0.5 text-[11px] text-[#1E1B18]/60">
                      {s.shop}
                    </span>
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-sm">{s.price}</span>
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full ${
                      s.locked ? "bg-[#D9623B] text-white" : "bg-[#F6F2EA] text-[#1E1B18]/50"
                    }`}
                    aria-label={s.locked ? "Locked" : "Unlocked"}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      {s.locked ? <path d="M8 11V8a4 4 0 0 1 8 0v3" /> : <path d="M8 11V8a4 4 0 0 1 7-2.6" />}
                    </svg>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Budget */}
          <div className="flex flex-col rounded-3xl border border-[#E8E1D5] bg-[#F6F2EA] p-7">
            <h3 className="text-lg font-semibold">A budget that rebalances live</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-[#1E1B18]/65">
              Slide the budget and the whole board adapts, so nothing goes over.
            </p>
            <div className="mt-auto pt-8">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-[#1E1B18]/60">Budget</span>
                <span className="font-[family-name:var(--font-mono)] text-2xl">$800</span>
              </div>
              <div className="relative mt-4 h-2 rounded-full bg-[#E8E1D5]" aria-hidden>
                <div className="h-full w-[76%] rounded-full bg-[#D9623B]" />
                <span className="absolute left-[76%] top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#D9623B] bg-white shadow" />
              </div>
              <p className="mt-4 text-sm text-[#5C6B52]">
                <span className="font-[family-name:var(--font-mono)]">$612</span> used ·{" "}
                <span className="font-[family-name:var(--font-mono)]">$188</span> left
              </p>
            </div>
          </div>

          {/* Checkout */}
          <div
            id="checkout"
            className="scroll-mt-24 grid gap-8 rounded-3xl bg-[#1E1B18] p-7 text-[#F2EDE3] md:col-span-3 md:grid-cols-[1fr_1.1fr] md:p-10"
          >
            <div className="flex flex-col justify-center">
              <h3 className="font-[family-name:var(--font-display)] text-3xl font-medium leading-tight sm:text-4xl">
                Many retailers. One total. One checkout.
              </h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#F2EDE3]/65">
                See shipping, delivery dates and return policies per retailer, folded neatly under a
                single PayPal payment. No surprises at the door.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <ul className="divide-y divide-white/10">
                {retailers.map((r) => (
                  <li key={r.name} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                    <span>
                      <span className="block text-sm font-medium">{r.name}</span>
                      <span className="mt-0.5 block text-xs text-[#F2EDE3]/55">{r.detail}</span>
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-sm">{r.price}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-sm text-[#F2EDE3]/70">Total</span>
                <span className="font-[family-name:var(--font-mono)] text-xl">$612</span>
              </div>
              {/* Illustrative only. In the real checkout, render PayPal's official button. */}
              <div
                className="mt-4 grid h-12 place-items-center rounded-full bg-[#FFC439] text-sm font-semibold text-[#111]"
                aria-hidden
              >
                Pay with PayPal
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA + footer                                                  */
/* ------------------------------------------------------------------ */

export function FinalCta() {
  return (
    <section className="px-5 py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#1E1B18] px-6 py-16 text-center text-[#F2EDE3] sm:px-12 sm:py-24">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#D9623B]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[#8B6CFF]/20 blur-3xl" />
        <h2 className="relative mx-auto max-w-3xl font-[family-name:var(--font-display)] text-4xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
          Your next room or gaming setup is one sentence away.
        </h2>
        <div className="relative mt-10">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-[#D9623B] px-7 py-4 text-base font-medium text-white shadow-[0_12px_30px_-10px_rgba(217,98,59,0.9)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/40"
          >
            Start your first board <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[#E8E1D5] px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-[#1E1B18]/55 sm:flex-row">
        <span className="font-[family-name:var(--font-display)] text-lg text-[#1E1B18]">Nakami</span>
        <nav className="flex gap-6" aria-label="Footer">
          <a href="#how-it-works" className="transition hover:text-[#1E1B18]">How it works</a>
          <a href="#features" className="transition hover:text-[#1E1B18]">Features</a>
          <Link href="/sign-in" className="transition hover:text-[#1E1B18]">Sign in</Link>
        </nav>
        <span>© 2026 Nakami</span>
      </div>
    </footer>
  );
}