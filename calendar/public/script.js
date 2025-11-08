const datePicker = document.getElementById("datePicker");
const eventsList = document.getElementById("eventsList");
const addBtn = document.getElementById("addBtn");

async function loadEvents(date) {
    eventsList.innerHTML = "";

    const res = await fetch(`/events/${date}`);
    const events = await res.json();

    events.forEach(ev => {
        const li = document.createElement("li");
        li.innerHTML = `${ev.time || ''} <b>${ev.title}</b> - ${ev.description || ''} 
                    <button onclick="deleteEvent(${ev.id}, '${date}')">X</button>`;
        eventsList.appendChild(li);
    });
}

async function deleteEvent(id, date) {
    await fetch(`/events/${id}`, { method: "DELETE" });
    loadEvents(date);
}

addBtn.onclick = async () => {
    const date = datePicker.value;
    const title = document.getElementById("title").value;
    const time = document.getElementById("time").value;
    const description = document.getElementById("description").value;

    if (!date || !title) return alert("¬веди дату та назву!");

    await fetch("/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, title, description })
    });

    loadEvents(date);
};

datePicker.onchange = () => loadEvents(datePicker.value);
