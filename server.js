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

// Login authentication endpoint
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const sql = "SELECT PASS_WORD, S_ID, USERNAME FROM login WHERE USERNAME = ?";
  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Error during login query:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const user = results[0];

    if (password === "faculty") {
      return res.status(200).json({
        message: "Login successful",
        route: "/logger1",
        username: user.USERNAME, 
        faculty_name: user.USERNAME, 
      });
    }

    if (user.PASS_WORD !== password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    
    const predefinedRoutes = {
      "7376242AD267": "/student1_1",
      "7376242CS111": "/student2_1",
      "7376242IT201": "/student3_1",
      "7376242AD199": "/student4_1",
      "7376242AL165": "/student5_1",
    };

    const route = predefinedRoutes[user.S_ID] || "recent_complaints"; 

    res.status(200).json({ message: "Login successful", route, S_ID: user.S_ID, username: user.USERNAME });
  });
});

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
// server.js
app.post("/api/log-entry", (req, res) => {
  const { S_ID, student_name, faculty_name, time_date, comment, venue, photo } = req.body;

  if (!faculty_name || !time_date || !comment || !venue) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // Only check duplicates for non-malpractice AND student-associated entries
  if (comment !== "malpractice" && S_ID) {
    const checkSql = `
      SELECT COUNT(*) as cnt FROM faculty_logger
      WHERE S_ID = ? AND comment = ?
    `;
    db.query(checkSql, [S_ID, comment], (err, results) => {
      if (err) {
        console.error("Error checking for duplicate log:", err);
        return res.status(500).json({ error: "Failed to check duplicate log", details: err.message });
      }
      if (results[0].cnt > 0) {
        return res.status(409).json({ error: "This complaint already exists for the student." });
      }
      insertLog();
    });
  } else {
    insertLog();
  }

  function insertLog() {
    const sql = `
      INSERT INTO faculty_logger (S_ID, student_name, faculty_name, time_date, comment, venue, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      sql,
      [
        S_ID && S_ID.trim() !== "" ? S_ID : null,
        student_name && student_name.trim() !== "" ? student_name : null,
        faculty_name,
        time_date,
        comment,
        venue,
        photo || null,
      ],
      (err, result) => {
        if (err) {
          console.error("Error inserting log:", err);
          return res.status(500).json({ error: "Failed to create log", details: err.message });
        }
        res.status(201).json({ message: "Log entry created" });
      }
    );
  }
});


// Add this to your server.js (or replace the existing POST /logger)
/* app.post("/logger", (req, res) => {
  const { S_ID, student_name, faculty_name, time_date, comment, venue } = req.body;

  console.log("Received log data:", req.body);

  // Validate required fields
  if (!faculty_name || !time_date || !comment || !venue) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Prepare query
  const sql = `
    INSERT INTO faculty_logger (S_ID, student_name, faculty_name, time_date, comment, venue)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  // Execute insert
  db.query(
    sql,
    [
      S_ID?.trim() || null,
      student_name?.trim() || null,
      faculty_name?.trim(),
      time_date,
      comment,
      venue,
    ],
    (err, result) => {
      if (err) {
        console.error("Error inserting log:", err);
        return res.status(500).json({ error: "Failed to insert log", details: err.message });
      }

      console.log("Log inserted successfully");
      return res.status(201).json({ message: "Log entry created" });
    }
  );
}); */

// ✅ POST a revoked complaint
/* app.post("/api/revoked", (req, res) => {
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
 */
app.post("/api/reason", (req, res) => {
  const { complaintCode, reason } = req.body;

  if (!complaintCode || !reason) {
    return res.status(400).json({ error: "Complaint Code and Reason are required." });
  }

  
  const fetchQuery = `
    SELECT student_name, S_ID, comment 
    FROM faculty_logger 
    WHERE complaint_id = ?
  `;

  db.query(fetchQuery, [complaintCode], (fetchErr, fetchResult) => {
    if (fetchErr) {
      console.error("Error fetching from faculty_logger:", fetchErr);
      return res.status(500).json({ error: "Database fetch error" });
    }

    if (fetchResult.length === 0) {
      return res.status(404).json({ error: "Complaint ID not found in faculty_logger." });
    }

    const { student_name, S_ID, comment } = fetchResult[0];

    // Step 2: Now insert into reason_ table
    const insertQuery = `
      INSERT INTO reason_ (complaint_id, REASON, S_name, Roll_no, issue)
      VALUES (?, ?, ?, ?, ?)
    `;
    const insertValues = [complaintCode, reason, student_name, S_ID, comment];

    db.query(insertQuery, insertValues, (insertErr, insertResult) => {
      if (insertErr) {
        console.error("Error inserting into reason_:", insertErr);
        return res.status(500).json({ error: "Database insert error" });
      }
      res.status(200).json({ message: "Reason and related info submitted successfully." });
    });
  });
});



// ✅ GET all revoked complaints with joined info
app.get("/api/revoked", (req, res) => {
  const sql = `
    SELECT 
      complaint_id,
      S_name,
      Roll_no,
      REASON 
    FROM reason_
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching revoked complaints:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }
    res.json(results);
  });
});

app.put("/api/revoked/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  console.log("Received PUT /api/revoked/:id =>", id, status); // ✅ Debug log

  if (!status || !id) {
    return res.status(400).json({ error: "Status and complaint_id are required." });
  }

  const updateFacultyLogger = `UPDATE faculty_logger SET Status_ = ? WHERE complaint_id = ?`;
  const updateReason = `UPDATE reason_ SET Status_ = ? WHERE complaint_id = ?`;

  db.query(updateFacultyLogger, [status, id], (err, result1) => {
    if (err) {
      console.error(" Error updating faculty_logger:", err);
      return res.status(500).json({ error: "Error updating faculty_logger", details: err.message });
    }

    db.query(updateReason, [status, id], (err, result2) => {
      if (err) {
        console.error(" Error updating reason_:", err);
        return res.status(500).json({ error: "Error updating reason_", details: err.message });
      }

      console.log(" Successfully updated both tables for complaint_id:", id);
      res.status(200).json({ message: "Status updated successfully in both tables!" });
    });
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

// ✅ Multer upload setup (already declared earlier in your file)
const upload = multer({ storage });

// ✅ POST: Send video and description to mentor queue
app.post("/api/support/send", upload.single("video"), (req, res) => {
  const { complaint_id, description } = req.body;
  const videoPath = req.file ? req.file.path : null;

  if (!complaint_id || !videoPath || !description) {
    return res.status(400).json({ error: "Missing data" });
  }

  const sql = `
    INSERT INTO mentor_queue (complaint_id, video_path, description)
    VALUES (?, ?, ?)
  `;
  db.query(sql, [complaint_id, videoPath, description], (err, result) => {
    if (err) {
      console.error("Error sending to mentor:", err);
      return res.status(500).json({ error: "Send failed" });
    }
    res.status(200).json({ message: "Sent to mentor" });
  });
});

// ✅ GET: Mentor queue (videos forwarded from support desk)
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

 // Fetching all PDFs
app.get("/api/student-pdfs", (req, res) => {
  console.log("Fetching all PDFs");
  const sql = "SELECT * FROM student_pdfs";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching PDFs:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});                                                                                             

// Fetching PDFs for a specific student
app.get("/api/student-pdfs/:studentId", (req, res) => {
  const studentId = req.params.studentId;
  const sql = "SELECT * FROM student_pdfs WHERE student_id = ?";
  db.query(sql, [studentId], (err, results) => {
    if (err) {
      console.error("Error fetching PDFs:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// Adding a new PDF
app.post("/api/student-pdfs", (req, res) => {
  const { student_id, pdf_name, pdf_src } = req.body;

  if (!student_id || !pdf_name || !pdf_src) {
    return res.status(400).json({ message: "Student ID, PDF name, and PDF source are required" });
  }

  const sql = "INSERT INTO student_pdfs (student_id, pdf_name, pdf_src) VALUES (?, ?, ?)";
  db.query(sql, [student_id, pdf_name, pdf_src], (err, result) => {
    if (err) {
      console.error("Error inserting PDF:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json({ message: "PDF added successfully", id: result.insertId });
  });
});

//  static files
app.use("/assets", express.static(path.join(__dirname, "../FrontEnd/D.C/public/assets")));

// INSERTING meeting details
app.post("/api/meeting-details", (req, res) => {
  console.log("Request Body:", req.body); 
  const { studentId, venue, date, time, reason } = req.body;

  if (!studentId || !venue || !date || !time || !reason) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const sql = `
    INSERT INTO meeting_details (S_ID, VENUE, DATE_, TIME_, INFO, STATUS_)
    VALUES (?, ?, STR_TO_DATE(?, '%Y-%m-%d'), ?, ?, 'pending')
  `;

  db.query(sql, [studentId, venue, date, time, reason], (err, result) => {
    if (err) {
      console.error("Error inserting data into meeting_details:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.status(201).json({ message: "Meeting details added successfully" });
  });
});

// FOR FETCHING meeting details in card
app.get("/api/meeting-details", (req, res) => {
  const sql = `
    SELECT No_ AS id, S_ID AS sId, VENUE AS venue, DATE_FORMAT(DATE_, '%d-%m-%Y') AS date, 
           TIME_FORMAT(TIME_, '%h:%i %p') AS time, INFO AS info, STATUS_ AS status
    FROM meeting_details
    ORDER BY No_ DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching meeting details:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

//FOR UPDATING ATTENDANCE IN MEETING
app.post("/api/update-attendance", (req, res) => {
  const { sId, venue, date, status } = req.body;

  if (!sId || !venue || !date || !status) {
    console.error("Missing required fields:", req.body); // Debug log
    return res.status(400).json({ message: "Missing required fields" });
  }

  console.log("Received data:", req.body); // Debug log

  const sql = `
    UPDATE meeting_details 
    SET STATUS_ = ? 
    WHERE S_ID = ? AND VENUE = ? AND DATE_ = STR_TO_DATE(?, '%d-%m-%Y')
  `;

  db.query(sql, [status, sId, venue, date], (err, result) => {
    if (err) {
      console.error("Error updating attendance:", err); // Debug log
      return res.status(500).json({ message: "Database error", error: err.message });
    }

    console.log("SQL Result:", result); // Debug log

    if (result.affectedRows > 0) {
      res.json({ message: "Attendance updated successfully" });
    } else {
      res.status(404).json({ message: "Meeting not found" });
    }
  });
});

// Fetch complaints for a specific student ID
app.get("/api/complaints/:S_ID", (req, res) => {
  const { S_ID } = req.params;

  const sql = `
    SELECT complaint_id, S_ID, student_name, faculty_name, time_date, comment, venue,
    TIMESTAMPDIFF(SECOND, NOW(), ADDTIME(time_date, '06:00:00')) AS time_remaining
    FROM faculty_logger
    WHERE S_ID = ?
    ORDER BY time_date DESC
  `;

  db.query(sql, [S_ID], (err, result) => {
    if (err) {
      console.error("Error fetching complaints:", err);
      return res.status(500).json({ error: "Failed to fetch complaints" });
    }

    res.status(200).json(result); // Send all matching complaints
  });
});

// For updating history
app.put('/complaints/update-status/:sid/:complaint_id', (req, res) => {
  const { sid, complaint_id } = req.params; // Extract S_ID and complaint_id from URL
  const { status } = req.body; // Extract status from request body

  const sql = 'UPDATE faculty_logger SET status = ? WHERE S_ID = ? AND complaint_id = ?';
  db.query(sql, [status, sid, complaint_id], (err, result) => {
    if (err) {
      console.error('Error updating complaint status:', err);
      return res.status(500).json({ error: 'Failed to update status' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'No matching complaint found to update' });
    }

    res.status(200).json({ message: 'Status updated successfully' });
  });
});

// Endpoint to fetch complaint details
app.get('/complaints/detail/:complaint_id', (req, res) => {
  const { complaint_id } = req.params;

  const sql = 'SELECT * FROM faculty_logger WHERE complaint_id = ?';
  db.query(sql, [complaint_id], (err, result) => {
    if (err) {
      console.error('Error fetching complaint details:', err);
      return res.status(500).json({ error: 'Failed to fetch complaint details' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.status(200).json(result[0]); // Return the complaint details
  });
});

// fetching complaints from admin table
app.get("/api/admin-all", (req, res) => {
  const query = `SELECT student_name, S_ID, Date_, Time_, Venue, Comment, faculty FROM admin_ ORDER BY ID DESC`; 
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching admin complaints:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});


// ✅ Start server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});