import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Car, MapPin, Phone, Building2, Clock, Star, ChevronLeft, AlertCircle, Bell, BellOff } from "lucide-react";
import { Job, JobStatus } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import logoUrl from "@assets/IMG_2508_1762619079711.png";

export default function CustomerTrack() {
  const [, params] = useRoute("/customer/track/:plateNumber");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const plateNumber = params?.plateNumber || "";

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/track", plateNumber],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/track/${plateNumber}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json();
    },
    enabled: !!plateNumber,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const { permission, isSubscribed, soundEnabled, isLoading: pushLoading, isSupported, subscribe, unsubscribe, toggleSound } = usePushNotifications({
    plateNumber,
  });

  const { subscribe: wsSubscribe, isConnected } = useWebSocket({
    onMessage: (data) => {
      console.log('[Customer Track] WebSocket message received:', data);
      if (data.type === 'job_update' && data.job) {
        console.log('[Customer Track] Job update for:', data.job.carPlateNumber, 'Status:', data.job.status);
        queryClient.invalidateQueries({ queryKey: ["/api/jobs/track", plateNumber] });
        
        const statusMessages: Record<JobStatus, string> = {
          [JobStatus.ASSIGNED]: "A cleaner has been assigned to your job!",
          [JobStatus.IN_PROGRESS]: "Your car wash is now in progress!",
          [JobStatus.COMPLETED]: "Your car wash is complete!",
          [JobStatus.CANCELLED]: "Your job has been cancelled",
          [JobStatus.REFUNDED]: "Your payment has been refunded",
          [JobStatus.PAID]: "Payment confirmed",
          [JobStatus.PENDING_PAYMENT]: "Waiting for payment",
        };

        if (data.job.carPlateNumber === plateNumber && statusMessages[data.job.status as JobStatus]) {
          toast({
            title: "Job Update",
            description: statusMessages[data.job.status as JobStatus],
          });
        }
      }
    },
    onOpen: () => {
      console.log('[Customer Track] WebSocket connected');
    },
    onClose: () => {
      console.log('[Customer Track] WebSocket disconnected');
    },
  });

  // Subscribe to job updates when jobs are loaded
  useEffect(() => {
    if (jobs && jobs.length > 0 && isConnected) {
      console.log('[Customer Track] Subscribing to', jobs.length, 'jobs');
      jobs.forEach(job => {
        console.log('[Customer Track] Subscribing to job:', job.id);
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
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/track", plateNumber] });
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

  const getStatusBadge = (status: JobStatus) => {
    const statusConfig = {
      [JobStatus.PENDING_PAYMENT]: { label: "Pending Payment", variant: "secondary" as const },
      [JobStatus.PAID]: { label: "Waiting for Cleaner", variant: "secondary" as const },
      [JobStatus.ASSIGNED]: { label: "Cleaner Assigned", variant: "default" as const },
      [JobStatus.IN_PROGRESS]: { label: "In Progress", variant: "default" as const },
      [JobStatus.COMPLETED]: { label: "Completed", variant: "outline" as const },
      [JobStatus.CANCELLED]: { label: "Cancelled", variant: "destructive" as const },
      [JobStatus.REFUNDED]: { label: "Refunded", variant: "secondary" as const },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const currentJob = jobs?.find(
    (job) => job.status !== JobStatus.COMPLETED && job.status !== JobStatus.CANCELLED && job.status !== JobStatus.REFUNDED
  );

  const completedJobs = jobs?.filter((job) => 
    job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED || job.status === JobStatus.REFUNDED
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Clean and minimal */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <img src={logoUrl} alt="Washapp.ae" className="h-10 w-auto" data-testid="img-logo" />
            <div className="flex-1">
              <h1 className="text-base font-semibold">{plateNumber}</h1>
              <p className="text-xs text-muted-foreground">
                Car wash tracking
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/")}
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

        {/* Push Notification Banner - Only show if supported */}
        {isSupported && !isSubscribed && permission === 'default' && jobs && jobs.length > 0 && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Get instant job updates</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable notifications to receive real-time alerts about your car wash
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={subscribe}
                  disabled={pushLoading}
                  data-testid="button-enable-notifications"
                >
                  {pushLoading ? 'Enabling...' : 'Enable'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notification Status */}
        {isSubscribed && (
          <Card className="mb-4 border-green-500/20 bg-green-500/5">
            <CardContent className="p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-green-600" />
                    <p className="text-sm text-green-600">Notifications enabled</p>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Sound</span>
                  </div>
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
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No car wash history found for plate number: <strong>{plateNumber}</strong>
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/")}
                data-testid="button-book-wash"
              >
                Book Your First Wash
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Current Active Job */}
            {currentJob && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Current Wash</h2>
                <JobCard
                  job={currentJob}
                  showRatingButton={false}
                  getStatusBadge={getStatusBadge}
                />
              </div>
            )}

            {/* Completed Jobs History */}
            {completedJobs && completedJobs.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">History</h2>
                <div className="space-y-4">
                  {completedJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      showRatingButton={job.status === JobStatus.COMPLETED && !job.rating}
                      getStatusBadge={getStatusBadge}
                      onRate={() => setSelectedJob(job)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Rating Modal */}
        {selectedJob && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Rate Your Car Wash</CardTitle>
                <CardDescription>Job #{selectedJob.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Star Rating */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="focus:outline-none"
                      data-testid={`button-star-${star}`}
                    >
                      <Star
                        className={`h-8 w-8 ${
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
                  className="flex-1"
                  disabled={rating === 0 || submitRating.isPending}
                  onClick={() => submitRating.mutate()}
                  data-testid="button-submit-rating"
                >
                  {submitRating.isPending ? "Submitting..." : "Submit Rating"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  showRatingButton,
  getStatusBadge,
  onRate,
}: {
  job: Job;
  showRatingButton: boolean;
  getStatusBadge: (status: JobStatus) => React.ReactNode;
  onRate?: () => void;
}) {
  return (
    <Card data-testid={`job-card-${job.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Job #{job.id}</CardTitle>
            <CardDescription className="mt-1">
              {new Date(job.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          {getStatusBadge(job.status as JobStatus)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Refund Message */}
        {job.status === JobStatus.REFUNDED && (
          <div className="bg-muted/50 border border-muted rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <p className="font-medium mb-1">Full Refund Processed</p>
              <p className="text-muted-foreground">
                No cleaner accepted your job within 15 minutes. 
                Your payment of {job.totalAmount} د.إ has been fully refunded 
                and will appear on your card within 10 business days.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium">{job.locationAddress}</p>
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
            <p className="text-sm text-muted-foreground">Contact</p>
            <p className="font-medium">{job.customerPhone}</p>
          </div>
        </div>

        {job.completedAt && (
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="font-medium">
                {new Date(job.completedAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Proof Photo - Show after completion */}
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

        {job.rating && (
          <div className="flex items-center gap-2 pt-2 border-t">
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
        )}

        {job.review && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground mb-1">Your Review</p>
            <p className="text-sm italic">{job.review}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total Paid</span>
          <span className="text-lg font-bold">{job.totalAmount} د.إ</span>
        </div>
      </CardContent>

      {showRatingButton && onRate && (
        <CardFooter>
          <Button
            className="w-full"
            variant="outline"
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
