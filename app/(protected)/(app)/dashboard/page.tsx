"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PromptComposer,
  type PromptCategory,
  type PromptSubmitData,
} from "@/components/prompt/prompt-composer";

import { PromptSuggestions } from "@/components/prompt/prompt-suggestions";
import { PromptHero } from "@/components/prompt/prompt-hero";

import { createThread } from "@/lib/api/threads";
import { RecentProjects } from "@/components/dashboard/recent-projects";

export default function Dashboard() {
  const router = useRouter();

  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<PromptCategory>("furniture");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Continue the prompt a visitor typed on the landing page before signing up.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("nakami:pending-shopping-intent");
      if (!raw) return;

      sessionStorage.removeItem("nakami:pending-shopping-intent");
      const intent = JSON.parse(raw) as {
        prompt?: unknown;
        category?: unknown;
      };
      if (typeof intent.prompt === "string" && intent.prompt.trim()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrompt(intent.prompt);
      }
      if (intent.category === "furniture" || intent.category === "gaming") {
        setCategory(intent.category);
      }
    } catch {
      /* storage unavailable or malformed — start with a blank board */
    }
  }, []);

  async function handleSubmit(data: PromptSubmitData) {
    const value = data.prompt.trim();

    if (!value || loading) return;

    setLoading(true);
    setError(null);

    try {
      const thread = await createThread(
        value.slice(0, 60),
        value,
        data.category,
      );

      sessionStorage.setItem(`nakami:pending-prompt:${thread.id}`, value);

      router.push(`/workspace/${thread.id}`);
    } catch (error) {
      console.error(error);

      setError("Failed to create project. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(suggestion: {
    prompt: string;
    category: PromptCategory;
  }) {
    setPrompt(suggestion.prompt);
    setCategory(suggestion.category);
  }

  return (
    <div
      className="min-h-full px-5 py-12 lg:px-10 lg:py-16"
      style={{
        backgroundImage: "radial-gradient(#e5e1eb 0.8px, transparent 0.8px)",
        backgroundSize: "24px 24px",
      }}
    >
      <PromptHero variant="dashboard" className="mb-10" />
      <PromptComposer
        prompt={prompt}
        onPromptChange={setPrompt}
        category={category}
        onCategoryChange={setCategory}
        onSubmit={handleSubmit}
        loading={loading}
        allowImages={false}
        error={error}
      />

      <PromptSuggestions
        selectedPrompt={prompt}
        onSelect={handleSuggestion}
        disabled={loading}
        className="mt-8"
      />

      <RecentProjects />
    </div>
  );
}
