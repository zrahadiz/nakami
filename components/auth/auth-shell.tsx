import type { ReactNode } from "react";
import Wordmark from "../ornaments/wordmark";


export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F6F2EA] text-[#1E1B18] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel (desktop only) */}
      <aside className="relative hidden overflow-hidden bg-[#1E1B18] p-12 text-[#F2EDE3] lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="relative">
          <Wordmark dark />
        </div>

        <div className="relative space-y-10">
          <div className="max-w-md space-y-4">
            <h2 className="font-(family-name:--font-display) text-4xl font-medium leading-[1.1] tracking-tight xl:text-5xl">
              Shop the whole look, not the whole internet.
            </h2>
            <p className="text-base leading-relaxed text-[#F2EDE3]/65">
              Describe a vibe or drop in an inspiration photo. Nakami curates real items across
              retailers and gathers them on one board, with one checkout.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-[#F2EDE3]/40">Interiors · Gaming setups</p>
      </aside>

      {/* Form panel */}
      <section className="relative flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:min-h-0">
        <header className="flex items-center justify-between lg:hidden">
          <Wordmark />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">{children}</div>

        <footer className="text-center text-xs text-[#1E1B18]/40">
          Secure sign-in · Your boards stay private to you
        </footer>
      </section>
    </main>
  );
}