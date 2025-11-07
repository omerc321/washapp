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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Clean and minimal */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">CarWash Pro</h1>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/login")}
              data-testid="button-staff-login"
              className="text-muted-foreground"
            >
              Staff Login
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        {/* Segmented Control - Modern toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'book'}
            onClick={() => setMode('book')}
            data-testid="button-book-mode"
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'book'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Book Wash
          </button>
          <button
            role="tab"
            aria-selected={mode === 'track'}
            onClick={() => setMode('track')}
            data-testid="button-track-mode"
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'track'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Track Wash
          </button>
        </div>

        {mode === 'track' ? (
          /* Tracking Form - Clean and simple */
          <div className="space-y-8 pb-24">
            <div>
              <Label htmlFor="trackingPlate" className="text-base font-medium mb-3 block">
                Car Plate Number
              </Label>
              <Input
                id="trackingPlate"
                data-testid="input-tracking-plate"
                placeholder="Enter your car plate number"
                value={trackingPlate}
                onChange={(e) => setTrackingPlate(e.target.value.toUpperCase())}
                className="h-12 text-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                autoFocus
              />
            </div>
          </div>
        ) : (
          /* Booking Form - All inputs first, map last */
          <form onSubmit={handleSubmit} className="space-y-6 pb-24">
            {/* Car Plate Number */}
            <div>
              <Label htmlFor="carPlateNumber" className="text-base font-medium mb-3 block">
                Car Plate Number
              </Label>
              <Input
                id="carPlateNumber"
                data-testid="input-plate-number"
                placeholder="Enter your car plate number"
                value={formData.carPlateNumber}
                onChange={(e) =>
                  setFormData({ ...formData, carPlateNumber: e.target.value.toUpperCase() })
                }
                required
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="customerPhone" className="text-base font-medium mb-3 block">
                Phone Number
              </Label>
              <Input
                id="customerPhone"
                data-testid="input-phone"
                type="tel"
                placeholder="Your contact number"
                value={formData.customerPhone}
                onChange={(e) =>
                  setFormData({ ...formData, customerPhone: e.target.value })
                }
                required
                className="h-12 text-lg"
              />
              <p className="text-sm text-muted-foreground mt-2">
                We'll share this with your cleaner
              </p>
            </div>

            {/* Parking Number (Optional) */}
            <div>
              <Label htmlFor="parkingNumber" className="text-base font-medium mb-3 block">
                Parking Number <span className="text-muted-foreground text-sm font-normal">(Optional)</span>
              </Label>
              <Input
                id="parkingNumber"
                data-testid="input-parking"
                placeholder="e.g. P2-45"
                value={formData.parkingNumber}
                onChange={(e) =>
                  setFormData({ ...formData, parkingNumber: e.target.value })
                }
                className="h-12 text-lg"
              />
            </div>

            {/* Location Picker - Now at the bottom */}
            <div>
              <Label className="text-base font-medium mb-3 block">
                Car Location
              </Label>
              {!showMap && formData.locationAddress ? (
                <div className="border rounded-lg p-4 bg-card">
                  <p className="text-sm mb-3" data-testid="text-selected-location">
                    {formData.locationAddress}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMap(true)}
                    data-testid="button-change-location"
                    className="h-9"
                  >
                    Change Location
                  </Button>
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
            </div>
          </form>
        )}
      </div>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
        <div className="max-w-md mx-auto">
          {mode === 'track' ? (
            <Button
              type="button"
              className="w-full h-12 text-base"
              onClick={handleTrack}
              data-testid="button-track"
            >
              Track My Wash
            </Button>
          ) : (
            <Button
              type="submit"
              className="w-full h-12 text-base"
              onClick={handleSubmit}
              data-testid="button-continue"
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
