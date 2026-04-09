let count = 0;

const counterElement = document.getElementById("counter");
const todayLabelElement = document.getElementById("todayLabel");
const saveButton = document.getElementById("saveButton");
const statusMessageElement = document.getElementById("statusMessage");
const chartElement = document.getElementById("chart");
const historyListElement = document.getElementById("historyList");

const todayDate = new Date();
const todayKey = formatDateKey(todayDate);

todayLabelElement.textContent = formatPrettyDate(todayDate);
saveButton.addEventListener("click", saveTodayCount);

void loadHistory();

function increment() {
    count += 1;
    renderCounter();
    setStatus("Unsaved changes for today.");
}

function renderCounter() {
    counterElement.textContent = count;
}

function setStatus(message, isError = false) {
    statusMessageElement.textContent = message;
    statusMessageElement.dataset.state = isError ? "error" : "default";
}

async function loadHistory() {
    setStatus("Loading saved history...");

    try {
        const response = await fetch("/api/history");

        if (!response.ok) {
            throw new Error("Could not load history.");
        }

        const data = await response.json();
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const todaysEntry = entries.find((entry) => entry.day_date === todayKey);

        if (todaysEntry) {
            count = Number(todaysEntry.counter_value) || 0;
            setStatus(`Loaded saved value for ${formatPrettyDate(todayDate)}.`);
        } else {
            setStatus("No saved value for today yet.");
        }

        renderCounter();
        renderChart(entries);
        renderHistory(entries);
    } catch (error) {
        renderCounter();
        setStatus(error.message || "Could not load history.", true);
    }
}

async function saveTodayCount() {
    saveButton.disabled = true;
    setStatus("Saving today's total...");

    try {
        const response = await fetch("/api/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                date: todayKey,
                count
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not save today's total.");
        }

        setStatus(`Saved ${count} for ${formatPrettyDate(todayDate)}.`);
        renderChart(data.entries || []);
        renderHistory(data.entries || []);
    } catch (error) {
        setStatus(error.message || "Could not save today's total.", true);
    } finally {
        saveButton.disabled = false;
    }
}

function renderChart(entries) {
    if (!entries.length) {
        chartElement.innerHTML = '<div class="empty-state">Save a day to start the chart.</div>';
        return;
    }

    const values = entries.map((entry) => Number(entry.counter_value) || 0);
    const maxValue = Math.max(...values, 1);
    const points = entries.map((entry, index) => {
        const x = entries.length === 1 ? 50 : (index / (entries.length - 1)) * 100;
        const y = 100 - ((Number(entry.counter_value) || 0) / maxValue) * 100;
        return `${x},${y}`;
    });

    const markers = entries.map((entry, index) => {
        const x = entries.length === 1 ? 50 : (index / (entries.length - 1)) * 100;
        const y = 100 - ((Number(entry.counter_value) || 0) / maxValue) * 100;

        return `
            <circle cx="${x}" cy="${y}" r="2.5"></circle>
            <text x="${x}" y="${Math.max(y - 6, 6)}">${entry.counter_value}</text>
        `;
    }).join("");

    chartElement.innerHTML = `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Saved daily counter history">
            <polyline points="${points.join(" ")}"></polyline>
            ${markers}
        </svg>
    `;
}

function renderHistory(entries) {
    if (!entries.length) {
        historyListElement.innerHTML = '<div class="empty-state">No saved history yet.</div>';
        return;
    }

    historyListElement.innerHTML = entries
        .slice()
        .reverse()
        .map((entry) => `
            <div class="history-row">
                <span>${formatPrettyDate(new Date(`${entry.day_date}T00:00:00`))}</span>
                <strong>${entry.counter_value}</strong>
            </div>
        `)
        .join("");
}

function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
}

function formatPrettyDate(date) {
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}
