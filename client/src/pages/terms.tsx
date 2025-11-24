import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-muted-foreground">Last Updated: November 23, 2025</p>
        </div>

        {/* Important Notice */}
        <Alert className="mb-8 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          <AlertDescription className="text-amber-900 dark:text-amber-200">
            <strong>Important:</strong> Washapp.ae is a marketplace platform that connects customers with independent car wash companies. We do not provide car washing services directly and take no responsibility for damages, quality issues, or service delivery.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* 1. Acceptance of Terms */}
          <Card>
            <CardHeader>
              <CardTitle>1. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                By accessing or using Washapp.ae ("the Platform", "we", "us", or "our"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the Platform.
              </p>
              <p>
                These terms apply to all users including customers requesting car wash services, car wash companies, cleaners, and platform administrators.
              </p>
            </CardContent>
          </Card>

          {/* 2. Platform Role */}
          <Card>
            <CardHeader>
              <CardTitle>2. Platform Role and Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>2.1 Marketplace Service:</strong> Washapp.ae operates solely as a marketplace platform that facilitates connections between customers ("Car Wash Requesters") and registered car washing companies ("Service Providers"). We are a technology intermediary and not a car wash service provider.
              </p>
              <p>
                <strong>2.2 No Direct Service:</strong> We do not employ cleaners, own car wash equipment, or provide car washing services. All services are performed by independent third-party companies and their employees.
              </p>
              <p>
                <strong>2.3 No Liability for Services:</strong> Washapp.ae expressly disclaims all responsibility and liability for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Quality, timeliness, or completion of car wash services</li>
                <li>Damages to vehicles, property, or personal items during or after service</li>
                <li>Actions, omissions, or negligence of service providers or their employees</li>
                <li>Loss, theft, or damage of vehicles or belongings</li>
                <li>Injuries or accidents occurring during service delivery</li>
                <li>Disputes between customers and service providers</li>
              </ul>
              <p>
                <strong>2.4 Platform Functions:</strong> Our role is limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Providing a booking and payment interface</li>
                <li>Facilitating communication between parties</li>
                <li>Processing payments and managing financial transactions</li>
                <li>Maintaining user accounts and service area information</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. User Responsibilities */}
          <Card>
            <CardHeader>
              <CardTitle>3. User Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>3.1 Customers:</strong> By booking a car wash, you acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are entering into a direct service agreement with the car wash company, not Washapp.ae</li>
                <li>You are responsible for removing valuables from your vehicle before service</li>
                <li>You accept all risks associated with the service</li>
                <li>You will resolve disputes directly with the service provider</li>
                <li>The location and car details you provide are accurate</li>
              </ul>
              <p>
                <strong>3.2 Service Providers:</strong> By registering as a company, you acknowledge that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are an independent business and not an employee or agent of Washapp.ae</li>
                <li>You maintain all necessary licenses, insurance, and permits to operate</li>
                <li>You are solely responsible for service quality and customer satisfaction</li>
                <li>You will handle customer complaints, disputes, and refunds independently</li>
                <li>You carry appropriate liability insurance for damages or injuries</li>
              </ul>
            </CardContent>
          </Card>

          {/* 4. Payments and Fees */}
          <Card>
            <CardHeader>
              <CardTitle>4. Payments and Fees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>4.1 Customer Payments:</strong> All payments are processed through Stripe. The total amount includes the car wash company's service price, platform fee, and applicable VAT. Payments are non-refundable except as specified in Section 5.
              </p>
              <p>
                <strong>4.2 Platform Fees:</strong> We charge service providers a platform fee based on their selected package (Custom, Package 1, or Package 2). Fee structures are determined during registration and may be updated by platform administrators.
              </p>
              <p>
                <strong>4.3 Withdrawals:</strong> Service providers may request withdrawals subject to minimum balance requirements. Withdrawals are processed manually by administrators within 2-3 business days.
              </p>
            </CardContent>
          </Card>

          {/* 5. Cancellations and Refunds */}
          <Card>
            <CardHeader>
              <CardTitle>5. Cancellations and Refunds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>5.1 Auto-Refund:</strong> If no cleaner accepts a job within 15 minutes of payment, the booking is automatically cancelled and a full refund is issued.
              </p>
              <p>
                <strong>5.2 Post-Acceptance:</strong> Once a cleaner accepts a job, cancellations and refunds are at the sole discretion of the service provider. Washapp.ae does not mediate or process refund requests after job acceptance.
              </p>
              <p>
                <strong>5.3 Disputes:</strong> All service-related disputes must be resolved directly between the customer and service provider. We do not arbitrate disputes or force refunds.
              </p>
            </CardContent>
          </Card>

          {/* 6. Limitation of Liability */}
          <Card>
            <CardHeader>
              <CardTitle>6. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>6.1 Maximum Liability:</strong> To the fullest extent permitted by law, Washapp.ae's total liability for any claims arising from use of the Platform shall not exceed the amount of platform fees collected from the relevant transaction.
              </p>
              <p>
                <strong>6.2 No Consequential Damages:</strong> We shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, goodwill, or other intangible losses.
              </p>
              <p>
                <strong>6.3 Service Provider Actions:</strong> We are not liable for the acts, errors, omissions, representations, warranties, breaches, or negligence of any service provider or for any personal injuries, death, property damage, or other damages resulting from their services.
              </p>
            </CardContent>
          </Card>

          {/* 7. Indemnification */}
          <Card>
            <CardHeader>
              <CardTitle>7. Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                You agree to indemnify, defend, and hold harmless Washapp.ae, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including legal fees) arising from:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your use of the Platform</li>
                <li>Your violation of these Terms</li>
                <li>Services provided by or to you through the Platform</li>
                <li>Any damage or injury resulting from car wash services</li>
              </ul>
            </CardContent>
          </Card>

          {/* 8. Account and Data */}
          <Card>
            <CardHeader>
              <CardTitle>8. Account and Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                <strong>8.1 Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
              </p>
              <p>
                <strong>8.2 Accurate Information:</strong> You agree to provide accurate, current, and complete information during registration and booking.
              </p>
              <p>
                <strong>8.3 Data Usage:</strong> By using the Platform, you consent to the collection and use of your data as described in our Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* 9. Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>9. Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                All content, features, and functionality on the Platform, including but not limited to text, graphics, logos, and software, are owned by Washapp.ae and protected by copyright, trademark, and other intellectual property laws.
              </p>
            </CardContent>
          </Card>

          {/* 10. Termination */}
          <Card>
            <CardHeader>
              <CardTitle>10. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We reserve the right to suspend or terminate your access to the Platform at any time, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
              </p>
            </CardContent>
          </Card>

          {/* 11. Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle>11. Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the United Arab Emirates. Any disputes arising from these Terms or use of the Platform shall be subject to the exclusive jurisdiction of the courts of the UAE.
              </p>
            </CardContent>
          </Card>

          {/* 12. Changes to Terms */}
          <Card>
            <CardHeader>
              <CardTitle>12. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the Platform. Your continued use of the Platform after changes constitutes acceptance of the modified Terms.
              </p>
            </CardContent>
          </Card>

          {/* 13. Contact */}
          <Card>
            <CardHeader>
              <CardTitle>13. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                If you have questions about these Terms, please contact us through the Platform's support channels or email us at the contact information provided on our website.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            By using Washapp.ae, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
