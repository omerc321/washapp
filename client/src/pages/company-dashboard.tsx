import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Briefcase, DollarSign, Star, TrendingUp } from "lucide-react";
import { CompanyAnalytics } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

export default function CompanyDashboard() {
  const { currentUser } = useAuth();

  const { data: analytics, isLoading } = useQuery<CompanyAnalytics>({
    queryKey: ["/api/company/analytics", currentUser?.companyId],
    enabled: !!currentUser?.companyId,
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
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full text-center p-6">
          <p className="text-muted-foreground">Company analytics not available</p>
        </Card>
      </div>
    );
  }

  const metrics = [
    {
      title: "Jobs Completed",
      value: analytics.totalJobsCompleted,
      icon: Briefcase,
      description: "All time",
    },
    {
      title: "Active Cleaners",
      value: analytics.activeCleaners,
      icon: Users,
      description: "Currently available",
    },
    {
      title: "Total Revenue",
      value: `$${analytics.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: "All time",
    },
    {
      title: "Average Rating",
      value: analytics.averageRating.toFixed(1),
      icon: Star,
      description: "Customer satisfaction",
    },
    {
      title: "Jobs This Month",
      value: analytics.jobsThisMonth,
      icon: TrendingUp,
      description: "Current month",
    },
    {
      title: "Revenue This Month",
      value: `$${analytics.revenueThisMonth.toLocaleString()}`,
      icon: DollarSign,
      description: "Current month",
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Company Dashboard
          </h1>
          <p className="text-muted-foreground">
            Company analytics and performance
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
      </div>
    </div>
  );
}
