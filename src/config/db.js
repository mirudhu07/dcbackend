const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Mirudhu07",
  database: "dc_portal"
});

db.connect((err) => {
  if (err) throw err;
  console.log("MySQL Connected...");
});

module.exports = db;
