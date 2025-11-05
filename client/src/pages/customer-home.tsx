import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Car, Phone, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createJobSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function CustomerHome() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    carPlateNumber: "",
    locationAddress: "",
    parkingNumber: "",
    customerPhone: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    try {
      // For now, use hardcoded coordinates (will be replaced with actual geocoding)
      const jobData = {
        ...formData,
        locationLatitude: 1.3521, // Singapore coordinates as example
        locationLongitude: 103.8198,
        companyId: "", // Will be selected in next step
        customerId: currentUser?.id || "temp-customer",
      };
      
      // Store in session for next step
      sessionStorage.setItem("pendingJob", JSON.stringify(jobData));
      setLocation("/customer/select-company");
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-md mx-auto">
        {/* Header with Login CTA */}
        <div className="mb-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Car className="h-8 w-8" />
              <h1 className="text-2xl font-bold text-foreground">CarWash Pro</h1>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation("/login")}
              data-testid="button-staff-login"
            >
              Staff Login
            </Button>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Request Car Wash
          </h2>
          <p className="text-muted-foreground">
            Fill in your details to get started
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Car Plate Number */}
            <div className="space-y-2">
              <Label htmlFor="carPlateNumber" className="flex items-center gap-2">
                <Car className="h-4 w-4" />
                Car Plate Number
              </Label>
              <Input
                id="carPlateNumber"
                data-testid="input-plate-number"
                placeholder="e.g. ABC 1234"
                value={formData.carPlateNumber}
                onChange={(e) =>
                  setFormData({ ...formData, carPlateNumber: e.target.value.toUpperCase() })
                }
                required
                className="text-base"
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="locationAddress" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location Address
              </Label>
              <Textarea
                id="locationAddress"
                data-testid="input-location"
                placeholder="Enter your current location or mall name"
                value={formData.locationAddress}
                onChange={(e) =>
                  setFormData({ ...formData, locationAddress: e.target.value })
                }
                required
                rows={2}
                className="text-base resize-none"
              />
            </div>

            {/* Parking Number (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="parkingNumber" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Parking Number <span className="text-muted-foreground text-sm">(Optional)</span>
              </Label>
              <Input
                id="parkingNumber"
                data-testid="input-parking"
                placeholder="e.g. P2-45"
                value={formData.parkingNumber}
                onChange={(e) =>
                  setFormData({ ...formData, parkingNumber: e.target.value })
                }
                className="text-base"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="customerPhone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Your Phone Number
              </Label>
              <Input
                id="customerPhone"
                data-testid="input-phone"
                type="tel"
                placeholder="e.g. +1234567890"
                value={formData.customerPhone}
                onChange={(e) =>
                  setFormData({ ...formData, customerPhone: e.target.value })
                }
                required
                className="text-base"
              />
              <p className="text-sm text-muted-foreground">
                The cleaner may contact you if needed
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              data-testid="button-continue"
            >
              Continue to Select Company
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
