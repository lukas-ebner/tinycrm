# tinyCRM - Lead Management System

A modern CRM application for managing cold-calling campaigns with CSV import, pipeline management, and role-based access control.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** Neon PostgreSQL
- **Auth:** JWT tokens

## Features

### Completed ✅
- JWT authentication with login/logout
- User management (Admin/Caller roles)
- Role-based access control
- Lead management with full CRUD
- Pipeline stages (customizable)
- Tags system with filtering
- Notes and reminders
- Custom field definitions
- CSV import (North Data format with Windows-1252 encoding)
- Responsive dashboard layout
- Leads list view with search and filters

### In Progress 🚧
- Kanban board view
- Lead detail page with editing
- Admin pages (users, stages, custom fields)
- CSV import UI

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (Neon account)

### Installation

1. **Install dependencies:**
   ```bash
   # Server dependencies
   cd server
   npm install

   # Client dependencies
   cd ../client
   npm install
   ```

2. **Database setup:**
   ```bash
   cd server
   npm run db:migrate
   ```

   This creates all tables and default data:
   - Default admin user: `admin@leadtimelabs.com` / `admin123`
   - Default pipeline stages: Neu, Zu kontaktieren, Kontaktiert, etc.

3. **Environment variables:**

   Server `.env` (already configured):
   ```
   DATABASE_URL=postgresql://neondb_owner:...
   JWT_SECRET=leadtime-labs-jwt-secret-key-change-in-production-2026
   PORT=3001
   NODE_ENV=development
   ```

   Client `.env`:
   ```
   VITE_API_URL=http://localhost:3001/api
   ```

### Running the Application

1. **Start the backend:**
   ```bash
   cd server
   npm run dev
   ```
   Server runs on http://localhost:3001

2. **Start the frontend:**
   ```bash
   cd client
   npm run dev
   ```
   Frontend runs on http://localhost:5174

3. **Login:**
   - Email: `admin@leadtimelabs.com`
   - Password: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/me` - Get current user

### Leads
- `GET /api/leads` - List leads (with filters)
- `GET /api/leads/:id` - Get lead details
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead (admin only)
- `POST /api/leads/bulk-assign` - Bulk assign leads (admin only)

### Users
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Stages
- `GET /api/stages` - List all stages
- `POST /api/stages` - Create stage (admin only)
- `PUT /api/stages/:id` - Update stage (admin only)
- `DELETE /api/stages/:id` - Delete stage (admin only)

### Tags
- `GET /api/tags` - List all tags
- `POST /api/tags` - Create tag
- `DELETE /api/tags/:id` - Delete tag

### Notes
- `POST /api/notes` - Create note
- `GET /api/notes/lead/:lead_id` - Get notes for lead

### Reminders
- `POST /api/reminders` - Create reminder
- `GET /api/reminders/my` - Get my reminders
- `PUT /api/reminders/:id/complete` - Complete reminder
- `DELETE /api/reminders/:id` - Delete reminder

### Custom Fields
- `GET /api/custom-fields` - List custom field definitions
- `POST /api/custom-fields` - Create custom field (admin only)
- `PUT /api/custom-fields/:id` - Update custom field (admin only)
- `DELETE /api/custom-fields/:id` - Delete custom field (admin only)

### CSV Import
- `POST /api/csv/import` - Import North Data CSV (admin only)
- `GET /api/csv/template` - Download CSV template

## CSV Import Format

The application supports CSV import in the North Data format:
- **Delimiter:** Semicolon (`;`)
- **Encoding:** Windows-1252 (for German umlauts)
- **Duplicate handling:** Updates existing leads by `Register-ID`

### Supported Fields:
```
Name, Rechtsform, PLZ, Ort, Straße, Tel., E-Mail, Website,
Branche (NACE), Gegenstand, Ges. Vertreter 1, Ges. Vertreter 2,
Umsatz EUR, Mitarbeiterzahl, North Data URL, Register-ID
```

## Database Schema

- `users` - User accounts (admin/caller roles)
- `leads` - Company/lead data
- `stages` - Pipeline stages
- `tags` - Freeform tags
- `lead_tags` - Lead-tag relationships
- `notes` - Lead notes (append-only)
- `reminders` - Follow-up reminders
- `custom_field_definitions` - Custom field configuration

## Role-Based Access

### Admin
- Full access to all features
- Can manage users, stages, custom fields
- Can assign leads to callers
- Can import CSV files

### Caller
- Can only see assigned leads
- Can add notes and reminders
- Can update lead stages
- Cannot manage users or system settings

## Production Deployment

### Backend (Vercel)
1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Frontend (Vercel)
1. Push to GitHub
2. Import to Vercel
3. Set `VITE_API_URL` to production API URL
4. Deploy

### Database
- Already hosted on Neon PostgreSQL
- Connection string in server `.env`

## Security Notes

⚠️ **Important for Production:**
1. Change the default admin password
2. Use a strong JWT_SECRET
3. Enable CORS restrictions
4. Add rate limiting
5. Use HTTPS for all connections

## Development

### Project Structure
```
tinyCRM/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── contexts/    # React contexts
│   │   ├── lib/         # Utilities
│   │   ├── pages/       # Page components
│   │   └── types/       # TypeScript types
│   └── ...
├── server/          # Express backend
│   ├── src/
│   │   ├── controllers/ # Route controllers
│   │   ├── db/          # Database config
│   │   ├── middleware/  # Express middleware
│   │   ├── models/      # Data models
│   │   ├── routes/      # API routes
│   │   └── index.ts     # Server entry
│   └── ...
└── README.md
```

## License

Proprietary - Leadtime Labs

## Support

For issues and questions, contact the development team.
