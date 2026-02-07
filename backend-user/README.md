# Backend User API

Express.js API for user-facing features in the Certificate Distribution System.

## Features

- User registration & authentication
- Competition browsing & registration
- Results viewing
- Certificate download (released only)
- Leaderboard access

## Setup

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| PORT | Server port (default: 3001) |
| DB_HOST | MySQL host |
| DB_USER | MySQL username |
| DB_PASSWORD | MySQL password |
| DB_NAME | Database name |
| USER_JWT_SECRET | JWT signing secret |
| USER_JWT_REFRESH_SECRET | Refresh token secret |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | User registration |
| POST | /api/auth/login | User login |
| POST | /api/auth/refresh | Refresh access token |
| GET | /api/profile | Get user profile |
| GET | /api/competitions | List open competitions |
| POST | /api/competitions/:id/register | Register for competition |
| GET | /api/registrations | User's registrations |
| GET | /api/results | User's results |
| GET | /api/certificates | User's released certificates |
| GET | /api/certificates/:id/download | Download certificate PDF |
| GET | /api/leaderboard | Competition rankings |
