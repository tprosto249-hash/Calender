// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { initDB } from "./database.js";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

let db;

// --- Nodemailer transporter конфіг через env
// Встанови в системі: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
function createTransporter() {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    return nodemailer.createTransport({
        host,
        port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

const transporter = createTransporter();

// --- Start and DB init
(async () => {
    db = await initDB();
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`? Server running on http://localhost:${port}`));
    startScheduler(); // запустити scheduler після підключення БД
})();

// --- API

// Create event
app.post("/events", async (req, res) => {
    try {
        const {
            date, time, title, description,
            category, reminder_type = "none",
            notify_before = 0, email = ""
        } = req.body;

        if (!date || !title) return res.status(400).json({ error: "Date and Title required" });

        const result = await db.run(
            `INSERT INTO events
       (date, time, title, description, category, reminder_type, notify_before, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [date, time, title, description, category, reminder_type, notify_before, email]
        );

        res.json({ id: result.lastID });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB error" });
    }
});

// Get events with optional filters: date (path) or query params
// GET /events/:date
// or GET /events?category=work&status=overdue
app.get("/events/:date?", async (req, res) => {
    try {
        const date = req.params.date;
        const { category, status } = req.query;

        let sql = "SELECT * FROM events";
        const where = [];
        const params = [];

        if (date) { where.push("date = ?"); params.push(date); }
        if (category) { where.push("category = ?"); params.push(category); }
        if (status) { where.push("status = ?"); params.push(status); }

        if (where.length) sql += " WHERE " + where.join(" AND ");
        sql += " ORDER BY date ASC, time ASC";

        const rows = await db.all(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB error" });
    }
});

// Delete event
app.delete("/events/:id", async (req, res) => {
    const id = req.params.id;
    await db.run("DELETE FROM events WHERE id = ?", [id]);
    res.json({ success: true });
});

// Mark as completed
app.patch("/events/:id/complete", async (req, res) => {
    const id = req.params.id;
    await db.run("UPDATE events SET status = 'completed' WHERE id = ?", [id]);
    res.json({ success: true });
});

// --- Scheduler: перевірка раз на хвилину
function startScheduler() {
    // запускаємо таймер, що раз на 60 сек перевіряє події для нагадування й оновлює прострочені
    setInterval(async () => {
        try {
            const now = new Date();

            // 1) Автоматично позначити прострочені події
            // подія прострочена, якщо дата+time < now і status = scheduled
            const overdueRows = await db.all(`
        SELECT id, date, time FROM events
        WHERE status = 'scheduled'
      `);

            for (const r of overdueRows) {
                if (!r.time) continue;
                const dt = new Date(`${r.date}T${r.time}:00`);
                if (dt < now) {
                    await db.run("UPDATE events SET status = 'overdue' WHERE id = ?", [r.id]);
                }
            }

            // 2) Знайти події, які треба нагадати
            // Умови:
            // - reminder_type = 'email' (зараз тільки email реалізовано)
            // - notified = 0
            // - статус не completed
            const candidates = await db.all(`
        SELECT * FROM events
        WHERE reminder_type = 'email' AND notified = 0 AND status = 'scheduled' AND email IS NOT NULL AND email != ''
      `);

            for (const ev of candidates) {
                // якщо нема time — пропускаємо
                if (!ev.time) continue;

                // обчислити час події та час для нагадування
                const eventDateTime = new Date(`${ev.date}T${ev.time}:00`);

                // notify_before — хвилини до eventDateTime
                const notifyBefore = Number(ev.notify_before || 0);
                const notifyTime = new Date(eventDateTime.getTime() - notifyBefore * 60000);

                // якщо зараз >= notifyTime і ще не нагадували — відправити
                if (now >= notifyTime) {
                    // спроба відправити email
                    let success = 0;
                    let infoText = "";

                    if (transporter) {
                        try {
                            const mail = {
                                from: process.env.FROM_EMAIL || process.env.SMTP_USER,
                                to: ev.email,
                                subject: `Нагадування: ${ev.title}`,
                                text: `У вас скоро подія "${ev.title}"\nДата: ${ev.date} ${ev.time}\nОпис: ${ev.description || ''}`
                            };

                            const info = await transporter.sendMail(mail);
                            success = 1;
                            infoText = JSON.stringify(info);
                            console.log("Sent reminder for event", ev.id, "to", ev.email);
                        } catch (sendErr) {
                            infoText = sendErr.message;
                            console.error("Error sending email for event", ev.id, sendErr);
                        }
                    } else {
                        infoText = "No SMTP configured";
                        console.warn("SMTP not configured; cannot send email reminders.");
                    }

                    // логуємо результат
                    await db.run(
                        `INSERT INTO send_logs (event_id, success, info) VALUES (?, ?, ?)`,
                        [ev.id, success, infoText]
                    );

                    // позначити як notified, щоб не спамити
                    await db.run(`UPDATE events SET notified = 1 WHERE id = ?`, [ev.id]);
                }
            }
        } catch (err) {
            console.error("Scheduler error:", err);
        }
    }, 60 * 1000); // кожну хвилину
}
