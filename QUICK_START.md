# Quick Start Guide

Get the Certificate Distribution System running in 5 minutes!

## Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm 9+

## Step 1: Install Dependencies
```powershell
.\scripts\install-all.ps1
```

## Step 2: Seed Database
```powershell
.\scripts\seed-database.ps1
```

## Step 3: Start All Services
```powershell
.\scripts\start-all.ps1
```

## Step 4: Access the Portals

| Portal | URL | Login |
|--------|-----|-------|
| **Admin** | http://localhost:5174 | admin@test.com / Admin@123 |
| **User** | http://localhost:5173 | aarav.sharma1@test.com / User@123 |

**Note:** All passwords now require:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter  
- At least 1 number

## Verify System Health
```powershell
.\scripts\check-status.ps1
```

## Test All APIs
```powershell
.\scripts\test-api.ps1
```

---

For detailed documentation, see [DOCUMENTATION.md](DOCUMENTATION.md)
