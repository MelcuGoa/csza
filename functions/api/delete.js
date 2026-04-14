export async function onRequestPost(context) {
    return handleDelete(context);
}

export async function onRequestDelete(context) {
    return handleDelete(context);
}

async function handleDelete(context) {
    const { DB } = context.env;
    const expectedWriteKey = context.env.WRITE_API_KEY;

    if (!DB) {
        return json(
            { error: "D1 binding 'DB' is missing. Add it in Cloudflare Pages settings or wrangler.jsonc." },
            500
        );
    }

    if (!expectedWriteKey) {
        return json(
            { error: "WRITE_API_KEY secret is missing. Add it in Cloudflare Pages settings." },
            500
        );
    }

    const providedWriteKey = context.request.headers.get("X-Write-Key");

    if (providedWriteKey !== expectedWriteKey) {
        return json({ error: "Invalid write key." }, 401);
    }

    const date = await getDateFromRequest(context.request);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ error: "Date must be in YYYY-MM-DD format." }, 400);
    }

    const deletionResult = await DB.prepare(`
        DELETE FROM daily_counts
        WHERE day_date = ?
    `)
        .bind(date)
        .run();

    const result = await DB.prepare(`
        SELECT day_date, counter_value, updated_at
        FROM daily_counts
        ORDER BY day_date ASC
    `).all();

    return json({
        ok: true,
        deleted: deletionResult.meta?.changes ?? 0,
        entries: result.results ?? []
    });
}

async function getDateFromRequest(request) {
    const url = new URL(request.url);
    const queryDate = url.searchParams.get("date");

    if (queryDate) {
        return queryDate;
    }

    try {
        const payload = await request.json();
        return typeof payload.date === "string" ? payload.date : "";
    } catch {
        return "";
    }
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}
