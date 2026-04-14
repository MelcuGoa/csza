const ADMIN_KEY_STORAGE_KEY = "csza-admin-key";
const adminStatusElement = document.getElementById("adminStatus");
const unlockButton = document.getElementById("unlockButton");
const clearAdminKeyButton = document.getElementById("clearAdminKeyButton");
const historyStatsElement = document.getElementById("historyStats");
const chartElement = document.getElementById("chart");
const adminForm = document.getElementById("adminForm");
const adminDateInput = document.getElementById("adminDate");
const adminCountInput = document.getElementById("adminCount");
const adminSubmitButton = document.getElementById("adminSubmitButton");
const clearFormButton = document.getElementById("clearFormButton");
const adminTableElement = document.getElementById("adminTable");

const todayDate = new Date();
const todayKey = formatDateKey(todayDate);
let historyEntries = [];

adminDateInput.value = todayKey;
adminCountInput.value = "0";

unlockButton.addEventListener("click", () => {
    const adminKey = promptForAdminKey(getAdminKey());

    if (adminKey) {
        setStatus("Admin key stored on this device.");
    }
});

clearAdminKeyButton.addEventListener("click", () => {
    window.localStorage.removeItem(ADMIN_KEY_STORAGE_KEY);
    setStatus("Admin key removed from this device.");
});

adminForm.addEventListener("submit", handleAdminSubmit);
clearFormButton.addEventListener("click", resetAdminForm);

void loadHistory();

async function loadHistory() {
    setStatus("Loading history...");

    try {
        const response = await fetch("/api/history");

        if (!response.ok) {
            throw new Error("Could not load history.");
        }

        const data = await response.json();
        const entries = Array.isArray(data.entries) ? data.entries : [];
        updateHistoryViews(entries);
        setStatus("History loaded.");
    } catch (error) {
        renderAdminTable([]);
        setStatus(error.message || "Could not load history.", true);
    }
}

async function handleAdminSubmit(event) {
    event.preventDefault();

    const adminKey = getAdminKey() || promptForAdminKey();

    if (!adminKey) {
        setStatus("An admin password is required.", true);
        return;
    }

    const date = adminDateInput.value;
    const count = Number(adminCountInput.value);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        setStatus("Choose a valid date before saving.", true);
        return;
    }

    if (!Number.isInteger(count) || count < 0) {
        setStatus("Count must be a non-negative whole number.", true);
        return;
    }

    adminSubmitButton.disabled = true;
    setStatus(`Saving ${date}...`);

    try {
        const response = await fetch("/api/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Key": adminKey
            },
            body: JSON.stringify({ date, count })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not save that day.");
        }

        updateHistoryViews(data.entries || []);
        setStatus(`Saved ${count} for ${formatPrettyDate(new Date(`${date}T00:00:00`))}.`);
    } catch (error) {
        setStatus(error.message || "Could not save that day.", true);
    } finally {
        adminSubmitButton.disabled = false;
    }
}

function updateHistoryViews(entries) {
    historyEntries = entries.slice();
    renderChart(historyEntries);
    renderAdminTable(historyEntries);
}

function renderChart(entries) {
    if (!entries.length) {
        chartElement.innerHTML = '<div class="empty-state">No saved history yet.</div>';
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
    const padding = { top: 30, right: 34, bottom: 46, left: 46 };
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

function renderAdminTable(entries) {
    if (!entries.length) {
        adminTableElement.innerHTML = '<div class="empty-state">No saved days to manage yet.</div>';
        return;
    }

    adminTableElement.innerHTML = `
        <div class="admin-table-header">
            <span>Date</span>
            <span>Count</span>
            <span>Actions</span>
        </div>
        ${entries
            .slice()
            .reverse()
            .map((entry) => `
                <div class="admin-row">
                    <div class="admin-date">
                        <strong>${formatPrettyDate(new Date(`${entry.day_date}T00:00:00`))}</strong>
                        <span>${entry.day_date}</span>
                    </div>
                    <div class="admin-count">${entry.counter_value}</div>
                    <div class="admin-actions">
                        <button class="table-button" type="button" data-action="edit" data-date="${entry.day_date}" data-count="${entry.counter_value}">Edit</button>
                        <button class="table-button danger-button" type="button" data-action="delete" data-date="${entry.day_date}">Delete</button>
                    </div>
                </div>
            `)
            .join("")}
    `;

    adminTableElement.querySelectorAll("[data-action='edit']").forEach((button) => {
        button.addEventListener("click", () => {
            adminDateInput.value = button.dataset.date;
            adminCountInput.value = button.dataset.count;
            adminDateInput.focus();
            setStatus(`Editing ${button.dataset.date}.`);
        });
    });

    adminTableElement.querySelectorAll("[data-action='delete']").forEach((button) => {
        button.addEventListener("click", async () => {
            const adminKey = getAdminKey() || promptForAdminKey();

            if (!adminKey) {
                setStatus("An admin password is required.", true);
                return;
            }

            const targetDate = button.dataset.date;
            const confirmed = window.confirm(`Delete ${targetDate} from the database?`);

            if (!confirmed) {
                return;
            }

            button.disabled = true;
            setStatus(`Deleting ${targetDate}...`);

            try {
                const response = await fetch("/api/delete", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Admin-Key": adminKey
                    },
                    body: JSON.stringify({ date: targetDate })
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Could not delete that day.");
                }

                updateHistoryViews(data.entries || []);
                setStatus(`Deleted ${targetDate}.`);
            } catch (error) {
                setStatus(error.message || "Could not delete that day.", true);
            } finally {
                button.disabled = false;
            }
        });
    });
}

function setStatus(message, isError = false) {
    adminStatusElement.textContent = message;
    adminStatusElement.dataset.state = isError ? "error" : "default";
}

function resetAdminForm() {
    adminDateInput.value = todayKey;
    adminCountInput.value = "0";
}

function getAdminKey() {
    return window.localStorage.getItem(ADMIN_KEY_STORAGE_KEY) || "";
}

function promptForAdminKey(defaultValue = "") {
    const enteredKey = window.prompt("Enter the admin password for this device:", defaultValue);

    if (!enteredKey) {
        return "";
    }

    const trimmedKey = enteredKey.trim();

    if (!trimmedKey) {
        return "";
    }

    window.localStorage.setItem(ADMIN_KEY_STORAGE_KEY, trimmedKey);
    return trimmedKey;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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
