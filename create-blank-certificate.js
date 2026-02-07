const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

async function createBlankCertificate() {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Add a page with A4 landscape dimensions (842 x 595 points)
  const page = pdfDoc.addPage([842, 595]);

  // Get fonts
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();

  // Draw outer border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.2, 0.3, 0.6),
    borderWidth: 3,
  });

  // Draw inner border
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

  // Static text: "This is to certify that"
  page.drawText("This is to certify that", {
    x: width / 2 - 100,
    y: height - 170,
    size: 16,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Static text: "has successfully participated in"
  page.drawText("has successfully participated in", {
    x: width / 2 - 130,
    y: height - 290,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Static text: "held in"
  page.drawText("held in", {
    x: width / 2 - 35,
    y: height - 410,
    size: 14,
    font: helveticaFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Signature lines
  // Left signature
  page.drawLine({
    start: { x: 120, y: 120 },
    end: { x: 280, y: 120 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawText("Signature", {
    x: 175,
    y: 105,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Right signature
  page.drawLine({
    start: { x: width - 280, y: 120 },
    end: { x: width - 120, y: 120 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawText("Director", {
    x: width - 220,
    y: 105,
    size: 10,
    font: helveticaFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Bottom text
  page.drawText(
    "THIS CERTIFICATE IS COMPUTER GENERATED AND DOES NOT REQUIRE SIGNATURE",
    {
      x: width / 2 - 240,
      y: 50,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    }
  );

  // Save to file
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(
    __dirname,
    "backend-admin",
    "uploads",
    "templates",
    "blank-certificate-template.pdf"
  );

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, pdfBytes);
  console.log("✅ Blank certificate template created at:", outputPath);
  console.log("\n📋 Recommended field positions (in pixels, from top-left):");
  console.log(
    "   NAME: x=221, y=207, width=400, height=50, size=28, align=CENTER"
  );
  console.log(
    "   COMPETITION: x=161, y=327, width=520, height=50, size=20, align=CENTER"
  );
  console.log(
    "   CITY: x=271, y=447, width=300, height=40, size=16, align=CENTER"
  );
  console.log(
    "   DATE: x=320, y=500, width=200, height=30, size=12, align=CENTER"
  );
  console.log(
    "\n💡 Import this template in the admin panel and configure the fields."
  );
}

createBlankCertificate().catch(console.error);
