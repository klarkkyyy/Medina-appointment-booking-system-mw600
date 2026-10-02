

const API_URL = "/api/appointments";

const form = document.getElementById("appointment-form");
const formTitle = document.getElementById("form-title");
const nameInput = document.getElementById("customer_name");
const contactInput = document.getElementById("contact_number");
const serviceInput = document.getElementById("service");
const dateInput = document.getElementById("appointment_date");
const timeInput = document.getElementById("appointment_time");
const statusInput = document.getElementById("status");
const statusField = document.getElementById("status-field");
const saveButton = document.getElementById("save-button");
const cancelEditButton = document.getElementById("cancel-edit-button");
const message = document.getElementById("message");
const tableBody = document.getElementById("appointment-rows");

// ---------- STATE ----------

let appointments = []; 
let editingId = null; 

// ---------- HELPER FUNCTIONS ----------

function isValidContactNumber(number) {
  if (number.length !== 11) return false;
  if (!number.startsWith("09")) return false;

  for (const character of number) {
    if (character < "0" || character > "9") return false;
  }
  return true;
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = type;
  message.hidden = false;
}

function formatTime(time) {
  const parts = time.split(":");
  let hour = Number(parts[0]);
  const minutes = parts[1];
  const period = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return hour + ":" + minutes + " " + period;
}

function formatDate(date) {
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(date + "T00:00").toLocaleDateString("en-US", options);
}

function addCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function addButton(cell, text, className, onClick) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = className;
  button.addEventListener("click", onClick);
  cell.appendChild(button);
}

// ---------- READ ----------

async function loadAppointments() {
  const response = await fetch(API_URL);
  const result = await response.json();

  if (!response.ok) {
    showMessage(result.error, "error");
    return;
  }

  appointments = result;
  showAppointments();
}

function showAppointments() {
  tableBody.innerHTML = "";

  if (appointments.length === 0) {
    const row = document.createElement("tr");
    const cell = addCell(row, "No appointments yet.");
    cell.colSpan = 7;
    cell.className = "empty";
    tableBody.appendChild(row);
    return;
  }

  for (const appointment of appointments) {
    const row = document.createElement("tr");

    addCell(row, formatDate(appointment.appointment_date));
    addCell(row, formatTime(appointment.appointment_time));
    addCell(row, appointment.customer_name);
    addCell(row, appointment.contact_number);
    addCell(row, appointment.service);

    const statusCell = addCell(row, "");
    const badge = document.createElement("span");
    badge.textContent = appointment.status;
    badge.className = "badge " + appointment.status;
    statusCell.appendChild(badge);

    const actionsCell = addCell(row, "");
    actionsCell.className = "actions";
    if (appointment.status === "booked") {
      addButton(actionsCell, "Done", "small", () => markAsDone(appointment));
    }
    addButton(actionsCell, "Edit", "small secondary", () => startEditing(appointment));
    addButton(actionsCell, "Delete", "small danger", () => deleteAppointment(appointment));

    tableBody.appendChild(row);
  }
}

// ---------- CREATE and UPDATE ----------


async function saveAppointment(appointment, id) {
  const url = id === null ? API_URL : API_URL + "/" + id;
  const method = id === null ? "POST" : "PUT";

  const response = await fetch(url, {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appointment),
  });
  const result = await response.json();

  if (!response.ok) {
    showMessage(result.error, "error");
    return false;
  }
  return true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault(); 

  const appointment = {
    customer_name: nameInput.value.trim(),
    contact_number: contactInput.value.trim(),
    service: serviceInput.value,
    appointment_date: dateInput.value,
    appointment_time: timeInput.value,
    status: editingId === null ? "booked" : statusInput.value,
  };

  if (!isValidContactNumber(appointment.contact_number)) {
    showMessage("Contact number must be 11 digits and start with 09.", "error");
    return;
  }

  const wasEditing = editingId !== null;
  const saved = await saveAppointment(appointment, editingId);
  if (!saved) return;

  resetForm();
  showMessage(wasEditing ? "Appointment updated." : "Appointment booked.", "success");
  loadAppointments();
});

function startEditing(appointment) {
  editingId = appointment.id;

  nameInput.value = appointment.customer_name;
  contactInput.value = appointment.contact_number;
  serviceInput.value = appointment.service;
  dateInput.value = appointment.appointment_date;
  timeInput.value = appointment.appointment_time.slice(0, 5);
  statusInput.value = appointment.status;

  formTitle.textContent = "Edit Appointment";
  saveButton.textContent = "Save Changes";
  statusField.hidden = false;
  cancelEditButton.hidden = false;
  message.hidden = true;

  form.scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  form.reset();

  formTitle.textContent = "Book an Appointment";
  saveButton.textContent = "Book Appointment";
  statusField.hidden = true;
  cancelEditButton.hidden = true;
  message.hidden = true;
}

cancelEditButton.addEventListener("click", resetForm);

async function markAsDone(appointment) {
  const updated = { ...appointment, status: "done" };

  const saved = await saveAppointment(updated, appointment.id);
  if (!saved) return;

  showMessage(appointment.customer_name + "'s appointment is marked as done.", "success");
  loadAppointments();
}

// ---------- DELETE ----------

async function deleteAppointment(appointment) {
  const confirmed = confirm("Delete the appointment of " + appointment.customer_name + "?");
  if (!confirmed) return;

  await fetch(API_URL + "/" + appointment.id, { method: "DELETE" });

  if (editingId === appointment.id) resetForm();

  showMessage("Appointment deleted.", "success");
  loadAppointments();
}

// ---------- START ----------

loadAppointments();
