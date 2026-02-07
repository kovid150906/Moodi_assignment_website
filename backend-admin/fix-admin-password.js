const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function updateAdminPassword() {
  const password = "Admin@123";
  const hash = await bcrypt.hash(password, 10);

  console.log("Generated hash for Admin@123");

  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD || "kb@8370007067",
    database: "certificate_system",
  });

  // Update admin password
  await connection.execute(
    "UPDATE admins SET password_hash = ? WHERE email = ?",
    [hash, "admin@system.com"]
  );

  console.log("✅ Admin password updated successfully!");
  console.log("Email: admin@system.com");
  console.log("Password: Admin@123");

  await connection.end();
}

updateAdminPassword().catch(console.error);
