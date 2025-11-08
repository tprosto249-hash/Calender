import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { initDB } from "./database.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

let db;

(async () => {
  db = await initDB();
  app.listen(3000, () => console.log(" Server running on http://localhost:3000"));
})();

app.post("/events", async (req, res) => {
  const { date, time, title, description } = req.body;

  if (!date || !title) return res.status(400).json({ error: "Date and Title required" });

  const result = await db.run(
    "INSERT INTO events (date, time, title, description) VALUES (?, ?, ?, ?)",
    [date, time, title, description]
  );

  res.json({ id: result.lastID });
});

app.get("/events/:date", async (req, res) => {
  const rows = await db.all("SELECT * FROM events WHERE date = ?", [req.params.date]);
  res.json(rows);
});

app.delete("/events/:id", async (req, res) => {
  await db.run("DELETE FROM events WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});
