// app/(protected)/workspace/[id]/page.tsx
import { notFound } from "next/navigation";
import type { UIMessage } from "@tanstack/ai-react";

import { ThreadWorkspace } from "@/components/workspace/thread-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function ThreadPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    await supabase.auth.getUser();

    // RLS scopes both queries to the signed-in user, so someone else's thread is a 404.
    const { data: thread, error } = await supabase
        .from("threads")
        .select("id, first_prompt, preview_image_url")
        .eq("id", id)
        .maybeSingle();
    console.log(error);
    if (!thread) notFound();

    const { data: rows } = await supabase
        .from("messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", id)
        .order("created_at", { ascending: true });

    // Same `parts` JSON your /api/chat route persists, so history and live replies render alike.
    const initialMessages = (rows ?? [])
        .filter((row) => row.role === "user" || row.role === "assistant")
        .map((row) => ({
            id: String(row.id),
            role: row.role as UIMessage["role"],
            parts: (row.parts ?? []) as unknown as UIMessage["parts"],
        })) as UIMessage[];

    return (
        <ThreadWorkspace
            threadId={id}
            firstPrompt={thread.first_prompt}
            initialPreviewUrl={thread.preview_image_url}
            initialMessages={initialMessages}
        />
    );
}
