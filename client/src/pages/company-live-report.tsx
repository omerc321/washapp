import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, MapPin, DollarSign, RefreshCw, ArrowLeft, Users, Briefcase } from "lucide-react";
import { Cleaner } from "@shared/schema";

interface LiveReportData {
  liveCleaners: number;
  activeLocations: number;
  revenueToday: number;
  tipsToday: number;
  netToday: number;
  completedJobsToday: number;
  refundedJobsToday: number;
  pendingJobsToday: number;
  cleanerDetails: Array<{
    id: number;
    name: string;
    email: string;
    status: string;
    currentLocation: { lat: number; lng: number } | null;
    lastLocationUpdate: Date | null;
    jobsCompletedToday: number;
  }>;
}

export default function CompanyLiveReport() {
  const [selectedCleanerId, setSelectedCleanerId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: cleaners } = useQuery<Cleaner[]>({
    queryKey: ["/api/company/cleaners"],
  });

  const { data: liveReport, isLoading: loadingReport, refetch } = useQuery<LiveReportData>({
    queryKey: ["/api/company/live-report", selectedCleanerId],
    queryFn: async () => {
      const params = selectedCleanerId ? `?cleanerId=${selectedCleanerId}` : "";
      const response = await fetch(`/api/company/live-report${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch live report");
      return response.json();
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 pt-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/company">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Live Report</h1>
              <p className="text-muted-foreground">Real-time operations overview</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <Select
                value={selectedCleanerId?.toString() || "all"}
                onValueChange={(val) => setSelectedCleanerId(val === "all" ? null : parseInt(val))}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-cleaner-filter">
                  <SelectValue placeholder="All Cleaners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cleaners</SelectItem>
                  {cleaners?.map((cleaner: any) => (
                    <SelectItem key={cleaner.id} value={cleaner.id.toString()}>
                      {cleaner.displayName || cleaner.email || `Cleaner #${cleaner.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh-report"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="button-auto-refresh"
              >
                {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
              </Button>
            </div>
          </div>

          {loadingReport ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="p-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-12 mt-2" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : liveReport ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                  <CardHeader className="p-4">
                    <CardDescription className="flex items-center gap-1">
                      <Activity className="h-4 w-4" />
                      Live Cleaners
                    </CardDescription>
                    <CardTitle className="text-2xl text-green-600 dark:text-green-400" data-testid="text-live-cleaners">
                      {liveReport.liveCleaners}
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                  <CardHeader className="p-4">
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      Active Locations
                    </CardDescription>
                    <CardTitle className="text-2xl text-blue-600 dark:text-blue-400" data-testid="text-active-locations">
                      {liveReport.activeLocations}
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                  <CardHeader className="p-4">
                    <CardDescription className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Revenue Today
                    </CardDescription>
                    <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400" data-testid="text-revenue-today">
                      {liveReport.revenueToday.toFixed(2)} AED
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                  <CardHeader className="p-4">
                    <CardDescription className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Net (excl. Tips)
                    </CardDescription>
                    <CardTitle className="text-2xl text-purple-600 dark:text-purple-400" data-testid="text-net-today">
                      {liveReport.netToday.toFixed(2)} AED
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="p-4">
                    <CardDescription>Tips Today</CardDescription>
                    <CardTitle className="text-2xl" data-testid="text-tips-today">
                      {liveReport.tipsToday.toFixed(2)} AED
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                  <CardHeader className="p-4">
                    <CardDescription className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      Completed Jobs
                    </CardDescription>
                    <CardTitle className="text-2xl text-green-600 dark:text-green-400" data-testid="text-completed-jobs">
                      {liveReport.completedJobsToday}
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                  <CardHeader className="p-4">
                    <CardDescription>Pending Jobs</CardDescription>
                    <CardTitle className="text-2xl text-yellow-600 dark:text-yellow-400" data-testid="text-pending-jobs">
                      {liveReport.pendingJobsToday}
                    </CardTitle>
                  </CardHeader>
                </Card>
                
                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                  <CardHeader className="p-4">
                    <CardDescription>Refunded Jobs</CardDescription>
                    <CardTitle className="text-2xl text-red-600 dark:text-red-400" data-testid="text-refunded-jobs">
                      {liveReport.refundedJobsToday}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Cleaner Activity
                  </CardTitle>
                  <CardDescription>Your cleaners and their status today</CardDescription>
                </CardHeader>
                <CardContent>
                  {liveReport.cleanerDetails.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No cleaner data available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cleaner</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Jobs Today</TableHead>
                            <TableHead>Last Location</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {liveReport.cleanerDetails.map((cleaner) => (
                            <TableRow key={cleaner.id} data-testid={`row-cleaner-${cleaner.id}`}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{cleaner.name}</div>
                                  <div className="text-sm text-muted-foreground">{cleaner.email}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  cleaner.status === 'on_duty' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                    : cleaner.status === 'busy'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                                }`}>
                                  {cleaner.status.replace('_', ' ')}
                                </span>
                              </TableCell>
                              <TableCell>{cleaner.jobsCompletedToday}</TableCell>
                              <TableCell>
                                {cleaner.currentLocation ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${cleaner.currentLocation.lat},${cleaner.currentLocation.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    View Map
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">No location</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Failed to load live report data
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
