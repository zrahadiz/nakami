import {
    chat,
    chatParamsFromRequest,
    memoryStream,
    ModelMessage,
    resumeServerSentEventsResponse,
    toServerSentEventsResponse,
} from "@tanstack/ai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import {
    defineAIPersistence,
    defineMessageStore,
    reconstructChat,
    withPersistence,
} from "@tanstack/ai-persistence";
import { createClient } from "@/lib/supabase/server";
import { agentTools } from "@/lib/agent/tools";
import { AgentPlanSchema } from "@/lib/agent/schema";
import { NAKAMI_SYSTEM_PROMPT } from "@/lib/agent/prompt";
import type { Json } from "@/lib/supabase/database.types";
import { redirect } from "next/navigation";
import { SupabaseClient } from "@supabase/supabase-js";

if (!process.env.LLM_API_KEY) {
    throw new Error("LLM_API_KEY is not configured");
}

const chatAdapter = createOpenRouterText(
    // @ts-expect-error - OpenRouter free model type is missing from the library types
    "openrouter/free",
    process.env.LLM_API_KEY,
);

function createPersistence(supabase: SupabaseClient, user: { id: string }) {
    return defineAIPersistence({
        stores: {
            messages: defineMessageStore({
                async loadThread(threadId) {
                    const { data } = await supabase
                        .from("messages")
                        .select("messages_json")
                        .eq("thread_id", threadId)
                        .maybeSingle();

                    if (!data || !data.messages_json) {
                        return [];
                    }

                    // const parsed: Array<ModelMessage> = JSON.parse(
                    //     data.messages_json.toString(),
                    // );
                    return data.messages_json as unknown as Array<ModelMessage>;
                },

                async saveThread(threadId, messages) {
                    const { error } = await supabase.from("messages").upsert(
                        {
                            user_id: user.id,
                            thread_id: threadId,
                            messages_json: messages as unknown as Json,
                        },
                        { onConflict: "thread_id" },
                    );

                    if (error) {
                        console.error(error.message);
                    }
                },
            }),
        },
    });
}

// POST /api/chat — run the Nakami agent and stream its lifecycle as SSE.
export async function POST(request: Request) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
        return redirect("/login");
    }

    const params = await chatParamsFromRequest(request);

    // RLS scopes this query: a thread owned by someone else is indistinguishable
    // from a missing one, so a clean 404 covers both.
    const { data: thread, error: threadError } = await supabase
        .from("threads")
        .select("id")
        .eq("id", params.threadId)
        .maybeSingle();
    if (threadError) {
        console.error("POST /api/chat thread lookup failed:", threadError);
        return Response.json(
            { error: "Failed to load thread" },
            { status: 500 },
        );
    }
    if (!thread) {
        return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    const abortController = new AbortController();
    request.signal.addEventListener("abort", () => abortController.abort());

    const persistence = defineAIPersistence({
        stores: {
            messages: defineMessageStore({
                async loadThread(threadId) {
                    const { data } = await supabase
                        .from("messages")
                        .select("messages_json")
                        .eq("id", threadId)
                        .maybeSingle();
                    if (!data || !data.messages_json) {
                        return [];
                    }

                    // const parsed: Array<ModelMessage> = JSON.parse(
                    //     data.messages_json.toString(),
                    // );
                    return data.messages_json as unknown as Array<ModelMessage>;
                },
                async saveThread(threadId, messages) {
                    const { error } = await supabase.from("messages").upsert(
                        {
                            user_id: user.id,
                            thread_id: threadId,
                            messages_json: messages as unknown as Json,
                        },
                        { onConflict: "thread_id" },
                    );
                    if (error) {
                        console.error(error.message);
                    }
                },
            }),
        },
    });

    try {
        const stream = chat({
            adapter: chatAdapter,
            threadId: params.threadId,
            messages: params.messages,
            systemPrompts: [NAKAMI_SYSTEM_PROMPT],
            tools: agentTools,
            outputSchema: AgentPlanSchema,
            stream: true,
            middleware: [withPersistence(persistence)],
            abortController,
        });

        return toServerSentEventsResponse(stream, {
            abortController,
        });
    } catch (err) {
        console.error("POST /api/chat failed to start the agent run:", err);
        return Response.json(
            { error: "Failed to start chat stream" },
            { status: 500 },
        );
    }
}

export async function GET(request: Request) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
        return redirect("/login");
    }

    const durability = memoryStream(request);
    if (durability.resumeFrom() !== null) {
        return resumeServerSentEventsResponse({ adapter: durability });
    }

    return reconstructChat(
        createPersistence(supabase, { id: user.id }),
        request,
    );
}
