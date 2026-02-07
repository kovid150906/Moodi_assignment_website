# Certificate System - Complete Rebuild Documentation

## Overview

The certificate system has been completely rebuilt from scratch to meet all modern requirements including:
- Dynamic certificate template management
- PDF generation with configurable text positioning
- Multi-city and multi-competition support
- Certificate preview functionality
- User dashboard with downloadable certificates
- Admin portal for complete certificate lifecycle management
- Leaderboard integration

## Architecture

### Backend Structure

#### Admin Backend (`backend-admin/`)
- **Service**: `src/services/certificate.service.js`
  - Template management (CRUD operations)
  - Field configuration
  - Certificate generation with PDF-lib
  - Preview functionality
  - Bulk operations
  - Statistics

- **Routes**: `src/routes/certificate.routes.js`
  - Template management endpoints
  - Field configuration endpoints
  - Certificate generation endpoints
  - Preview endpoints
  - Certificate release/revoke endpoints

#### User Backend (`backend-user/`)
- **Service**: `src/services/certificate.service.js`
  - Get user certificates
  - Download certificates
  - Certificate statistics
  - Grouped views (by competition/city)

- **Routes**: `src/routes/certificate.routes.js`
  - User certificate listing
  - Certificate download
  - Statistics endpoints

### Frontend Structure

#### Admin Frontend (`frontend-admin/`)
- **Templates.jsx**: Template listing and upload
- **TemplateDetail.jsx**: Template configuration (to be created)
- **Certificates.jsx**: Certificate management (to be created)

#### User Frontend (`frontend-user/`)
- **Certificates.jsx**: User certificate dashboard (to be created)

### Database Schema

#### Tables

**certificate_templates**
- Stores template metadata and file references
- Supports PDF, PNG, JPG formats
- Links to competitions (optional)
- Status: ACTIVE, ARCHIVED

**certificate_template_fields**
- Dynamic field positioning
- Supports: NAME, COMPETITION, CITY, DATE, RESULT, POSITION, MI_ID, CUSTOM
- Configurable styling: fonts, colors, alignment, transformations

**certificates**
- Generated certificate records
- Unique certificate numbers
- Status workflow: DRAFT → GENERATED → RELEASED → REVOKED
- Tracks generation and release timestamps
- Links to users, participations, and templates

## Key Features

### 1. Template Management

**Upload Templates**
- Support for PDF, PNG, JPG formats
- Configurable page dimensions
- Optional competition linking
- Automatic file type detection

**Configure Fields**
- Drag-and-drop positioning
- Multiple field types
- Font customization (size, family, weight, color)
- Text alignment and transformation
- Date formatting options

### 2. Certificate Generation

**Single/Bulk Generation**
- Generate for specific participations
- Generate for entire competitions
- Generate for specific cities
- Handles success and failures gracefully

**Dynamic Content**
- Participant name
- Competition name
- City name
- Event date (multiple formats)
- Result status (WINNER/PARTICIPATED)
- Position (with ordinal suffixes: 1st, 2nd, 3rd)
- MI ID
- Custom text

### 3. Certificate Preview

**Live Preview**
- Preview with real participant data
- Preview with sample data
- Returns base64 encoded PDF
- No file creation on disk

### 4. Certificate Release

**Workflow**
1. Generate certificates (status: GENERATED)
2. Preview and verify
3. Release to users (status: RELEASED)
4. Users can download

**Bulk Operations**
- Release multiple certificates at once
- Track who released and when

### 5. User Experience

**User Dashboard**
- View all released certificates
- Download as PDF
- View by competition
- View by city
- Certificate statistics

**Certificate Details**
- Certificate number
- Competition name
- City
- Date
- Result status

## API Endpoints

### Admin Endpoints

#### Templates
```
GET    /api/certificates/templates              Get all templates
GET    /api/certificates/templates/:id          Get template details
POST   /api/certificates/templates              Upload new template
PUT    /api/certificates/templates/:id          Update template
DELETE /api/certificates/templates/:id          Delete template
POST   /api/certificates/templates/:id/archive  Archive template
```

#### Fields
```
POST   /api/certificates/templates/:id/fields         Add field
PUT    /api/certificates/templates/fields/:fieldId    Update field
DELETE /api/certificates/templates/fields/:fieldId    Delete field
PUT    /api/certificates/templates/:id/fields/bulk    Bulk update fields
```

#### Generation
```
POST   /api/certificates/generate                     Generate certificates
POST   /api/certificates/generate/competition         Generate for competition
POST   /api/certificates/preview                      Preview certificate
```

#### Management
```
GET    /api/certificates                     Get all certificates
GET    /api/certificates/stats               Get statistics
GET    /api/certificates/:id                 Get certificate
POST   /api/certificates/:id/release         Release certificate
POST   /api/certificates/release/bulk        Bulk release
POST   /api/certificates/:id/revoke          Revoke certificate
DELETE /api/certificates/:id                 Delete certificate
GET    /api/certificates/:id/download        Download certificate
```

### User Endpoints
```
GET    /api/certificates                  Get user certificates
GET    /api/certificates/stats            Get user stats
GET    /api/certificates/by-competition   Get grouped by competition
GET    /api/certificates/by-city          Get grouped by city
GET    /api/certificates/:id              Get certificate details
GET    /api/certificates/:id/download     Download certificate
```

## Setup Instructions

### 1. Database Migration

Run the migration script to update database schema:

```bash
mysql -u root -p certificate_system < database/migrate-certificate-system.sql
```

Or reset the database completely:

```bash
mysql -u root -p certificate_system < database/schema.sql
```

### 2. Backend Dependencies

Both admin and user backends already have the required dependencies:
- `pdf-lib` - PDF generation
- `multer` - File uploads
- Ensure they're installed:

```bash
cd backend-admin
npm install

cd ../backend-user
npm install
```

### 3. Environment Configuration

Ensure these directories are configured in `.env` or use defaults:

```
UPLOAD_DIR=./uploads/templates
GENERATED_DIR=./generated/certificates
```

Directories will be created automatically.

### 4. Start Services

```bash
# Admin backend
cd backend-admin
npm start

# User backend
cd backend-user
npm start

# Admin frontend
cd frontend-admin
npm run dev

# User frontend
cd frontend-user
npm run dev
```

## Usage Workflow

### Admin Workflow

1. **Upload Template**
   - Go to Templates page
   - Click "Upload New Template"
   - Fill in details and upload PDF/image
   - Template is created with ACTIVE status

2. **Configure Fields**
   - Click "Configure" on template
   - Add fields for dynamic content
   - Position fields using coordinates
   - Configure styling (fonts, colors, alignment)
   - Save configuration

3. **Generate Certificates**
   - Go to Certificates page
   - Select competition and city
   - Choose template
   - Click "Generate"
   - System creates certificates for all participants

4. **Preview Certificates**
   - Click "Preview" on any certificate
   - View with real participant data
   - Verify text positioning and content

5. **Release Certificates**
   - Select generated certificates
   - Click "Release"
   - Certificates become available to users

### User Workflow

1. **View Certificates**
   - Go to Certificates page
   - See all released certificates
   - Filter by competition or city

2. **Download Certificate**
   - Click "Download" on any certificate
   - PDF is downloaded to device

3. **View Statistics**
   - See total certificates
   - View winner vs participation counts
   - See competitions and cities

## Advanced Features

### Certificate Number Format

Format: `CERT-YEAR-COMPETITIONID-CITYID-TIMESTAMP-RANDOM`

Example: `CERT-2026-1-3-1738176000000-542`

### Text Transformations

- UPPERCASE: "john doe" → "JOHN DOE"
- lowercase: "JOHN DOE" → "john doe"
- Capitalize: "john doe" → "John Doe"

### Date Formats

- DD MMM YYYY: "15 Jan 2026"
- DD MMMM YYYY: "15 January 2026"
- DD/MM/YYYY: "15/01/2026"
- MM/DD/YYYY: "01/15/2026"
- YYYY-MM-DD: "2026-01-15"

### Position Ordinals

- 1 → "1st Position"
- 2 → "2nd Position"
- 3 → "3rd Position"
- 4 → "4th Position"

## Security

- **Admin Authentication**: All admin endpoints require authentication and role check
- **User Authentication**: Users can only access their own certificates
- **File Access Control**: Certificate files are only accessible through API endpoints
- **Status Checks**: Only RELEASED certificates are visible to users
- **Audit Logging**: All admin actions are logged

## Performance Considerations

- **Bulk Operations**: Generate certificates in batches
- **File Storage**: Generated PDFs are stored on disk
- **Caching**: Consider implementing file caching for frequently downloaded certificates
- **Database Indexes**: All foreign keys and common queries are indexed

## Troubleshooting

### Common Issues

1. **Template Upload Fails**
   - Check file size (20MB limit)
   - Verify file format (PDF, PNG, JPG only)
   - Ensure upload directory exists and is writable

2. **Certificate Generation Fails**
   - Verify template has fields configured
   - Check participation data exists
   - Ensure template file is accessible

3. **Preview Not Working**
   - Verify template file exists at specified path
   - Check PDF-lib can read the template
   - Ensure all required field data is available

4. **Download Fails**
   - Verify certificate status is RELEASED
   - Check file exists on disk
   - Ensure user has access rights

## Future Enhancements

- [ ] Email certificate notifications
- [ ] Certificate verification system (QR codes)
- [ ] Batch download (zip multiple certificates)
- [ ] Certificate templates gallery
- [ ] Visual field positioning editor
- [ ] Certificate analytics dashboard
- [ ] Print-ready formatting
- [ ] Multiple languages support
- [ ] Watermark support
- [ ] Digital signatures

## File Locations

### Backend Files
```
backend-admin/
  src/
    services/certificate.service.js    (NEW - Complete rewrite)
    routes/certificate.routes.js       (NEW - Complete rewrite)

backend-user/
  src/
    services/certificate.service.js    (NEW - Complete rewrite)
    routes/certificate.routes.js       (NEW - Complete rewrite)
```

### Frontend Files
```
frontend-admin/
  src/
    pages/
      Templates.jsx                    (NEW - Complete rewrite)
      TemplateDetail.jsx              (TODO - To be created)
      Certificates.jsx                (TODO - To be updated)

frontend-user/
  src/
    pages/
      Certificates.jsx                (TODO - To be created)
```

### Database Files
```
database/
  schema.sql                          (UPDATED - Enhanced schema)
  migrate-certificate-system.sql      (NEW - Migration script)
```

## Support

For issues or questions about the certificate system:
1. Check this documentation
2. Review the API endpoint responses
3. Check server logs for errors
4. Verify database schema is up to date

---

**Last Updated**: January 29, 2026
**Version**: 2.0.0
**Status**: Rebuilt from scratch with enhanced features
