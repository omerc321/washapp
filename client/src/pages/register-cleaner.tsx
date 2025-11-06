import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Car, CheckCircle, Phone } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegisterCleanerPage() {
  const { registerCleaner } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [step, setStep] = useState<"phone" | "register">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [validatingPhone, setValidatingPhone] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{ companyId: number; companyName: string } | null>(null);
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handlePhoneValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidatingPhone(true);
    
    try {
      const response = await apiRequest("POST", "/api/auth/validate-cleaner-phone", { phoneNumber });
      const data = await response.json();
      
      if (data.valid) {
        setCompanyInfo({
          companyId: data.companyId,
          companyName: data.companyName,
        });
        setStep("register");
        toast({
          title: "Phone Validated",
          description: `You can now register as a cleaner for ${data.companyName}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Validation Failed",
        description: error.message || "This phone number is not invited to any company",
        variant: "destructive",
      });
    } finally {
      setValidatingPhone(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await registerCleaner({
        ...formData,
        phoneNumber,
      });
      setLocation("/cleaner");
    } catch (error) {
      // Error shown by toast in auth context
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "phone") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Car className="h-8 w-8" />
              <CardTitle className="text-3xl font-bold">Register as Cleaner</CardTitle>
            </div>
            <CardDescription className="text-base">
              Enter your invited phone number
            </CardDescription>
          </CardHeader>
          <form onSubmit={handlePhoneValidation}>
            <CardContent className="space-y-4">
              <Alert>
                <Phone className="h-4 w-4" />
                <AlertDescription>
                  You need an invitation from a company to register. Please enter the phone number your company invited.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+65 1234 5678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  data-testid="input-phone"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the exact phone number your company used to invite you
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={validatingPhone || !phoneNumber}
                data-testid="button-validate-phone"
              >
                {validatingPhone ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/login")}
                data-testid="button-back-to-login"
              >
                Back to Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Car className="h-8 w-8" />
            <CardTitle className="text-3xl font-bold">Complete Registration</CardTitle>
          </div>
          <CardDescription className="text-base">
            Register for {companyInfo?.companyName}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Phone number verified: {phoneNumber}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                data-testid="input-password"
              />
              <p className="text-sm text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitting}
              data-testid="button-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Complete Registration"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setStep("phone")}
              data-testid="button-back"
            >
              Change Phone Number
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
