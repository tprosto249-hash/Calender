// public/script.js

const datePicker = document.getElementById("datePicker");
const eventsList = document.getElementById("eventsList");
const addBtn = document.getElementById("addBtn");

const titleInput = document.getElementById("title");
const evDate = document.getElementById("evDate");
const evTime = document.getElementById("evTime");
const description = document.getElementById("description");
const categorySel = document.getElementById("category");
const emailInput = document.getElementById("email");
const reminderSel = document.getElementById("reminder");

const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const applyFilters = document.getElementById("applyFilters");

const themeToggle = document.getElementById("themeToggle");

// Theme
function applyTheme() {
    const dark = localStorage.getItem("theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    themeToggle.checked = dark;
}
themeToggle.onchange = () => {
    localStorage.setItem("theme", themeToggle.checked ? "dark" : "light");
    applyTheme();
};
applyTheme();

// Load events for selected date or with filters
async function loadEvents(date = null, category = null, status = null) {
    eventsList.innerHTML = "";

    // If date is provided use /events/:date, else use query params
    let url = "/events";
    if (date) {
        url += `/${date}`;
    } else {
        const params = [];
        if (category) params.push(`category=${encodeURIComponent(category)}`);
        if (status) params.push(`status=${encodeURIComponent(status)}`);
        if (params.length) url += "?" + params.join("&");
    }

    const res = await fetch(url);
    const events = await res.json();

    if (!events || events.length === 0) {
        eventsList.innerHTML = "<li>Немає подій</li>";
        return;
    }

    events.forEach(ev => {
        const li = document.createElement("li");
        const remText = (ev.reminder_type && ev.reminder_type !== "none") ?
            `Нагадування: за ${ev.notify_before} хв.` : "Немає нагадування";

        li.innerHTML = `
      <div class="ev-top">
        <b>${ev.title}</b> <span class="muted">${ev.date} ${ev.time || ""}</span>
      </div>
      <div>${ev.description || ""}</div>
      <div class="meta">Категорія: ${ev.category || "—"} • Статус: ${ev.status || "—"} • ${remText}</div>
      <div class="actions">
        ${ev.status !== "completed" ? `<button onclick="markComplete(${ev.id})">Позначити як завершену</button>` : ""}
        <button onclick="deleteEvent(${ev.id})">Видалити</button>
      </div>
    `;
        eventsList.appendChild(li);
    });
}

// global functions used in HTML
window.deleteEvent = async (id) => {
    await fetch(`/events/${id}`, { method: "DELETE" });
    reloadCurrent();
};

window.markComplete = async (id) => {
    await fetch(`/events/${id}/complete`, { method: "PATCH" });
    reloadCurrent();
};

function reloadCurrent() {
    const date = datePicker.value || null;
    const cat = filterCategory.value || null;
    const st = filterStatus.value || null;
    loadEvents(date, cat, st);
}

// Add new event
addBtn.onclick = async () => {
    const date = evDate.value;
    const title = titleInput.value.trim();
    const time = evTime.value;
    const desc = description.value.trim();
    const category = categorySel.value;
    const email = emailInput.value.trim();
    const notify_before = Number(reminderSel.value);
    const reminder_type = reminderSel.selectedOptions[0].dataset.type || "none";

    if (!date || !title) return alert("Введи дату та назву!");

    await fetch("/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            date, time, title, description: desc,
            category, reminder_type, notify_before, email
        })
    });

    // очистити форми
    titleInput.value = "";
    evDate.value = "";
    evTime.value = "";
    description.value = "";
    emailInput.value = "";
    reminderSel.value = "0";

    // якщо в datePicker вибрана ця дата — перезавантажити
    if (datePicker.value === date) loadEvents(date);
};

// date picker change
datePicker.onchange = () => loadEvents(datePicker.value);

// filters
applyFilters.onclick = () => {
    const date = datePicker.value || null;
    const cat = filterCategory.value || null;
    const st = filterStatus.value || null;
    loadEvents(date, cat, st);
};

// initial load — сьогодні
const today = new Date().toISOString().slice(0, 10);
datePicker.value = today;
loadEvents(today);
