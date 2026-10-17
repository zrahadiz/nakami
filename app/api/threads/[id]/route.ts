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
    const result = z.ulid().safeParse((await ctx.params).id);
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
