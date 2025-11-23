import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Car, Building2, MapPin, CreditCard, CheckCircle2, Users, Shield, Clock } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            CarWash Pro
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your trusted platform connecting car owners with professional car wash companies across the UAE
          </p>
        </div>

        {/* How It Works Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              How It Works
            </CardTitle>
            <CardDescription>
              CarWash Pro is a marketplace that connects car wash requesters with verified car washing companies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* For Customers */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-600" />
                For Car Owners
              </h3>
              <div className="grid gap-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Enter Your Phone Number</h4>
                    <p className="text-sm text-muted-foreground">
                      Start by providing your phone number. If you've booked before, we'll auto-fill your car details to save time.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Enter Car Details</h4>
                    <p className="text-sm text-muted-foreground">
                      Provide your car plate number, type, make, and color so companies know what they're washing.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Choose Location & Company</h4>
                    <p className="text-sm text-muted-foreground">
                      Select your car's location on the map. We'll show you available companies in your area with their pricing.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Pay Securely</h4>
                    <p className="text-sm text-muted-foreground">
                      Complete payment via Stripe (card, Apple Pay, or Google Pay). Your booking is confirmed instantly.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Track Your Service</h4>
                    <p className="text-sm text-muted-foreground">
                      A cleaner will be assigned to your job. Track the progress in real-time and receive photo proof when completed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Companies */}
            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                For Car Wash Companies
              </h3>
              <div className="grid gap-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Register Your Company</h4>
                    <p className="text-sm text-muted-foreground">
                      Sign up with your company details and upload your trade license. Admin will review and approve your account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Define Service Areas</h4>
                    <p className="text-sm text-muted-foreground">
                      Set up geofences for areas where you operate. Only customers in these areas will see your company.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Invite Cleaners</h4>
                    <p className="text-sm text-muted-foreground">
                      Send email invitations to your cleaners. Assign them to specific service areas or all areas.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Receive Jobs</h4>
                    <p className="text-sm text-muted-foreground">
                      When customers book in your service areas, your on-duty cleaners receive notifications instantly.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Get Paid</h4>
                    <p className="text-sm text-muted-foreground">
                      Earnings accumulate in your account. Request withdrawals anytime, processed manually by admin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Location-Based Matching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We use smart geofencing to match you with companies that operate in your area. No more searching through unavailable providers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                Secure Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                All payments are processed securely through Stripe. Your financial information is never stored on our servers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Real-Time Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track your car wash in real-time with push notifications. Know exactly when a cleaner is assigned and when the job is done.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                Photo Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Every completed job includes before and after photos, so you have proof that your car was washed professionally.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
            <CardDescription>Common questions from customers and companies</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {/* Customer FAQs */}
              <AccordionItem value="faq-1" data-testid="faq-payment">
                <AccordionTrigger>How do I pay for a car wash?</AccordionTrigger>
                <AccordionContent>
                  We accept all major credit cards, Apple Pay, and Google Pay through our secure Stripe payment gateway. Payment is required upfront when you book a car wash. The total includes the company's car wash price, platform fee, and VAT.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-2" data-testid="faq-cancellation">
                <AccordionTrigger>Can I cancel or get a refund?</AccordionTrigger>
                <AccordionContent>
                  If no cleaner accepts your job within 15 minutes, you'll automatically receive a full refund. Once a cleaner accepts your job, cancellations may not be possible. For disputes or issues, please contact the car wash company directly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-3" data-testid="faq-tracking">
                <AccordionTrigger>How do I track my car wash?</AccordionTrigger>
                <AccordionContent>
                  After payment, you'll be redirected to a tracking page. You can also access it anytime by searching with your phone number or car plate number. You'll see real-time status updates: Paid → Assigned → In Progress → Completed.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-4" data-testid="faq-areas">
                <AccordionTrigger>What areas do you serve?</AccordionTrigger>
                <AccordionContent>
                  Service areas depend on the car wash companies registered on our platform. When you select your location on the map, we'll show you all companies that operate in your area. If no companies appear, it means no providers are currently available in your location.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-5" data-testid="faq-notification">
                <AccordionTrigger>Will I receive notifications?</AccordionTrigger>
                <AccordionContent>
                  Yes! Enable push notifications in your browser to receive real-time updates when a cleaner is assigned to your job and when your car wash is completed.
                </AccordionContent>
              </AccordionItem>

              {/* Company FAQs */}
              <AccordionItem value="faq-6" data-testid="faq-fees">
                <AccordionTrigger>What fees does the platform charge companies?</AccordionTrigger>
                <AccordionContent>
                  We offer three fee packages: Custom (admin-set flat fee + 5% VAT), Package 1 (2 AED base + 5% of wash price + 5% VAT), and Package 2 (offline mode with 5% VAT only). Your fee structure is determined during registration and can be updated by admin.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-7" data-testid="faq-approval">
                <AccordionTrigger>How long does company approval take?</AccordionTrigger>
                <AccordionContent>
                  After you register and upload your trade license, our admin team will review your application. Approval typically takes 1-2 business days. You'll receive an email notification once approved or if additional information is needed.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-8" data-testid="faq-cleaners">
                <AccordionTrigger>How do I add cleaners to my company?</AccordionTrigger>
                <AccordionContent>
                  From your company dashboard, go to "Cleaners" and click "Invite Cleaner". Enter their email and assign them to service areas. They'll receive an invitation email to register and create their account. Once registered, they can start accepting jobs.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-9" data-testid="faq-geofence">
                <AccordionTrigger>What are service areas (geofences)?</AccordionTrigger>
                <AccordionContent>
                  Service areas are geographic zones where your company operates. You can create multiple named areas by drawing boundaries on a map. Only customers within these boundaries will see your company as an option. You can assign cleaners to specific areas or all areas.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-10" data-testid="faq-withdrawal">
                <AccordionTrigger>How do I withdraw my earnings?</AccordionTrigger>
                <AccordionContent>
                  Go to your Financial Reports page and click "Request Withdrawal". Enter the amount you want to withdraw (minimum 100 AED). Admin will manually process your request and transfer funds to your registered bank account within 2-3 business days.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-11" data-testid="faq-pricing">
                <AccordionTrigger>Can I change my car wash pricing?</AccordionTrigger>
                <AccordionContent>
                  Yes! From your company settings, you can update your car wash price anytime. The new price will apply to all future bookings. Note that the platform fee structure is managed by admin and varies by package.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="faq-12" data-testid="faq-support">
                <AccordionTrigger>What if I have an issue with a customer?</AccordionTrigger>
                <AccordionContent>
                  As a marketplace platform, we connect customers with companies but don't mediate disputes. You are responsible for handling customer service, refunds, and any issues that arise during service delivery. We recommend maintaining professional communication and resolving issues promptly.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            Ready to get started?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/customer/booking"
              className="inline-flex items-center justify-center h-10 px-6 font-medium rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 transition-opacity"
              data-testid="link-book-wash"
            >
              Book a Car Wash
            </a>
            <a
              href="/company/register"
              className="inline-flex items-center justify-center h-10 px-6 font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              data-testid="link-register-company"
            >
              Register as Company
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
