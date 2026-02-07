# Certificate System - Page Guide

## Understanding the Two Certificate Pages

The certificate system has **TWO different pages** with distinct purposes:

### 1. Templates Page (`/templates`)
**Purpose**: Manage certificate TEMPLATES (the designs/layouts)

**What you do here**:
- Upload certificate template files (PDF, PNG, JPG)
- Configure dynamic fields (name, competition, city, date, result, position)
- Position text fields on the template
- Set font styling (size, color, weight, alignment)
- Link templates to specific competitions
- Archive or delete templates

**Think of it as**: The design studio where you create and configure certificate designs

**Key Features**:
- Upload new templates
- Configure field positions
- Preview template with sample data
- Link to competitions
- Archive unused templates

---

### 2. Certificates Page (`/certificates`)
**Purpose**: Manage generated CERTIFICATES (actual certificates for users)

**What you do here**:
- View all generated certificates
- Preview certificates with real participant data
- Release certificates to users
- Bulk release operations
- Filter by competition or status

**Think of it as**: The certificate distribution center where you manage and release certificates to users

**Key Features**:
- View generated certificates
- Preview before releasing
- Release to users (makes them downloadable)
- Bulk operations
- Filter and search

---

## Workflow: From Template to User

```
1. TEMPLATES PAGE
   └─> Upload certificate template (PDF file)
   └─> Configure dynamic fields
   └─> Position fields on template
   └─> Link to competition (optional)

2. BACKEND (Admin action)
   └─> Generate certificates for participants
   └─> System creates certificate files

3. CERTIFICATES PAGE
   └─> Preview generated certificates
   └─> Verify content and positioning
   └─> Release certificates

4. USER DASHBOARD
   └─> Users see their certificates
   └─> Download as PDF
```

---

## Fixed Issues

### Issue 1: Competitions Filter
**Problem**: Templates page wasn't showing DRAFT or CLOSED competitions
**Solution**: Removed status filter from competitions API call - now shows ALL competitions

### Issue 2: API Endpoints Mismatch
**Problem**: Frontend was calling old API endpoints that don't exist
**Solution**: Updated all API endpoints to match new backend:
- `/templates` → `/certificates/templates`
- `/templates/certificates` → `/certificates`
- Added new endpoints for stats, preview, etc.

### Issue 3: Certificate Page Purpose Unclear
**Problem**: Users confused about what the Certificates page is for
**Solution**: Added clear documentation comments and updated page description

### Issue 4: Data Extraction
**Problem**: API responses not being parsed correctly
**Solution**: Updated data extraction to handle both old and new response formats:
```javascript
// Now handles both formats:
response.data.certificates || response.data.data || []
```

---

## API Endpoints Reference

### Templates (Design Management)
```
GET    /certificates/templates              - List all templates
GET    /certificates/templates/:id          - Get template details
POST   /certificates/templates              - Upload new template
PUT    /certificates/templates/:id          - Update template
DELETE /certificates/templates/:id          - Delete template
POST   /certificates/templates/:id/archive  - Archive template
POST   /certificates/templates/:id/fields   - Add field to template
PUT    /certificates/templates/fields/:id   - Update field
DELETE /certificates/templates/fields/:id   - Delete field
```

### Certificates (Generated Certificate Management)
```
GET    /certificates                  - List generated certificates
GET    /certificates/stats            - Get statistics
POST   /certificates/generate         - Generate certificates
POST   /certificates/preview          - Preview certificate
POST   /certificates/:id/release      - Release to user
POST   /certificates/release/bulk     - Bulk release
POST   /certificates/:id/revoke       - Revoke certificate
GET    /certificates/:id/download     - Download certificate file
```

---

## Common Questions

### Q: Why are there two pages?
**A**: Templates = designs/layouts. Certificates = actual generated certificates for users. They serve different purposes in the workflow.

### Q: Why can't I see templates in the Certificates page?
**A**: The Certificates page is for managing GENERATED certificates, not templates. Go to Templates page to manage designs.

### Q: How do I create a certificate for a user?
**A**: 
1. Create template in Templates page
2. Configure fields
3. Use backend API to generate certificates
4. Preview and release in Certificates page

### Q: What's the difference between "Generate" and "Release"?
**A**: 
- **Generate**: Creates certificate files (not visible to users yet)
- **Release**: Makes certificates available for users to download

### Q: Why don't I see all competitions?
**A**: Fixed! Now shows ALL competitions including drafts and closed ones.

---

## Testing the Fixes

1. **Test Templates Page**:
   - Go to `/templates`
   - Click "Upload New Template"
   - Check competition dropdown - should show ALL competitions (including DRAFT)
   - Upload a template successfully

2. **Test Certificates Page**:
   - Go to `/certificates`
   - Should see any generated certificates
   - Click "Preview Certificate"
   - Select template from dropdown (should show all active templates with fields)
   - Select competition (should show ALL competitions)
   - Select participant
   - Click "Generate Preview"

3. **Verify API Calls**:
   - Open browser DevTools > Network tab
   - Refresh Templates page
   - Should see: `GET /certificates/templates`
   - Refresh Certificates page
   - Should see: `GET /certificates`

---

## Next Steps

To complete the certificate system:

1. **Generate Certificates** (Backend/API):
   - Use POST `/certificates/generate` with template_id and participation_ids
   - Or use POST `/certificates/generate/competition` for bulk generation

2. **Create TemplateDetail Page**:
   - Visual field positioning editor
   - Drag and drop field placement
   - Real-time preview

3. **Enhance Certificates Page**:
   - Add generate certificates button
   - Add filtering by city
   - Add search functionality

---

**Last Updated**: January 29, 2026
**Status**: Issues Fixed ✅
