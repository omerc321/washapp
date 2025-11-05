# Design Guidelines - Mobile-First Car Wash Booking App

## Design Approach
**Uber-Inspired Professional Theme**: Clean, minimalistic interface with focus on functionality and ease of use.

## Color Palette
- **Base**: Black and white color scheme
- **Secondary**: Subtle grays for dividers, backgrounds, and secondary elements
- **Accent**: Single accent color (sleek blue or green) for primary CTAs and highlights
- **No color variations needed initially** - maintain strict monochrome with accent

## Typography
- **Font Family**: Roboto or Helvetica (clean, modern sans-serif)
- **Hierarchy**:
  - Large, bold text for key actions and headings
  - Legible body text optimized for mobile screens
  - Clear size differentiation between primary, secondary, and body text

## Layout System
- **Mobile-First**: Design for mobile screens first, expand to larger screens
- **Spacing**: Use Tailwind units of 4, 6, and 8 for consistent spacing (p-4, m-6, gap-8)
- **Touch Targets**: Ensure all interactive elements are easily tappable with thumb (minimum 44px height)
- **Generous spacing** between buttons and interactive elements

## Component Structure

### Cards & Panels
- Use card-based design for:
  - Company listings (showing price, distance, on-duty cleaners)
  - Job requests
  - Cleaner details
  - Analytics widgets
- Clean borders or subtle shadows to separate content

### Buttons
- **Primary Actions**: Accent color background, white text, prominent placement
- **Secondary Actions**: White/gray background with dark text or outlined style
- **Consistent sizing**: Full-width on mobile for primary CTAs

### Icons
- Simple, minimalist line icons
- Monochrome to match black-and-white theme
- Use for: navigation, status indicators, company details, cleaner actions

### Forms & Inputs
- Clean input fields with clear labels
- Mobile-optimized keyboard types (tel for phone, text for plates)
- Clear validation states
- Google Maps integration for location selection
- File upload for cleaner's proof photos

### Navigation
- Bottom navigation bar for main user flows (mobile-first)
- Simple top bar for context/back actions
- Role-specific navigation (Customer, Cleaner, Company, Admin)

### Data Display
- **Analytics Dashboards**: Simple cards with key metrics
- **Lists**: Scannable company/job listings with essential info
- **Status Indicators**: Clear visual states for job progress

## Key Screens Structure

### Customer Flow
1. **Home/Request**: Car plate input, map for location, optional parking number, mobile number
2. **Company Selection**: Cards showing nearby companies with prices
3. **Payment**: Stripe integration, clear pricing
4. **Tracking**: Job status, cleaner contact info

### Cleaner Flow
1. **Available Jobs**: List of incoming requests from their company
2. **Job Details**: Customer info, location, plate number
3. **Complete**: Photo upload with plate visible

### Company Dashboard
- Jobs overview, cleaner management, earnings

### Admin Dashboard
- System-wide analytics, company/cleaner management

## Images
**No hero images needed** - This is a utility-focused mobile app. Focus on functional UI with clean layouts and efficient workflows.

## Animations
Minimal - only use for:
- Loading states
- Success confirmations
- Smooth transitions between screens

## Mobile-First Priorities
- Single-column layouts
- Bottom-anchored primary CTAs
- Easy thumb reach for all controls
- Optimized for one-handed use
- Fast load times
- Clear visual hierarchy without scrolling