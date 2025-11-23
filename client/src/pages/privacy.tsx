import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: November 23, 2025</p>
        </div>

        {/* Important Notice */}
        <Alert className="mb-8 border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-500" />
          <AlertDescription className="text-blue-900 dark:text-blue-200">
            <strong>Important:</strong> Car wash booking data is publicly searchable by phone number and car plate number. This data is not considered confidential and is necessary for our service to function. By using CarWash Pro, you consent to this data being accessible to authorized users.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* 1. Introduction */}
          <Card>
            <CardHeader>
              <CardTitle>1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                CarWash Pro ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our car wash booking platform.
              </p>
              <p>
                Please read this Privacy Policy carefully. By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* 2. Information We Collect */}
          <Card>
            <CardHeader>
              <CardTitle>2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>2.1 Customer Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Phone Number:</strong> Used for booking identification and communication</li>
                <li><strong>Car Details:</strong> Plate number, car type, make, and color</li>
                <li><strong>Location Data:</strong> Geographic coordinates of service delivery location</li>
                <li><strong>Payment Information:</strong> Processed securely through Stripe (we do not store card details)</li>
                <li><strong>Device Information:</strong> Browser type, IP address, and device identifiers</li>
                <li><strong>Push Notification Tokens:</strong> If you enable notifications</li>
              </ul>
              <p>
                <strong>2.2 Company Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Company name, email, phone, and address</li>
                <li>Trade license documents</li>
                <li>Service area (geofence) boundaries</li>
                <li>Pricing and fee structure</li>
                <li>Financial transaction history</li>
              </ul>
              <p>
                <strong>2.3 Cleaner Information:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Name, email, and phone number</li>
                <li>Company association and service area assignments</li>
                <li>Location data when on duty</li>
                <li>Job completion photos</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. Public Data Disclosure */}
          <Card>
            <CardHeader>
              <CardTitle>3. Public Data and Searchability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>3.1 Non-Confidential Data:</strong> The following information is NOT considered confidential and may be accessed by authorized users of the Platform:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Phone numbers used for bookings</li>
                <li>Car plate numbers</li>
                <li>Car type, make, and color</li>
                <li>Job status and history</li>
                <li>Service locations (approximate area, not exact coordinates)</li>
              </ul>
              <p>
                <strong>3.2 Search Functionality:</strong> Any user can search for car wash bookings using:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Phone number - Returns all bookings associated with that phone number</li>
                <li>Car plate number - Returns all bookings for that vehicle</li>
              </ul>
              <p>
                <strong>3.3 Purpose of Public Access:</strong> This searchability is essential for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Allowing customers to track their bookings without creating accounts</li>
                <li>Enabling auto-fill of car details for repeat customers</li>
                <li>Facilitating service delivery by companies and cleaners</li>
                <li>Providing transparency in service history</li>
              </ul>
              <p>
                <strong>3.4 Your Consent:</strong> By using CarWash Pro, you explicitly consent to your car wash booking data being searchable and accessible as described above. If you do not agree with this policy, please do not use the Platform.
              </p>
            </CardContent>
          </Card>

          {/* 4. How We Use Your Information */}
          <Card>
            <CardHeader>
              <CardTitle>4. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>We use the collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Facilitate car wash bookings and service delivery</li>
                <li>Process payments and manage financial transactions</li>
                <li>Match customers with car wash companies based on location</li>
                <li>Send notifications about job status updates</li>
                <li>Enable search and tracking of bookings</li>
                <li>Auto-fill booking forms for repeat customers</li>
                <li>Verify company credentials and approve registrations</li>
                <li>Generate analytics and usage reports</li>
                <li>Improve platform functionality and user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          {/* 5. Data Sharing */}
          <Card>
            <CardHeader>
              <CardTitle>5. Data Sharing and Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>5.1 Service Providers:</strong> We share data with third-party service providers:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Stripe:</strong> For payment processing</li>
                <li><strong>Resend:</strong> For email notifications</li>
                <li><strong>Web Push Services:</strong> For push notifications</li>
              </ul>
              <p>
                <strong>5.2 Car Wash Companies:</strong> When you book a service, we share your phone number, car details, and location with the selected company and assigned cleaner to enable service delivery.
              </p>
              <p>
                <strong>5.3 Legal Requirements:</strong> We may disclose your information if required by law or in response to valid requests by public authorities.
              </p>
              <p>
                <strong>5.4 Business Transfers:</strong> If CarWash Pro is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
              </p>
            </CardContent>
          </Card>

          {/* 6. Data Retention */}
          <Card>
            <CardHeader>
              <CardTitle>6. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Booking history and transaction records may be retained indefinitely for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Financial auditing and tax compliance</li>
                <li>Dispute resolution</li>
                <li>Service history tracking</li>
                <li>Platform analytics and improvements</li>
              </ul>
            </CardContent>
          </Card>

          {/* 7. Data Security */}
          <Card>
            <CardHeader>
              <CardTitle>7. Data Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We implement reasonable security measures to protect your information from unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encrypted connections (HTTPS/SSL)</li>
                <li>Secure session management</li>
                <li>Password hashing with bcrypt</li>
                <li>Regular security updates and monitoring</li>
              </ul>
              <p>
                However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          {/* 8. Your Rights */}
          <Card>
            <CardHeader>
              <CardTitle>8. Your Rights and Choices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>8.1 Access and Correction:</strong> You may access and update your account information through your profile settings.
              </p>
              <p>
                <strong>8.2 Data Deletion:</strong> Due to the public nature of booking data and legal retention requirements, we cannot delete all your data upon request. However, you may request deletion of your account and personal details by contacting us.
              </p>
              <p>
                <strong>8.3 Push Notifications:</strong> You can disable push notifications at any time through your browser settings.
              </p>
              <p>
                <strong>8.4 Marketing Communications:</strong> You can opt out of promotional emails by clicking the unsubscribe link in any marketing email.
              </p>
            </CardContent>
          </Card>

          {/* 9. Cookies and Tracking */}
          <Card>
            <CardHeader>
              <CardTitle>9. Cookies and Tracking Technologies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain user sessions and authentication</li>
                <li>Remember user preferences (e.g., theme settings)</li>
                <li>Analyze platform usage and performance</li>
              </ul>
              <p>
                You can control cookies through your browser settings, but disabling cookies may affect platform functionality.
              </p>
            </CardContent>
          </Card>

          {/* 10. Children's Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>10. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                CarWash Pro is not intended for use by children under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </CardContent>
          </Card>

          {/* 11. International Users */}
          <Card>
            <CardHeader>
              <CardTitle>11. International Data Transfers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                CarWash Pro operates in the United Arab Emirates. If you access the Platform from outside the UAE, your information may be transferred to and processed in the UAE, which may have different data protection laws than your jurisdiction.
              </p>
            </CardContent>
          </Card>

          {/* 12. Changes to Privacy Policy */}
          <Card>
            <CardHeader>
              <CardTitle>12. Changes to This Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We may update this Privacy Policy from time to time. Changes will be effective immediately upon posting to the Platform. We will notify you of significant changes via email or prominent notice on the Platform. Your continued use after changes constitutes acceptance of the updated Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* 13. Contact Us */}
          <Card>
            <CardHeader>
              <CardTitle>13. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                If you have questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us through the Platform's support channels or at the contact information provided on our website.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            By using CarWash Pro, you acknowledge that you have read and understood this Privacy Policy, including the public nature of booking data.
          </p>
        </div>
      </div>
    </div>
  );
}
