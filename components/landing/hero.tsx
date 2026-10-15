"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FloatingBoards from "@/components/ornaments/floating-boards";
import { PromptHero } from "@/components/prompt/prompt-hero";

import {
  PromptComposer,
  type PromptCategory,
  type PromptSubmitData,
} from "@/components/prompt/prompt-composer";

const sparkles: [string, string][] = [
  ["6%", "62%"],
  ["12%", "88%"],
  ["22%", "74%"],
  ["34%", "92%"],
  ["66%", "90%"],
  ["78%", "76%"],
  ["88%", "86%"],
  ["94%", "64%"],
  ["80%", "34%"],
  ["20%", "30%"],
];

export default function Hero() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<PromptCategory>("furniture");

  function handleSubmit(data: PromptSubmitData) {
    sessionStorage.setItem(
      "nakami:pending-shopping-intent",
      JSON.stringify({
        prompt: data.prompt,
        category: data.category,
      }),
    );

    router.push("/register?next=%2Fworkspace");
  }

  return (
    <section className="relative overflow-hidden py-10">
      {/* warm haze */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%] bg-[radial-gradient(ellipse_at_bottom,rgba(217,98,59,0.22),rgba(139,108,255,0.10)_45%,transparent_72%)]" />
      <div
        className="pointer-events-none absolute inset-0 hidden sm:block"
        aria-hidden
      >
        {sparkles.map(([left, top], i) => (
          <span
            key={i}
            className="absolute text-lg leading-none text-[#D9623B]/35"
            style={{ left, top }}
          >
            +
          </span>
        ))}
      </div>

      <FloatingBoards />

      <div className="mx-auto w-full max-w-3xl">
        <PromptHero variant="landing" className="mb-10" />

        <PromptComposer
          prompt={prompt}
          onPromptChange={setPrompt}
          category={category}
          onCategoryChange={setCategory}
          onSubmit={handleSubmit}
          allowImages={false}
        />

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Type a prompt · Press Ctrl/⌘ + Enter to generate
        </p>
      </div>
    </section>
  );
}
