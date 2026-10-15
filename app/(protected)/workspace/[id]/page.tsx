// app/(protected)/workspace/[id]/page.tsx
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ThreadWorkspace } from "@/components/workspace/thread-workspace";
import { createClient } from "@/lib/supabase/server";

// The page itself is synchronous, so Next.js can prerender a static shell
// and stream the real content in at request time.
export default function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <ThreadContent params={params} />
    </Suspense>
  );
}

// Everything that needs the request (route param, session, current time) lives here.
async function ThreadContent({ params }: { params: Promise<{ id: string }> }) {
  // Render at request time: supabase-js reads Date.now() to check the session token.
  await connection();

  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes the query to the signed-in user, so someone else's thread is a 404.
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

// Shown for a moment while the thread loads.
function WorkspaceLoading() {
  return (
    <div className="grid h-dvh place-items-center bg-background">
      <div
        className="size-6 animate-spin rounded-full border-2 border-border border-t-[#D9623B]"
        role="status"
        aria-label="Loading workspace"
      />
    </div>
  );
}
