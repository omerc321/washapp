import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import logoUrl from "@assets/IMG_2508_1762619079711.png";

export default function RegisterCompanyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { registerCompany } = useAuth();
  const [formData, setFormData] = useState({
    // Admin details
    email: "",
    password: "",
    displayName: "",
    phoneNumber: "",
    // Company details
    companyName: "",
    companyDescription: "",
    pricePerWash: "",
    tradeLicenseNumber: "",
  });
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      let tradeLicenseDocumentURL: string | undefined;
      
      // Upload license document if provided
      if (licenseFile) {
        const uploadData = new FormData();
        uploadData.append("tradeLicense", licenseFile);
        
        const uploadResponse = await fetch("/api/upload/trade-license", {
          method: "POST",
          body: uploadData,
        });
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          tradeLicenseDocumentURL = uploadResult.url;
        }
      }
      
      // Register company and admin user
      await registerCompany({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        phoneNumber: formData.phoneNumber || undefined,
        companyName: formData.companyName,
        companyDescription: formData.companyDescription || undefined,
        pricePerWash: formData.pricePerWash,
        tradeLicenseNumber: formData.tradeLicenseNumber || undefined,
        tradeLicenseDocumentURL,
      });
      
      setLocation("/company");
    } catch (error: any) {
      // Error is already shown by auth context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center mb-4">
            <img src={logoUrl} alt="Washapp.ae" className="h-24 w-auto" data-testid="img-logo" />
          </div>
          <CardTitle className="text-xl font-bold">Register Company</CardTitle>
          <CardDescription className="text-base">
            Create a car wash company account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-3">Company Details</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="ABC Car Wash"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    data-testid="input-company-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyDescription">Description</Label>
                  <Textarea
                    id="companyDescription"
                    placeholder="Professional car wash services..."
                    value={formData.companyDescription}
                    onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
                    rows={3}
                    data-testid="input-company-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricePerWash">Price per Wash ($)</Label>
                  <Input
                    id="pricePerWash"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="25.00"
                    value={formData.pricePerWash}
                    onChange={(e) => setFormData({ ...formData, pricePerWash: e.target.value })}
                    required
                    data-testid="input-price"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tradeLicenseNumber">Trade License Number</Label>
                  <Input
                    id="tradeLicenseNumber"
                    placeholder="ABC-12345-2024"
                    value={formData.tradeLicenseNumber}
                    onChange={(e) => setFormData({ ...formData, tradeLicenseNumber: e.target.value })}
                    data-testid="input-trade-license"
                  />
                  <p className="text-xs text-muted-foreground">Optional: Your business trade license number</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenseDocument">Trade License Document</Label>
                  <Input
                    id="licenseDocument"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                    data-testid="input-license-document"
                  />
                  <p className="text-xs text-muted-foreground">Optional: Upload your trade license (PDF, JPG, or PNG)</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Admin Account</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Your Name</Label>
                  <Input
                    id="displayName"
                    placeholder="John Doe"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    required
                    data-testid="input-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+6512345678 (E.164 format)"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    data-testid="input-phone"
                  />
                  <p className="text-xs text-muted-foreground">Use E.164 format: +[country code][number] (e.g., +6512345678)</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    data-testid="input-password"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting}
              data-testid="button-register"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Company...
                </>
              ) : (
                "Register Company"
              )}
            </Button>
            
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Button
                type="button"
                variant="ghost"
                className="p-0 h-auto"
                onClick={() => setLocation("/login")}
                data-testid="link-login"
              >
                Sign In
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
