import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Wallet, Car, Banknote, Clock, User, Search, CalendarDays, MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { Cleaner } from "@shared/schema";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

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

type CleanerWithUser = Cleaner & {
  displayName: string | null;
  phoneNumber: string | null;
  email: string | null;
};

export default function CompanyOfflineJobs() {
  const { currentUser } = useAuth();
  const [cleanerFilter, setCleanerFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: cleaners = [] } = useQuery<CleanerWithUser[]>({
    queryKey: ["/api/company/cleaners"],
    enabled: !!currentUser?.companyId,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (cleanerFilter !== "all") {
      params.append("cleanerId", cleanerFilter);
    }
    if (startDate) {
      params.append("startDate", startDate);
    }
    if (endDate) {
      params.append("endDate", endDate);
    }
    params.append("page", String(page));
    params.append("pageSize", String(pageSize));
    return params.toString();
  }, [cleanerFilter, startDate, endDate, page]);

  const { data: offlineJobsResponse, isLoading: loadingOfflineJobs } = useQuery<{ data: OfflineJob[], total: number }>({
    queryKey: ["/api/company/offline-jobs", cleanerFilter, startDate, endDate, page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/company/offline-jobs?${queryString}`);
      return response.json();
    },
    enabled: !!currentUser?.companyId,
  });

  const offlineJobs = offlineJobsResponse?.data || [];
  const totalJobs = offlineJobsResponse?.total || 0;
  const totalPages = Math.ceil(totalJobs / pageSize);

  const totalRevenue = useMemo(() => {
    return offlineJobs.reduce((sum, job) => sum + parseFloat(job.totalAmount), 0);
  }, [offlineJobs]);

  const totalVAT = useMemo(() => {
    return offlineJobs.reduce((sum, job) => sum + parseFloat(job.vatAmount), 0);
  }, [offlineJobs]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/company">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Cash/Offline Jobs</h1>
            <p className="text-muted-foreground text-sm">Track manually recorded payments</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card data-testid="card-total-revenue">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-lg font-bold" data-testid="text-total-revenue">{totalRevenue.toFixed(2)} AED</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-vat">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Total VAT</p>
                  <p className="text-lg font-bold" data-testid="text-total-vat">{totalVAT.toFixed(2)} AED</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Cleaner</label>
                <Select value={cleanerFilter} onValueChange={(val) => { setCleanerFilter(val); setPage(1); }}>
                  <SelectTrigger data-testid="select-cleaner-filter">
                    <SelectValue placeholder="All Cleaners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cleaners</SelectItem>
                    {cleaners.map((cleaner) => (
                      <SelectItem key={cleaner.id} value={String(cleaner.id)}>
                        {cleaner.displayName || `Cleaner #${cleaner.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            {(cleanerFilter !== "all" || startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCleanerFilter("all");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Recorded Jobs
              </span>
              <Badge variant="secondary">{totalJobs} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOfflineJobs ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <Skeleton className="h-6 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : offlineJobs.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium">No offline jobs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {cleanerFilter !== "all" || startDate || endDate 
                    ? "Try adjusting your filters" 
                    : "Cleaners can record cash payments from their dashboard"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {offlineJobs.map((job) => (
                  <Card key={job.id} data-testid={`card-offline-job-${job.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-primary" />
                          <span className="font-bold">
                            {job.carPlateEmirate && job.carPlateCode 
                              ? `${job.carPlateEmirate} ${job.carPlateCode} ${job.carPlateNumber}`
                              : job.carPlateNumber}
                          </span>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <Banknote className="h-3 w-3 mr-1" />
                          Cash
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{job.cleanerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {new Date(job.createdAt).toLocaleString('en-AE', { 
                              timeZone: 'Asia/Dubai',
                              dateStyle: 'short',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>
                      </div>

                      {job.notes && (
                        <div className="text-sm text-muted-foreground mb-3 flex items-start gap-2">
                          <MessageCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{job.notes}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t pt-3 text-sm">
                        <div className="flex gap-4">
                          <span>Service: <strong>{job.servicePrice} AED</strong></span>
                          <span>VAT: <strong>{job.vatAmount} AED</strong></span>
                        </div>
                        <span className="text-primary font-bold">Total: {job.totalAmount} AED</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPage(Math.max(1, page - 1))}
                            className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            data-testid="button-prev-page"
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setPage(pageNum)}
                                isActive={page === pageNum}
                                className="cursor-pointer"
                                data-testid={`button-page-${pageNum}`}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            data-testid="button-next-page"
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                    <p className="text-center text-sm text-muted-foreground mt-2">
                      Page {page} of {totalPages} ({totalJobs} jobs)
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
