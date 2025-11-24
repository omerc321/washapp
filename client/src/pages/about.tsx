import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Car, Building2, MapPin, CreditCard, CheckCircle2, Users, Shield, Clock, Smartphone, Monitor, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.h1
            className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Washapp.ae
          </motion.h1>
          <motion.p
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Your trusted platform connecting car owners with professional car wash companies across the UAE
          </motion.p>
        </motion.div>

        {/* Mobile App Showcase */}
        <AnimatedSection>
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3 flex items-center justify-center gap-2">
                <Smartphone className="w-8 h-8 text-blue-600" />
                Mobile Booking Experience
              </h2>
              <p className="text-muted-foreground">Book a car wash in just 4 simple steps</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              {[
                {
                  step: 1,
                  title: "Phone Number",
                  desc: "Enter your phone for smart auto-fill",
                  icon: "📱",
                  color: "from-blue-500 to-blue-600"
                },
                {
                  step: 2,
                  title: "Car Details",
                  desc: "Plate number, type, make & color",
                  icon: "🚗",
                  color: "from-indigo-500 to-indigo-600"
                },
                {
                  step: 3,
                  title: "Location",
                  desc: "Pick location & choose company",
                  icon: "📍",
                  color: "from-purple-500 to-purple-600"
                },
                {
                  step: 4,
                  title: "Payment",
                  desc: "Secure payment with Stripe",
                  icon: "💳",
                  color: "from-emerald-500 to-emerald-600"
                }
              ].map((item, idx) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 + idx * 0.1 }}
                >
                  <Card className="relative overflow-hidden hover-elevate h-full">
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.color} opacity-10 rounded-full blur-2xl`} />
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${item.color} text-white flex items-center justify-center font-bold text-lg shadow-lg`}>
                          {item.step}
                        </div>
                        <div className="text-4xl">{item.icon}</div>
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                      <CardDescription>{item.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Mobile App Preview Mockup */}
            <motion.div
              className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-4">Mobile-First Design</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Phone-first booking with smart auto-fill for returning customers</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Interactive map for precise location selection</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Real-time job tracking with push notifications</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Progressive Web App - install on your home screen</span>
                    </li>
                  </ul>
                </div>
                <div className="w-64 h-96 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border-8 border-gray-800 dark:border-gray-600 overflow-hidden relative">
                  <div className="absolute top-0 inset-x-0 h-6 bg-gray-800 dark:bg-gray-900 flex items-center justify-center">
                    <div className="w-24 h-4 bg-gray-900 dark:bg-black rounded-full" />
                  </div>
                  <div className="pt-8 px-4 h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
                    <div className="space-y-4">
                      <div className="h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        CarWash Pro
                      </div>
                      <div className="space-y-2">
                        <div className="h-10 bg-white dark:bg-gray-700 rounded-lg shadow" />
                        <div className="h-20 bg-white dark:bg-gray-700 rounded-lg shadow" />
                        <div className="h-32 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 rounded-lg shadow" />
                      </div>
                      <div className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg shadow-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatedSection>

        {/* Company Platform Desktop Showcase */}
        <AnimatedSection delay={0.2}>
          <div className="mb-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-3 flex items-center justify-center gap-2">
                <Monitor className="w-8 h-8 text-indigo-600" />
                Company Management Platform
              </h2>
              <p className="text-muted-foreground">Full-featured desktop dashboard for car wash companies</p>
            </div>

            {/* Desktop Dashboard Mockup */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-950 dark:to-black p-2">
                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
                  {/* Browser Chrome */}
                  <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex items-center gap-2 border-b">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 mx-4 bg-white dark:bg-gray-600 rounded px-3 py-1 text-xs text-muted-foreground">
                      https://carwashpro.replit.app/company
                    </div>
                  </div>

                  {/* Dashboard Content */}
                  <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b">
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                          Company Dashboard
                        </h3>
                        <p className="text-xs text-muted-foreground">Manage your car wash business</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600" />
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-pink-600" />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4">
                      {[
                        { label: "Active Jobs", value: "12", color: "from-blue-500 to-blue-600" },
                        { label: "Revenue", value: "AED 5.2K", color: "from-emerald-500 to-emerald-600" },
                        { label: "Cleaners", value: "8", color: "from-purple-500 to-purple-600" },
                        { label: "Completed", value: "156", color: "from-indigo-500 to-indigo-600" }
                      ].map((stat) => (
                        <div key={stat.label} className="p-3 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} mb-2`} />
                          <div className="text-lg font-bold">{stat.value}</div>
                          <div className="text-xs text-muted-foreground">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Feature Sections */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          Service Areas
                        </div>
                        <div className="space-y-1">
                          <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-300 rounded w-3/4" />
                          <div className="h-2 bg-gradient-to-r from-indigo-500 to-indigo-300 rounded w-full" />
                          <div className="h-2 bg-gradient-to-r from-purple-500 to-purple-300 rounded w-1/2" />
                        </div>
                      </div>

                      <div className="p-4 rounded-lg border bg-card space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Users className="w-4 h-4 text-indigo-600" />
                          Cleaner Management
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Company Features List */}
            <div className="mt-8 grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: <MapPin className="w-6 h-6" />,
                  title: "Geofence Management",
                  desc: "Define multiple service areas with custom boundaries",
                  color: "from-blue-500 to-blue-600"
                },
                {
                  icon: <Users className="w-6 h-6" />,
                  title: "Cleaner Invitations",
                  desc: "Invite and manage cleaners with area assignments",
                  color: "from-indigo-500 to-indigo-600"
                },
                {
                  icon: <CreditCard className="w-6 h-6" />,
                  title: "Financial Reports",
                  desc: "Track revenue, withdrawals, and transaction history",
                  color: "from-purple-500 to-purple-600"
                },
                {
                  icon: <Shield className="w-6 h-6" />,
                  title: "Trade License Verification",
                  desc: "Secure registration with document upload",
                  color: "from-emerald-500 to-emerald-600"
                },
                {
                  icon: <Clock className="w-6 h-6" />,
                  title: "Real-Time Job Tracking",
                  desc: "Monitor active jobs and cleaner locations",
                  color: "from-teal-500 to-teal-600"
                },
                {
                  icon: <CheckCircle2 className="w-6 h-6" />,
                  title: "Photo Verification",
                  desc: "Review before/after photos for quality assurance",
                  color: "from-cyan-500 to-cyan-600"
                }
              ].map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="hover-elevate h-full">
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} text-white flex items-center justify-center mb-3 shadow-lg`}>
                        {feature.icon}
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                      <CardDescription className="text-sm">{feature.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* How It Works Section */}
        <AnimatedSection delay={0.3}>
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
                  {[
                    {
                      num: 1,
                      title: "Enter Your Phone Number",
                      desc: "Start by providing your phone number. If you've booked before, we'll auto-fill your car details to save time.",
                      color: "from-blue-500 to-indigo-600"
                    },
                    {
                      num: 2,
                      title: "Enter Car Details",
                      desc: "Provide your car plate number, type, make, and color so companies know what they're washing.",
                      color: "from-blue-500 to-indigo-600"
                    },
                    {
                      num: 3,
                      title: "Choose Location & Company",
                      desc: "Select your car's location on the map. We'll show you available companies in your area with their pricing.",
                      color: "from-blue-500 to-indigo-600"
                    },
                    {
                      num: 4,
                      title: "Pay Securely",
                      desc: "Complete payment via Stripe (card, Apple Pay, or Google Pay). Your booking is confirmed instantly.",
                      color: "from-blue-500 to-indigo-600"
                    },
                    {
                      num: "✓",
                      title: "Track Your Service",
                      desc: "A cleaner will be assigned to your job. Track the progress in real-time and receive photo proof when completed.",
                      color: "from-emerald-500 to-teal-600"
                    }
                  ].map((step, idx) => (
                    <motion.div
                      key={idx}
                      className="flex gap-4"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${step.color} text-white flex items-center justify-center font-semibold`}>
                        {step.num}
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">{step.title}</h4>
                        <p className="text-sm text-muted-foreground">{step.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* For Companies */}
              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  For Car Wash Companies
                </h3>
                <div className="grid gap-4">
                  {[
                    {
                      num: 1,
                      title: "Register Your Company",
                      desc: "Sign up with your company details and upload your trade license. Admin will review and approve your account."
                    },
                    {
                      num: 2,
                      title: "Define Service Areas",
                      desc: "Set up geofences for areas where you operate. Only customers in these areas will see your company."
                    },
                    {
                      num: 3,
                      title: "Invite Cleaners",
                      desc: "Send email invitations to your cleaners. Assign them to specific service areas or all areas."
                    },
                    {
                      num: 4,
                      title: "Receive Jobs",
                      desc: "When customers book in your service areas, your on-duty cleaners receive notifications instantly."
                    },
                    {
                      num: "💰",
                      title: "Get Paid",
                      desc: "Earnings accumulate in your account. Request withdrawals anytime, processed manually by admin."
                    }
                  ].map((step, idx) => (
                    <motion.div
                      key={idx}
                      className="flex gap-4"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: idx * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-semibold">
                        {step.num}
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">{step.title}</h4>
                        <p className="text-sm text-muted-foreground">{step.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        {/* Features */}
        <AnimatedSection delay={0.4}>
          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            {[
              {
                icon: <MapPin className="w-5 h-5" />,
                title: "Location-Based Matching",
                desc: "We use smart geofencing to match you with companies that operate in your area. No more searching through unavailable providers.",
                color: "text-blue-600"
              },
              {
                icon: <Shield className="w-5 h-5" />,
                title: "Secure Payments",
                desc: "All payments are processed securely through Stripe. Your financial information is never stored on our servers.",
                color: "text-emerald-600"
              },
              {
                icon: <Clock className="w-5 h-5" />,
                title: "Real-Time Updates",
                desc: "Track your car wash in real-time with push notifications. Know exactly when a cleaner is assigned and when the job is done.",
                color: "text-indigo-600"
              },
              {
                icon: <CheckCircle2 className="w-5 h-5" />,
                title: "Photo Verification",
                desc: "Every completed job includes before and after photos, so you have proof that your car was washed professionally.",
                color: "text-teal-600"
              }
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="hover-elevate h-full">
                  <CardHeader>
                    <CardTitle className={`text-lg flex items-center gap-2 ${feature.color}`}>
                      {feature.icon}
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>

        {/* FAQs */}
        <AnimatedSection delay={0.5}>
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
        </AnimatedSection>

        {/* Call to Action */}
        <AnimatedSection delay={0.6}>
          <motion.div
            className="mt-12 text-center p-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-2xl font-bold mb-3">Ready to get started?</h3>
            <p className="mb-6 opacity-90">Join thousands of satisfied customers and car wash companies</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="/customer/booking"
                className="inline-flex items-center justify-center h-12 px-8 font-medium rounded-lg bg-white text-blue-600 hover:bg-gray-100 transition-colors shadow-lg"
                data-testid="link-book-wash"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Book a Car Wash
                <ChevronRight className="w-4 h-4 ml-2" />
              </motion.a>
              <motion.a
                href="/company/register"
                className="inline-flex items-center justify-center h-12 px-8 font-medium rounded-lg border-2 border-white text-white hover:bg-white/10 transition-colors"
                data-testid="link-register-company"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Register as Company
                <ChevronRight className="w-4 h-4 ml-2" />
              </motion.a>
            </div>
          </motion.div>
        </AnimatedSection>
      </div>
    </div>
  );
}
