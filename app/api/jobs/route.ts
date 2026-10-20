import { after } from "next/server";
import { isFalMockEnabled } from "@/lib/fal/mock";
import { computeCacheKey } from "@/lib/jobs/cache-key";
import { STALE_JOB_MS, runJob } from "@/lib/jobs/worker";
import { jobFromRow } from "@/lib/supabase/mappers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { GenerationJob } from "@/lib/types";
import z from "zod";

// T5: 3D generation jobs.
// - POST queues an image-to-3D or text-to-3D job and returns it immediately;
//   the heavy work runs in after(), up to maxDuration.
// - GET lists the jobs of one thread (RLS scopes it to the caller) and
//   re-advances stale queued/running jobs so a reload can resume generation.
//
// Reads use the cookie client (RLS applies); writes use the service-role
// client because clients cannot insert/update jobs directly. Jobs and assets
// are only ever written by this route and the worker.

// export const maxDuration = 300

const MAX_SWEEPS_PER_GET = 3;

/** Real key or the dev mock — either one means generations can run. */
function falConfigured(): boolean {
    return Boolean(process.env.FAL_KEY) || isFalMockEnabled();
}

const postJobSchema = z
    .object({
        threadId: z.uuid(),
        productId: z.string().trim(),
        imageUrl: z.url().optional(),
        prompt: z.string().trim().min(1).optional(),
    })
    .refine((data) => Boolean(data.imageUrl || data.prompt), {
        // imageUrl wins when both are present; prompt is kept as a source hint
        // for the dev mock and as the text-to-3D input when there is no image.
        error: "Provide imageUrl (image-to-3D) or prompt (text-to-3D)",
    });

const getJobSearchParams = z.object({
    threadId: z.uuid(),
});

// POST /api/jobs — queue a 3D generation job for a thread.
export async function POST(request: Request) {
    if (!falConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return Response.json(
            {
                error: "3D generation is not configured (FAL_KEY / SUPABASE_SERVICE_ROLE_KEY)",
            },
            { status: 503 },
        );
    }

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

    const result = postJobSchema.safeParse(body);
    if (!result.success) {
        console.error(result.error);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    const { threadId, productId, imageUrl, prompt } = result.data;

    // RLS scopes this query: a thread owned by someone else looks missing.
    const { data: thread, error: threadError } = await supabase
        .from("threads")
        .select("id")
        .eq("id", threadId)
        .maybeSingle();
    if (threadError) {
        console.error("POST /api/jobs thread lookup failed:", threadError);
        return Response.json(
            { error: "Failed to load thread" },
            { status: 500 },
        );
    }
    if (!thread) {
        return Response.json({ error: "Thread not found" }, { status: 404 });
    }

    const service = createServiceClient();
    const kind = imageUrl ? ("image-to-3d" as const) : ("text-to-3d" as const);
    const cacheKey = computeCacheKey(
        kind,
        {
            imageUrl: imageUrl,
            prompt: prompt,
        },
        // Mock samples are chosen from the prompt, so the name has to be part
        // of the cache identity there. Real fal image-to-3D depends only on
        // the image URL.
        { includePrompt: isFalMockEnabled() },
    );

    const baseInsert = {
        user_id: user.id,
        thread_id: threadId,
        kind,
        cache_key: cacheKey,
        product_id: productId,
        input_url: imageUrl,
        input_prompt: prompt,
    };

    // 1) Cache hit: the asset already exists — record a ready job for this
    //    thread so the UI (and Realtime) sees it like any other finished job.
    const cached = await service
        .from("assets")
        .select("id, storage_path")
        .eq("cache_key", cacheKey)
        .maybeSingle();
    if (cached.error) {
        console.error("POST /api/jobs cache lookup failed:", cached.error);
        return Response.json(
            { error: "Failed to check asset cache" },
            { status: 500 },
        );
    }

    if (cached.data) {
        const assetUrl = service.storage
            .from("glb-cache")
            .getPublicUrl(cached.data.storage_path).data.publicUrl;
        const { data: row, error } = await service
            .from("jobs")
            .insert({
                ...baseInsert,
                status: "ready",
                asset_id: cached.data.id,
                asset_url: assetUrl,
            })
            .select()
            .single();
        if (error) {
            console.error(
                "POST /api/jobs failed to insert cache-hit job:",
                error,
            );
            return Response.json(
                { error: "Failed to create job" },
                { status: 500 },
            );
        }
        return Response.json(jobFromRow(row), { status: 200 });
    }

    // 2) In-flight guard: reuse a queued/running job for the same thread and
    //    cache key instead of paying fal twice (double click, retried fetch).
    const inFlight = await service
        .from("jobs")
        .select()
        .eq("thread_id", threadId)
        .eq("cache_key", cacheKey)
        .in("status", ["queued", "running"])
        .limit(1)
        .maybeSingle();
    if (inFlight.error) {
        console.error(
            "POST /api/jobs in-flight lookup failed:",
            inFlight.error,
        );
        return Response.json(
            { error: "Failed to create job" },
            { status: 500 },
        );
    }
    if (inFlight.data) {
        return Response.json(jobFromRow(inFlight.data), { status: 202 });
    }

    // 3) New job: insert queued, then run the pipeline after the response.
    const { data: row, error } = await service
        .from("jobs")
        .insert({ ...baseInsert, status: "queued" })
        .select()
        .single();
    if (error) {
        console.error("POST /api/jobs failed to insert job:", error);
        return Response.json(
            { error: "Failed to create job" },
            { status: 500 },
        );
    }

    after(() => runJob(row.id));
    return Response.json(jobFromRow(row), { status: 202 });
}

// GET /api/jobs?threadId=... — jobs for one thread, oldest first.
export async function GET(request: Request) {
    const supabase = await createClient();

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const result = getJobSearchParams.safeParse(
        Object.fromEntries(url.searchParams.entries()),
    );
    if (!result.success) {
        console.error(result.error.message);
        return Response.json({ error: result.error.message }, { status: 400 });
    }

    const { threadId } = result.data;

    const { data: rows, error } = await supabase
        .from("jobs")
        .select()
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
    if (error) {
        console.error("GET /api/jobs failed:", error);
        return Response.json({ error: "Failed to load jobs" }, { status: 500 });
    }

    // Stale-job reaper: re-advance jobs whose worker stopped mid-flight (poll
    // window elapsed, instance recycled). Bounded per request.
    if (falConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const staleBefore = Date.now() - STALE_JOB_MS;
        const stale = rows
            .filter(
                (row) =>
                    (row.status === "queued" || row.status === "running") &&
                    Date.parse(row.updated_at) < staleBefore,
            )
            .slice(0, MAX_SWEEPS_PER_GET);
        for (const row of stale) {
            after(() => runJob(row.id));
        }
    }

    const jobs: GenerationJob[] = rows.map(jobFromRow);
    return Response.json(jobs);
}
