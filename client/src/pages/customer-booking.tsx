import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Car, Phone, MapPin, CreditCard, Building2, ChevronLeft, Loader2, Check, LogIn, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import LocationPicker from "@/components/location-picker";
import ProgressIndicator from "@/components/progress-indicator";
import logoUrl from "@assets/IMG_2508_1762619079711.png";
import type { CompanyWithCleaners } from "@shared/schema";

const STEPS = ["Car Details", "Location & Company", "Payment"];

export default function CustomerBooking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Car Details
  const [formData, setFormData] = useState({
    carPlateNumber: "",
    parkingNumber: "",
    customerPhone: "",
    requestedCleanerEmail: "",
  });
  
  // Step 2: Location & Company
  const [locationData, setLocationData] = useState({
    address: "",
    latitude: 0,
    longitude: 0,
  });
  const [showMap, setShowMap] = useState(false);
  const [companies, setCompanies] = useState<CompanyWithCleaners[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithCleaners | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigatingToPayment, setIsNavigatingToPayment] = useState(false);

  // Auto-load map on step 2
  useEffect(() => {
    if (currentStep === 2 && !locationData.address) {
      setShowMap(true);
    }
  }, [currentStep]);

  // Fetch companies when location is selected
  useEffect(() => {
    if (currentStep === 2 && locationData.latitude !== 0) {
      fetchCompanies();
    }
  }, [locationData, currentStep]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const params = new URLSearchParams({
        lat: locationData.latitude.toString(),
        lon: locationData.longitude.toString(),
      });
      const res = await fetch(`/api/companies/nearby?${params}`);
      if (!res.ok) throw new Error("Failed to fetch companies");
      const data = await res.json();
      setCompanies(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load nearby companies",
        variant: "destructive",
      });
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleStep1Submit = () => {
    if (!formData.carPlateNumber) {
      toast({
        title: "Car Plate Required",
        description: "Please enter your car plate number",
        variant: "destructive",
      });
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
    setCurrentStep(2);
  };

  const handleStep2Submit = async () => {
    if (!locationData.address) {
      toast({
        title: "Location Required",
        description: "Please select your car's location",
        variant: "destructive",
      });
      setShowMap(true);
      return;
    }
    
    if (!selectedCompany) {
      toast({
        title: "Company Required",
        description: "Please select a car wash company",
        variant: "destructive",
      });
      return;
    }
    
    setIsNavigatingToPayment(true);
    
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
      
      // Prepare job data for checkout page
      const jobData = {
        ...formData,
        locationAddress: locationData.address,
        locationLatitude: locationData.latitude,
        locationLongitude: locationData.longitude,
        companyId: selectedCompany.id.toString(),
        customerId: customer.id.toString(),
        price: Number(selectedCompany.pricePerWash),
        tipAmount: 0,
      };
      
      // Store in sessionStorage for checkout page
      sessionStorage.setItem("pendingJob", JSON.stringify(jobData));
      
      // Show Step 3 transition before navigating to checkout
      setCurrentStep(3);
      
      // Navigate to checkout after brief animation
      setTimeout(() => {
        setLocation("/customer/checkout");
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsNavigatingToPayment(false);
    }
  };

  const handleLocationSelect = (location: { address: string; latitude: number; longitude: number }) => {
    setLocationData(location);
    setShowMap(false);
    setSelectedCompany(null); // Reset company selection when location changes
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/customer");
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-card/80 backdrop-blur-lg border-b sticky top-0 z-50"
      >
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              data-testid="button-back"
              className="hover-elevate active-elevate-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <img src={logoUrl} alt="Washapp.ae" className="h-10 w-auto" data-testid="img-logo" />
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="hover-elevate active-elevate-2"
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Track Your Wash Section */}
      {currentStep === 1 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-md mx-auto w-full px-4 pt-4"
        >
          <Card className="border-primary/20 hover-elevate">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 1
                    }}
                    className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30"
                  >
                    <Search className="h-6 w-6 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-lg">Track Your Wash</h3>
                    <p className="text-sm text-muted-foreground">Already booked? Track your service</p>
                  </div>
                </div>
                <Link href="/customer/track">
                  <Button
                    variant="default"
                    className="bg-primary"
                    data-testid="button-track-wash"
                  >
                    Track
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Progress Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <ProgressIndicator currentStep={currentStep} totalSteps={3} steps={STEPS} />
      </motion.div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 pb-24">
        <AnimatePresence mode="wait" custom={currentStep}>
          {currentStep === 1 && (
            <Step1CarDetails
              key="step1"
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleStep1Submit}
            />
          )}
          
          {currentStep === 2 && (
            <Step2LocationCompany
              key="step2"
              locationData={locationData}
              showMap={showMap}
              setShowMap={setShowMap}
              onLocationSelect={handleLocationSelect}
              companies={companies}
              selectedCompany={selectedCompany}
              setSelectedCompany={setSelectedCompany}
              loadingCompanies={loadingCompanies}
              onSubmit={handleStep2Submit}
              isSubmitting={isSubmitting}
            />
          )}
          
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 space-y-6"
              data-testid="step-3-loading"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30"
              >
                <Check className="w-10 h-10 text-white" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center space-y-2"
              >
                <h2 className="text-2xl font-bold">All Set!</h2>
                <p className="text-muted-foreground">Redirecting to payment...</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex gap-1"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-2 h-2 rounded-full bg-primary"
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom CTA - Only for steps 1 and 2 */}
      {currentStep < 3 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t p-4 z-40"
        >
          <div className="max-w-md mx-auto">
            <Button
              type="button"
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              onClick={currentStep === 1 ? handleStep1Submit : handleStep2Submit}
              disabled={isSubmitting || isNavigatingToPayment}
              data-testid="button-continue"
            >
              {isSubmitting || isNavigatingToPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isNavigatingToPayment ? "Proceeding to payment..." : "Processing..."}
                </>
              ) : (
                <>
                  Continue
                  <ChevronLeft className="ml-2 h-4 w-4 rotate-180" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Step 1: Car Details Component
function Step1CarDetails({
  formData,
  setFormData,
  onSubmit,
}: {
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pt-4"
    >
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30"
        >
          <Car className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold">Car Details</h2>
        <p className="text-muted-foreground">Tell us about your vehicle</p>
      </div>

      <Card className="p-6 space-y-5 border-2 hover-elevate">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="carPlateNumber" className="text-base font-medium mb-2 block">
              Car Plate *
            </Label>
            <Input
              id="carPlateNumber"
              data-testid="input-plate-number"
              placeholder="ABC-1234"
              value={formData.carPlateNumber}
              onChange={(e) => setFormData({ ...formData, carPlateNumber: e.target.value.toUpperCase() })}
              required
              className="h-12 text-lg"
              autoFocus
            />
          </div>
          
          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="parkingNumber" className="text-base font-medium mb-2 block">
              Parking <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
            </Label>
            <Input
              id="parkingNumber"
              data-testid="input-parking"
              placeholder="P2-45"
              value={formData.parkingNumber}
              onChange={(e) => setFormData({ ...formData, parkingNumber: e.target.value })}
              className="h-12 text-lg"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="customerPhone" className="text-base font-medium mb-2 block">
            Phone Number *
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="customerPhone"
              data-testid="input-phone"
              type="tel"
              placeholder="Your contact number"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              required
              className="h-12 text-lg pl-11"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            We'll share this with your cleaner
          </p>
        </div>

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
            onChange={(e) => setFormData({ ...formData, requestedCleanerEmail: e.target.value })}
            className="h-12 text-lg"
          />
          <p className="text-sm text-muted-foreground mt-2">
            If on-duty and within 50m, they'll be auto-assigned
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

// Step 2: Location & Company Component
function Step2LocationCompany({
  locationData,
  showMap,
  setShowMap,
  onLocationSelect,
  companies,
  selectedCompany,
  setSelectedCompany,
  loadingCompanies,
  onSubmit,
  isSubmitting,
}: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pt-4"
    >
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 mx-auto flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30"
        >
          <MapPin className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold">Location & Company</h2>
        <p className="text-muted-foreground">Where is your car parked?</p>
      </div>

      <Card className="p-6 space-y-5 border-2 hover-elevate">
        <div>
          <Label className="text-base font-medium mb-2 block">
            Car Location *
          </Label>
          {!showMap && locationData.address ? (
            <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
              <p className="text-sm mb-3 flex items-start gap-2" data-testid="text-selected-location">
                <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                <span>{locationData.address}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowMap(true)}
                data-testid="button-change-location"
                className="hover-elevate"
              >
                Change Location
              </Button>
            </div>
          ) : (
            <LocationPicker
              onLocationSelect={onLocationSelect}
              initialPosition={
                locationData.latitude !== 0
                  ? [locationData.latitude, locationData.longitude]
                  : undefined
              }
            />
          )}
        </div>

        {locationData.address && !showMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-3 overflow-hidden"
          >
            <Label className="text-base font-medium block">
              Select Company *
            </Label>
            
            {loadingCompanies ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : companies.length === 0 ? (
              <Card className="p-6 text-center border-dashed">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No companies available in this area</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {companies.map((company: CompanyWithCleaners) => (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`p-4 cursor-pointer transition-all border-2 ${
                        selectedCompany?.id === company.id
                          ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedCompany(company)}
                      data-testid={`company-card-${company.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{company.name}</h3>
                            {selectedCompany?.id === company.id && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                              >
                                <Check className="w-4 h-4 text-primary-foreground" />
                              </motion.div>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {company.onDutyCleanersCount || 0} cleaner{company.onDutyCleanersCount !== 1 ? 's' : ''} on duty
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {company.pricePerWash} AED
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}
