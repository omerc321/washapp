# CarWash Pro - Mobile-First Car Wash Booking Platform

## Overview
A professional car wash booking platform with Uber-style black/white design. Customers can request car washes, companies manage cleaners, and cleaners complete jobs with photo proof.

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui components, Roboto font
- **Backend**: Express.js, Node.js
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Email/Password for staff roles only)
- **Payments**: Stripe
- **Email**: Resend
- **Real-time**: Firebase Firestore listeners

## User Roles
1. **Customer**: Request car washes, select companies, pay via Stripe, track jobs
2. **Cleaner**: Toggle availability, accept jobs, upload completion photos
3. **Company Admin**: View company analytics and performance
4. **Admin**: Platform-wide analytics and management

## Key Features

### Customer Flow (Anonymous - No Login Required)
1. Enter car plate number, location, optional parking number, and phone
2. View nearby companies (within 50m) with available cleaners
3. Select company and pay via Stripe
4. Track job status (Paid → Assigned → In Progress → Completed)
5. Customer homepage (/) is the default landing page with "Staff Login" CTA

### Cleaner Flow (Email/Password Auth Required)
1. Register via /register/cleaner (select company from dropdown)
2. Login via /login with email/password
3. Toggle on-duty/off-duty status
4. View available jobs from their company
5. Accept jobs (auto-assigned based on proximity)
6. Start and complete jobs with photo proof upload

### Company Admin Flow (Email/Password Auth Required)
1. Register via /register/company (creates user + company atomically)
2. Login via /login with email/password
3. View company analytics and performance
4. Manage company settings

### Payment & Assignment
- Stripe payment creates job in PENDING_PAYMENT status
- Webhook updates job to PAID on successful payment
- System auto-assigns closest on-duty cleaner within 50m radius
- Email notifications via Resend for job assignment and completion

## Data Models

### Users
- id, email, displayName, role, photoURL, phoneNumber, companyId (for cleaners/company admins)

### Companies
- id, name, description, pricePerWash, adminId, totalJobsCompleted, totalRevenue, rating

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

### Backend
- Express.js REST API
- Firebase Admin SDK for Firestore and Auth operations
- Haversine formula for distance calculations (50m radius matching)
- Stripe webhook with signature verification
- Resend email notifications
- `/api/company/register` - Atomic user+company creation for company admins
- `/api/cleaner/create` - Create cleaner profile linked to company
- `/api/companies/all` - Get all companies for registration dropdown

### Security
- Firebase Authentication with Email/Password (staff roles only)
- Anonymous customer booking (no authentication required)
- Role-based access control and redirects
- Stripe webhook signature verification
- Protected API endpoints
- User profiles store role and companyId for authorization

## Environment Variables Required
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_STRIPE_PUBLIC_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (optional for development)
- `GOOGLE_APPLICATION_CREDENTIALS` (for Firebase Admin in production)

## Development Notes

### Firebase Setup
- Firebase Admin uses Application Default Credentials
- For local dev, gcloud SDK provides credentials
- For Replit deployment, credentials come from environment

### Stripe Webhook
- Development: Can work without webhook secret (signature verification skipped)
- Production: Requires STRIPE_WEBHOOK_SECRET for signature verification
- Raw body middleware configured in server/index.ts

### Distance Calculation
- Haversine formula calculates distance between coordinates
- 50-meter radius for company/cleaner matching
- Closest cleaner auto-assigned after payment

### Seed Data
Run `tsx server/seed.ts` to create test companies and cleaners

## Recent Changes
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
