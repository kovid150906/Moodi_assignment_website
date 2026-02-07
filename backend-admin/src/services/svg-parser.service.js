const fs = require('fs').promises;

/**
 * Service to parse SVG files and extract placeholder text positions
 * Looks for text elements with placeholder patterns like {{NAME}}, {{DATE}}, etc.
 */
class SVGParserService {
    constructor() {
        // Case-insensitive pattern to match placeholders like {{NAME}}, {{name}}, {{Name}}
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
    }

    /**
     * Parse SVG file and extract text elements with placeholders or plain text fields
     * @param {string} filePath - Path to SVG file
     * @returns {Array} Array of detected fields with positions and properties
     */
    async parseSVG(filePath) {
        try {
            const svgContent = await fs.readFile(filePath, 'utf-8');
            const fields = [];

            // Extract SVG dimensions
            const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
            const widthMatch = svgContent.match(/width=["']([^"']+)["']/);
            const heightMatch = svgContent.match(/height=["']([^"']+)["']/);

            let svgWidth = 842; // Default A4 landscape
            let svgHeight = 595;

            if (viewBoxMatch) {
                const viewBox = viewBoxMatch[1].split(/\s+/);
                svgWidth = parseFloat(viewBox[2]);
                svgHeight = parseFloat(viewBox[3]);
            } else if (widthMatch && heightMatch) {
                svgWidth = this.parseSize(widthMatch[1]);
                svgHeight = this.parseSize(heightMatch[1]);
            }

            // Find all text elements with placeholders or plain text
            const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
            let textMatch;
            
            console.log('Starting SVG parsing...');
            const allTextFound = [];

            while ((textMatch = textRegex.exec(svgContent)) !== null) {
                const textElement = textMatch[0];
                let textContent = textMatch[1];
                
                // Extract text from tspan elements if present
                const tspanRegex = /<tspan[^>]*>(.*?)<\/tspan>/g;
                const tspans = [...textContent.matchAll(tspanRegex)];
                if (tspans.length > 0) {
                    textContent = tspans.map(m => m[1]).join(' ').trim();
                } else {
                    textContent = textContent.replace(/<[^>]*>/g, '').trim();
                }

                allTextFound.push(textContent);
                console.log('SVG text found:', textContent);

                // Check if contains {{placeholder}}
                const placeholderMatch = textContent.match(this.placeholderPattern);
                // Check if contains plain text field
                const plainTextMatch = this.detectPlainTextField(textContent);
                
                console.log('Placeholder match:', placeholderMatch);
                console.log('Plain text match:', plainTextMatch);
                
                if (!placeholderMatch && !plainTextMatch) continue;

                // Extract coordinates
                const x = this.extractAttribute(textElement, 'x');
                const y = this.extractAttribute(textElement, 'y');

                if (x === null || y === null) continue;

                // Extract styling
                const fontSize = this.extractFontSize(textElement);
                const fontFamily = this.extractAttribute(textElement, 'font-family') || 'Arial';
                const fill = this.extractAttribute(textElement, 'fill') || '#000000';
                
                // Handle plain text field
                if (plainTextMatch && !placeholderMatch) {
                    fields.push({
                        field_type: plainTextMatch.fieldType,
                        x_coordinate: Math.round(x),
                        y_coordinate: Math.round(y),
                        font_size: fontSize,
                        font_family: fontFamily,
                        font_color: fill,
                        alignment: 'center',
                        placeholder: plainTextMatch.text
                    });
                    continue;
                }
                const textAnchor = this.extractAttribute(textElement, 'text-anchor') || 'start';

                // Map text-anchor to alignment
                const alignment = textAnchor === 'middle' ? 'center' :
                    textAnchor === 'end' ? 'right' : 'left';

                // Extract placeholder name (normalize to uppercase for mapping)
                const placeholder = placeholderMatch[0].replace(/[{}]/g, '');
                const normalizedPlaceholder = placeholder.toUpperCase();
                const fieldType = this.fieldTypeMap[normalizedPlaceholder] || 'NAME';

                fields.push({
                    field_type: fieldType,
                    x_coordinate: Math.round(x),
                    y_coordinate: Math.round(y),
                    font_size: fontSize,
                    font_family: fontFamily,
                    font_color: fill.startsWith('#') ? fill : this.colorNameToHex(fill),
                    alignment: alignment,
                    placeholder: placeholder,
                    original_text: textContent
                });
            }

            // If no placeholders found, suggest default positions
            if (fields.length === 0) {
                const suggestedFields = this.suggestDefaultPositions(svgWidth, svgHeight);
                return {
                    fields: suggestedFields,
                    dimensions: {
                        width: Math.round(svgWidth),
                        height: Math.round(svgHeight),
                        orientation: svgWidth > svgHeight ? 'LANDSCAPE' : 'PORTRAIT'
                    },
                    auto_detected: false,
                    note: 'No placeholders (like {{NAME}}) found in SVG. Showing suggested default positions. Click on the preview to adjust positions manually.'
                };
            }

            console.log('Total text elements found:', allTextFound.length);
            console.log('All text:', allTextFound);
            console.log('Fields detected:', fields.length);

            return {
                fields,
                dimensions: {
                    width: Math.round(svgWidth),
                    height: Math.round(svgHeight),
                    orientation: svgWidth > svgHeight ? 'LANDSCAPE' : 'PORTRAIT'
                },
                auto_detected: true,
                note: `Found ${fields.length} field(s) with exact coordinates.`
            };
        } catch (error) {
            console.error('SVG parsing error:', error);
            throw new Error('Failed to parse SVG file: ' + error.message);
        }
    }

    /**
     * Suggest default positions for standard certificate fields
     */
    suggestDefaultPositions(width, height) {
        const centerX = Math.round(width / 2);
        const standardPlaceholders = ['NAME', 'COMPETITION', 'CITY', 'DATE', 'RESULT'];

        const positions = {
            'NAME': { x: centerX, y: Math.round(height * 0.40), font_size: 28 },
            'COMPETITION': { x: centerX, y: Math.round(height * 0.55), font_size: 20 },
            'CITY': { x: Math.round(width * 0.30), y: Math.round(height * 0.70), font_size: 16 },
            'DATE': { x: Math.round(width * 0.70), y: Math.round(height * 0.70), font_size: 16 },
            'RESULT': { x: centerX, y: Math.round(height * 0.85), font_size: 18 }
        };

        return standardPlaceholders.map(fieldType => ({
            field_type: fieldType,
            x_coordinate: positions[fieldType].x,
            y_coordinate: positions[fieldType].y,
            font_size: positions[fieldType].font_size,
            font_family: 'Arial',
            font_color: '#000000',
            alignment: 'center',
            placeholder: `{{${fieldType}}}`,
            original_text: `(Suggested: ${fieldType})`
        }));
    }

    /**
     * Extract attribute value from SVG element
     */
    extractAttribute(element, attrName) {
        const regex = new RegExp(`${attrName}=["']([^"']+)["']`, 'i');
        const match = element.match(regex);
        if (match) {
            return parseFloat(match[1]);
        }

        // Check in style attribute
        const styleMatch = element.match(/style=["']([^"']+)["']/);
        if (styleMatch) {
            const styleRegex = new RegExp(`${attrName}:\\s*([^;]+)`, 'i');
            const styleAttr = styleMatch[1].match(styleRegex);
            if (styleAttr) {
                return parseFloat(styleAttr[1]);
            }
        }

        return null;
    }

    /**
     * Extract font size from element
     */
    extractFontSize(element) {
        const fontSize = this.extractAttribute(element, 'font-size');
        if (fontSize !== null) {
            return Math.round(fontSize);
        }

        // Default font size
        return 20;
    }

    /**
     * Detect plain text fields like "Benefactors of this pass", "Names", etc.
     * @param {string} text - Text content to check
     * @returns {Object|null} Field info if detected, null otherwise
     */
    detectPlainTextField(text) {
        const normalizedText = text.toLowerCase().trim();
        
        console.log('Checking plain text:', text, '| normalized:', normalizedText);
        
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
                console.log('✅ Matched pattern:', pattern.fieldType);
                return {
                    fieldType: pattern.fieldType,
                    text: text
                };
            }
        }
        
        console.log('❌ No pattern matched');
        return null;
    }

    /**
     * Parse size string (handles px, pt, etc.)
     */
    parseSize(sizeStr) {
        const num = parseFloat(sizeStr);
        if (sizeStr.includes('pt')) {
            return num * 1.333; // Convert pt to px
        }
        return num;
    }

    /**
     * Convert common color names to hex
     */
    colorNameToHex(colorName) {
        const colors = {
            'black': '#000000',
            'white': '#FFFFFF',
            'red': '#FF0000',
            'blue': '#0000FF',
            'green': '#008000',
            'yellow': '#FFFF00',
            'gray': '#808080',
            'grey': '#808080'
        };
        return colors[colorName.toLowerCase()] || '#000000';
    }
}

module.exports = new SVGParserService();
