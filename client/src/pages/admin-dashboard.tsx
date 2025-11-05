import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, Briefcase, DollarSign, TrendingUp, CheckCircle2, Check, X } from "lucide-react";
import { AdminAnalytics, Company } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { data: analytics, isLoading } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: pendingCompanies, isLoading: isLoadingPending } = useQuery<Company[]>({
    queryKey: ["/api/admin/pending-companies"],
  });

  const approveMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest("POST", `/api/admin/approve-company/${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Company Approved",
        description: "The company has been approved and is now active.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest("POST", `/api/admin/reject-company/${companyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({
        title: "Company Rejected",
        description: "The company has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 pt-4">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const metrics = [
    {
      title: "Total Companies",
      value: analytics.totalCompanies,
      icon: Building2,
      description: "Registered companies",
    },
    {
      title: "Total Cleaners",
      value: analytics.totalCleaners,
      icon: Users,
      description: "Active cleaners",
    },
    {
      title: "Active Jobs",
      value: analytics.activeJobs,
      icon: Briefcase,
      description: "Currently ongoing",
    },
    {
      title: "Completed Jobs",
      value: analytics.completedJobs,
      icon: CheckCircle2,
      description: "All time",
    },
    {
      title: "Total Revenue",
      value: `$${analytics.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: "All time",
    },
    {
      title: "Revenue This Month",
      value: `$${analytics.revenueThisMonth.toLocaleString()}`,
      icon: TrendingUp,
      description: "Current month",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Platform analytics and insights
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.title} data-testid={`metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {metric.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metric.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pending Companies */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Pending Company Approvals</CardTitle>
              <CardDescription>
                Review and approve new company registrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPending ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : pendingCompanies && pendingCompanies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Admin Email</TableHead>
                      <TableHead>Price/Wash</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCompanies.map((company) => (
                      <TableRow key={company.id} data-testid={`pending-company-${company.id}`}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-muted-foreground">{company.description || "N/A"}</TableCell>
                        <TableCell>${company.pricePerWash}</TableCell>
                        <TableCell className="text-sm">{company.tradeLicenseNumber || "N/A"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveMutation.mutate(company.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-approve-${company.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate(company.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                            data-testid={`button-reject-${company.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No pending companies to review
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
