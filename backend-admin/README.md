# Backend Admin API

Express.js API for admin-facing features in the Certificate Distribution System.

## Features

- Admin and Coordinator authentication
- User management (ADMIN only)
- Competition management
- Participant and result management
- Certificate template management
- Certificate generation and release
- Audit logging

## Role Hierarchy

| Role | Permissions |
|------|-------------|
| ADMIN | Full access to all features |
| COORDINATOR | Limited access (no user creation, no unlock, no delete) |

## Setup

```bash
npm install
npm run dev
```

## Default Admin Credentials

- Email: `admin@system.com`
- Password: `Admin@123`

## Environment Variables

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 3002) |
| DB_HOST | MySQL host |
| DB_USER | MySQL username |
| DB_PASSWORD | MySQL password |
| DB_NAME | Database name |
| ADMIN_JWT_SECRET | JWT signing secret (DIFFERENT from user) |
| ADMIN_JWT_REFRESH_SECRET | Refresh token secret |
| UPLOAD_DIR | Directory for template uploads |
| GENERATED_DIR | Directory for generated certificates |

## API Endpoints

### Authentication
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | ALL | Admin login |
| POST | /api/auth/refresh | ALL | Refresh token |

### User Management
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | /api/users | ALL | List users |
| POST | /api/users | ADMIN | Create user |
| POST | /api/users/bulk | ADMIN | Bulk CSV upload |
| PATCH | /api/users/:id/suspend | ADMIN | Suspend user |
| PATCH | /api/users/:id/activate | ADMIN | Activate user |

### Competition Management
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | /api/competitions | ALL | List competitions |
| POST | /api/competitions | ALL | Create competition |
| PATCH | /api/competitions/:id | ALL | Update competition |
| DELETE | /api/competitions/:id | ADMIN | Delete competition |

### Certificate Management
| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | /api/templates | ALL | List templates |
| POST | /api/templates | ADMIN | Upload template |
| POST | /api/certificates/generate | ALL | Generate certificates |
| POST | /api/certificates/:id/release | ADMIN | Release certificate |
