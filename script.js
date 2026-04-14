let count = 0;

const counterElement = document.getElementById("counter");
const todayLabelElement = document.getElementById("todayLabel");
const saveButton = document.getElementById("saveButton");
const keyButton = document.getElementById("keyButton");
const statusMessageElement = document.getElementById("statusMessage");
const chartElement = document.getElementById("chart");
const historyListElement = document.getElementById("historyList");
const historyStatsElement = document.getElementById("historyStats");
const WRITE_KEY_STORAGE_KEY = "csza-write-key";

const todayDate = new Date();
const todayKey = formatDateKey(todayDate);

todayLabelElement.textContent = formatPrettyDate(todayDate);
saveButton.addEventListener("click", saveTodayCount);
keyButton.addEventListener("click", manageWriteKey);

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
    const writeKey = getWriteKey() || promptForWriteKey();

    if (!writeKey) {
        setStatus("A write key is required to save data.", true);
        return;
    }

    saveButton.disabled = true;
    setStatus("Saving today's total...");

    try {
        const response = await fetch("/api/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Write-Key": writeKey
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
        historyStatsElement.innerHTML = "";
        return;
    }

    const values = entries.map((entry) => Number(entry.counter_value) || 0);
    const maxValue = Math.max(...values, 1);
    const minValue = 0;
    const latestEntry = entries[entries.length - 1];
    const firstEntry = entries[0];
    const trend = Number(latestEntry.counter_value) - Number(firstEntry.counter_value);
    const width = 640;
    const height = 280;
    const padding = {
        top: 30,
        right: 34,
        bottom: 46,
        left: 46
    };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const valueRange = Math.max(maxValue - minValue, 1);

    const points = entries.map((entry, index) => {
        const x = entries.length === 1
            ? padding.left + plotWidth / 2
            : padding.left + (index / (entries.length - 1)) * plotWidth;
        const y = padding.top + (1 - ((Number(entry.counter_value) - minValue) / valueRange)) * plotHeight;
        return { x, y, value: Number(entry.counter_value), date: entry.day_date };
    });

    const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
    const areaPoints = [
        `${points[0].x},${padding.top + plotHeight}`,
        linePoints,
        `${points[points.length - 1].x},${padding.top + plotHeight}`
    ].join(" ");
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((step) => {
        const y = padding.top + step * plotHeight;
        const labelValue = Math.round(maxValue - step * valueRange);

        return `
            <line class="chart-grid-line" x1="${padding.left}" x2="${padding.left + plotWidth}" y1="${y}" y2="${y}"></line>
            <text class="chart-axis-label" x="${padding.left - 12}" y="${y + 4}">${labelValue}</text>
        `;
    }).join("");
    const markers = points.map((point) => `
        <g class="chart-point">
            <circle cx="${point.x}" cy="${point.y}" r="6"></circle>
            <text class="chart-value" x="${point.x}" y="${Math.max(point.y - 13, 18)}">${point.value}</text>
        </g>
    `).join("");
    const dateLabels = points.map((point, index) => {
        const shouldShow = index === 0 || index === points.length - 1 || entries.length <= 6;

        if (!shouldShow) {
            return "";
        }

        return `<text class="chart-date-label" x="${point.x}" y="${height - 16}">${formatShortDate(point.date)}</text>`;
    }).join("");

    historyStatsElement.innerHTML = `
        <span>${entries.length} days</span>
        <span>Latest ${latestEntry.counter_value}</span>
        <span>${trend >= 0 ? "+" : ""}${trend} trend</span>
    `;
    chartElement.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Saved daily counter history">
            <defs>
                <linearGradient id="chartLineGradient" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stop-color="#22d3ee"></stop>
                    <stop offset="100%" stop-color="#3b82f6"></stop>
                </linearGradient>
                <linearGradient id="chartAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.32"></stop>
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"></stop>
                </linearGradient>
            </defs>
            ${gridLines}
            <polygon class="chart-area" points="${areaPoints}"></polygon>
            <polyline class="chart-line" points="${linePoints}"></polyline>
            ${markers}
            ${dateLabels}
        </svg>
    `;
}

function manageWriteKey() {
    const existingKey = getWriteKey();

    if (existingKey) {
        const shouldReplace = window.confirm("A write key is already stored on this device. Do you want to replace it?");

        if (!shouldReplace) {
            return;
        }
    }

    const updatedKey = promptForWriteKey(existingKey);

    if (updatedKey) {
        setStatus("Write key saved on this device.");
    }
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getWriteKey() {
    return window.localStorage.getItem(WRITE_KEY_STORAGE_KEY) || "";
}

function promptForWriteKey(defaultValue = "") {
    const enteredKey = window.prompt("Enter your write key for this device:", defaultValue);

    if (!enteredKey) {
        return "";
    }

    const trimmedKey = enteredKey.trim();

    if (!trimmedKey) {
        return "";
    }

    window.localStorage.setItem(WRITE_KEY_STORAGE_KEY, trimmedKey);
    return trimmedKey;
}

function formatPrettyDate(date) {
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
    }).format(date);
}

function formatShortDate(dateKey) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric"
    }).format(new Date(`${dateKey}T00:00:00`));
}
