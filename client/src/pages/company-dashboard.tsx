import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, Briefcase, DollarSign, Star, TrendingUp, UserPlus } from "lucide-react";
import { CompanyAnalytics, Cleaner } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function CompanyDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCleaner, setNewCleaner] = useState({
    email: "",
    password: "",
    displayName: "",
    phoneNumber: "",
  });

  const { data: analytics, isLoading } = useQuery<CompanyAnalytics>({
    queryKey: ["/api/company/analytics", currentUser?.companyId],
    enabled: !!currentUser?.companyId,
  });

  const { data: cleaners, isLoading: isLoadingCleaners } = useQuery<Cleaner[]>({
    queryKey: ["/api/company/cleaners"],
    enabled: !!currentUser?.companyId,
  });

  const addCleanerMutation = useMutation({
    mutationFn: async (data: typeof newCleaner) => {
      return await apiRequest("/api/company/add-cleaner", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/cleaners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/analytics"] });
      setIsAddDialogOpen(false);
      setNewCleaner({ email: "", password: "", displayName: "", phoneNumber: "" });
      toast({
        title: "Cleaner Added",
        description: "The cleaner has been successfully added to your company.",
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

        {/* Car Washers Management */}
        <div className="mt-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Car Washers</CardTitle>
                <CardDescription>
                  Manage your team of car wash cleaners
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-cleaner">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Cleaner
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Car Washer</DialogTitle>
                    <DialogDescription>
                      Create a new cleaner account for your company
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Full Name</Label>
                      <Input
                        id="displayName"
                        placeholder="John Doe"
                        value={newCleaner.displayName}
                        onChange={(e) => setNewCleaner({ ...newCleaner, displayName: e.target.value })}
                        data-testid="input-cleaner-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="cleaner@example.com"
                        value={newCleaner.email}
                        onChange={(e) => setNewCleaner({ ...newCleaner, email: e.target.value })}
                        data-testid="input-cleaner-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={newCleaner.password}
                        onChange={(e) => setNewCleaner({ ...newCleaner, password: e.target.value })}
                        data-testid="input-cleaner-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="+65 1234 5678"
                        value={newCleaner.phoneNumber}
                        onChange={(e) => setNewCleaner({ ...newCleaner, phoneNumber: e.target.value })}
                        data-testid="input-cleaner-phone"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => addCleanerMutation.mutate(newCleaner)}
                      disabled={addCleanerMutation.isPending || !newCleaner.email || !newCleaner.password || !newCleaner.displayName}
                      data-testid="button-submit-cleaner"
                    >
                      {addCleanerMutation.isPending ? "Adding..." : "Add Cleaner"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingCleaners ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : cleaners && cleaners.length > 0 ? (
                <div className="space-y-4">
                  {cleaners.map((cleaner) => (
                    <div
                      key={cleaner.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`cleaner-${cleaner.id}`}
                    >
                      <div>
                        <p className="font-medium">Cleaner ID: {cleaner.id}</p>
                        <p className="text-sm text-muted-foreground">
                          Status: {cleaner.status.replace("_", " ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Jobs: {cleaner.totalJobsCompleted}</p>
                        <p className="text-sm text-muted-foreground">
                          Rating: {cleaner.rating || "N/A"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No cleaners yet. Add your first car washer to get started!
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
