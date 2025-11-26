import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, MapPin, Phone, Building2, Upload, CheckCircle2, Clock, Navigation, History, Timer, User, MessageCircle, Banknote, DollarSign, Star, Bell, BellOff, Volume2, VolumeX, QrCode, Copy, PlusCircle, Edit, Wallet } from "lucide-react";
import { Job, Cleaner, CleanerStatus, JobStatus } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { Input } from "@/components/ui/input";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import QRCodeComponent from "react-qr-code";

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah"
];

const PLATE_CODES = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  ...Array.from({ length: 13 }, (_, i) => {
    const char = String.fromCharCode(65 + i);
    return char + char;
  }),
  ...Array.from({ length: 50 }, (_, i) => (i + 1).toString())
];

export default function CleanerDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [paymentQRData, setPaymentQRData] = useState<{ token: string; expiresAt: string } | null>(null);
  
  // Offline jobs state
  const [showOfflineJobModal, setShowOfflineJobModal] = useState(false);
  const [offlineJobForm, setOfflineJobForm] = useState({
    carPlateEmirate: '',
    carPlateCode: '',
    carPlateNumber: '',
    notes: '',
  });
  
  // Edit plate state (for QR-paid anonymous jobs)
  const [showEditPlateModal, setShowEditPlateModal] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editPlateForm, setEditPlateForm] = useState({
    carPlateEmirate: '',
    carPlateCode: '',
    carPlateNumber: '',
  });
  
  // Push notifications for cleaners
  const {
    permission,
    isSubscribed,
    soundEnabled,
    isLoading: notificationLoading,
    isSupported,
    subscribe,
    unsubscribe,
    toggleSound,
  } = usePushNotifications({ userId: currentUser?.id });

  // Consolidated dashboard query - fetches all data in one call
  const { data: dashboardData, isLoading: loadingDashboard } = useQuery<{
    cleaner: Cleaner;
    activeShift: any;
    myJobs: Job[];
    availableJobs: Job[];
  }>({
    queryKey: ["/api/cleaner/dashboard"],
    enabled: !!currentUser,
    refetchOnWindowFocus: true,
    // Only poll for available jobs when on duty
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.cleaner?.status === CleanerStatus.ON_DUTY ? 30000 : false;
    },
    staleTime: 0,
  });

  // Derive individual pieces of data from dashboard
  const cleaner = dashboardData?.cleaner;
  const shiftData = dashboardData ? { activeShift: dashboardData.activeShift, cleaner: dashboardData.cleaner } : undefined;
  const activeJobs = dashboardData?.myJobs || [];
  const availableJobs = dashboardData?.availableJobs || [];
  const loadingCleaner = loadingDashboard;
  const loadingJobs = loadingDashboard;

  // Query for offline jobs
  interface OfflineJob {
    id: number;
    cleanerId: number;
    companyId: number;
    carPlateNumber: string;
    carPlateEmirate: string | null;
    carPlateCode: string | null;
    servicePrice: string;
    vatAmount: string;
    totalAmount: string;
    notes: string | null;
    createdAt: string;
    cleanerName: string;
  }
  
  const { data: offlineJobs = [], isLoading: loadingOfflineJobs } = useQuery<OfflineJob[]>({
    queryKey: ["/api/cleaner/offline-jobs"],
    enabled: !!currentUser,
  });

  useWebSocket({
    onMessage: (data) => {
      if (data.type === 'job_update' && cleaner) {
        queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
        
        if (data.job && data.job.status === JobStatus.PAID) {
          toast({
            title: "New Job Available",
            description: `New car wash for ${data.job.carPlateNumber}`,
          });
        }
      }
    },
  });

  const startShift = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/cleaner/start-shift", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      toast({
        title: "Shift Started",
        description: "You are now on duty",
      });
    },
  });

  const endShift = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/cleaner/end-shift", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      toast({
        title: "Shift Ended",
        description: "You are now off duty",
      });
    },
  });

  const toggleAvailability = useMutation({
    mutationFn: async (status: CleanerStatus) => {
      return await apiRequest("POST", "/api/cleaner/toggle-status", { 
        status
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      toast({
        title: "Status Updated",
        description: "Your availability status has been updated",
      });
    },
  });

  const acceptJob = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest("POST", `/api/cleaner/accept-job/${jobId}`, {
        userId: currentUser?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      toast({
        title: "Job Accepted",
        description: "You have accepted the job",
      });
    },
  });

  const startJob = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest("POST", `/api/cleaner/start-job/${jobId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
    },
  });

  const completeJob = useMutation({
    mutationFn: async ({ jobId, photoURL }: { jobId: string; photoURL: string }) => {
      return await apiRequest("POST", `/api/cleaner/complete-job/${jobId}`, { 
        proofPhotoURL: photoURL,
        userId: currentUser?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      setSelectedFile(null);
      setUploadingJobId(null);
      toast({
        title: "Job Completed",
        description: "The job has been marked as completed",
      });
    },
  });

  const updateLocation = useMutation({
    mutationFn: async ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      return await apiRequest("POST", "/api/cleaner/update-location", {
        latitude,
        longitude,
      });
    },
  });

  const generateQRToken = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cleaner/generate-qr-token", {});
      return await response.json();
    },
    onSuccess: (data) => {
      setPaymentQRData(data);
      setShowQRModal(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate payment QR code",
        variant: "destructive",
      });
    },
  });

  const createOfflineJob = useMutation({
    mutationFn: async (data: typeof offlineJobForm) => {
      const response = await apiRequest("POST", "/api/cleaner/create-offline-job", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/offline-jobs"] });
      setShowOfflineJobModal(false);
      setOfflineJobForm({
        carPlateEmirate: '',
        carPlateCode: '',
        carPlateNumber: '',
        notes: '',
      });
      toast({
        title: "Job Created",
        description: "Job started - upload photo when complete",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create offline job",
        variant: "destructive",
      });
    },
  });

  const updateJobPlate = useMutation({
    mutationFn: async ({ jobId, ...data }: { jobId: number; carPlateEmirate: string; carPlateCode: string; carPlateNumber: string }) => {
      const response = await apiRequest("PATCH", `/api/cleaner/update-job-plate/${jobId}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/dashboard"] });
      setShowEditPlateModal(false);
      setEditingJobId(null);
      setEditPlateForm({
        carPlateEmirate: '',
        carPlateCode: '',
        carPlateNumber: '',
      });
      toast({
        title: "Plate Updated",
        description: "Car plate number has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update car plate",
        variant: "destructive",
      });
    },
  });

  const handleCopyPaymentLink = () => {
    if (!paymentQRData) return;
    
    const paymentURL = `${window.location.origin}/customer/pay/${paymentQRData.token}`;
    navigator.clipboard.writeText(paymentURL);
    
    toast({
      title: "Link Copied",
      description: "Payment link copied to clipboard",
    });
  };

  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.log("Geolocation is not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation.mutate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error("Error getting location:", error);
      }
    );
  };

  useEffect(() => {
    const isOnDuty = shiftData?.activeShift || cleaner?.status === CleanerStatus.ON_DUTY;

    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }

    if (isOnDuty) {
      updateCurrentLocation();
      
      locationIntervalRef.current = setInterval(() => {
        updateCurrentLocation();
      }, 5 * 60 * 1000);
    }

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [shiftData?.activeShift, cleaner?.status]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, jobId: string) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadingJobId(jobId);
    }
  };

  const handleUploadProof = async (jobId: string) => {
    if (!selectedFile) return;

    try {
      const formData = new FormData();
      formData.append('proofPhoto', selectedFile);
      
      const uploadRes = await fetch('/api/upload/proof-photo', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadRes.ok) {
        throw new Error('File upload failed');
      }
      
      const { url } = await uploadRes.json();
      
      completeJob.mutate({ jobId, photoURL: url });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload proof photo. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loadingCleaner) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!cleaner) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full text-center p-6">
          <p className="text-muted-foreground">Cleaner profile not found</p>
        </Card>
      </div>
    );
  }

  const isOnDuty = shiftData?.activeShift || cleaner.status === CleanerStatus.ON_DUTY;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Compact Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`sticky top-0 z-10 ${isOnDuty ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-muted to-muted/80'} shadow-lg`}
        >
          <div className="p-3 pr-16 space-y-2">
            {/* Header Info */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h1 className={`text-base font-bold truncate ${isOnDuty ? 'text-white' : 'text-foreground'}`}>
                  {currentUser?.displayName}
                </h1>
                <p className={`text-xs ${isOnDuty ? 'text-white/90' : 'text-muted-foreground'}`}>
                  {isOnDuty ? "● On Duty" : "○ Off Duty"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {/* Star Rating */}
                <div className={`flex items-center gap-1 ${isOnDuty ? 'text-white' : 'text-foreground'}`}>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-bold">
                    {cleaner?.rating ? Number(cleaner.rating).toFixed(1) : "0.0"}
                  </span>
                  <span className={`text-xs ${isOnDuty ? 'text-white/70' : 'text-muted-foreground'}`}>
                    ({cleaner?.totalRatings || 0})
                  </span>
                </div>
                {/* Shift History Button */}
                <Link href="/cleaner/shift-history">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className={`h-7 ${isOnDuty ? 'text-white hover:bg-white/20' : ''}`}
                    data-testid="button-shift-history"
                  >
                    <History className="h-3 w-3 mr-1" />
                    <span className="text-xs">Shift History</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Shift Control Button */}
            {shiftData?.activeShift ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => endShift.mutate()}
                disabled={endShift.isPending}
                className="w-full bg-white/90 hover:bg-white border-2 text-green-600 border-white/50 min-h-12"
                data-testid="button-stop-shift"
              >
                <Clock className="h-4 w-4 mr-2" />
                <div className="flex items-center justify-between flex-1">
                  <span className="font-bold">Stop Shift</span>
                  <span className="text-xs opacity-80">
                    {new Date(shiftData.activeShift.startedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}
                  </span>
                </div>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => startShift.mutate()}
                disabled={startShift.isPending}
                className="w-full bg-gradient-to-r from-primary to-primary/80 text-white min-h-12 shadow-lg hover:shadow-xl"
                data-testid="button-start-shift"
              >
                <Clock className="h-4 w-4 mr-2" />
                <span className="font-bold">Start Shift</span>
              </Button>
            )}

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-2">
              {/* Payment QR Code Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => generateQRToken.mutate()}
                disabled={generateQRToken.isPending}
                className="border-2 min-h-12"
                data-testid="button-generate-qr"
              >
                <QrCode className="h-4 w-4 mr-1" />
                <span className="font-semibold text-sm">Payment QR</span>
              </Button>

              {/* Record Cash Payment Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowOfflineJobModal(true)}
                className="border-2 min-h-12"
                data-testid="button-record-cash"
              >
                <Wallet className="h-4 w-4 mr-1" />
                <span className="font-semibold text-sm">Record Cash</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Notification Settings */}
        {isSupported && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 pb-0"
          >
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSubscribed ? (
                      <Bell className="h-5 w-5 text-primary" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">Job Notifications</CardTitle>
                  </div>
                  <Switch
                    checked={isSubscribed}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        await subscribe();
                      } else {
                        await unsubscribe();
                      }
                    }}
                    disabled={notificationLoading}
                    data-testid="switch-notifications"
                  />
                </div>
                <CardDescription className="text-xs">
                  {isSubscribed
                    ? "You'll receive notifications when new jobs are available"
                    : "Enable to get instant alerts for new jobs"}
                </CardDescription>
              </CardHeader>
              {isSubscribed && (
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {soundEnabled ? (
                        <Volume2 className="h-4 w-4 text-primary" />
                      ) : (
                        <VolumeX className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Label htmlFor="sound-toggle" className="text-sm cursor-pointer">
                        Notification Sound
                      </Label>
                    </div>
                    <Switch
                      id="sound-toggle"
                      checked={soundEnabled}
                      onCheckedChange={toggleSound}
                      disabled={notificationLoading}
                      data-testid="switch-sound"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        )}

        {/* Jobs Tabs */}
        <div className="p-4">
          <Tabs defaultValue="available" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-12">
              <TabsTrigger value="available" className="text-sm" data-testid="tab-available">
                Available <Badge variant="secondary" className="ml-1">{availableJobs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="active" className="text-sm" data-testid="tab-active">
                My Jobs <Badge variant="secondary" className="ml-1">{activeJobs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="offline" className="text-sm" data-testid="tab-offline">
                Cash Jobs <Badge variant="secondary" className="ml-1">{offlineJobs.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* Available Jobs */}
            <TabsContent value="available" className="space-y-4 mt-4">
              <AnimatePresence mode="popLayout">
                {loadingJobs ? (
                  <>
                    {[1, 2].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Card>
                          <CardHeader>
                            <Skeleton className="h-6 w-1/2" />
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </>
                ) : availableJobs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-8 text-center border-dashed">
                      <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground font-medium">No available jobs at the moment</p>
                      <p className="text-sm text-muted-foreground mt-2">New jobs will appear here automatically</p>
                    </Card>
                  </motion.div>
                ) : (
                  availableJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      layout
                    >
                      <JobCard
                        job={job}
                        action={
                          <Button
                            size="lg"
                            className="w-full min-h-14 bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl"
                            onClick={() => acceptJob.mutate(String(job.id))}
                            disabled={acceptJob.isPending}
                            data-testid={`button-accept-${job.id}`}
                          >
                            <CheckCircle2 className="h-5 w-5 mr-2" />
                            <span className="font-bold text-lg">Accept Job</span>
                          </Button>
                        }
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Active Jobs */}
            <TabsContent value="active" className="space-y-4 mt-4">
              <AnimatePresence mode="popLayout">
                {activeJobs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-8 text-center border-dashed">
                      <CheckCircle2 className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground font-medium">No active jobs</p>
                      <p className="text-sm text-muted-foreground mt-2">Accepted jobs will appear here</p>
                    </Card>
                  </motion.div>
                ) : (
                  activeJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      layout
                    >
                      <JobCard
                        job={job}
                        onEditPlate={(jobId) => {
                          setEditingJobId(jobId);
                          setShowEditPlateModal(true);
                        }}
                        action={
                          job.status === JobStatus.ASSIGNED ? (
                            <Button
                              size="lg"
                              className="w-full min-h-14 bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl"
                              onClick={() => startJob.mutate(String(job.id))}
                              data-testid={`button-start-${job.id}`}
                            >
                              <Timer className="h-5 w-5 mr-2" />
                              <span className="font-bold text-lg">Start Cleaning</span>
                            </Button>
                          ) : job.status === JobStatus.IN_PROGRESS ? (
                            <div className="space-y-3">
                              <Input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleFileSelect(e, String(job.id))}
                                className="min-h-12"
                                data-testid={`input-photo-${job.id}`}
                              />
                              <Button
                                size="lg"
                                className="w-full min-h-14 bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl"
                                onClick={() => handleUploadProof(String(job.id))}
                                disabled={!selectedFile || uploadingJobId !== String(job.id) || completeJob.isPending}
                                data-testid={`button-complete-${job.id}`}
                              >
                                <Upload className="h-5 w-5 mr-2" />
                                <span className="font-bold text-lg">Upload & Complete</span>
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="outline" className="w-full py-3 text-base justify-center">
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Completed
                            </Badge>
                          )
                        }
                      />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </TabsContent>

            {/* Offline/Cash Jobs */}
            <TabsContent value="offline" className="space-y-4 mt-4">
              <AnimatePresence mode="popLayout">
                {loadingOfflineJobs ? (
                  <>
                    {[1, 2].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Card>
                          <CardHeader>
                            <Skeleton className="h-6 w-1/2" />
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </>
                ) : offlineJobs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-8 text-center border-dashed">
                      <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-muted-foreground font-medium">No cash jobs recorded</p>
                      <p className="text-sm text-muted-foreground mt-2">Use "Record Cash Job" to track manual payments</p>
                    </Card>
                  </motion.div>
                ) : (
                  offlineJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      layout
                    >
                      <Card data-testid={`card-offline-job-${job.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Car className="h-5 w-5 text-primary" />
                              <CardTitle className="text-lg">
                                {job.carPlateEmirate && job.carPlateCode 
                                  ? `${job.carPlateEmirate} ${job.carPlateCode} ${job.carPlateNumber}`
                                  : job.carPlateNumber}
                              </CardTitle>
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              <Banknote className="h-3 w-3 mr-1" />
                              Cash
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Service Price:</span>
                            <span className="font-medium">{job.servicePrice} AED</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">VAT (5%):</span>
                            <span className="font-medium">{job.vatAmount} AED</span>
                          </div>
                          <div className="flex items-center justify-between text-sm border-t pt-2">
                            <span className="font-medium">Total:</span>
                            <span className="font-bold text-primary">{job.totalAmount} AED</span>
                          </div>
                          {job.notes && (
                            <div className="text-sm text-muted-foreground border-t pt-2">
                              <MessageCircle className="h-4 w-4 inline mr-1" />
                              {job.notes}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground border-t pt-2">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(job.createdAt).toLocaleString('en-AE', { 
                              timeZone: 'Asia/Dubai',
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* QR Code Payment Modal */}
      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment QR Code</DialogTitle>
            <DialogDescription>
              Customers can scan this QR code to pay and auto-assign the job to you
            </DialogDescription>
          </DialogHeader>
          
          {paymentQRData && (
            <div className="space-y-4">
              <div className="flex justify-center p-6 bg-white rounded-lg">
                <QRCodeComponent 
                  value={`${window.location.origin}/customer/pay/${paymentQRData.token}`}
                  size={256}
                  data-testid="qr-code"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Expires:</span>
                  <span className="text-sm font-medium">
                    {new Date(paymentQRData.expiresAt).toLocaleString('en-AE', { 
                      timeZone: 'Asia/Dubai',
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
                
                <Button
                  onClick={handleCopyPaymentLink}
                  variant="outline"
                  className="w-full"
                  data-testid="button-copy-link"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Payment Link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Offline Job Modal */}
      <Dialog open={showOfflineJobModal} onOpenChange={setShowOfflineJobModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Start Cash Job
            </DialogTitle>
            <DialogDescription>
              Record a job - upload photo when complete to finish
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Car Plate */}
            <div className="space-y-2">
              <Label>Car Plate</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={offlineJobForm.carPlateEmirate}
                  onValueChange={(value) => setOfflineJobForm(prev => ({ ...prev, carPlateEmirate: value }))}
                >
                  <SelectTrigger data-testid="select-emirate-offline">
                    <SelectValue placeholder="Emirate" />
                  </SelectTrigger>
                  <SelectContent>
                    {UAE_EMIRATES.map((emirate) => (
                      <SelectItem key={emirate} value={emirate}>{emirate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={offlineJobForm.carPlateCode}
                  onValueChange={(value) => setOfflineJobForm(prev => ({ ...prev, carPlateCode: value }))}
                >
                  <SelectTrigger data-testid="select-code-offline">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATE_CODES.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Number"
                  value={offlineJobForm.carPlateNumber}
                  onChange={(e) => setOfflineJobForm(prev => ({ ...prev, carPlateNumber: e.target.value }))}
                  data-testid="input-number-offline"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={offlineJobForm.notes}
                onChange={(e) => setOfflineJobForm(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="input-notes-offline"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowOfflineJobModal(false)}
              data-testid="button-cancel-offline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createOfflineJob.mutate(offlineJobForm)}
              disabled={!offlineJobForm.carPlateEmirate || !offlineJobForm.carPlateCode || !offlineJobForm.carPlateNumber || createOfflineJob.isPending}
              data-testid="button-submit-offline"
            >
              {createOfflineJob.isPending ? "Starting..." : "Start Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Plate Modal (for QR-paid jobs) */}
      <Dialog open={showEditPlateModal} onOpenChange={setShowEditPlateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Update Car Plate
            </DialogTitle>
            <DialogDescription>
              Enter the actual car plate number for this QR-scanned job
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Car Plate</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select
                  value={editPlateForm.carPlateEmirate}
                  onValueChange={(value) => setEditPlateForm(prev => ({ ...prev, carPlateEmirate: value }))}
                >
                  <SelectTrigger data-testid="select-emirate-edit">
                    <SelectValue placeholder="Emirate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dubai">Dubai</SelectItem>
                    <SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem>
                    <SelectItem value="Sharjah">Sharjah</SelectItem>
                    <SelectItem value="Ajman">Ajman</SelectItem>
                    <SelectItem value="RAK">RAK</SelectItem>
                    <SelectItem value="Fujairah">Fujairah</SelectItem>
                    <SelectItem value="UAQ">UAQ</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Code"
                  value={editPlateForm.carPlateCode}
                  onChange={(e) => setEditPlateForm(prev => ({ ...prev, carPlateCode: e.target.value.toUpperCase() }))}
                  data-testid="input-code-edit"
                />
                <Input
                  placeholder="Number"
                  value={editPlateForm.carPlateNumber}
                  onChange={(e) => setEditPlateForm(prev => ({ ...prev, carPlateNumber: e.target.value }))}
                  data-testid="input-number-edit"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditPlateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => editingJobId && updateJobPlate.mutate({
                jobId: editingJobId,
                ...editPlateForm,
              })}
              disabled={!editPlateForm.carPlateNumber || updateJobPlate.isPending}
              data-testid="button-submit-edit-plate"
            >
              {updateJobPlate.isPending ? "Updating..." : "Update Plate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobCard({ job, action, onEditPlate }: { job: Job; action: React.ReactNode; onEditPlate?: (jobId: number) => void }) {
  const isQRScannedJob = job.carPlateNumber?.startsWith('QR-ANON') || job.carPlateNumber?.startsWith('QR_SCAN');
  const getProgressStage = (status: JobStatus) => {
    switch (status) {
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

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case JobStatus.PAID:
        return "bg-blue-500";
      case JobStatus.ASSIGNED:
        return "bg-yellow-500";
      case JobStatus.IN_PROGRESS:
        return "bg-orange-500";
      case JobStatus.COMPLETED:
        return "bg-green-500";
      default:
        return "bg-muted";
    }
  };

  const getStatusLabel = (status: JobStatus) => {
    switch (status) {
      case JobStatus.PAID:
        return "New Job";
      case JobStatus.ASSIGNED:
        return "Assigned";
      case JobStatus.IN_PROGRESS:
        return "In Progress";
      case JobStatus.COMPLETED:
        return "Completed";
      default:
        return status;
    }
  };

  const stage = getProgressStage(job.status as JobStatus);
  const stages = [
    { id: 1, label: "New", icon: Car },
    { id: 2, label: "Assigned", icon: User },
    { id: 3, label: "Cleaning", icon: Timer },
    { id: 4, label: "Done", icon: CheckCircle2 },
  ];

  const formatPhoneForWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.startsWith('971') ? cleaned : `971${cleaned}`;
  };

  return (
    <Card className="overflow-hidden border-primary/20 shadow-lg">
      {/* Payout Banner - Most Prominent */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <DollarSign className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm opacity-90">Your Earnings</p>
              <motion.p 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-4xl font-bold"
              >
                {(parseFloat(job.price) + parseFloat(job.tipAmount || "0")).toFixed(2)} AED
              </motion.p>
              {parseFloat(job.tipAmount || "0") > 0 && (
                <p className="text-xs opacity-80 mt-1">
                  Base: {job.price} AED + Tip: {job.tipAmount} AED
                </p>
              )}
            </div>
          </div>
          <Badge 
            className={`${getStatusColor(job.status as JobStatus)} text-white border-0 px-3 py-2 text-sm shadow-lg`}
          >
            {getStatusLabel(job.status as JobStatus)}
          </Badge>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
        <div className="relative">
          <div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((stage - 1) / 3) * 100}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-primary rounded-full"
            />
          </div>

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
                    } ${isCurrent ? "ring-4 ring-primary/30 scale-110" : ""}`}
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
      </div>

      <CardContent className="space-y-4 pt-6">
        {/* Car Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Car Plate</p>
            <p className="font-bold text-lg">{job.carPlateNumber}</p>
          </div>
          {isQRScannedJob && onEditPlate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEditPlate(job.id)}
              className="shrink-0"
              data-testid={`button-edit-plate-${job.id}`}
            >
              <Edit className="h-4 w-4 mr-1" />
              Update
            </Button>
          )}
        </div>

        {/* Location with Navigation */}
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-medium">{job.locationAddress}</p>
            </div>
          </div>
          {job.locationLatitude && job.locationLongitude && (
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-12 border-2 border-primary/20 hover:bg-primary/5"
              onClick={() => {
                const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${job.locationLatitude},${job.locationLongitude}`;
                window.open(googleMapsUrl, "_blank");
              }}
              data-testid={`button-navigate-${job.id}`}
            >
              <Navigation className="h-5 w-5 mr-2 text-primary" />
              <span className="font-bold">Navigate with Google Maps</span>
            </Button>
          )}
        </div>

        {/* Parking */}
        {job.parkingNumber && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Parking Number</p>
              <p className="font-bold text-lg">{job.parkingNumber}</p>
            </div>
          </div>
        )}

        {/* Customer Contact */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Customer Phone</p>
              <p className="font-bold">{job.customerPhone}</p>
            </div>
          </div>
          
          {/* Contact Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 border-2 border-primary/20 hover:bg-primary/5"
              onClick={() => {
                window.location.href = `tel:${job.customerPhone}`;
              }}
              data-testid={`button-call-${job.id}`}
            >
              <Phone className="h-4 w-4 mr-2" />
              <span className="font-bold">Call</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 border-2 border-green-500/20 hover:bg-green-500/5"
              onClick={() => {
                if (!job.customerPhone) return;
                const whatsappNumber = formatPhoneForWhatsApp(job.customerPhone);
                const message = encodeURIComponent(`Hi, I'm your car cleaner for ${job.carPlateNumber}. I'll be there soon!`);
                window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
              }}
              data-testid={`button-whatsapp-${job.id}`}
            >
              <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
              <span className="font-bold text-green-600">WhatsApp</span>
            </Button>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="bg-muted/30 p-4">
        {action}
      </CardFooter>
    </Card>
  );
}
