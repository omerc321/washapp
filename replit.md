# CarWash Pro - Mobile-First Car Wash Booking Platform

## Overview
A professional car wash booking platform with Uber-style black/white design. Customers can request car washes, companies manage cleaners, and cleaners complete jobs with photo proof.

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui components, Roboto font
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with bcrypt password hashing (Email/Password for staff roles only)
- **Session Store**: connect-pg-simple (PostgreSQL session storage)
- **Maps**: OpenStreetMap (via react-leaflet), Nominatim reverse geocoding, Google Maps navigation
- **Payments**: Stripe
- **Email**: Resend
- **Real-time**: WebSocket server for job status updates
- **File Uploads**: multer (local file storage)

## User Roles
1. **Customer**: Request car washes, select companies, pay via Stripe, track jobs (anonymous - no login)
2. **Cleaner**: Toggle availability, accept jobs, upload completion photos (email/password auth)
3. **Company Admin**: View company analytics and performance (email/password auth, no approval needed)
4. **Admin**: Platform-wide analytics and management (email/password auth, register via /register/admin)

## Key Features

### Customer Flow (Anonymous - No Login Required)
1. Enter car plate number
2. **Select location on OpenStreetMap** - Interactive map with click-to-select, "Use Current Location" button, and automatic reverse geocoding
3. Enter optional parking number and phone
4. View nearby companies (within 50m) with available cleaners
5. Select company and pay via Stripe
6. Track job status (Paid → Assigned → In Progress → Completed)
7. Customer homepage (/) is the default landing page with "Staff Login" CTA

### Cleaner Flow (Email/Password Auth Required)
1. Register via /register/cleaner (select company from dropdown)
2. Login via /login with email/password
3. Toggle on-duty/off-duty status
4. View available jobs from their company
5. Accept jobs (auto-assigned based on proximity)
6. **Navigate to job location** - "Open in Google Maps" button for turn-by-turn directions
7. Start and complete jobs with photo proof upload

### Company Admin Flow (Email/Password Auth Required)
1. Register via /register/company (creates user + company - **no admin approval required, auto-active**)
2. Login via /login with email/password (case-insensitive)
3. Provide trade license number and upload trade license document (optional)
4. View company analytics and performance
5. Manage company settings

### Payment & Assignment
- Stripe payment creates job in PENDING_PAYMENT status
- Webhook updates job to PAID on successful payment
- System auto-assigns closest on-duty cleaner within 50m radius
- Email notifications via Resend for job assignment and completion

## Data Models

### Users
- id, email, displayName, role, photoURL, phoneNumber, companyId (for cleaners/company admins)

### Companies
- id, name, description, pricePerWash, adminId, tradeLicenseNumber (optional), tradeLicenseDocumentURL (optional), totalJobsCompleted, totalRevenue, rating

### Cleaners
- id, userId, companyId, status (on_duty/off_duty/busy), currentLatitude, currentLongitude, totalJobsCompleted, rating

### Jobs
- id, customerId, companyId, cleanerId, carPlateNumber, locationAddress, locationLatitude, locationLongitude, parkingNumber, customerPhone, price, status, stripePaymentIntentId, proofPhotoURL

## Architecture

### Frontend
- Mobile-first responsive design (optimized for app store wrapping)
- Uber-style black/white professional theme
- Dark mode support with theme toggle
- Bottom navigation for role-based routing
- Protected routes by user role
- Interactive OpenStreetMap integration with Leaflet
- Geolocation support for "Use Current Location" feature

### Backend
- Express.js REST API
- PostgreSQL with Drizzle ORM for all data persistence
- Database transactions for multi-step operations
- Passport.js local strategy for authentication
- bcrypt for password hashing (10 salt rounds)
- Haversine formula for distance calculations (50m radius matching)
- Stripe webhook with signature verification
- Resend email notifications
- WebSocket pub/sub for real-time job updates
- multer for file uploads (trade licenses, job photos)
- `/api/auth/register/*` - Registration endpoints for admin/company/cleaner
- `/api/auth/login` - Authentication endpoint
- `/api/companies/all` - Get all companies for registration dropdown

### Security
- Session-based authentication with Passport.js (staff roles only)
- SameSite='lax' cookies with CSRF protection
- Anonymous customer booking (no authentication required)
- Role-based access control and redirects
- Stripe webhook signature verification
- Protected API endpoints with session middleware
- User profiles store role and companyId for authorization
- 30-day session cookies with secure storage in PostgreSQL

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (provided by Replit)
- `SESSION_SECRET` - Secret for session encryption
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - (optional for development)

## Development Notes

### Database Setup
- PostgreSQL database provided by Replit
- Drizzle ORM for schema management and queries
- Session store using connect-pg-simple
- File uploads stored locally in `uploads/` directory
- Run `npm run db:push` to sync schema to database
- Run `tsx server/seed.ts` to create test data

### Stripe Webhook
- Development: Can work without webhook secret (signature verification skipped)
- Production: Requires STRIPE_WEBHOOK_SECRET for signature verification
- Raw body middleware configured in server/index.ts

### Distance Calculation
- Haversine formula calculates distance between coordinates
- 50-meter radius for company/cleaner matching
- Closest cleaner auto-assigned after payment

### WebSocket Real-time Updates
- WebSocket server for real-time job status updates
- Clients subscribe to job updates by jobId
- Automatic updates when job status changes (assigned, in progress, completed)

## Recent Changes
- 2025-11-05: **Complete PostgreSQL Migration**
  - Migrated from Firebase (Auth + Firestore + Storage) to PostgreSQL + Passport.js
  - Implemented Passport.js local strategy with bcrypt password hashing
  - Converted all 17 API endpoints from Firestore to PostgreSQL with Drizzle ORM
  - Added database transactions for atomic multi-step operations (company registration, cleaner creation)
  - Implemented session-based authentication with connect-pg-simple session store
  - Added WebSocket server for real-time job status updates (replacing Firestore listeners)
  - Implemented file upload handling with multer for trade licenses and job photos
  - Added CSRF protection with SameSite='lax' cookies
  - Updated frontend auth context to use session-based API
  - Removed all Firebase dependencies (firebase, firebase-admin packages)
  - 30-day persistent sessions with PostgreSQL storage
- 2025-11-05: **Company Registration & Authentication Improvements**
  - Added trade license number and document upload fields to company registration
  - Made email authentication case-insensitive (normalized to lowercase)
  - Fixed company registration to work without Firebase Admin service account credentials
  - Changed registration flow: user created via client SDK, then company/profile via API
  - Companies are auto-approved - no admin approval required
  - Created /register/admin page for platform admin registration
  - Admin user credentials: omer.eldirdieri@gmail.com / 12345678 (register via /register/admin)
- 2025-11-05: **OpenStreetMap Integration**
  - Added interactive map-based location selection for customers
  - Implemented LocationPicker component with click-to-select and current location features
  - Integrated Nominatim reverse geocoding (free, no API key required)
  - Added fallback handling for geocoding failures to ensure booking flow never blocks
  - Added "Open in Google Maps" button for cleaners to navigate to job locations
  - Coordinates and address now automatically captured from map selection
- 2025-11-05: **Major Authentication Refactor**
  - Removed Google Sign-In completely
  - Implemented email/password authentication for staff roles (cleaners, company admins, admins)
  - Made customer booking flow anonymous (no login required)
  - Customer home (/) is now the default landing page
  - Created separate registration flows:
    - `/register/company` - Company admin registration (creates user + company atomically)
    - `/register/cleaner` - Cleaner registration (requires company selection)
  - Single login page at `/login` with role-based redirects
  - Fixed company-user linking: adminId stored on company, companyId stored on user profile
  - Added `/api/company/register` endpoint for atomic company+admin creation
  - Login page now redirects users to role-appropriate dashboards
- 2025-01-05: Initial implementation with all MVP features
  - Fixed company admin routing (added /company route)
  - Implemented proper 50m radius filtering with haversine distance
  - Added Stripe webhook with signature verification
  - Updated Firebase Admin with proper credential handling
  - Added company analytics endpoint

## Future Enhancements (Not in MVP)
- Customer rating and review system
- Advanced analytics with heatmaps
- Push notifications
- In-app chat/messaging
- Company cleaner management dashboard
- Real-time Google Maps integration
