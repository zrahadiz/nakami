import Link from "next/link";

export default function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-baseline gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#D9623B]/50 ${
        dark ? "text-[#F2EDE3]" : "text-[#1E1B18]"
      }`}
    >
      <span className="font-(family-name:--font-display) text-2xl font-medium tracking-tight">
        Nakami
      </span>
      <span
        className="h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[#D9623B]"
        aria-hidden
      />
      <span
        className={`text-xs ${dark ? "text-[#F2EDE3]/50" : "text-[#1E1B18]/40"}`}
        aria-hidden
      >
        中身
      </span>
    </Link>
  );
}
