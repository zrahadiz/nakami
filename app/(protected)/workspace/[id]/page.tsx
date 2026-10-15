// app/(protected)/workspace/[id]/page.tsx
import { notFound } from "next/navigation";

import { ThreadWorkspace } from "@/components/workspace/thread-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes both queries to the signed-in user, so someone else's thread is a 404.
  const { data: thread, error } = await supabase
    .from("threads")
    .select("id, first_prompt, preview_image_url")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error(error.stack, error.message);
  }
  if (!thread) notFound();

  return (
<div className="h-dvh min-h-0 overflow-hidden">
      <ThreadWorkspace
        threadId={id}
        firstPrompt={thread.first_prompt}
        initialPreviewUrl={thread.preview_image_url}
      />
    </div>
  );
}
