import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Car, Phone, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import LocationPicker from "@/components/location-picker";

export default function CustomerHome() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    carPlateNumber: "",
    locationAddress: "",
    locationLatitude: 0,
    locationLongitude: 0,
    parkingNumber: "",
    customerPhone: "",
  });
  
  const [showMap, setShowMap] = useState(false);

  const handleLocationSelect = (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    setFormData({
      ...formData,
      locationAddress: location.address,
      locationLatitude: location.latitude,
      locationLongitude: location.longitude,
    });
    setShowMap(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.locationAddress || formData.locationLatitude === 0) {
      toast({
        title: "Location Required",
        description: "Please select your location on the map",
        variant: "destructive",
      });
      setShowMap(true);
      return;
    }
    
    if (!formData.customerPhone) {
      toast({
        title: "Phone Required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Create or get customer profile
      const customerResponse = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: formData.customerPhone }),
      });
      
      if (!customerResponse.ok) {
        throw new Error("Failed to create customer profile");
      }
      
      const customer = await customerResponse.json();
      
      const jobData = {
        ...formData,
        companyId: "", // Will be selected in next step
        customerId: customer.id,
      };
      
      // Store in session for next step
      sessionStorage.setItem("pendingJob", JSON.stringify(jobData));
      setLocation("/customer/select-company");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const [mode, setMode] = useState<'book' | 'track'>('book');
  const [trackingPlate, setTrackingPlate] = useState("");

  const handleTrack = () => {
    if (!trackingPlate.trim()) {
      toast({
        title: "Plate Number Required",
        description: "Please enter your car plate number",
        variant: "destructive",
      });
      return;
    }
    setLocation(`/customer/track/${trackingPlate.toUpperCase()}`);
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
          
          {/* Mode Selector */}
          <div className="flex gap-2 mb-4">
            <Button 
              variant={mode === 'book' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('book')}
              data-testid="button-book-mode"
            >
              Book New Wash
            </Button>
            <Button 
              variant={mode === 'track' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMode('track')}
              data-testid="button-track-mode"
            >
              Track Your Wash
            </Button>
          </div>
          
          <h2 className="text-xl font-semibold text-foreground mb-1">
            {mode === 'book' ? 'Request Car Wash' : 'Track Your Wash'}
          </h2>
          <p className="text-muted-foreground">
            {mode === 'book' ? 'Fill in your details to get started' : 'Enter your car plate number to track status'}
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-6">
          {mode === 'track' ? (
            /* Tracking Form */
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="trackingPlate" className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Car Plate Number
                </Label>
                <Input
                  id="trackingPlate"
                  data-testid="input-tracking-plate"
                  placeholder="e.g. ABC 1234"
                  value={trackingPlate}
                  onChange={(e) => setTrackingPlate(e.target.value.toUpperCase())}
                  className="text-base"
                  onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                />
              </div>
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleTrack}
                data-testid="button-track"
              >
                Track My Wash
              </Button>
            </div>
          ) : (
            /* Booking Form */
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

            {/* Location Picker */}
            {!showMap && formData.locationAddress ? (
              <div className="space-y-2">
                <Label>Selected Location</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm" data-testid="text-selected-location">
                    {formData.locationAddress}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowMap(true)}
                    data-testid="button-change-location"
                  >
                    Change Location
                  </Button>
                </div>
              </div>
            ) : (
              <LocationPicker
                onLocationSelect={handleLocationSelect}
                initialPosition={
                  formData.locationLatitude !== 0
                    ? [formData.locationLatitude, formData.locationLongitude]
                    : undefined
                }
              />
            )}

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
          )}
        </Card>
      </div>
    </div>
  );
}
