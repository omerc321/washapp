import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Car } from "lucide-react";

export default function RegisterCompanyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn } = useAuth();
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
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Register will be called with companyId after company creation
      // So we'll do this manually here in the correct order
      
      const response = await fetch('/api/company/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // User data
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          phoneNumber: formData.phoneNumber,
          // Company data
          companyName: formData.companyName,
          companyDescription: formData.companyDescription,
          pricePerWash: parseFloat(formData.pricePerWash),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create company");
      }

      // Now sign in with the created credentials
      await signIn(formData.email, formData.password);
      // Redirect to company dashboard
      setLocation("/company");
    } catch (error: any) {
      toast({
        title: "Registration Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Car className="h-8 w-8" />
            <CardTitle className="text-3xl font-bold">Register Company</CardTitle>
          </div>
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
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+65 1234 5678"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    required
                    data-testid="input-phone"
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
