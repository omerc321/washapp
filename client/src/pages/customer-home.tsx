import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Car, Phone, Building2, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LocationPicker from "@/components/location-picker";
import logoUrl from "@assets/IMG_2508_1762619079711.png";

type GeolocationStatus = 'idle' | 'requesting' | 'success' | 'denied' | 'error';

export default function CustomerHome() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<'book' | 'track'>('book');
  const [trackingPlate, setTrackingPlate] = useState("");
  
  const [formData, setFormData] = useState({
    carPlateNumber: "",
    locationAddress: "",
    locationLatitude: 0,
    locationLongitude: 0,
    parkingNumber: "",
    customerPhone: "",
    requestedCleanerEmail: "",
  });
  
  const [showMap, setShowMap] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>('idle');
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Progressive geolocation: Show consent modal when needed
  useEffect(() => {
    if (mode === 'book' && geolocationStatus === 'idle' && !formData.locationAddress) {
      setShowLocationConsent(true);
    }
  }, [mode, geolocationStatus, formData.locationAddress]);

  // Request geolocation with consent
  const requestGeolocation = async () => {
    setShowLocationConsent(false);
    setGeolocationStatus('requesting');
    
    if (!navigator.geolocation) {
      setGeolocationStatus('error');
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support geolocation. Please select your location manually.",
        variant: "destructive",
      });
      setShowMap(true);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          // Use functional updater to prevent losing concurrent form edits
          setFormData(prev => ({
            ...prev,
            locationAddress: address,
            locationLatitude: latitude,
            locationLongitude: longitude,
          }));
          setGeolocationStatus('success');
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          // Still use coordinates even if reverse geocoding fails
          setFormData(prev => ({
            ...prev,
            locationAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            locationLatitude: latitude,
            locationLongitude: longitude,
          }));
          setGeolocationStatus('success');
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationStatus('denied');
        } else {
          setGeolocationStatus('error');
        }
        // Don't auto-show map on error, let user click "Change Location"
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

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
    setGeolocationStatus('success'); // Manual selection also counts as success
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submits
    if (isSubmitting) return;
    
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
    
    setIsSubmitting(true);
    
    try {
      // Validate cleaner email if provided
      let forcedCompanyId = null;
      let cleanerInfo = null;
      
      if (formData.requestedCleanerEmail && formData.requestedCleanerEmail.trim()) {
        try {
          const cleanerResponse = await fetch(
            `/api/cleaners/lookup?email=${encodeURIComponent(formData.requestedCleanerEmail.trim())}`
          );
          
          if (!cleanerResponse.ok) {
            if (cleanerResponse.status === 404) {
              toast({
                title: "Cleaner Not Found",
                description: "No cleaner found with this email address",
                variant: "destructive",
              });
            } else if (cleanerResponse.status === 403) {
              toast({
                title: "Cleaner Unavailable",
                description: "This cleaner is not currently available",
                variant: "destructive",
              });
            } else {
              toast({
                title: "Validation Error",
                description: "Unable to validate cleaner email",
                variant: "destructive",
              });
            }
            setIsSubmitting(false);
            return;
          }
          
          cleanerInfo = await cleanerResponse.json();
          forcedCompanyId = cleanerInfo.companyId;
          
          toast({
            title: "Cleaner Found",
            description: `Request will be sent to ${cleanerInfo.name}`,
          });
        } catch (error) {
          console.error("Cleaner lookup error:", error);
          toast({
            title: "Validation Error",
            description: "Unable to validate cleaner email. Please try again.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      
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
        companyId: forcedCompanyId || "", // Pre-set if cleaner was validated
        customerId: customer.id,
        forcedCompanyId: forcedCompanyId, // Flag to lock company selection
        requestedCleanerId: cleanerInfo?.id || null, // For direct assignment
        cleanerName: cleanerInfo?.name || null, // For display
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
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <img src={logoUrl} alt="Washapp.ae" className="h-12 w-auto" data-testid="img-logo" />
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
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-4">
        {/* Segmented Control - Modern toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-4" role="tablist">
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
          <div className="space-y-4 pb-20">
            <div>
              <Label htmlFor="trackingPlate" className="text-base font-medium mb-2 block">
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
          <form onSubmit={handleSubmit} className="space-y-4 pb-20">
            {/* Car Plate and Parking Number - Same line */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="carPlateNumber" className="text-base font-medium mb-2 block">
                  Car Plate
                </Label>
                <Input
                  id="carPlateNumber"
                  data-testid="input-plate-number"
                  placeholder="ABC-1234"
                  value={formData.carPlateNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, carPlateNumber: e.target.value.toUpperCase() })
                  }
                  required
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>
              
              <div>
                <Label htmlFor="parkingNumber" className="text-base font-medium mb-2 block">
                  Parking <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
                </Label>
                <Input
                  id="parkingNumber"
                  data-testid="input-parking"
                  placeholder="P2-45"
                  value={formData.parkingNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, parkingNumber: e.target.value })
                  }
                  className="h-12 text-lg"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="customerPhone" className="text-base font-medium mb-2 block">
                Phone Number
              </Label>
              <Input
                id="customerPhone"
                data-testid="input-phone"
                type="text"
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

            {/* Cleaner Email - Optional */}
            <div>
              <Label htmlFor="cleanerEmail" className="text-base font-medium mb-2 block">
                Cleaner Email <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
              </Label>
              <Input
                id="cleanerEmail"
                data-testid="input-cleaner-email"
                type="email"
                placeholder="Request specific cleaner"
                value={formData.requestedCleanerEmail || ""}
                onChange={(e) =>
                  setFormData({ ...formData, requestedCleanerEmail: e.target.value })
                }
                className="h-12 text-lg"
              />
              <p className="text-sm text-muted-foreground mt-2">
                If on-duty and within 50m, they'll be auto-assigned
              </p>
            </div>

            {/* Location Picker - Now at the bottom */}
            <div>
              <Label className="text-base font-medium mb-2 block">
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

      {/* Geolocation Status Banner */}
      {mode === 'book' && (geolocationStatus === 'denied' || geolocationStatus === 'error') && (
        <div className="max-w-md mx-auto w-full px-4 mb-4">
          <Alert variant="destructive" data-testid="alert-location-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {geolocationStatus === 'denied'
                  ? "Location access was denied. Please enable location or select manually."
                  : "Unable to get your location. Please select manually."}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGeolocationStatus('idle');
                  setShowLocationConsent(true);
                }}
                data-testid="button-retry-location"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

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
              disabled={geolocationStatus === 'requesting' || isSubmitting}
            >
              {geolocationStatus === 'requesting' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Location...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Location Consent Modal */}
      <Dialog open={showLocationConsent} onOpenChange={setShowLocationConsent}>
        <DialogContent data-testid="dialog-location-consent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              We'll use your location
            </DialogTitle>
            <DialogDescription>
              To find car wash cleaners nearby, we need to know where your car is parked. 
              You can change this location anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowLocationConsent(false);
                setShowMap(true); // Open manual map picker instead
              }}
              data-testid="button-select-manually"
            >
              Select Manually
            </Button>
            <Button
              onClick={requestGeolocation}
              data-testid="button-allow-location"
            >
              Allow Location Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
