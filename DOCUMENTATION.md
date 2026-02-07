# Certificate Distribution System - Complete Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Prerequisites](#prerequisites)
3. [Installation & Setup](#installation--setup)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [System Architecture](#system-architecture)
7. [Admin Portal Features](#admin-portal-features)
8. [User Portal Features](#user-portal-features)
9. [API Reference](#api-reference)
10. [Utility Scripts](#utility-scripts)
11. [Troubleshooting](#troubleshooting)
12. [Default Credentials](#default-credentials)

---

## System Overview

The Certificate Distribution System is an enterprise-grade platform for managing:
- Multi-city competitions
- User registrations & participations
- Multi-round competition management
- Score tracking & leaderboards
- Certificate generation & distribution

### Key Features
- **Dual Portal System**: Separate Admin and User interfaces
- **Role-Based Access**: ADMIN and COORDINATOR roles with different permissions
- **Multi-Round Competitions**: Support for preliminary, semifinal, and final rounds
- **Dynamic Certificate Generation**: PDF certificates with customizable templates
- **Audit Logging**: Track all administrative actions
- **Bulk Operations**: CSV import for users, scores, and results

---

## Prerequisites

Before installation, ensure you have:

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime for backends and frontends |
| npm | 9+ | Package management |
| MySQL | 8.0+ | Database server |
| Git | Any | Version control |

### Verify Installation
```powershell
node --version    # Should be v18+
npm --version     # Should be 9+
mysql --version   # Should be 8.0+
```

---

## Installation & Setup

### Step 1: Clone/Download the Project
```powershell
cd C:\Users\YourUsername\Desktop
# If using git:
git clone <repository-url> moodi_assignment_web
cd moodi_assignment_web
```

### Step 2: Install All Dependencies

**Option A: Using the utility script (recommended)**
```powershell
.\scripts\install-all.ps1
```

**Option B: Manual installation**
```powershell
# Backend Admin
cd backend-admin
npm install
cd ..

# Backend User
cd backend-user
npm install
cd ..

# Frontend Admin
cd frontend-admin
npm install
cd ..

# Frontend User
cd frontend-user
npm install
cd ..

# Database scripts
cd database
npm install
cd ..
```

### Step 3: Configure Environment (Optional)

The system uses default configurations that work out-of-the-box. To customize:

**Backend Admin** (`backend-admin/.env`):
```env
PORT=3002
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=certificate_system
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

**Backend User** (`backend-user/.env`):
```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=certificate_system
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

---

## Database Setup

The database is **automatically created** when you start the backend servers. No manual SQL execution required!

### Automatic Setup (Default)
When you start either backend:
1. Creates `certificate_system` database if not exists
2. Creates all required tables if not exists
3. Seeds default admin and cities

### Manual Database Operations

**Seed Test Data** (recommended for development):
```powershell
cd database
node seed-test-data.js
```

This creates:
- 5 admin accounts
- 6 cities
- 50 test users
- Sample competitions with rounds
- Sample certificates

**Reset Database** (⚠️ deletes all data):
```powershell
cd database
node reset-db.js
```

### Database Schema

| Table | Description |
|-------|-------------|
| `users` | Registered participants with MI IDs |
| `admins` | Admin and coordinator accounts |
| `competitions` | Competition definitions |
| `cities` | Available cities |
| `competition_cities` | Competition-city mappings |
| `participations` | User registrations for competitions |
| `rounds` | Competition rounds (preliminary, semifinal, finale) |
| `round_participations` | Users qualified for each round |
| `round_scores` | Scores and rankings per round |
| `results` | Final competition results |
| `certificates` | Generated certificates |
| `certificate_templates` | Certificate template definitions |
| `audit_logs` | Admin action audit trail |

---

## Running the Application

### Quick Start (Recommended)
```powershell
.\scripts\start-all.ps1
```

This opens 4 terminal windows running all services.

### Manual Start

**Terminal 1 - Admin Backend:**
```powershell
cd backend-admin
npm run dev
# Runs on http://localhost:3002
```

**Terminal 2 - User Backend:**
```powershell
cd backend-user
npm run dev
# Runs on http://localhost:3001
```

**Terminal 3 - Admin Frontend:**
```powershell
cd frontend-admin
npm run dev
# Runs on http://localhost:5174
```

**Terminal 4 - User Frontend:**
```powershell
cd frontend-user
npm run dev
# Runs on http://localhost:5173
```

### Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| User Portal | http://localhost:5173 | Participant registration, certificates |
| Admin Portal | http://localhost:5174 | Competition & user management |
| User API | http://localhost:3001 | User backend API |
| Admin API | http://localhost:3002 | Admin backend API |

---

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  User Frontend  │     │ Admin Frontend  │
│   (Port 5173)   │     │   (Port 5174)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  User Backend   │     │ Admin Backend   │
│   (Port 3001)   │     │   (Port 3002)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │     MySQL       │
            │   (Port 3306)   │
            │ certificate_system │
            └─────────────────┘
```

### Security Features
- **Separate JWT Secrets**: User and Admin tokens are independent
- **Role-Based Access Control**: ADMIN vs COORDINATOR permissions
- **Audit Logging**: All admin actions are logged
- **Rate Limiting**: Prevents brute force attacks
- **Helmet Security**: HTTP security headers

---

## Admin Portal Features

### 1. Dashboard (`/dashboard`)
- Overview statistics
- Recent activity
- Quick access to all features

### 2. Competitions Management (`/competitions`)

**Create Competition:**
1. Click "Create Competition"
2. Fill in name, description, dates
3. Select cities where competition will be held
4. Set registration status (open/closed)
5. Save

**Manage Competition:**
- View participants per city
- Add/remove cities
- Open/close registration
- Archive completed competitions

### 3. Round Management (`/competitions/:id/rounds`)

**Multi-Round Competition Flow:**
```
Round 1 (Preliminary) → Round 2 (Semifinal) → Round 3 (Finale)
     ↓                        ↓                     ↓
  All Users              Top Scorers           Top Scorers
     ↓                        ↓                     ↓
Upload Scores → Qualify Top N → Upload Scores → Declare Winners
```

**Create Round:**
1. Go to Competition Dashboard
2. Select a city
3. Click "Add Round"
4. Set round number, name, date
5. Mark as finale if final round

**Upload Scores (CSV):**
```csv
mi_id,score
MI000001,85.5
MI000002,92.0
MI000003,78.0
```

1. Click "Upload Scores"
2. Select CSV file
3. Review imported scores
4. Confirm upload

**Qualify Participants:**
1. After scoring a round
2. Click "Qualify to Next Round"
3. Select top N participants or manual selection
4. Qualified users appear in next round

### 4. Users Management (`/users`)

**View Users:**
- List all registered users
- Search by name, email, MI ID
- Filter by status

**Create User:**
1. Click "Add User"
2. Enter MI ID (unique identifier)
3. Enter name, email, password
4. Save

**Bulk Import (CSV):**
```csv
mi_id,full_name,email,password
MI000051,John Doe,john@example.com,Pass@123
MI000052,Jane Smith,jane@example.com,Pass@123
```

**User Actions:**
- View profile & participations
- Suspend/activate account
- Reset password
- Register for competitions

### 5. Certificate Templates (`/templates`)

**Create Template:**
1. Click "Create Template"
2. Upload PDF/image background
3. Define placeholder fields:
   - `{{name}}` - Participant name
   - `{{competition}}` - Competition name
   - `{{city}}` - City name
   - `{{date}}` - Event date
   - `{{position}}` - Winner position
   - `{{mi_id}}` - MI ID
4. Set field positions (x, y coordinates)
5. Configure font, size, color
6. Save template

**Link Template to Competition:**
1. Edit template
2. Select competition
3. Choose template type (participation, winner)
4. Save

### 6. Certificate Generation (`/certificates`)

**Generate Certificates:**
1. Select competition
2. Select template
3. Choose recipients:
   - All participants
   - Winners only (1st, 2nd, 3rd)
   - Specific round qualifiers
4. Click "Generate"
5. Certificates are created with unique IDs

**Certificate Types:**
- **Participation**: For all participants
- **Winner**: For 1st, 2nd, 3rd place

### 7. Admins Management (`/admins`)
*ADMIN role only*

**Create Coordinator:**
1. Click "Add Coordinator"
2. Enter name, email, password
3. Role is automatically COORDINATOR

**Manage Coordinators:**
- Suspend accounts
- View activity in audit logs

### 8. Audit Logs
*ADMIN role only*

View all system actions:
- Login/logout
- User creation/modification
- Competition changes
- Certificate generation
- Score uploads

---

## User Portal Features

### 1. Registration (`/register`)
New users can self-register:
1. Enter MI ID (required, provided by organization)
2. Enter full name
3. Enter email
4. Create password
5. Submit

### 2. Login (`/login`)
- Email and password authentication
- Token-based session management

### 3. Dashboard (`/dashboard`)
- View registered competitions
- Quick stats
- Recent certificates

### 4. Competitions (`/competitions`)

**Browse Competitions:**
- View available competitions
- See cities and dates
- Check registration status

**Register for Competition:**
1. Click on competition
2. Select city
3. Click "Register"
4. Confirmation shown

**View My Participations:**
- See all registered competitions
- View round progress
- Check scores and rankings

### 5. Competition Details (`/competitions/:id`)
- Round-by-round progress
- Scores and rankings
- Qualification status

### 6. Leaderboard (`/leaderboard`)
- View rankings by competition/city
- Filter by round
- See scores and positions

### 7. Certificates (`/certificates`)
- View earned certificates
- Download as PDF
- Verify certificate authenticity

### 8. Profile (`/profile`)
- View personal information
- Update password
- See MI ID and email

---

## API Reference

### Admin API (Port 3002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Admin login |
| `/api/auth/change-password` | POST | Change password |
| `/api/competitions` | GET | List competitions |
| `/api/competitions` | POST | Create competition |
| `/api/competitions/:id` | GET | Get competition details |
| `/api/competitions/:id/dashboard` | GET | Full competition dashboard |
| `/api/competitions/cities` | GET | List all cities |
| `/api/competitions/cities` | POST | Create city |
| `/api/users` | GET | List users |
| `/api/users` | POST | Create user |
| `/api/users/:id` | GET | Get user details |
| `/api/users/bulk-import` | POST | Import users from CSV |
| `/api/rounds` | POST | Create round |
| `/api/rounds/:id` | GET | Get round details |
| `/api/rounds/:id/upload-scores` | POST | Upload scores CSV |
| `/api/rounds/:id/qualify` | POST | Qualify participants |
| `/api/certificates/templates` | GET | List templates |
| `/api/certificates/templates` | POST | Create template |
| `/api/certificates/generate` | POST | Generate certificates |
| `/api/admins` | GET | List admins |
| `/api/admins` | POST | Create admin/coordinator |

### User API (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |
| `/api/profile` | GET | Get user profile |
| `/api/profile` | PATCH | Update profile |
| `/api/competitions` | GET | List available competitions |
| `/api/competitions/:id` | GET | Get competition details |
| `/api/competitions/:id/register` | POST | Register for competition |
| `/api/leaderboard` | GET | Get leaderboard |
| `/api/certificates` | GET | Get user's certificates |
| `/api/certificates/:id/download` | GET | Download certificate PDF |

---

## Utility Scripts

Located in the `scripts/` folder:

| Script | Description |
|--------|-------------|
| `start-all.ps1` | Start all 4 services in separate terminals |
| `install-all.ps1` | Install npm dependencies for all projects |
| `check-status.ps1` | Check if all services are running |
| `seed-database.ps1` | Populate database with test data |
| `reset-database.ps1` | Drop and recreate database (⚠️ destructive) |
| `backup-database.ps1` | Create SQL backup of database |
| `test-api.ps1` | Run API endpoint tests |

### Usage Examples

```powershell
# From project root:
.\scripts\start-all.ps1       # Start everything
.\scripts\check-status.ps1    # Check system health
.\scripts\test-api.ps1        # Test all APIs
.\scripts\seed-database.ps1   # Seed test data
```

---

## Troubleshooting

### Common Issues

**1. "Cannot connect to MySQL"**
- Ensure MySQL service is running
- Verify password in database.js matches your MySQL root password
- Default password: `kb@8370007067`

**2. "Port already in use"**
- Kill the process using the port:
  ```powershell
  netstat -ano | findstr :3001
  taskkill /PID <pid> /F
  ```

**3. "Module not found"**
- Run `npm install` in the affected directory

**4. "Invalid credentials" on login**
- Seed the database: `node database/seed-test-data.js`
- Use correct credentials (see below)

**5. "CORS error"**
- Ensure both backend and frontend are running
- Check ports match expected values

### Reset Everything

```powershell
# 1. Stop all services (Ctrl+C in each terminal)

# 2. Reset database
cd database
node reset-db.js
node seed-test-data.js

# 3. Restart services
cd ..
.\scripts\start-all.ps1
```

---

## Default Credentials

### Admin Portal (http://localhost:5174)

| Email | Password | Role |
|-------|----------|------|
| admin@test.com | Admin@123 | ADMIN |
| admin@system.com | Admin@123 | ADMIN |
| delhi.coord@test.com | Coord@123 | COORDINATOR |
| mumbai.coord@test.com | Coord@123 | COORDINATOR |
| bangalore.coord@test.com | Coord@123 | COORDINATOR |

### User Portal (http://localhost:5173)

| Email | Password | MI ID |
|-------|----------|-------|
| aarav.sharma1@test.com | User@123 | MI000001 |
| vivaan.patel2@test.com | User@123 | MI000002 |
| aditya.singh3@test.com | User@123 | MI000003 |
| ... | User@123 | MI000004-MI000050 |

---

## Workflow Examples

### Complete Competition Workflow

1. **Admin creates competition**
   - Set name, dates, cities
   - Open registration

2. **Users register**
   - Login to user portal
   - Browse competitions
   - Register for city

3. **Admin creates Round 1**
   - Add preliminary round for each city
   - Set round date

4. **Conduct Round 1**
   - (Offline competition happens)
   - Admin uploads scores via CSV

5. **Admin qualifies top participants**
   - Click "Qualify to Round 2"
   - Select top N scorers

6. **Repeat for Round 2, 3...**
   - Create semifinal, finale
   - Upload scores
   - Qualify winners

7. **Mark winners**
   - In finale round
   - Set winner positions (1st, 2nd, 3rd)

8. **Generate certificates**
   - Select competition
   - Choose template
   - Generate for winners/all

9. **Users download certificates**
   - Login to user portal
   - View certificates
   - Download PDF

---

## Support

For issues or questions:
1. Check this documentation
2. Review troubleshooting section
3. Check server logs in terminal
4. Verify database connection

---

*Documentation last updated: February 2026*
