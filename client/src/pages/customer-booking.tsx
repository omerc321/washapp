import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Phone, MapPin, CreditCard, Building2, ChevronLeft, Loader2, Check, LogIn, Search, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import LocationPicker from "@/components/location-picker";
import ProgressIndicator from "@/components/progress-indicator";
import logoUrl from "@assets/IMG_2508_1762619079711.png";
import type { CompanyWithCleaners } from "@shared/schema";
import { calculateFees, type FeePackageType } from "@shared/fee-calculator";

const STEPS = ["Email Verification", "Car Details", "Location & Company", "Payment"];

interface PreviousCar {
  carPlateEmirate: string;
  carPlateCode: string;
  carPlateNumber: string;
  customerEmail: string;
  parkingNumber: string;
  lastUsed: string;
}

interface BookingFormData {
  carPlateNumber: string;
  carPlateEmirate: string;
  carPlateCode: string;
  parkingNumber: string;
  customerPhone: string;
  customerEmail: string;
  requestedCleanerEmail: string;
}

interface CustomerHistoryResponse {
  cars: PreviousCar[];
}

// UAE Emirates
const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah"
];

// Generate plate codes: A-Z, AA-MM, 1-50
const PLATE_CODES = [
  // Single letters A-Z
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  // Double letters AA-MM
  ...Array.from({ length: 13 }, (_, i) => {
    const char = String.fromCharCode(65 + i);
    return char + char;
  }),
  // Numbers 1-50
  ...Array.from({ length: 50 }, (_, i) => (i + 1).toString())
];

export default function CustomerBooking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1); // Start at step 1 for email/OTP entry
  const checkoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Step 1: Email and OTP
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  
  // Step 2: Car Details
  const [formData, setFormData] = useState<BookingFormData>({
    carPlateNumber: "",
    carPlateEmirate: "",
    carPlateCode: "",
    parkingNumber: "",
    customerPhone: "",
    customerEmail: "",
    requestedCleanerEmail: "",
  });
  const [carPlateHistory, setCarPlateHistory] = useState<Array<{ customerEmail: string; parkingNumber: string }>>([]);
  const [loadingCarHistory, setLoadingCarHistory] = useState(false);
  const [showCarHistoryOptions, setShowCarHistoryOptions] = useState(false);
  
  // Step 3: Location & Company
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (checkoutTimeoutRef.current) {
        clearTimeout(checkoutTimeoutRef.current);
      }
    };
  }, []);

  // Auto-load map on step 3 (was step 2)
  useEffect(() => {
    if (currentStep === 3 && !locationData.address) {
      setShowMap(true);
    }
  }, [currentStep]);

  // Fetch companies when location is selected on step 3
  useEffect(() => {
    if (currentStep === 3 && locationData.latitude !== 0) {
      fetchCompanies();
    }
  }, [locationData, currentStep]);

  // Fetch car plate history when car plate is complete
  useEffect(() => {
    const fetchCarPlateHistory = async () => {
      if (
        currentStep === 2 &&
        formData.carPlateEmirate &&
        formData.carPlateCode &&
        formData.carPlateNumber
      ) {
        setLoadingCarHistory(true);
        try {
          const res = await fetch(
            `/api/customer/car-history/${encodeURIComponent(formData.carPlateEmirate)}/${encodeURIComponent(formData.carPlateCode)}/${encodeURIComponent(formData.carPlateNumber)}`
          );
          
          if (res.ok) {
            const data = await res.json();
            if (data.history && data.history.length > 0) {
              setCarPlateHistory(data.history);
              setShowCarHistoryOptions(true);
            } else {
              setCarPlateHistory([]);
              setShowCarHistoryOptions(false);
            }
          } else {
            setCarPlateHistory([]);
            setShowCarHistoryOptions(false);
          }
        } catch (error) {
          console.error("Failed to fetch car plate history:", error);
          setCarPlateHistory([]);
          setShowCarHistoryOptions(false);
        } finally {
          setLoadingCarHistory(false);
        }
      }
    };

    fetchCarPlateHistory();
  }, [currentStep, formData.carPlateEmirate, formData.carPlateCode, formData.carPlateNumber]);

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

  // Step 1: Send OTP to Email
  const handleSendOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error("Failed to send OTP");
      }

      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: "Check your email for the verification code",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 1: Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });

      if (!res.ok) {
        throw new Error("Invalid OTP");
      }

      setOtpVerified(true);
      
      // Set email in form data
      setFormData(prev => ({ ...prev, customerEmail: email }));
      
      toast({
        title: "Email Verified",
        description: "Proceeding to car details",
      });

      // Move to next step after short delay
      setTimeout(() => {
        setCurrentStep(2);
      }, 500);
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Invalid or expired OTP code",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Step 2: Car Details Submit
  const handleStep2Submit = () => {
    if (!formData.carPlateEmirate || !formData.carPlateCode || !formData.carPlateNumber) {
      toast({
        title: "Car Plate Required",
        description: "Please complete all car plate fields (emirate, code, and number)",
        variant: "destructive",
      });
      return;
    }
    
    if (!formData.customerEmail) {
      toast({
        title: "Email Missing",
        description: "Email from step 1 is required",
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(3);
  };

  // Step 3: Location & Company Submit
  const handleStep3Submit = async () => {
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
      const carWashPrice = Number(selectedCompany.pricePerWash);
      const feePackageType = (selectedCompany.feePackageType || "custom") as FeePackageType;
      const platformFee = Number(selectedCompany.platformFee);
      
      const fees = calculateFees({
        carWashPrice,
        feePackageType,
        platformFee,
      });
      
      const jobData = {
        ...formData,
        locationAddress: locationData.address,
        locationLatitude: locationData.latitude,
        locationLongitude: locationData.longitude,
        companyId: selectedCompany.id.toString(),
        customerId: customer.id.toString(),
        price: carWashPrice,
        ...fees,
        tipAmount: 0,
      };
      
      // Store in sessionStorage for checkout page
      sessionStorage.setItem("pendingJob", JSON.stringify(jobData));
      
      // Show Step 4 (payment) transition before navigating to checkout
      setCurrentStep(4);
      
      // Clear any existing timeout before setting a new one
      if (checkoutTimeoutRef.current) {
        clearTimeout(checkoutTimeoutRef.current);
      }
      
      // Navigate to checkout after brief animation
      checkoutTimeoutRef.current = setTimeout(() => {
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
    // Clear any pending checkout redirect
    if (checkoutTimeoutRef.current) {
      clearTimeout(checkoutTimeoutRef.current);
      checkoutTimeoutRef.current = null;
    }
    
    // Reset navigation state
    setIsNavigatingToPayment(false);
    
    // Navigate back
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
      {/* Header - Vibrant and modern */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={goBack}
                data-testid="button-back"
                className="h-9 w-9"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              {/* Track Button - Vibrant Blue */}
              <Button 
                variant="default"
                size="sm"
                onClick={() => setLocation('/customer/track')}
                data-testid="button-track"
                className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white font-medium shadow-md hover:shadow-lg transition-all"
              >
                <Search className="h-4 w-4 mr-1.5" />
                Track
              </Button>
              
              {/* Staff Login Button - Brand Colors */}
              <Button 
                variant="default"
                size="sm"
                onClick={() => setLocation("/login")}
                data-testid="button-staff-login"
                className="bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 text-white font-medium shadow-md hover:shadow-lg transition-all"
              >
                <LogIn className="h-4 w-4 mr-1.5" />
                Staff
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="max-w-md mx-auto w-full"
      >
        <ProgressIndicator currentStep={currentStep} totalSteps={4} steps={STEPS} />
      </motion.div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 pb-24">
        <AnimatePresence mode="wait" custom={currentStep}>
          {/* Step 1: Email & OTP Verification */}
          {currentStep === 1 && (
            <Step0EmailOTP
              key="step1"
              email={email}
              setEmail={setEmail}
              otp={otp}
              setOtp={setOtp}
              otpSent={otpSent}
              onSendOtp={handleSendOtp}
              onVerifyOtp={handleVerifyOtp}
              sendingOtp={sendingOtp}
              verifyingOtp={verifyingOtp}
            />
          )}

          {/* Step 2: Car Details (with auto-fill from car plate history) */}
          {currentStep === 2 && (
            <Step1CarDetails
              key="step2"
              formData={formData}
              setFormData={setFormData}
              carPlateHistory={carPlateHistory}
              loadingCarHistory={loadingCarHistory}
              showCarHistoryOptions={showCarHistoryOptions}
              setShowCarHistoryOptions={setShowCarHistoryOptions}
              verifiedEmail={email}
              onSubmit={handleStep2Submit}
            />
          )}
          
          {/* Step 3: Location & Company */}
          {currentStep === 3 && (
            <Step2LocationCompany
              key="step3"
              locationData={locationData}
              showMap={showMap}
              setShowMap={setShowMap}
              onLocationSelect={handleLocationSelect}
              companies={companies}
              selectedCompany={selectedCompany}
              setSelectedCompany={setSelectedCompany}
              loadingCompanies={loadingCompanies}
              onSubmit={handleStep3Submit}
              isSubmitting={isSubmitting}
            />
          )}
          
          {/* Step 4: Payment Loading */}
          {currentStep === 4 && (
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

      {/* Sticky Bottom CTA - Only for steps 2 and 3 (not step 1) */}
      {currentStep >= 2 && currentStep < 4 && (
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
              onClick={currentStep === 2 ? handleStep2Submit : handleStep3Submit}
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

// Step 0: Email & OTP Verification Component
function Step0EmailOTP({
  email,
  setEmail,
  otp,
  setOtp,
  otpSent,
  onSendOtp,
  onVerifyOtp,
  sendingOtp,
  verifyingOtp,
}: {
  email: string;
  setEmail: (email: string) => void;
  otp: string;
  setOtp: (otp: string) => void;
  otpSent: boolean;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
  sendingOtp: boolean;
  verifyingOtp: boolean;
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
          className="mx-auto mb-4"
        >
          <motion.img 
            src={logoUrl} 
            alt="Washapp.ae" 
            className="h-24 w-auto mx-auto"
            animate={{ 
              scale: [1, 1.05, 1],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              repeatDelay: 1
            }}
            data-testid="img-logo-animation"
          />
        </motion.div>
        <h2 className="text-2xl font-bold">Welcome!</h2>
        <p className="text-muted-foreground">
          {otpSent ? "Enter the verification code" : "Enter your email to get started"}
        </p>
      </div>

      <Card className="p-6 space-y-5 border-2 hover-elevate">
        {!otpSent ? (
          <>
            <div>
              <Label htmlFor="email" className="text-base font-medium mb-2 block">
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-lg"
                autoFocus
                data-testid="input-email"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSendOtp();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground mt-2">
                We'll send you a verification code
              </p>
            </div>

            <Button
              type="button"
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              onClick={onSendOtp}
              disabled={sendingOtp}
              data-testid="button-send-otp"
            >
              {sendingOtp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code...
                </>
              ) : (
                <>
                  Send Verification Code
                  <ChevronLeft className="ml-2 h-4 w-4 rotate-180" />
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="otp" className="text-base font-medium mb-2 block">
                Verification Code *
              </Label>
              <Input
                id="otp"
                type="text"
                placeholder="Enter 6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="h-12 text-lg text-center tracking-widest"
                autoFocus
                maxLength={6}
                data-testid="input-otp"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    onVerifyOtp();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Code sent to {email}
              </p>
            </div>

            <Button
              type="button"
              className="w-full h-12 text-base bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              onClick={onVerifyOtp}
              disabled={verifyingOtp}
              data-testid="button-verify-otp"
            >
              {verifyingOtp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Verify & Continue
                  <ChevronLeft className="ml-2 h-4 w-4 rotate-180" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onSendOtp}
              disabled={sendingOtp}
              data-testid="button-resend-otp"
            >
              Resend Code
            </Button>
          </>
        )}
      </Card>
    </motion.div>
  );
}

// Step 1: Car Details Component
function Step1CarDetails({
  formData,
  setFormData,
  carPlateHistory,
  loadingCarHistory,
  showCarHistoryOptions,
  setShowCarHistoryOptions,
  verifiedEmail,
  onSubmit,
}: {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  carPlateHistory: Array<{ customerEmail: string; parkingNumber: string }>;
  loadingCarHistory: boolean;
  showCarHistoryOptions: boolean;
  setShowCarHistoryOptions: (show: boolean) => void;
  verifiedEmail: string;
  onSubmit: () => void;
}) {
  const handleUseHistory = (history: { customerEmail: string; parkingNumber: string }) => {
    setFormData(prev => ({
      ...prev,
      parkingNumber: history.parkingNumber,
    }));
    setShowCarHistoryOptions(false);
  };

  // Show car details form (either pre-filled from selection or empty for new car)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pt-4"
    >
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Car Details</h2>
        <p className="text-sm text-muted-foreground">Booking for: {verifiedEmail}</p>
      </div>

      <Card className="p-6 space-y-5 border-2 hover-elevate relative overflow-hidden">
        {/* Animated Logo - Top Right */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="absolute top-4 right-4 z-10"
        >
          <motion.img 
            src={logoUrl} 
            alt="Washapp.ae" 
            className="h-12 w-auto"
            animate={{ 
              scale: [1, 1.08, 1],
              rotate: [0, 2, -2, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              repeatDelay: 2
            }}
            data-testid="img-logo-animation"
          />
        </motion.div>
        <div>
          <Label className="text-base font-medium mb-3 block">
            Car Plate Details *
          </Label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="carPlateEmirate" className="text-sm mb-1.5 block text-muted-foreground">
                Emirate
              </Label>
              <Select value={formData.carPlateEmirate} onValueChange={(value) => setFormData(prev => ({ ...prev, carPlateEmirate: value }))}>
                <SelectTrigger id="carPlateEmirate" className="h-12" data-testid="select-emirate">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {UAE_EMIRATES.map((emirate) => (
                    <SelectItem key={emirate} value={emirate}>
                      {emirate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="carPlateCode" className="text-sm mb-1.5 block text-muted-foreground">
                Code
              </Label>
              <Select value={formData.carPlateCode} onValueChange={(value) => setFormData(prev => ({ ...prev, carPlateCode: value }))}>
                <SelectTrigger id="carPlateCode" className="h-12" data-testid="select-code">
                  <SelectValue placeholder="A-Z" />
                </SelectTrigger>
                <SelectContent>
                  {PLATE_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="carPlateNumber" className="text-sm mb-1.5 block text-muted-foreground">
                Number
              </Label>
              <Input
                id="carPlateNumber"
                data-testid="input-plate-number"
                placeholder="12345"
                value={formData.carPlateNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, carPlateNumber: e.target.value }))}
                required
                className="h-12 text-lg"
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Car History Auto-fill Alert */}
        {showCarHistoryOptions && carPlateHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4"
            data-testid="car-history-alert"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Car className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  We found this car's history!
                </p>
                <div className="space-y-2">
                  {carPlateHistory.map((history, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-lg p-3 border border-blue-100 dark:border-blue-900"
                    >
                      <div className="text-sm">
                        <p className="text-muted-foreground">Previous parking:</p>
                        <p className="font-semibold">{history.parkingNumber || "Not specified"}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleUseHistory(history)}
                        data-testid={`button-use-history-${index}`}
                      >
                        Use This
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCarHistoryOptions(false)}
                  className="mt-2"
                  data-testid="button-dismiss-history"
                >
                  No thanks, I'll enter manually
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        
        <div>
          <Label htmlFor="parkingNumber" className="text-base font-medium mb-2 block">
            Parking <span className="text-muted-foreground text-xs font-normal">(Optional)</span>
          </Label>
          <Input
            id="parkingNumber"
            data-testid="input-parking"
            placeholder="P2-45"
            value={formData.parkingNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, parkingNumber: e.target.value }))}
            className="h-12 text-lg"
          />
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
            onChange={(e) => setFormData(prev => ({ ...prev, requestedCleanerEmail: e.target.value }))}
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
                          <p className="text-sm text-muted-foreground">
                            {(() => {
                              const carWashPrice = Number(company.pricePerWash);
                              const feePackageType = (company.feePackageType || "custom") as FeePackageType;
                              const platformFee = Number(company.platformFee);
                              const fees = calculateFees({
                                carWashPrice,
                                feePackageType,
                                platformFee,
                              });
                              return fees.displayBreakdown;
                            })()}
                          </p>
                          <p className="text-2xl font-bold text-primary">
                            {(() => {
                              const carWashPrice = Number(company.pricePerWash);
                              const feePackageType = (company.feePackageType || "custom") as FeePackageType;
                              const platformFee = Number(company.platformFee);
                              const fees = calculateFees({
                                carWashPrice,
                                feePackageType,
                                platformFee,
                              });
                              return fees.totalAmount.toFixed(2);
                            })()} AED
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
