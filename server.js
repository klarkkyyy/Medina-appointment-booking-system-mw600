
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

const DURATIONS = {
  "Haircut": 30,
  "Shave": 20,
  "Haircut + Shave": 50,
};
const SERVICES = Object.keys(DURATIONS);

const OPENING_TIME = "08:00";
const CLOSING_TIME = "19:00";
const STATUSES = ["booked", "done", "cancelled"];

// ---------- DATABASE ----------

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "barbershop",
  dateStrings: true,
});

// ---------- MIDDLEWARE ----------

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- HELPER FUNCTIONS ----------

function isValidContactNumber(number) {
  if (number.length !== 11) return false;
  if (!number.startsWith("09")) return false;

  for (const character of number) {
    if (character < "0" || character > "9") return false;
  }
  return true;
}

function findError(appointment) {
  if (!appointment.customer_name) return "Customer name is required.";
  if (!isValidContactNumber(appointment.contact_number)) {
    return "Contact number must be 11 digits and start with 09.";
  }
  if (!SERVICES.includes(appointment.service)) return "Please choose a service.";
  if (!appointment.appointment_date) return "Appointment date is required.";
  if (!appointment.appointment_time) return "Appointment time is required.";
  if (!STATUSES.includes(appointment.status)) return "Invalid status.";
  return null;
}

function toMinutes(time) {
  const parts = time.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function toClockTime(minutes) {
  let hour = Math.floor(minutes / 60) % 24;
  const minute = String(minutes % 60).padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return hour + ":" + minute + " " + period;
}

function findShopHoursError(appointment) {
  const open = toMinutes(OPENING_TIME);
  const close = toMinutes(CLOSING_TIME);
  const start = toMinutes(appointment.appointment_time);
  const end = start + DURATIONS[appointment.service];

  if (start < open || end > close) {
    return (
      "The shop is open from " + toClockTime(open) + " to " + toClockTime(close) + ". A " +
      appointment.service + " at " + toClockTime(start) + " would end at " + toClockTime(end) + "."
    );
  }

  return null;
}

async function findConflict(appointment, ignoreId) {
  const [rows] = await db.query(
    `SELECT * FROM appointments
     WHERE appointment_date = ? AND status != 'cancelled' AND id != ?`,
    [appointment.appointment_date, ignoreId]
  );

  const newStart = toMinutes(appointment.appointment_time);
  const newEnd = newStart + DURATIONS[appointment.service];

  for (const other of rows) {
    const otherStart = toMinutes(other.appointment_time);
    const otherEnd = otherStart + DURATIONS[other.service];

    if (newStart < otherEnd && otherStart < newEnd) {
      return (
        "That slot is already taken. There is a " + other.service + " appointment scheduled from " +
        toClockTime(otherStart) + " to " + toClockTime(otherEnd) + "."
      );
    }
  }

  return null;
}

function readAppointment(body) {
  if (!body) body = {}; 

  return {
    customer_name: String(body.customer_name || "").trim(),
    contact_number: String(body.contact_number || "").trim(),
    service: body.service,
    appointment_date: body.appointment_date,
    appointment_time: body.appointment_time,
    status: body.status || "booked",
  };
}

// ---------- ROUTES (CRUD) ----------

app.get("/api/appointments", async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM appointments ORDER BY appointment_date, appointment_time"
  );

  res.json(rows);
});

app.post("/api/appointments", async (req, res) => {
  const appointment = readAppointment(req.body);

  const error = findError(appointment);
  if (error) return res.status(400).json({ error: error });

  const hoursError = findShopHoursError(appointment);
  if (hoursError) return res.status(400).json({ error: hoursError });

  const conflict = await findConflict(appointment, 0);
  if (conflict) return res.status(409).json({ error: conflict });

  const [result] = await db.query(
    `INSERT INTO appointments
       (customer_name, contact_number, service, appointment_date, appointment_time, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      appointment.customer_name,
      appointment.contact_number,
      appointment.service,
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.status,
    ]
  );

  res.status(201).json({ id: result.insertId });
});


app.put("/api/appointments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const appointment = readAppointment(req.body);

  const error = findError(appointment);
  if (error) return res.status(400).json({ error: error });

  if (appointment.status === "booked") {
    const hoursError = findShopHoursError(appointment);
    if (hoursError) return res.status(400).json({ error: hoursError });

    const conflict = await findConflict(appointment, id);
    if (conflict) return res.status(409).json({ error: conflict });
  }

  const [result] = await db.query(
    `UPDATE appointments
     SET customer_name = ?, contact_number = ?, service = ?,
         appointment_date = ?, appointment_time = ?, status = ?
     WHERE id = ?`,
    [
      appointment.customer_name,
      appointment.contact_number,
      appointment.service,
      appointment.appointment_date,
      appointment.appointment_time,
      appointment.status,
      id,
    ]
  );

  if (result.affectedRows === 0) return res.status(404).json({ error: "Appointment not found." });

  res.json({ message: "Appointment updated." });
});

app.delete("/api/appointments/:id", async (req, res) => {
  const id = Number(req.params.id);

  const [result] = await db.query("DELETE FROM appointments WHERE id = ?", [id]);

  if (result.affectedRows === 0) return res.status(404).json({ error: "Appointment not found." });

  res.json({ message: "Appointment deleted." });
});

app.use((error, req, res, next) => {
  console.log("Server error: " + error.message);

  if (error.code === "ECONNREFUSED") {
    return res.status(500).json({ error: "Could not reach the database. Is MySQL running in XAMPP?" });
  }
  res.status(500).json({ error: "Something went wrong on the server. Check the terminal for details." });
});

// ---------- START ----------

app.listen(PORT, async () => {
  console.log(`Barbershop Appointment Book is running at http://localhost:${PORT}`);

  try {
    await db.query("SELECT 1 FROM appointments LIMIT 1");
    console.log("Connected to the MySQL database.");
  } catch (error) {
    console.log("Could not use the database: " + error.message);
    console.log("Make sure MySQL is started in XAMPP and database.sql was imported in phpMyAdmin.");
  }
});
