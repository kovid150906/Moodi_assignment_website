const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

async function createTestCertificate() {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Add a page with A4 landscape dimensions (842 x 595 points)
  const page = pdfDoc.addPage([842, 595]);

  // Get fonts
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Draw border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.2, 0.3, 0.6),
    borderWidth: 3,
  });

  page.drawRectangle({
    x: 35,
    y: 35,
    width: width - 70,
    height: height - 70,
    borderColor: rgb(0.2, 0.3, 0.6),
    borderWidth: 1,
  });

  // Title
  page.drawText("CERTIFICATE OF ACHIEVEMENT", {
    x: width / 2 - 200,
    y: height - 100,
    size: 32,
    font: timesFont,
    color: rgb(0.2, 0.3, 0.6),
  });

  // Underline
  page.drawLine({
    start: { x: width / 2 - 180, y: height - 110 },
    end: { x: width / 2 + 180, y: height - 110 },
    thickness: 2,
    color: rgb(0.8, 0.6, 0.2),
  });

  // This is to certify text
  page.drawText("This is to certify that", {
    x: width / 2 - 100,
    y: height - 170,
    size: 16,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Participant Name Placeholder (with visual marker)
  page.drawRectangle({
    x: width / 2 - 200,
    y: height - 240,
    width: 400,
    height: 45,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText("{{PARTICIPANT_NAME}}", {
    x: width / 2 - 120,
    y: height - 225,
    size: 28,
    font: timesFont,
    color: rgb(0, 0, 0),
  });

  // Achievement text
  page.drawText("has successfully participated in", {
    x: width / 2 - 130,
    y: height - 280,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Competition Name Placeholder
  page.drawRectangle({
    x: width / 2 - 150,
    y: height - 330,
    width: 300,
    height: 35,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 0.95),
  });

  page.drawText("{{COMPETITION_NAME}}", {
    x: width / 2 - 100,
    y: height - 318,
    size: 20,
    font: helveticaBold,
    color: rgb(0.2, 0.3, 0.6),
  });

  // City and Date
  page.drawText("held at", {
    x: width / 2 - 180,
    y: height - 370,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText("{{CITY}}", {
    x: width / 2 - 115,
    y: height - 370,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  page.drawText("on", {
    x: width / 2 + 10,
    y: height - 370,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText("{{DATE}}", {
    x: width / 2 + 40,
    y: height - 370,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  // Result/Position
  page.drawText("Result:", {
    x: width / 2 - 180,
    y: height - 410,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText("{{RESULT}} - Position: {{POSITION}}", {
    x: width / 2 - 110,
    y: height - 410,
    size: 14,
    font: helveticaBold,
    color: rgb(0.8, 0.4, 0.1),
  });

  // MI ID
  page.drawText("MI ID: {{MI_ID}}", {
    x: width / 2 - 60,
    y: height - 445,
    size: 12,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Certificate Number
  page.drawText("Certificate No: _________________", {
    x: 80,
    y: 80,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Date of Issue
  page.drawText("Date of Issue: _________________", {
    x: width - 250,
    y: 80,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Signature line
  page.drawLine({
    start: { x: width - 250, y: 140 },
    end: { x: width - 100, y: 140 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  page.drawText("Authorized Signature", {
    x: width - 240,
    y: 125,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Footer note
  page.drawText(
    "* This is a test certificate template with placeholder fields",
    {
      x: width / 2 - 190,
      y: 50,
      size: 9,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6),
    }
  );

  // Save the PDF
  const pdfBytes = await pdfDoc.save();

  // Create output directory if it doesn't exist
  const outputDir = path.join(
    __dirname,
    "backend-admin",
    "uploads",
    "templates"
  );
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "test-certificate-template.pdf");
  fs.writeFileSync(outputPath, pdfBytes);

  console.log("✅ Test certificate template created successfully!");
  console.log(`📄 Location: ${outputPath}`);
  console.log("\n📝 Placeholder fields in the template:");
  console.log("   - {{PARTICIPANT_NAME}} - at position (421, 370) - 28pt");
  console.log("   - {{COMPETITION_NAME}} - at position (421, 277) - 20pt");
  console.log("   - {{CITY}} - at position (306, 225) - 14pt");
  console.log("   - {{DATE}} - at position (461, 225) - 14pt");
  console.log("   - {{RESULT}} - at position (311, 185) - 14pt");
  console.log("   - {{POSITION}} - at position (450, 185) - 14pt");
  console.log("   - {{MI_ID}} - at position (361, 150) - 12pt");
  console.log(
    "\n💡 Use these coordinates when configuring fields in the admin panel"
  );
}

createTestCertificate().catch(console.error);
