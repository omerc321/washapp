import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, MapPin, Phone, Building2, Clock, Star, ChevronLeft, AlertCircle, Bell, BellOff, User, Timer, CheckCircle2, Navigation, MessageSquare } from "lucide-react";
import { Job, JobStatus, Cleaner, Company } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import logoUrl from "@assets/IMG_2508_1762619079711.png";
import { motion } from "framer-motion";

// UAE Emirates list
const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah"
];

// Plate codes: A-Z, AA-MM, 1-50
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

// Extended Cleaner type with user information (phone number, name, email)
type CleanerWithContact = Cleaner & {
  phoneNumber?: string;
  displayName?: string;
  email?: string;
};

export default function CustomerTrack() {
  const [, params] = useRoute("/customer/track/:plateNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Search method selection: "plate" or "phone"
  const [searchMethod, setSearchMethod] = useState<"plate" | "phone">("plate");
  
  // Three-field car plate state
  const [plateEmirate, setPlateEmirate] = useState("");
  const [plateCode, setPlateCode] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  
  // Phone number state
  const [phoneNumber, setPhoneNumber] = useState("");

  const fullPlateNumber = params?.plateNumber || "";

  // Sync search method with URL on mount and when URL changes
  useEffect(() => {
    if (fullPlateNumber.startsWith('phone:')) {
      setSearchMethod('phone');
      const phone = fullPlateNumber.substring(6);
      setPhoneNumber(decodeURIComponent(phone));
    } else if (fullPlateNumber) {
      setSearchMethod('plate');
      // Optionally parse and set plate fields here if needed
    }
  }, [fullPlateNumber]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchMethod === "phone") {
      if (!phoneNumber.trim()) {
        toast({
          title: "Phone Number Required",
          description: "Please enter your phone number",
          variant: "destructive",
        });
        return;
      }
      // Use phone number in URL
      setLocation(`/customer/track/phone:${encodeURIComponent(phoneNumber)}`);
    } else {
      if (!plateEmirate || !plateCode || !plateNumber.trim()) {
        toast({
          title: "Car Plate Required",
          description: "Please complete all car plate fields (emirate, code, and number)",
          variant: "destructive",
        });
        return;
      }
      const combinedPlate = `${plateEmirate} ${plateCode} ${plateNumber.trim().toUpperCase()}`;
      setLocation(`/customer/track/${encodeURIComponent(combinedPlate)}`);
    }
  };

  // Determine if we're searching by phone
  const isPhoneSearch = fullPlateNumber.startsWith('phone:');
  const searchPhone = isPhoneSearch ? fullPlateNumber.substring(6) : '';
  const searchPlate = isPhoneSearch ? '' : fullPlateNumber;

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/track", fullPlateNumber],
    queryFn: async () => {
      if (isPhoneSearch) {
        // Fetch by phone number (searchPhone is already decoded from URL)
        const res = await fetch(`/api/jobs/track-by-phone/${searchPhone}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      } else {
        // Fetch by plate number
        const res = await fetch(`/api/jobs/track/${searchPlate}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        });
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return res.json();
      }
    },
    enabled: !!fullPlateNumber,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { permission, isSubscribed, soundEnabled, isLoading: pushLoading, isSupported, subscribe, unsubscribe, toggleSound } = usePushNotifications({
    plateNumber: fullPlateNumber,
  });

  const { subscribe: wsSubscribe, isConnected } = useWebSocket({
    onMessage: (data) => {
      if (data.type === 'job_update' && data.job) {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs/track", fullPlateNumber] });
        
        const statusMessages: Record<JobStatus, string> = {
          [JobStatus.ASSIGNED]: "A cleaner has been assigned to your job!",
          [JobStatus.IN_PROGRESS]: "Your car wash is now in progress!",
          [JobStatus.COMPLETED]: "Your car wash is complete!",
          [JobStatus.CANCELLED]: "Your job has been cancelled",
          [JobStatus.REFUNDED]: "Your payment has been refunded",
          [JobStatus.PAID]: "Payment confirmed",
          [JobStatus.PENDING_PAYMENT]: "Waiting for payment",
        };

        if (data.job.carPlateNumber === fullPlateNumber && statusMessages[data.job.status as JobStatus]) {
          toast({
            title: "Job Update",
            description: statusMessages[data.job.status as JobStatus],
          });
        }
      }
    },
  });

  useEffect(() => {
    if (jobs && jobs.length > 0 && isConnected) {
      jobs.forEach(job => {
        wsSubscribe({ jobId: job.id });
      });
    }
  }, [jobs, wsSubscribe, isConnected]);

  const submitRating = useMutation({
    mutationFn: async () => {
      if (!selectedJob) return;
      await apiRequest("POST", `/api/jobs/${selectedJob.id}/rate`, {
        rating,
        review: review.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Rating Submitted",
        description: "Thank you for your feedback!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/track", fullPlateNumber] });
      setSelectedJob(null);
      setRating(0);
      setReview("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit rating",
        variant: "destructive",
      });
    },
  });

  // Split jobs into active and history
  // Active: Only show jobs that have been paid and are in progress
  const activeJobs = jobs?.filter(
    (job) => job.status === JobStatus.PAID || 
             job.status === JobStatus.ASSIGNED || 
             job.status === JobStatus.IN_PROGRESS
  );

  // History: Show all completed, cancelled, refunded jobs
  // Note: PENDING_PAYMENT jobs are excluded entirely (incomplete bookings)
  const historyJobs = jobs?.filter((job) => 
    job.status === JobStatus.COMPLETED || 
    job.status === JobStatus.CANCELLED || 
    job.status === JobStatus.REFUNDED
  );

  // Get the most recent active job to show in "Active Wash" section
  const currentJob = activeJobs?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary to-primary/80 sticky top-0 z-10 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <img src={logoUrl} alt="Washapp.ae" className="h-12 w-auto" data-testid="img-logo" />
              <div>
                <h1 className="text-white text-lg font-bold">{fullPlateNumber || "Track Your Wash"}</h1>
                <p className="text-white/90 text-xs">
                  {fullPlateNumber ? "Track your car wash" : "Enter your plate details"}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/")}
              className="text-white hover:bg-white/20"
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-20">

        {/* Plate Number Input Form - shown when no plate number in URL */}
        {!fullPlateNumber && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30">
                    <Car className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Track Your Wash</CardTitle>
                    <CardDescription>Search by phone number or car plate</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTrackSubmit} className="space-y-5">
                  {/* Search Method Toggle */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <Button
                      type="button"
                      variant={searchMethod === "phone" ? "default" : "ghost"}
                      className="flex-1 h-10"
                      onClick={() => setSearchMethod("phone")}
                      data-testid="button-search-phone"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Phone Number
                    </Button>
                    <Button
                      type="button"
                      variant={searchMethod === "plate" ? "default" : "ghost"}
                      className="flex-1 h-10"
                      onClick={() => setSearchMethod("plate")}
                      data-testid="button-search-plate"
                    >
                      <Car className="h-4 w-4 mr-2" />
                      Car Plate
                    </Button>
                  </div>

                  {searchMethod === "phone" ? (
                    <div>
                      <Label htmlFor="phoneNumber" className="text-base font-medium mb-2 block">
                        Phone Number
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="phoneNumber"
                          data-testid="input-phone-number"
                          type="tel"
                          placeholder="Enter your phone number"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="h-12 text-lg pl-11"
                          autoFocus
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Enter the phone number you used when booking
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-base font-medium mb-3 block">
                        Car Plate Details
                      </Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="plateEmirate" className="text-sm mb-1.5 block text-muted-foreground">
                            Emirate
                          </Label>
                          <Select value={plateEmirate} onValueChange={setPlateEmirate}>
                            <SelectTrigger id="plateEmirate" className="h-12" data-testid="select-emirate">
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
                          <Label htmlFor="plateCode" className="text-sm mb-1.5 block text-muted-foreground">
                            Code
                          </Label>
                          <Select value={plateCode} onValueChange={setPlateCode}>
                            <SelectTrigger id="plateCode" className="h-12" data-testid="select-code">
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
                          <Label htmlFor="plateNumber" className="text-sm mb-1.5 block text-muted-foreground">
                            Number
                          </Label>
                          <Input
                            id="plateNumber"
                            data-testid="input-plate-number"
                            placeholder="12345"
                            value={plateNumber}
                            onChange={(e) => setPlateNumber(e.target.value)}
                            className="h-12 text-lg"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-primary"
                    size="lg"
                    data-testid="button-track-submit"
                  >
                    Track My Wash
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-muted/50 border-muted">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Real-time updates</p>
                      <p className="text-sm text-muted-foreground">Track your wash from booking to completion</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Push notifications</p>
                      <p className="text-sm text-muted-foreground">Get notified when your cleaner is on the way</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Cleaner details</p>
                      <p className="text-sm text-muted-foreground">View your assigned cleaner's profile and contact info</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Push Notification Banner */}
        {isSupported && !isSubscribed && permission === 'default' && jobs && jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Get instant updates</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Enable notifications for real-time job alerts
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={subscribe}
                    disabled={pushLoading}
                    className="bg-primary hover:bg-primary/90"
                    data-testid="button-enable-notifications"
                  >
                    {pushLoading ? 'Enabling...' : 'Enable'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Notification Status */}
        {isSubscribed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Card className="border-green-500/30 bg-gradient-to-r from-green-50 to-green-50/50 dark:from-green-950/20 dark:to-green-950/10">
              <CardContent className="p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Notifications enabled</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={unsubscribe}
                      disabled={pushLoading}
                      data-testid="button-disable-notifications"
                    >
                      <BellOff className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-green-500/20">
                    <span className="text-sm">Sound</span>
                    <Button
                      size="sm"
                      variant={soundEnabled ? "default" : "outline"}
                      onClick={toggleSound}
                      disabled={pushLoading}
                      data-testid="button-toggle-sound"
                    >
                      {soundEnabled ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {!isLoading && fullPlateNumber && (!jobs || jobs.length === 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Car className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No washes yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  No car wash history found for <strong>{fullPlateNumber}</strong>
                </p>
                <Button
                  onClick={() => setLocation("/")}
                  className="bg-primary"
                  data-testid="button-book-wash"
                >
                  Book Your First Wash
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {!isLoading && fullPlateNumber && jobs && jobs.length > 0 && (
          <>
            {/* Current Active Job */}
            {currentJob && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Timer className="h-4 w-4 text-primary" />
                  </div>
                  Active Wash
                </h2>
                <ActiveJobCard job={currentJob} currentTime={currentTime} onRate={() => setSelectedJob(currentJob)} />
              </motion.div>
            )}

            {/* Completed Jobs History */}
            {historyJobs && historyJobs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  History
                </h2>
                <div className="space-y-4">
                  {historyJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                    >
                      <HistoryJobCard
                        job={job}
                        onRate={() => setSelectedJob(job)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Rating Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <Card className="border-primary/20">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                  <CardTitle>Rate Your Car Wash</CardTitle>
                  <CardDescription>Job #{selectedJob.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {/* Star Rating */}
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="focus:outline-none transition-transform hover:scale-110"
                        data-testid={`button-star-${star}`}
                      >
                        <Star
                          className={`h-10 w-10 ${
                            star <= rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Review Text */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Review (Optional)
                    </label>
                    <Textarea
                      placeholder="Tell us about your experience..."
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      rows={4}
                      data-testid="input-review"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedJob(null);
                      setRating(0);
                      setReview("");
                    }}
                    data-testid="button-cancel-rating"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={rating === 0 || submitRating.isPending}
                    onClick={() => submitRating.mutate()}
                    data-testid="button-submit-rating"
                  >
                    {submitRating.isPending ? "Submitting..." : "Submit Rating"}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveJobCard({ job, currentTime, onRate }: { job: Job; currentTime: Date; onRate?: () => void }) {
  const { data: cleaner, isError: cleanerError } = useQuery<CleanerWithContact>({
    queryKey: ["/api/cleaners", job.cleanerId],
    queryFn: async () => {
      const res = await fetch(`/api/cleaners/${job.cleanerId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!job.cleanerId,
    retry: false,
  });

  const { data: company, isError: companyError } = useQuery<Company>({
    queryKey: ["/api/companies", job.companyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${job.companyId}`);
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  const getProgressStage = (status: JobStatus) => {
    switch (status) {
      case JobStatus.PENDING_PAYMENT:
      case JobStatus.PAID:
        return 1;
      case JobStatus.ASSIGNED:
        return 2;
      case JobStatus.IN_PROGRESS:
        return 3;
      case JobStatus.COMPLETED:
        return 4;
      default:
        return 0;
    }
  };

  const stage = getProgressStage(job.status as JobStatus);

  const stages = [
    { id: 1, label: "Requested", icon: Car },
    { id: 2, label: "Assigned", icon: User },
    { id: 3, label: "In Progress", icon: Timer },
    { id: 4, label: "Completed", icon: CheckCircle2 },
  ];

  const getTimeRemaining = (targetTime: Date | null) => {
    if (!targetTime) return null;
    const diff = new Date(targetTime).getTime() - currentTime.getTime();
    if (diff <= 0) return "Now";
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Card className="border-primary/30 overflow-hidden" data-testid={`job-card-${job.id}`}>
      {/* Progress Timeline */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${((stage - 1) / 3) * 100}%` }}
            />
          </div>

          {/* Progress Steps */}
          <div className="relative flex justify-between">
            {stages.map((s) => {
              const Icon = s.icon;
              const isActive = stage >= s.id;
              const isCurrent = stage === s.id;
              
              return (
                <div key={s.id} className="flex flex-col items-center gap-2">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: s.id * 0.1 }}
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-primary text-white shadow-lg"
                        : "bg-muted text-muted-foreground"
                    } ${isCurrent ? "ring-4 ring-primary/30" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                  <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Estimated Times */}
        {(job.estimatedStartTime || job.estimatedFinishTime) && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {job.estimatedStartTime && stage < 3 && (
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Estimated Start</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    {getTimeRemaining(job.estimatedStartTime)}
                  </span>
                </div>
              </div>
            )}
            {job.estimatedFinishTime && stage >= 3 && (
              <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Estimated Finish</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">
                    {getTimeRemaining(job.estimatedFinishTime)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <CardContent className="space-y-4 pt-6">
        {/* Refund Message */}
        {job.status === JobStatus.REFUNDED && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-sm">
                <p className="font-bold text-green-900 dark:text-green-100 mb-2">Full Refund Processed</p>
                <p className="text-green-800 dark:text-green-200">
                  No cleaner accepted your job within 15 minutes. 
                  Your payment of <strong>{job.totalAmount} AED</strong> has been fully refunded 
                  and will appear on your card within 10 business days.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cleaner Assigned Indicator */}
        {job.cleanerId && job.status !== JobStatus.PAID && job.status !== JobStatus.PENDING_PAYMENT && (
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Cleaner Assigned</p>
                <p className="text-sm text-muted-foreground">Your cleaner is on the way!</p>
              </div>
            </div>
          </div>
        )}

        {/* Company */}
        {company && (
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Company</p>
              <p className="font-semibold">{company.name}</p>
            </div>
          </div>
        )}

        {/* Location */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium">{job.locationAddress}</p>
            {job.parkingNumber && (
              <p className="text-sm text-muted-foreground mt-1">
                Parking: {job.parkingNumber}
              </p>
            )}
          </div>
        </div>

        {/* Phone */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Phone</p>
            <p className="font-medium">{job.customerPhone}</p>
          </div>
        </div>

        {/* Cleaner Phone */}
        {cleaner?.phoneNumber && (
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cleaner Phone</p>
              <a 
                href={`tel:${cleaner.phoneNumber}`} 
                className="font-medium text-primary hover:underline"
                data-testid="link-cleaner-phone"
              >
                {cleaner.phoneNumber}
              </a>
            </div>
          </div>
        )}

        {/* Completion Photo */}
        {job.status === JobStatus.COMPLETED && job.proofPhotoURL && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-2">Completion Photo</p>
            <img 
              src={job.proofPhotoURL} 
              alt="Completed car wash proof" 
              className="w-full h-auto rounded-lg border"
              data-testid={`img-proof-${job.id}`}
            />
          </div>
        )}

        {/* Rating Display */}
        {job.rating && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Number(job.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Your Rating</span>
            </div>
            {job.review && (
              <p className="text-sm text-muted-foreground italic mt-2">{job.review}</p>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-muted-foreground">Total Amount</span>
          <span className="text-2xl font-bold text-primary">{job.totalAmount} AED</span>
        </div>
      </CardContent>

      {/* Rate Button */}
      {job.status === JobStatus.COMPLETED && !job.rating && onRate && (
        <CardFooter>
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={onRate}
            data-testid={`button-rate-${job.id}`}
          >
            <Star className="h-4 w-4 mr-2" />
            Rate This Wash
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function HistoryJobCard({ job, onRate }: { job: Job; onRate?: () => void }) {
  const [, setLocation] = useLocation();
  const { data: cleaner, isError: cleanerError } = useQuery<CleanerWithContact>({
    queryKey: ["/api/cleaners", job.cleanerId],
    queryFn: async () => {
      const res = await fetch(`/api/cleaners/${job.cleanerId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!job.cleanerId,
    retry: false,
  });

  const getDuration = () => {
    if (!job.startedAt || !job.completedAt) return null;
    const diff = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
    const minutes = Math.round(diff / 60000);
    return `${minutes} min`;
  };

  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(job.locationLongitude as string) - 0.01},${parseFloat(job.locationLatitude as string) - 0.01},${parseFloat(job.locationLongitude as string) + 0.01},${parseFloat(job.locationLatitude as string) + 0.01}&layer=mapnik&marker=${job.locationLatitude},${job.locationLongitude}`;

  return (
    <Card className="hover-elevate overflow-hidden" data-testid={`job-card-${job.id}`}>
      {/* Map Thumbnail */}
      <div className="relative h-32 bg-muted">
        <iframe
          src={mapUrl}
          className="w-full h-full pointer-events-none"
          title="Job location"
        />
        <div className="absolute top-2 right-2">
          {job.status === JobStatus.REFUNDED ? (
            <Badge className="bg-green-600 text-white font-bold shadow-lg">
              Refunded
            </Badge>
          ) : job.status === JobStatus.COMPLETED ? (
            <Badge className="bg-green-600 text-white font-bold shadow-lg">
              Completed
            </Badge>
          ) : (
            <Badge variant="destructive">Cancelled</Badge>
          )}
        </div>
      </div>

      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Job #{job.id}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(job.createdAt).toLocaleDateString('en-AE', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'Asia/Dubai'
              })}
            </p>
          </div>
          {getDuration() && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-semibold text-primary">{getDuration()}</p>
            </div>
          )}
        </div>

        {/* Cleaner Info */}
        {job.cleanerId && job.status === JobStatus.COMPLETED && (
          <div className="bg-primary/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Professional Cleaner</p>
                <p className="text-xs text-muted-foreground">Wash completed successfully</p>
              </div>
            </div>
            {cleaner?.phoneNumber && (
              <div className="flex items-center gap-2 pl-10">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a 
                  href={`tel:${cleaner.phoneNumber}`} 
                  className="text-sm text-primary hover:underline"
                  data-testid="link-cleaner-phone-history"
                >
                  {cleaner.phoneNumber}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-sm">{job.locationAddress}</p>
        </div>

        {/* Proof Photo */}
        {job.status === JobStatus.COMPLETED && job.proofPhotoURL && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Completion Photo</p>
            <img 
              src={job.proofPhotoURL} 
              alt="Completed car wash proof" 
              className="w-full h-auto rounded-lg border"
              data-testid={`img-proof-${job.id}`}
            />
          </div>
        )}

        {/* Rating Display */}
        {job.rating && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Number(job.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">Your Rating</span>
            </div>
            {job.review && (
              <p className="text-sm text-muted-foreground italic mt-2">{job.review}</p>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total Paid</span>
          <span className="text-lg font-bold">{job.totalAmount} AED</span>
        </div>
      </CardContent>

      {/* Action Buttons */}
      {(job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED || job.status === JobStatus.REFUNDED) && (
        <CardFooter className="flex gap-2">
          {/* Rate Button - only for completed jobs without rating */}
          {job.status === JobStatus.COMPLETED && !job.rating && onRate && (
            <Button
              className="flex-1 bg-primary hover:bg-primary/90"
              onClick={onRate}
              data-testid={`button-rate-${job.id}`}
            >
              <Star className="h-4 w-4 mr-2" />
              Rate This Wash
            </Button>
          )}
          
          {/* Complaint Button - for all eligible statuses */}
          <Button
            variant="outline"
            className={job.status === JobStatus.COMPLETED && !job.rating ? "flex-1" : "w-full"}
            onClick={() => {
              // Pass the job ID to complaint page
              setLocation(`/customer/complaint/${job.id}`);
            }}
            data-testid={`button-complaint-${job.id}`}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
