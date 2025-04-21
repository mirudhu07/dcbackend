const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./src/config/db");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Fetch all students
app.get("/students", (req, res) => {
  const query = "SELECT S_ID, name FROM student_details";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching students:", err);
      return res.status(500).json({ error: "Failed to fetch students", details: err.message });
    }
    res.json(results);
  });
});

// ✅ Create log entry (used by Logger.jsx)
app.post("/api/log-entry", (req, res) => {
  const { S_ID, student_name, faculty_name, time_date, comment, venue } = req.body;

  console.log(" Received log data:", req.body);


  if (!S_ID || !student_name || !faculty_name || !time_date || !comment || !venue) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `
    INSERT INTO faculty_logger (S_ID, student_name, faculty_name, time_date, comment, venue)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [S_ID, student_name, faculty_name, time_date, comment, venue], (err, result) => {
    if (err) {
      console.error("Error inserting log:", err);
      return res.status(500).json({ error: "Failed to create log", details: err.message });
    }
    res.status(201).json({ message: "Log entry created" });
  });
});

// ✅ POST a revoked complaint
app.post("/api/revoked", (req, res) => {
  const { roll_no, s_name, reason, complaint_id } = req.body;

  if (!roll_no || !s_name || !reason || !complaint_id) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `INSERT INTO REASON_ (Roll_no, S_name, REASON, STATUS_, complaint_id) 
               VALUES (?, ?, ?, NULL, ?)`;

  db.query(sql, [roll_no, s_name, reason, complaint_id], (err, result) => {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).json({ error: "Database insert failed", details: err.message });
    }
    res.status(201).json({ message: "Revoked complaint created", id: result.insertId });
  });
});

// ✅ GET all revoked complaints with joined info
app.get("/api/revoked", (req, res) => {
  const sql = `SELECT R.*, F.comment, F.venue, F.time_date 
               FROM REASON_ R 
               JOIN faculty_logger F ON R.complaint_id = F.complaint_id`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching revoked complaints:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    res.json(results);
  });
});

// ✅ Accept / Decline complaint
app.put("/api/revoked/:roll_no", (req, res) => {
  const { status } = req.body;
  const roll_no = req.params.roll_no;

  if (status !== "Accepted" && status !== "Declined") {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const sql = "UPDATE REASON_ SET STATUS_ = ? WHERE Roll_no = ?";
  db.query(sql, [status, roll_no], (err, result) => {
    if (err) {
      console.error("Error updating revoked complaint status:", err);
      return res.status(500).json({ error: "Failed to update complaint status", details: err.message });
    }
    res.json({ message: `Complaint ${status}` });
  });
});

// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
