# CarWash Pro - Mobile-First Car Wash Booking Platform

## Overview
A professional car wash booking platform with Uber-style black/white design. Customers can request car washes, companies manage cleaners, and cleaners complete jobs with photo proof.

**Admin Login:** omer.eldirdieri@gmail.com / 12345678

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
4. **Admin**: Platform-wide analytics, approve/reject companies, manage platform (email/password auth)

## Key Features

### Customer Flow (Anonymous - No Login Required)
1. Enter car plate number
2. **Select location on OpenStreetMap** - Interactive map with click-to-select, "Use Current Location" button, and automatic reverse geocoding
3. Enter optional parking number and phone
4. View nearby companies (within 50m) with available cleaners
5. Select company and pay via Stripe
6. Track job status (Paid → Assigned → In Progress → Completed)
7. Customer homepage (/) is the default landing page with "Staff Login" CTA

### Cleaner Flow (Email/Password Auth Required - Invitation-Based)
1. Company admin invites cleaner by phone number via /company dashboard
2. Cleaner registers via /register/cleaner (two-step process):
   - Step 1: Enter invited phone number for validation
   - Step 2: Complete registration form (company auto-assigned from invitation)
3. Login via /login with email/password
4. Toggle on-duty/off-duty status
5. View available jobs from their company
6. Accept jobs (auto-assigned based on proximity)
7. **Navigate to job location** - "Open in Google Maps" button for turn-by-turn directions
8. Start and complete jobs with photo proof upload

### Company Admin Flow (Email/Password Auth Required)
1. Register via /register/company (creates user + company - **requires admin approval**)
2. Wait for admin approval before company becomes active
3. Login via /login with email/password (case-insensitive)
4. **Invite cleaners** - Add phone numbers to invite cleaners (invitation-based onboarding)
5. View invited phone numbers and their registration status (pending/consumed/revoked)
6. View company analytics and performance
7. Manage company settings

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

### Cleaner Invitations
- id, companyId, phoneNumber (unique), status (pending/consumed/revoked), invitedBy, invitedAt, consumedAt

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

### Stripe Webhook & Payment Confirmation
- Development: Webhooks don't fire to localhost - client-side auto-confirmation endpoint used (`/api/confirm-payment/:paymentIntentId`)
- Production: Webhooks fire automatically, requires STRIPE_WEBHOOK_SECRET for signature verification
- Client calls confirmation endpoint after successful payment in development mode
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
- 2025-11-06: **Critical Fixes: Route Ordering & Payment Confirmation**
  - Fixed Express route ordering bug: `/api/companies/:id` was matching `/api/companies/nearby` 
  - Moved specific routes before parameterized routes to prevent incorrect pattern matching
  - Added client-side payment confirmation endpoint `/api/confirm-payment/:paymentIntentId` for development
  - Updated checkout flow to use `redirect: "if_required"` and auto-confirm payments
  - Fixed job assignment and WebSocket notifications not firing after payment
  - Resolved "invalid input syntax for type integer: NaN" error caused by route mismatch
- 2025-11-06: **Periodic Location Tracking & Proximity Matching Improvements**
  - Implemented periodic location tracking for on-duty cleaners (every 5 minutes)
  - Browser Geolocation API captures cleaner's real-time coordinates
  - Location updates stored in `currentLatitude` and `currentLongitude` fields
  - Automatic tracking starts when cleaner goes on-duty, stops when off-duty or logged out
  - Fixed interval accumulation bug to prevent multiple concurrent timers
  - Backend endpoint: `/api/cleaner/update-location` for coordinate updates
  - Improved proximity matching: companies with on-duty cleaners within 50m radius show as options
  - Added frontend/backend validation to prevent NaN coordinates
  - Better error handling for geolocation failures
- 2025-11-06: **Company Analytics Enhancements & Performance Optimization**
  - Added real-time shift roster to company analytics dashboard
  - Displays all cleaners with status, performance metrics, and active shift duration
  - Implemented query performance optimization (eliminated N+1 pattern)
    - Reduced from O(n) queries to O(2) queries using LEFT JOIN + batch fetch
    - Batch fetch active shifts using `inArray` with Map for O(1) lookup
    - Added edge case handling for companies with zero cleaners
  - Removed type safety issues (`any` casts) in frontend components
  - CompanyAnalytics schema updated with typed shift roster interface
  - Backend route: `/api/company/analytics` now includes `shiftRoster` array
- 2025-11-05: **Cleaner Invitation System**
  - Refactored cleaner onboarding to invitation-based workflow
  - Company admins now invite cleaners by phone number only
  - Created `cleaner_invitations` table with status tracking (pending/consumed/revoked)
  - Two-step cleaner registration: phone validation → full registration
  - Company auto-assigned to cleaner based on invitation (no manual selection)
  - Added invitation management UI in company dashboard
  - Invitations are consumed after cleaner successfully registers
  - Backend routes: `/api/company/invite-cleaner`, `/api/company/invitations`, `/api/auth/validate-cleaner-phone`
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
