import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Car, MapPin, Clock, CheckCircle2, Building2 } from "lucide-react";
import { Job, JobStatus } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

export default function CustomerJobs() {
  const { currentUser } = useAuth();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/customer/jobs", currentUser?.id],
    enabled: !!currentUser,
  });

  const activeJobs = jobs.filter(j => 
    [JobStatus.PAID, JobStatus.ASSIGNED, JobStatus.IN_PROGRESS].includes(j.status)
  );
  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            My Jobs
          </h1>
          <p className="text-muted-foreground">
            Track your car wash bookings
          </p>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" data-testid="tab-active-jobs">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-jobs">
              Completed ({completedJobs.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Jobs */}
          <TabsContent value="active" className="space-y-4 mt-4">
            {isLoading ? (
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
            ) : activeJobs.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active jobs</p>
              </Card>
            ) : (
              activeJobs.map((job) => <JobCard key={job.id} job={job} />)
            )}
          </TabsContent>

          {/* Completed Jobs */}
          <TabsContent value="completed" className="space-y-4 mt-4">
            {completedJobs.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No completed jobs yet</p>
              </Card>
            ) : (
              completedJobs.map((job) => <JobCard key={job.id} job={job} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const getStatusBadge = (status: JobStatus) => {
    const statusConfig = {
      [JobStatus.PAID]: { label: "Waiting for Cleaner", variant: "secondary" as const },
      [JobStatus.ASSIGNED]: { label: "Assigned", variant: "default" as const },
      [JobStatus.IN_PROGRESS]: { label: "In Progress", variant: "default" as const },
      [JobStatus.COMPLETED]: { label: "Completed", variant: "outline" as const },
      [JobStatus.CANCELLED]: { label: "Cancelled", variant: "destructive" as const },
      [JobStatus.PENDING_PAYMENT]: { label: "Pending Payment", variant: "secondary" as const },
    };

    const config = statusConfig[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card data-testid={`job-card-${job.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Job #{job.id.slice(0, 8)}</CardTitle>
            <CardDescription className="mt-1">
              {new Date(job.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          {getStatusBadge(job.status)}
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

        <div className="pt-2 border-t flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-bold">${job.price}</span>
        </div>
      </CardContent>
    </Card>
  );
}
