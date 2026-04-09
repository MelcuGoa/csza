export async function onRequestGet(context) {
    const { DB } = context.env;

    if (!DB) {
        return json(
            { error: "D1 binding 'DB' is missing. Add it in Cloudflare Pages settings or wrangler.jsonc." },
            500
        );
    }

    const result = await DB.prepare(`
        SELECT day_date, counter_value, updated_at
        FROM daily_counts
        ORDER BY day_date ASC
    `).all();

    return json({
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
