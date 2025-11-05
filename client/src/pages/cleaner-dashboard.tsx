import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, MapPin, Phone, Building2, Upload, CheckCircle2, Clock, Navigation } from "lucide-react";
import { Job, Cleaner, CleanerStatus, JobStatus } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function CleanerDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingJobId, setUploadingJobId] = useState<string | null>(null);

  // Get cleaner profile
  const { data: cleaner, isLoading: loadingCleaner } = useQuery<Cleaner>({
    queryKey: ["/api/cleaner/profile", currentUser?.id],
    enabled: !!currentUser,
  });

  // Get available jobs
  const { data: availableJobs = [], isLoading: loadingJobs } = useQuery<Job[]>({
    queryKey: ["/api/cleaner/available-jobs"],
    enabled: !!cleaner,
  });

  // Get my active jobs
  const { data: activeJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/cleaner/my-jobs"],
    enabled: !!cleaner,
  });

  // Toggle availability mutation
  const toggleAvailability = useMutation({
    mutationFn: async (status: CleanerStatus) => {
      const res = await apiRequest("POST", "/api/cleaner/toggle-status", { 
        status,
        userId: currentUser?.id 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/profile"] });
      toast({
        title: "Status Updated",
        description: "Your availability status has been updated",
      });
    },
  });

  // Accept job mutation
  const acceptJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/cleaner/accept-job/${jobId}`, {
        userId: currentUser?.id
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/available-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/my-jobs"] });
      toast({
        title: "Job Accepted",
        description: "You have accepted the job",
      });
    },
  });

  // Start job mutation
  const startJob = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/cleaner/start-job/${jobId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/my-jobs"] });
    },
  });

  // Complete job mutation
  const completeJob = useMutation({
    mutationFn: async ({ jobId, photoURL }: { jobId: string; photoURL: string }) => {
      const res = await apiRequest("POST", `/api/cleaner/complete-job/${jobId}`, { 
        proofPhotoURL: photoURL,
        userId: currentUser?.id
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cleaner/my-jobs"] });
      setSelectedFile(null);
      setUploadingJobId(null);
      toast({
        title: "Job Completed",
        description: "The job has been marked as completed",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, jobId: string) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadingJobId(jobId);
    }
  };

  const handleUploadProof = async (jobId: string) => {
    if (!selectedFile) return;

    // In a real app, upload to Firebase Storage first
    // For now, we'll use a placeholder
    const photoURL = `https://placeholder.com/${selectedFile.name}`;
    
    completeJob.mutate({ jobId, photoURL });
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

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header with Availability Toggle */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cleaner Dashboard</CardTitle>
                <CardDescription>{currentUser?.displayName}</CardDescription>
              </div>
              <Badge variant={cleaner.status === CleanerStatus.ON_DUTY ? "default" : "secondary"}>
                {cleaner.status === CleanerStatus.ON_DUTY ? "On Duty" : "Off Duty"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="availability" className="text-base">
                Available for Jobs
              </Label>
              <Switch
                id="availability"
                checked={cleaner.status === CleanerStatus.ON_DUTY}
                onCheckedChange={(checked) =>
                  toggleAvailability.mutate(checked ? CleanerStatus.ON_DUTY : CleanerStatus.OFF_DUTY)
                }
                data-testid="switch-availability"
              />
            </div>
          </CardContent>
        </Card>

        {/* Jobs Tabs */}
        <Tabs defaultValue="available" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available" data-testid="tab-available">
              Available ({availableJobs.length})
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              My Jobs ({activeJobs.length})
            </TabsTrigger>
          </TabsList>

          {/* Available Jobs */}
          <TabsContent value="available" className="space-y-4 mt-4">
            {loadingJobs ? (
              <>
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : availableJobs.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No available jobs at the moment</p>
              </Card>
            ) : (
              availableJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  action={
                    <Button
                      className="w-full"
                      onClick={() => acceptJob.mutate(job.id)}
                      disabled={acceptJob.isPending}
                      data-testid={`button-accept-${job.id}`}
                    >
                      Accept Job
                    </Button>
                  }
                />
              ))
            )}
          </TabsContent>

          {/* Active Jobs */}
          <TabsContent value="active" className="space-y-4 mt-4">
            {activeJobs.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active jobs</p>
              </Card>
            ) : (
              activeJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  action={
                    job.status === JobStatus.ASSIGNED ? (
                      <Button
                        className="w-full"
                        onClick={() => startJob.mutate(job.id)}
                        data-testid={`button-start-${job.id}`}
                      >
                        Start Job
                      </Button>
                    ) : job.status === JobStatus.IN_PROGRESS ? (
                      <div className="space-y-3">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileSelect(e, job.id)}
                          data-testid={`input-photo-${job.id}`}
                        />
                        <Button
                          className="w-full"
                          onClick={() => handleUploadProof(job.id)}
                          disabled={!selectedFile || uploadingJobId !== job.id || completeJob.isPending}
                          data-testid={`button-complete-${job.id}`}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Proof & Complete
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline">Completed</Badge>
                    )
                  }
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function JobCard({ job, action }: { job: Job; action: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Job #{job.id.slice(0, 8)}</CardTitle>
            <CardDescription>
              <Badge variant="outline" className="mt-1">
                ${job.price}
              </Badge>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2">
          <Car className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Plate Number</p>
            <p className="font-medium">{job.carPlateNumber}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium">{job.locationAddress}</p>
            {job.locationLatitude && job.locationLongitude && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${job.locationLatitude},${job.locationLongitude}`;
                  window.open(googleMapsUrl, "_blank");
                }}
                data-testid={`button-navigate-${job.id}`}
              >
                <Navigation className="h-3 w-3 mr-1" />
                Open in Google Maps
              </Button>
            )}
          </div>
        </div>

        {job.parkingNumber && (
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Parking</p>
              <p className="font-medium">{job.parkingNumber}</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Customer Phone</p>
            <p className="font-medium">{job.customerPhone}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>{action}</CardFooter>
    </Card>
  );
}
