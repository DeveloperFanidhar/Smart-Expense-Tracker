// -----------------------------
// JavaScript: Data + UI behavior
// -----------------------------

// STORAGE_KEY: key used for localStorage so data persists across reloads
const STORAGE_KEY = "sx_expenses_v1";

// Load expenses from localStorage; if nothing exists, default to an empty array
let expenses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

// DOM references: cache commonly used elements for performance and clarity
const addBtn = document.getElementById("addBtn"); // main add button
const modal = document.getElementById("modal"); // modal container
const saveModal = document.getElementById("saveModal"); // save button inside modal
const cancelModal = document.getElementById("cancelModal"); // cancel button inside modal
const txList = document.getElementById("txList"); // transactions list wrapper
const monthAmountEl = document.getElementById("monthAmount"); // current month amount element
const countEl = document.getElementById("count"); // number of transactions element
const avgEl = document.getElementById("avg"); // average per day element
const predVal = document.getElementById("predVal"); // prediction element
const categoryFilter = document.getElementById("categoryFilter"); // category filter select
const fromDate = document.getElementById("fromDate"); // from date input
const toDate = document.getElementById("toDate"); // to date input
const applyFilter = document.getElementById("applyFilter"); // apply filter button
const exportCsv = document.getElementById("exportCsv"); // export CSV button
const importBtn = document.getElementById("importBtn"); // import CSV button

// -----------------
// Modal behaviour
// -----------------

// Show modal when primary add button is clicked
addBtn.addEventListener("click", () => (modal.style.display = "flex"));

// Quick Add button (nullable chaining in case element not present) shows modal too
document
    .getElementById("quickAddBtn")
    ?.addEventListener("click", () => (modal.style.display = "flex"));

// Hide modal when cancel is clicked
cancelModal.addEventListener("click", () => (modal.style.display = "none"));

// -----------------
// Save new expense
// -----------------
saveModal.addEventListener("click", () => {
    // Read values from inputs; fallback to defaults
    const d = document.getElementById("desc").value || "Untitled";
    const a = Number(document.getElementById("amount").value || 0);
    const c = document.getElementById("category").value || "Other";
    const dt =
        document.getElementById("date").value ||
        new Date().toISOString().slice(0, 10);

    // Simple validation: require a positive amount
    if (!a || a <= 0) {
        alert("Enter an amount");
        return;
    }

    // Build item object and push to array
    const item = { id: Date.now(), desc: d, amount: a, category: c, date: dt };
    expenses.push(item);

    // Persist back to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));

    // Clear form fields
    document.getElementById("desc").value = "";
    document.getElementById("amount").value = "";

    // Close modal and refresh UI
    modal.style.display = "none";
    render();
});

// -----------------
// Render function
// -----------------
function render(filter) {
    // Apply filters (category/date) to the master expenses array
    const list = applyFilters(expenses, filter);

    // Clear list container
    txList.innerHTML = "";

    // Sort list by date descending so newest items appear first
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    // For each transaction, create a DOM node and append to list
    list.forEach((tx) => {
        const div = document.createElement("div");
        div.className = "tx";
        // Template contains description, date, category and amount
        div.innerHTML = `<div class='meta'><div><strong>${tx.desc}</strong><div class='small muted'>${tx.date} • ${tx.category}</div></div></div><div><div class='amount'>₹${tx.amount}</div></div>`;
        txList.appendChild(div);
    });

    // ---------- Stats calculations ----------
    // Current month key in YYYY-MM format
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}`;

    // Sum of amounts for the current month (uses original expenses array)
    const monthSum = expenses
        .filter((e) => e.date.startsWith(currentMonth))
        .reduce((s, e) => s + Number(e.amount), 0);
    monthAmountEl.textContent = "₹" + monthSum.toLocaleString();

    // Show total number of transactions
    countEl.textContent = expenses.length;

    // Average per day over last 30 days: sum(last30) / 30
    const last30 = expenses.filter(
        (e) =>
            new Date(e.date) >= new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
    );
    const avg = last30.length
        ? Math.round(last30.reduce((s, e) => s + Number(e.amount), 0) / 30)
        : 0;
    avgEl.textContent = "₹" + avg;

    // ---------- Prediction (demo) ----------
    // Build a map of month -> total so we can average last 3 months
    const monthlyMap = {};
    expenses.forEach((e) => {
        const key = e.date.slice(0, 7); // YYYY-MM
        monthlyMap[key] = (monthlyMap[key] || 0) + Number(e.amount);
    });
    const months = Object.keys(monthlyMap).sort();
    const last3 = months.slice(-3).map((m) => monthlyMap[m] || 0);
    const pred = last3.length
        ? Math.round(last3.reduce((s, v) => s + v, 0) / last3.length)
        : 0;
    predVal.textContent = "₹" + pred.toLocaleString();

    // Update chart with the aggregated monthly data
    drawChart(monthlyMap);
}

// -----------------
// Filter helper
// -----------------
function applyFilters(list, filter) {
    filter = filter || {};
    let out = [...list]; // copy to avoid mutating original

    // Category filtering: if not 'all', only keep matching category
    const cat = categoryFilter.value;
    if (cat && cat !== "all") out = out.filter((i) => i.category === cat);

    // Date range filtering
    if (fromDate.value)
        out = out.filter((i) => new Date(i.date) >= new Date(fromDate.value));
    if (toDate.value)
        out = out.filter((i) => new Date(i.date) <= new Date(toDate.value));
    return out;
}

// Wire apply filter button to re-render (you could also wire inputs to render on change)
applyFilter.addEventListener("click", () => render({}));

// -----------------
// Chart drawing (Canvas API)
// -----------------
function drawChart(monthlyMap) {
    const canvas = document.getElementById("trendChart");
    const ctx = canvas.getContext("2d");

    // Keys are month labels (YYYY-MM)
    const keys = Object.keys(monthlyMap).sort();
    const vals = keys.map((k) => monthlyMap[k]);

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background subtle fill for the chart area
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If no data, show a 'No data' message and exit
    if (!keys.length) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.font = "14px sans-serif";
        ctx.fillText("No data yet", 20, 40);
        return;
    }

    // Calculate drawing bounds and bar widths
    const padding = 28;
    const w = canvas.width - padding * 2;
    const h = canvas.height - padding * 2;
    const max = Math.max(...vals);
    const barW = Math.max(12, w / keys.length - 8);

    // Draw each month as a bar scaled by the maximum
    keys.forEach((k, i) => {
        const x = padding + i * (barW + 8);
        const vh = max ? (vals[i] / max) * h : 0; // scaled height
        ctx.fillStyle = "rgba(6,182,212,0.9)";
        ctx.fillRect(x, padding + (h - vh), barW, vh);

        // Label the month under the bar
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "11px sans-serif";
        ctx.fillText(k, x, padding + h + 14);
    });
}

// -----------------
// Export CSV
// -----------------
exportCsv.addEventListener("click", () => {
    if (!expenses.length) {
        alert("No data to export");
        return;
    }
    // Build CSV rows: header + each expense as a CSV row (naive escaping)
    const rows = [
        "id,desc,amount,category,date",
        ...expenses.map(
            (e) => `${e.id},"${e.desc}",${e.amount},${e.category},${e.date}`
        ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();
    URL.revokeObjectURL(url);
});

// -----------------
// Import CSV (very simple parser)
// -----------------
importBtn.addEventListener("click", () => {
    // Create a hidden file input to prompt the user
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            // Split lines, skip header, naive CSV split by comma
            const text = reader.result.split("\n").slice(1).filter(Boolean);
            text.forEach((line) => {
                const cols = line.split(",");
                const it = {
                    id: Date.now() + Math.random(),
                    desc: cols[1]?.replace(/"/g, ""),
                    amount: Number(cols[2]),
                    category: cols[3],
                    date: cols[4],
                };
                expenses.push(it);
            });
            // Save and re-render
            localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
            render();
        };
        reader.readAsText(file);
    };
    input.click();
});

// Initial render when page loads
render();
