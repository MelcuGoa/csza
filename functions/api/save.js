export async function onRequestPost(context) {
    const { DB } = context.env;
    const expectedWriteKey = context.env.WRITE_API_KEY;
    const expectedAdminKey = context.env.ADMIN_API_KEY;

    if (!DB) {
        return json(
            { error: "D1 binding 'DB' is missing. Add it in Cloudflare Pages settings or wrangler.jsonc." },
            500
        );
    }

    if (!expectedWriteKey && !expectedAdminKey) {
        return json(
            { error: "No write secret is configured. Add WRITE_API_KEY and/or ADMIN_API_KEY in Cloudflare Pages settings." },
            500
        );
    }

    const providedWriteKey = context.request.headers.get("X-Write-Key");
    const providedAdminKey = context.request.headers.get("X-Admin-Key");

    const isWriteAuthorized = expectedWriteKey && providedWriteKey === expectedWriteKey;
    const isAdminAuthorized = expectedAdminKey && providedAdminKey === expectedAdminKey;

    if (!isWriteAuthorized && !isAdminAuthorized) {
        return json({ error: "Invalid write key." }, 401);
    }

    let payload;

    try {
        payload = await context.request.json();
    } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
    }

    const date = typeof payload.date === "string" ? payload.date : "";
    const count = Number(payload.count);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ error: "Date must be in YYYY-MM-DD format." }, 400);
    }

    if (!Number.isInteger(count) || count < 0) {
        return json({ error: "Count must be a non-negative integer." }, 400);
    }

    await DB.prepare(`
        INSERT INTO daily_counts (day_date, counter_value)
        VALUES (?, ?)
        ON CONFLICT(day_date) DO UPDATE SET
            counter_value = excluded.counter_value,
            updated_at = CURRENT_TIMESTAMP
    `)
        .bind(date, count)
        .run();

    const result = await DB.prepare(`
        SELECT day_date, counter_value, updated_at
        FROM daily_counts
        ORDER BY day_date ASC
    `).all();

    return json({
        ok: true,
        entries: result.results ?? []
    });
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
