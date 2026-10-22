import { createClient } from "@/lib/supabase/server";
import { threadFromRow } from "@/lib/supabase/mappers";
import type { Thread } from "@/lib/types";
import z from "zod";

// GET /api/threads/[id] — one thread, 404 unless it belongs to the caller.
// RLS makes a thread owned by someone else indistinguishable from a missing one.
export async function GET(
    _request: Request,
    ctx: RouteContext<"/api/threads/[id]">,
) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Next 16: params is a Promise — await before reading the id.
    const result = z.uuid().safeParse((await ctx.params).id);
    if (!result.success) {
        console.error(result.error);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    const id = result.data;

    const { data: row, error } = await supabase
        .from("threads")
        .select()
        .eq("id", id)
        .maybeSingle();
    if (error) {
        console.error(error);
        return Response.json(
            { error: "Failed to load thread" },
            { status: 500 },
        );
    }
    if (!row) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    const thread: Thread = threadFromRow(row);
    return Response.json(thread);
}

const patchThreadSchema = z.object({
    category: z.enum(["furniture", "gaming"]),
});

// PATCH /api/threads/[id] — update the board category. RLS ensures the caller
// can only update their own thread.
export async function PATCH(
    request: Request,
    ctx: RouteContext<"/api/threads/[id]">,
) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedId = z.uuid().safeParse((await ctx.params).id);
    if (!parsedId.success) {
        return Response.json({ error: "Invalid thread id" }, { status: 400 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = patchThreadSchema.safeParse(body);
    if (!result.success) {
        console.error(result.error);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    const { data: row, error } = await supabase
        .from("threads")
        .update({ category: result.data.category, updated_at: new Date().toISOString() })
        .eq("id", parsedId.data)
        .select()
        .maybeSingle();
    if (error) {
        console.error(error);
        return Response.json(
            { error: "Failed to update thread" },
            { status: 500 },
        );
    }
    if (!row) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }

    const thread: Thread = threadFromRow(row);
    return Response.json(thread);
}
