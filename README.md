# Certificate Distribution & Competition Registration System

Enterprise-grade platform for managing multi-city competitions, user registrations, results, and certificates.

## 🚀 Quick Start

```powershell
# 1. Install all dependencies
.\scripts\install-all.ps1

# 2. Seed test data
.\scripts\seed-database.ps1

# 3. Start all services
.\scripts\start-all.ps1
```

**Access URLs:**
- User Portal: http://localhost:5173 (`aarav.sharma1@test.com` / `User@123`)
- Admin Portal: http://localhost:5174 (`admin@test.com` / `Admin@123`)

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](QUICK_START.md) | 5-minute setup guide |
| [DOCUMENTATION.md](DOCUMENTATION.md) | Complete system documentation |
| [CERTIFICATE_SYSTEM_DOCUMENTATION.md](CERTIFICATE_SYSTEM_DOCUMENTATION.md) | Certificate generation details |

## 📁 Project Structure

```
├── backend-admin/     # Admin API (Port 3002)
├── backend-user/      # User API (Port 3001)
├── frontend-admin/    # Admin React app (Port 5174)
├── frontend-user/     # User React app (Port 5173)
├── database/          # Migrations & seeders
├── scripts/           # Utility scripts
└── test-data/         # Sample CSV files
```

## 🛠️ Utility Scripts

| Script | Description |
|--------|-------------|
| `scripts\start-all.ps1` | Start all services |
| `scripts\install-all.ps1` | Install dependencies |
| `scripts\check-status.ps1` | Check system health |
| `scripts\seed-database.ps1` | Seed test data |
| `scripts\test-api.ps1` | Test API endpoints |
| `scripts\backup-database.ps1` | Backup database |

## 🔧 Manual Setup

### 1. Start Backend Services
```powershell
# Terminal 1 - Admin Backend
cd backend-admin
npm install
npm run dev

# Terminal 2 - User Backend
cd backend-user
npm install
npm run dev
```

### 2. Start Frontend Applications
```powershell
# Terminal 3 - Admin Frontend
cd frontend-admin
npm install
npm run dev

# Terminal 4 - User Frontend
cd frontend-user
npm install
npm run dev
```

## 🏗️ Architecture

- **Dual Portal System**: Separate User and Admin interfaces
- **Role-Based Access**: ADMIN and COORDINATOR permissions
- **Auto-Database Setup**: Tables created automatically on startup
- **Multi-Round Competitions**: Preliminary → Semifinal → Finale
- **Certificate Generation**: Dynamic PDF generation from templates

## 📊 Default Ports

| Service | Port |
|---------|------|
| User Frontend | 5173 |
| Admin Frontend | 5174 |
| User Backend | 3001 |
| Admin Backend | 3002 |
| MySQL | 3306 |

## 🔐 Default Credentials

**Admin Portal:**
- `admin@test.com` / `Admin@123` (Super Admin)
- `admin@system.com` / `Admin@123` (System Admin)
- `delhi.coord@test.com` / `Coord@123` (Delhi Coordinator)
- `mumbai.coord@test.com` / `Coord@123` (Mumbai Coordinator)
- `bangalore.coord@test.com` / `Coord@123` (Bangalore Coordinator)

**User Portal:**
- `aarav.sharma1@test.com` / `User@123`
- (50 test users: MI000001-MI000050, all use `User@123`)

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

## 💻 Tech Stack

- **Backend**: Express.js, Node.js, MySQL2, JWT, bcrypt
- **Frontend**: React 18, Vite, Tailwind CSS
- **PDF Generation**: pdf-lib, sharp
- **Database**: MySQL 8.0
