const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

class PDFPlaceholderPreviewService {
    async generatePreview(templatePath, fields, pageWidth, pageHeight) {
        const pdfBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const page = pdfDoc.getPages()[0];
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        for (const field of fields) {
            const text = `{{${field.field_type}}}`;
            const colorHex = (field.font_color || '#000000').replace('#', '');
            const r = parseInt(colorHex.substring(0, 2), 16) / 255;
            const g = parseInt(colorHex.substring(2, 4), 16) / 255;
            const b = parseInt(colorHex.substring(4, 6), 16) / 255;
            const fontSize = field.font_size || 20;
            const alignment = (field.alignment || 'center').toLowerCase();
            const textWidth = font.widthOfTextAtSize(text, fontSize);
            let x = field.x_coordinate;
            if (alignment === 'center') x -= textWidth / 2;
            else if (alignment === 'right') x -= textWidth;
            page.drawText(text, {
                x,
                y: field.y_coordinate,
                size: fontSize,
                font: field.field_type === 'NAME' ? boldFont : font,
                color: rgb(r, g, b),
            });
        }
        return await pdfDoc.save();
    }
}

module.exports = new PDFPlaceholderPreviewService();
