# Washapp.ae - Mobile-First Car Wash Booking Platform

## Overview
Washapp.ae is a professional, mobile-first platform for car wash booking, featuring an Uber-style interface. It enables anonymous customer requests, allows companies to manage cleaners, and empowers cleaners to complete jobs with photo verification. The project aims to streamline car wash booking and provide comprehensive management tools, tapping into market potential.

## Recent Changes (November 24, 2025)
-   **Complaint System Improvements**: Simplified complaint reference format from `CMP-{timestamp}-{random}` to `CMP-{id}` for easier tracking. Added status filter dropdown (All, Pending, In Progress, Resolved, Refunded) and reference number search to both admin and company complaint pages. Filtering is client-side using `useMemo` for optimal performance.
-   **Team Management Filtering**: Implemented location and name filters for cleaners in company dashboard, with assigned service areas displayed in cleaner summaries. Modified `/api/company/cleaners` endpoint to include geofence assignments (`assignedGeofences` and `isAssignedToAll` fields) for each cleaner.
-   **Pagination Implementation**: Added comprehensive pagination across all reporting views (company financials, admin dashboard, cleaner tips, customer tracking) with standard page size of 20 items. Created reusable PaginationControls component using shadcn/ui primitives. Storage layer returns {data, total} format with automatic page reset when filters change. Updated tracking endpoints (`getJobsByPlateNumber`, `getJobsByPhoneNumber`) to return paginated format.
-   **Package 1 Fee Calculation Fix**: Fixed critical bug where `feePackageType` field was missing from `getNearbyCompanies()` API response, causing Package 1 pricing to show incorrect amounts (e.g., 17.00 AED instead of 17.75 AED for 15 AED wash). Fixed by adding `fee_package_type` to SELECT query and company mapping in `server/storage.ts`.
-   **Post-Payment Tracking Redirect Fix**: Fixed bug where checkout redirected to `/customer/track/{number}` instead of full plate identifier. Updated all redirect locations in `checkout.tsx` to use complete plate format: `${carPlateEmirate} ${carPlateCode} ${carPlateNumber}`. Also fixed car plate display in checkout summary.
-   **Booking Flow Auto-Fill Fix**: Fixed two issues in customer booking flow: (1) After email verification, customer's most recent car plate details now auto-fill correctly via new `/api/customer/recent-car-by-email/:email` endpoint. (2) Car history popup now only appears when user skips email verification, preventing duplicate suggestions for verified users.

## User Preferences
I prefer simple language and clear explanations. I want iterative development with frequent, small updates. Ask before making major changes to the architecture or core functionalities. Ensure the code is clean, well-commented, and follows modern React and Node.js best practices. Do not make changes to the `uploads/` folder or modify existing environment variables without explicit confirmation.

## System Architecture

### UI/UX Decisions
-   **Design**: Mobile-first responsive design, optimized for potential app store wrapping.
-   **Theme**: Modern vibrant interface with bright blue primary color, gradient accents, and dark mode support.
-   **Navigation**: Role-based bottom navigation and a footer with legal links. Staff login button in top-right.
-   **Mapping**: Interactive OpenStreetMap integration with Leaflet for location selection and Nominatim reverse geocoding.
-   **Booking Flow**: Email/OTP-first 4-step wizard with persistent progress, Framer Motion animations, and mobile-first design. Reuses existing checkout component.
-   **Legal Pages**: Informational pages for About/How It Works, Terms & Conditions, and Privacy Policy.

### Technical Implementations
-   **Frontend**: React, Tailwind CSS, shadcn/ui, Roboto font, Framer Motion.
-   **Backend**: Express.js, Node.js.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **Authentication**: Passport.js with bcrypt for staff roles, `connect-pg-simple` for session storage. Auto-admin setup on server startup. Password reset functionality with token-based flow and email notifications. Customer data model uses email as primary identifier.
-   **Payments**: Stripe integration for AED currency.
-   **Email**: Resend for notifications.
-   **Real-time**: WebSocket server for job status updates.
-   **File Uploads**: Multer for local file storage (job photos, trade licenses).
-   **Location**: Geofence polygon matching using ray-casting.
-   **Security**: Session-based authentication, CSRF protection, role-based access control, Stripe webhook verification. Push notification coordinates validated server-side.
-   **PWA**: Progressive Web App with service worker and manifest for installability.
-   **Push Notifications**: Web Push API for real-time alerts to customers and cleaners, with four-way geolocation validation for cleaners.
-   **Performance Optimization**: Consolidated API endpoints, parallel data fetching, single invalidation pattern for mutations, parallel push notification eligibility checks.
-   **Idempotency Pattern**: Critical mutation endpoints use atomic conditional updates to prevent duplicate submissions.
-   **Cache Management**: Zero API data caching, automatic version checking with cache invalidation and page reload on deployment updates.

### Feature Specifications
-   **Customer Booking Flow**: Flexible 4-step wizard at `/customer/booking` including email verification (optional), car details entry (with auto-fill), location and company selection (geofence-based), and payment via existing checkout.
-   **Customer Flow**: Anonymous booking with car plate entry, map-based location selection, geofence-based company matching, Stripe payment, and job tracking (Paid → Assigned → In Progress → Completed).
-   **Cleaner Flow**: Invitation-based registration, streamlined shift-based status, job acceptance, Google Maps navigation, photo-based job completion. Continuous GPS tracking and automatic shift timeout.
-   **Company Admin Flow**: Registration (admin approval required), multiple named geofence management, cleaner invitation management with service area assignment, detailed financial reports (with Excel export), and company settings.
-   **Admin Flow**: Platform-wide analytics, company approval/rejection with fee package selection, financial oversight, manual withdrawal processing, transaction history, and platform settings.
-   **Job Acceptance**: Stripe payment triggers PENDING_PAYMENT, webhook confirmation to PAID, job becomes available to eligible on-duty cleaners based on four-criteria geolocation validation. First-come-first-served manual acceptance.
-   **Geofence Validation**: All customer interactions validate location against company service areas.
-   **Cleaner Geofence Assignment**: Companies can assign cleaners to specific service areas or all areas during invitation or post-registration.

### System Design Choices
-   **Data Models**: Comprehensive models for Users, Companies, Cleaners, Jobs, Financials, etc., with email as primary customer identifier.
-   **Currency**: All transactions in AED (United Arab Emirates Dirham).
-   **Tax Policy**: 5% VAT on car wash and platform fee; tips are VAT-exempt. Receipts show tips as a separate line item.
-   **Fee Structure**: Flexible three-tier package system (Custom, Package 1, Package 2 - offline payment) with configurable platform fees and VAT calculation. Admin can change fee structures.
-   **Transaction Tracking**: All payments, refunds, and withdrawals tracked with unique reference numbers and Stripe IDs. Atomic receipt number generation. Dual-ledger for withdrawals and payment transactions.
-   **Auto-Refund**: Jobs not accepted within 15 minutes are automatically refunded via Stripe.
-   **Auto-Shift-Timeout**: Cleaners' shifts automatically end after 10 minutes of no location updates.
-   **Payment Options**: Card, Apple Pay, and Google Pay via Stripe Payment Request Button.
-   **API**: RESTful API built with Express.js.
-   **Transactions**: Database transactions for multi-step operations.

## External Dependencies
-   **Mapping**: OpenStreetMap (`react-leaflet`), Nominatim, Google Maps.
-   **Payments**: Stripe.
-   **Email**: Resend.
-   **Database**: PostgreSQL.
-   **Authentication**: Passport.js, bcrypt.
-   **Session Store**: `connect-pg-simple`.
-   **File Uploads**: `multer`.