"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ProfileMenu } from "../auth/profile-menu";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#checkout", label: "Checkout" },
];

function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex items-baseline gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#D9623B]/50"
    >
      <span className="font-[family-name:var(--font-display)] text-2xl font-medium tracking-tight text-[#1E1B18]">
        Nakami
      </span>
      <span
        className="h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[#D9623B]"
        aria-hidden
      />
      <span className="text-xs text-[#1E1B18]/40" aria-hidden>
        中身
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Listen for authentication changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Check the initial session.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      })
      .catch((error) => {
        console.error("Failed to retrieve session:", error);
        setAuthLoading(false);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const authButtons = user ? (
    <ProfileMenu user={user} />
  ) : (
    <>
      <Link
        href="/sign-in"
        className="rounded-full px-4 py-2 text-[15px] text-[#1E1B18]/75 outline-none transition hover:text-[#1E1B18] focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
      >
        Sign in
      </Link>

      <Link
        href="/register"
        className="rounded-full bg-[#1E1B18] px-5 py-2.5 text-[15px] font-medium text-[#F6F2EA] outline-none transition hover:bg-[#33302B] focus-visible:ring-4 focus-visible:ring-[#1E1B18]/20"
      >
        Get started
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E1D5]/70 bg-[#F6F2EA]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Wordmark />

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-[15px] text-[#1E1B18]/75 outline-none transition hover:bg-[#E8E1D5]/70 hover:text-[#1E1B18] focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop authentication */}
        <div className="hidden items-center gap-2 justify-self-end md:flex">
          {authLoading ? (
            <div className="h-10 w-28 animate-pulse rounded-full bg-[#E8E1D5]" />
          ) : (
            authButtons
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="grid h-10 w-10 place-items-center rounded-full text-[#1E1B18] outline-none transition hover:bg-[#E8E1D5]/70 focus-visible:ring-2 focus-visible:ring-[#D9623B]/40 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 8h16M4 16h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile navigation */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-[#E8E1D5] bg-[#F6F2EA] px-5 pb-5 pt-3 md:hidden"
        >
          <nav className="flex flex-col" aria-label="Mobile">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-base text-[#1E1B18]/80 transition hover:bg-[#E8E1D5]/70"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-3 flex items-center justify-end gap-3">
            {authLoading ? (
              <div className="h-10 w-28 animate-pulse rounded-full bg-[#E8E1D5]" />
            ) : (
              authButtons
            )}
          </div>
        </div>
      )}
    </header>
  );
}