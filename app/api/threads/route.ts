import { createClient } from "@/lib/supabase/server";
import { threadFromRow } from "@/lib/supabase/mappers";
import type { Thread } from "@/lib/types";
import z from "zod";

const postThreadSchema = z.object({
    name: z.string().trim().min(1),
    firstPrompt: z.string().trim().min(1),
});

// GET /api/threads — all threads for the authenticated user, newest first.
// RLS scopes the query to the caller's rows.
export async function GET() {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows, error } = await supabase
        .from("threads")
        .select()
        .order("updated_at", { ascending: false });
    if (error) {
        console.error(error);
        return Response.json(
            { error: "Failed to load threads" },
            { status: 500 },
        );
    }

    const threads: Thread[] = rows.map(threadFromRow);
    return Response.json(threads);
}

// POST /api/threads — create a thread owned by the authenticated user.
export async function POST(request: Request) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = postThreadSchema.safeParse(body);
    if (!result.success) {
        console.error(result.error);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    const { name, firstPrompt } = result.data;

    const { data: row, error } = await supabase
        .from("threads")
        .insert({
            user_id: user.id,
            name: name,
            first_prompt: firstPrompt,
        })
        .select()
        .single();
    if (error) {
        console.error(error);
        return Response.json(
            { error: "Failed to create thread" },
            { status: 500 },
        );
    }

    const thread: Thread = threadFromRow(row);
    return Response.json(thread, { status: 201 });
}
