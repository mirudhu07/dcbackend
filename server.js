const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./src/config/db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

  console.log("Received log data:", req.body);

  if (!faculty_name || !time_date || !comment || !venue) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `
    INSERT INTO faculty_logger (S_ID, student_name, faculty_name, time_date, comment, venue)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      S_ID && S_ID.trim() !== "" ? S_ID : null,
      student_name && student_name.trim() !== "" ? student_name : null,
      faculty_name,
      time_date,
      comment,
      venue
    ],
    (err, result) => {
      if (err) {
        console.error("Error inserting log:", err);
        return res.status(500).json({ error: "Failed to create log", details: err.message });
      }
      res.status(201).json({ message: "Log entry created" });
    }
  );
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

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "_" + file.originalname;
    cb(null, uniqueName);
  },
});

// ✅ GET logs with missing S_ID and student_name (for Support Desk)
app.get("/api/support-logs", (req, res) => {
  const sql = `
    SELECT * FROM faculty_logger
    WHERE S_ID IS NULL OR student_name IS NULL
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching support logs:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    res.json(results);
  });
});

const upload = multer({ storage });
app.post("/api/support/send", upload.single("video"), (req, res) => {
  const { complaint_id } = req.body;
  const videoPath = req.file ? req.file.path : null;

  if (!complaint_id || !videoPath) {
    return res.status(400).json({ error: "Missing data" });
  }

  const sql = `
    INSERT INTO mentor_queue (complaint_id, video_path)
    VALUES (?, ?)
  `;
  db.query(sql, [complaint_id, videoPath], (err, result) => {
    if (err) {
      console.error("Error sending to mentor:", err);
      return res.status(500).json({ error: "Send failed" });
    }
    res.status(200).json({ message: "Sent to mentor" });
  });
});

// ✅ GET mentor queue (videos forwarded from support desk)
app.get("/api/mentor-queue", (req, res) => {
  const sql = "SELECT * FROM mentor_queue";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching mentor queue:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ✅ Mentor submits complaint to faculty_logger
app.post("/api/mentor/submit", (req, res) => {
  const { complaint_id, S_ID, student_name } = req.body;

  if (!complaint_id || !S_ID || !student_name) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const sql = `
    UPDATE faculty_logger 
    SET S_ID = ?, student_name = ? 
    WHERE complaint_id = ?
  `;

  db.query(sql, [S_ID, student_name, complaint_id], (err, result) => {
    if (err) {
      console.error(" UPDATE ERROR:", err);
      return res.status(500).json({ error: "Update failed", details: err.message });
    }

    res.status(200).json({ message: "Log updated with student details" });
  });
});
// Fetch from Faculty Logger
app.get("/faculty-logger", (req, res) => {
  const query = "SELECT * FROM faculty_logger";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching faculty logger data:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


// Insert into admin_ table
app.post("/send-to-admin", (req, res) => {
  const { student_name, S_ID, Date_, Time_, Venue, Comment, faculty } = req.body;

  const query = `
    INSERT INTO admin_ (student_name, S_ID, Date_, Time_, Venue, Comment, faculty)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    query,
    [student_name, S_ID, Date_, Time_, Venue, Comment, faculty],
    (err, result) => {
      if (err) {
        console.error("Error inserting into admin_:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ message: "Complaint forwarded successfully", id: result.insertId });
    }
  );
});
                                                                                                        


// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
