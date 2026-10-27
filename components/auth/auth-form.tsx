"use client";

import { useState, type ReactNode, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "login" | "register";
};

const inputClass =
  "w-full rounded-2xl border border-[#DDD4C4] bg-white/70 px-4 py-3.5 text-[15px] text-[#1E1B18] " +
  "placeholder:text-[#1E1B18]/35 outline-none transition " +
  "hover:border-[#C9BFAE] focus:border-[#D9623B] focus:bg-white focus:ring-4 focus:ring-[#D9623B]/15";

const strengthLabels = [
  "Enter a password",
  "Too weak",
  "Okay",
  "Good",
  "Strong",
];

function getStrength(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.max(s, 1);
}

function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[#1E1B18]">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const strength = getStrength(password);

  // Honor the `next` path added by middleware / the 401 interceptor. Only
  // same-origin absolute paths are accepted.
  function destination() {
    if (typeof window === "undefined") return "/dashboard";
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return "/dashboard";
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            // emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        if (data.session) {
          router.replace(destination());
          router.refresh();
        } else {
          setMessage(
            "Check your email for a confirmation link to finish creating your account.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.replace(destination());
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-105">
      <div className="mb-4">
        <h1 className="font-(family-name:--font-display) text-[2.5rem] font-medium leading-[1.05] tracking-tight text-[#1E1B18] sm:text-4xl">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#1E1B18]/60">
          {isRegister
            ? "Describe a vibe, get a curated board, and check out once. It takes a minute to set up."
            : "Sign in to pick up your boards where you left off."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        {isRegister && (
          <Field id="name" label="Full name">
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Your name"
            />
          </Field>
        )}

        <Field id="email" label="Email address">
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          id="password"
          label="Password"
          hint={
            isRegister ? (
              <div id="password-hint" className="pt-1">
                <div className="flex gap-1.5" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength >= 3
                            ? "bg-[#7A8B6F]"
                            : "bg-[#D9623B]"
                          : "bg-[#E8E1D5]"
                      }`}
                    />
                  ))}
                </div>
                <p
                  className="mt-2 text-xs text-[#1E1B18]/55"
                  aria-live="polite"
                >
                  {strengthLabels[strength]} · use at least 6 characters
                </p>
              </div>
            ) : undefined
          }
        >
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={isRegister ? "password-hint" : undefined}
              className={`${inputClass} pr-12`}
              placeholder={
                isRegister ? "Create a password" : "Enter your password"
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-[#1E1B18]/45 outline-none transition hover:text-[#1E1B18] focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="rounded-2xl border border-[#7A8B6F]/30 bg-[#7A8B6F]/10 px-4 py-3 text-sm text-[#3F4B38]"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D9623B] px-4 py-3.5 text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(217,98,59,0.7)] outline-none transition hover:bg-[#C4532D] focus-visible:ring-4 focus-visible:ring-[#D9623B]/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="3"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Please wait…
            </>
          ) : (
            <>
              {isRegister ? "Create account" : "Sign in"}
              <span
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              >
                →
              </span>
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-[#1E1B18]/60">
        {isRegister ? "Already have an account?" : "New to Nakami?"}{" "}
        <Link
          href={isRegister ? "/sign-in" : "/register"}
          className="rounded font-medium text-[#B84A25] underline decoration-[#D9623B]/30 underline-offset-4 outline-none transition hover:decoration-[#D9623B] focus-visible:ring-2 focus-visible:ring-[#D9623B]/40"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
