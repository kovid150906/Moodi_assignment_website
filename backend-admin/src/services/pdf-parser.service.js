const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

/**
 * Service to parse PDF files and extract placeholder text positions
 * Uses pdfjs-dist for accurate coordinate extraction
 */
class PDFParserService {
    constructor() {
        this.placeholderPattern = /\{\{([A-Za-z_]+)\}\}/gi;

        // Map placeholder names to field types (case-insensitive)
        this.fieldTypeMap = {
            'NAME': 'NAME',
            'NAMES': 'NAME',
            'PARTICIPANT': 'NAME',
            'PARTICIPANT_NAME': 'NAME',
            'PARTICIPANT_NAMES': 'NAME',
            'FULL_NAME': 'NAME',
            'USER_NAME': 'NAME',
            'STUDENT_NAME': 'NAME',
            'RANK': 'RANK',
            'RANKING': 'RANK',
            'POSITION': 'POSITION',
            'POS': 'POSITION',
            'SCORE': 'SCORE',
            'POINTS': 'SCORE',
            'MARKS': 'SCORE',
            'COMPETITION': 'COMPETITION',
            'COMPETITION_NAME': 'COMPETITION',
            'COMP': 'COMPETITION',
            'EVENT': 'COMPETITION',
            'EVENT_NAME': 'COMPETITION',
            'ROUND': 'ROUND',
            'ROUND_NAME': 'ROUND',
            'ROUND_NUMBER': 'ROUND',
            'DATE': 'DATE',
            'EVENT_DATE': 'DATE',
            'ISSUE_DATE': 'DATE',
            'CITY': 'CITY',
            'CITY_NAME': 'CITY',
            'LOCATION': 'CITY',
            'RESULT': 'RESULT',
            'STATUS': 'RESULT',
            'MI_ID': 'MI_ID',
            'MIID': 'MI_ID',
            'ID': 'MI_ID',
            'STUDENT_ID': 'MI_ID',
            'BENEFACTORS': 'BENEFACTORS',
            'BENEFACTOR': 'BENEFACTORS',
            'BENEFACTORS_OF_THIS_PASS': 'BENEFACTORS',
            'SPONSOR': 'BENEFACTORS',
            'SPONSORS': 'BENEFACTORS'
        };

        // Standard placeholders to look for
        this.standardPlaceholders = ['NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT'];
    }

    /**
     * Parse PDF file and extract text with placeholders and their positions
     * Uses pdf-lib for dimensions and returns suggested positions
     */
    async parsePDF(filePath) {
        try {
            // Get dimensions using pdf-lib (always works)
            const dimensions = await this.getPDFDimensions(filePath);

            // Return suggested positions - pdfjs-dist doesn't work reliably in Node.js
            console.log('PDF parsing: Using suggested default positions');
            const suggestedFields = this.suggestDefaultPositions(dimensions.width, dimensions.height);
            
            return {
                fields: suggestedFields,
                dimensions,
                auto_detected: false,
                note: 'PDF loaded successfully. Showing suggested field positions. Click "Visual Editor" to adjust positions by clicking on the PDF preview.'
            };
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw new Error('Failed to parse PDF file: ' + error.message);
        }
    }

    /**
     * Get pdfjs-diswarn('pdfjs-dist not available, will use fallbackort in CommonJS)
     */
    async getPDFJS() {
        try {
            // Use dynamic import for ES module
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

            // Disable worker for Node.js environment
            pdfjsLib.GlobalWorkerOptions.workerSrc = false;

            return pdfjsLib;
        } catch (error) {
            console.error('Failed to load pdfjs-dist:', error.message);
            return null;
        }
    }

    /**
     * Detect plain text fields like "Benefactors of this pass", "Names", etc.
     * @param {string} text - Text content to check
     * @returns {Object|null} Field info if detected, null otherwise
     */
    detectPlainTextField(text) {
        const normalizedText = text.toLowerCase().trim();
        
        // Define patterns for plain text fields (case-insensitive)
        const patterns = [
            { text: /benefactors?\s+of\s+this\s+pass/i, fieldType: 'BENEFACTORS' },
            { text: /^benefactors?$/i, fieldType: 'BENEFACTORS' },
            { text: /^sponsors?$/i, fieldType: 'BENEFACTORS' },
            { text: /^names?$/i, fieldType: 'NAME' },
            { text: /participant\s+names?/i, fieldType: 'NAME' },
            { text: /^dates?$/i, fieldType: 'DATE' },
            { text: /^city$/i, fieldType: 'CITY' },
            { text: /^competition$/i, fieldType: 'COMPETITION' },
            { text: /^rank$/i, fieldType: 'RANK' },
            { text: /^position$/i, fieldType: 'POSITION' },
            { text: /^score$/i, fieldType: 'SCORE' },
            { text: /^result$/i, fieldType: 'RESULT' }
        ];
        
        for (const pattern of patterns) {
            if (pattern.text.test(text)) {
                return {
                    fieldType: pattern.fieldType,
                    text: text
                };
            }
        }
        
        return null;
    }

    /**
     * Detect plain text labels like "Names:", "Date:", "Purpose:" etc.
     * Returns field type if a known label is found
     */
    detectPlainTextLabel(text) {
        const normalizedText = text.toLowerCase().trim();

        // Map of common form labels to field types
        const labelPatterns = [
            { patterns: ['names:', 'name:', 'participant:', 'participants:'], fieldType: 'NAME', label: 'Names' },
            { patterns: ['date:', 'event date:', 'dated:'], fieldType: 'DATE', label: 'Date' },
            { patterns: ['city:', 'location:', 'venue:', 'place:'], fieldType: 'CITY', label: 'City' },
            { patterns: ['competition:', 'event:', 'competition name:'], fieldType: 'COMPETITION', label: 'Competition' },
            { patterns: ['result:', 'position:', 'rank:', 'score:'], fieldType: 'RESULT', label: 'Result' },
            { patterns: ['purpose:', 'subject:'], fieldType: 'COMPETITION', label: 'Purpose' }
        ];

        for (const { patterns, fieldType, label } of labelPatterns) {
            for (const pattern of patterns) {
                if (normalizedText.startsWith(pattern) || normalizedText === pattern.slice(0, -1)) {
                    // Calculate offset to position field after the label text
                    const labelLength = pattern.length;
                    const xOffset = labelLength * 8; // Approximate x offset based on character width
                    return { fieldType, label, xOffset };
                }
            }
        }

        return null;
    }

    /**
     * Suggest default positions for standard certificate fields
     * Based on common certificate layouts
     */
    suggestDefaultPositions(width, height) {
        const centerX = Math.round(width / 2);

        // Common positions for certificate fields
        const positions = {
            'NAME': { x: centerX, y: Math.round(height * 0.40), font_size: 28 },
            'COMPETITION': { x: centerX, y: Math.round(height * 0.55), font_size: 20 },
            'CITY': { x: Math.round(width * 0.30), y: Math.round(height * 0.70), font_size: 16 },
            'DATE': { x: Math.round(width * 0.70), y: Math.round(height * 0.70), font_size: 16 },
            'RESULT': { x: centerX, y: Math.round(height * 0.85), font_size: 18 }
        };

        return this.standardPlaceholders.map(fieldType => ({
            field_type: fieldType,
            x_coordinate: positions[fieldType].x,
            y_coordinate: positions[fieldType].y,
            font_size: positions[fieldType].font_size,
            font_family: 'Helvetica',
            font_color: '#000000',
            alignment: 'center',
            placeholder: `{{${fieldType}}}`,
            original_text: `(Suggested: ${fieldType})`
        }));
    }

    /**
     * Generate a preview image of the PDF for visual editing
     * Returns null to fallback to direct PDF serving (pdfjs-dist doesn't work in Node.js)
     */
    async generatePreviewImage(filePath, scale = 1.5) {
        // Always return null - let frontend handle PDF rendering
        return null;
    }

    /**
     * Get PDF dimensions without full parsing
     */
    async getPDFDimensions(filePath) {
        try {
            const dataBuffer = await fs.readFile(filePath);
            const pdfDoc = await PDFDocument.load(dataBuffer);
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();

            return {
                width: Math.round(width),
                height: Math.round(height),
                orientation: width > height ? 'LANDSCAPE' : 'PORTRAIT'
            };
        } catch (error) {
            return { width: 842, height: 595, orientation: 'LANDSCAPE' };
        }
    }
}

module.exports = new PDFParserService();
