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

    const dates = await getDatesFromRequest(context.request);

    if (!dates.length) {
        return json({ error: "Provide either 'date' or 'dates' in YYYY-MM-DD format." }, 400);
    }

    const invalidDate = dates.find((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date));

    if (invalidDate) {
        return json({ error: `Invalid date format: ${invalidDate}` }, 400);
    }

    const uniqueDates = [...new Set(dates)];
    const placeholders = uniqueDates.map(() => "?").join(", ");
    const deletionResult = await DB.prepare(`
        DELETE FROM daily_counts
        WHERE day_date IN (${placeholders})
    `)
        .bind(...uniqueDates)
        .run();

    const result = await DB.prepare(`
        SELECT day_date, counter_value, updated_at
        FROM daily_counts
        ORDER BY day_date ASC
    `).all();

    return json({
        ok: true,
        requested_dates: uniqueDates,
        deleted: deletionResult.meta?.changes ?? 0,
        entries: result.results ?? []
    });
}

async function getDatesFromRequest(request) {
    const url = new URL(request.url);
    const queryDate = url.searchParams.get("date");
    const queryDates = url.searchParams.getAll("date");
    const queryDatesCsv = url.searchParams.get("dates");

    if (queryDate) {
        return queryDates.length ? queryDates : [queryDate];
    }

    if (queryDatesCsv) {
        return queryDatesCsv
            .split(",")
            .map((date) => date.trim())
            .filter(Boolean);
    }

    try {
        const payload = await request.json();
        if (typeof payload.date === "string" && payload.date.trim()) {
            return [payload.date.trim()];
        }

        if (Array.isArray(payload.dates)) {
            return payload.dates
                .filter((date) => typeof date === "string")
                .map((date) => date.trim())
                .filter(Boolean);
        }

        return [];
    } catch {
        return [];
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
