import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import { createClient } from "@/lib/supabase/server";
import { agentTools } from "@/lib/agent/tools";
import { AgentPlanSchema } from "@/lib/agent/schema";
import { NAKAMI_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { toModelMessages } from "@/lib/agent/history";
import { withAssistantPersistence } from "@/lib/agent/assistant-message";
import type { TablesInsert } from "@/lib/supabase/database.types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/chat — run the Nakami agent and stream its lifecycle as SSE.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims;
  if (!user?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { threadId, message } = (body ?? {}) as {
    threadId?: unknown;
    message?: unknown;
  };
  if (typeof threadId !== "string" || !UUID_RE.test(threadId)) {
    return Response.json({ error: "threadId must be a UUID" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // RLS scopes this query: a thread owned by someone else is indistinguishable
  // from a missing one, so a clean 404 covers both.
  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle();
  if (threadError) {
    console.error("POST /api/chat thread lookup failed:", threadError);
    return Response.json({ error: "Failed to load thread" }, { status: 500 });
  }
  if (!thread) {
    return Response.json({ error: "Thread not found" }, { status: 404 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 503 });
  }

  const { error: insertError } = await supabase.from("messages").insert({
    thread_id: threadId,
    user_id: user.sub,
    role: "user",
    parts: [{ type: "text", text: message }],
  });
  if (insertError) {
    console.error("POST /api/chat failed to persist user message:", insertError);
    return Response.json({ error: "Failed to persist message" }, { status: 500 });
  }

  // Keep the thread list ordered by activity until a DB trigger takes over.
  const { error: touchError } = await supabase
    .from("threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (touchError) {
    console.error("POST /api/chat failed to touch thread:", touchError);
  }

  const { data: rows, error: historyError } = await supabase
    .from("messages")
    .select()
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (historyError || !rows) {
    console.error("POST /api/chat failed to load history:", historyError);
    return Response.json({ error: "Failed to load history" }, { status: 500 });
  }

  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  try {
    const stream = chat({
      // @ts-expect-error - OpenRouter free model type is missing from the library types
      adapter: openRouterText("openrouter/free"),
      messages: toModelMessages(rows),
      systemPrompts: [NAKAMI_SYSTEM_PROMPT],
      tools: agentTools,
      outputSchema: AgentPlanSchema,
      stream: true,
      abortController,
    });

    const persistentStream = withAssistantPersistence(stream, async (assistant) => {
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        user_id: user.sub,
        role: "assistant",
        // Contract parts carry `unknown` payloads; JSONB stores the same data.
        parts: assistant.parts as unknown as TablesInsert<"messages">["parts"],
      });
      if (error) throw error;
    });

    return toServerSentEventsResponse(persistentStream, { abortController });
  } catch (err) {
    console.error("POST /api/chat failed to start the agent run:", err);
    return Response.json({ error: "Failed to start chat stream" }, { status: 500 });
  }
}
