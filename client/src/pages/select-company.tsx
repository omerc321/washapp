import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Star } from "lucide-react";
import { CompanyWithCleaners } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function SelectCompany() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [pendingJob, setPendingJob] = useState<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingJob");
    if (!stored) {
      setLocation("/customer");
      return;
    }
    setPendingJob(JSON.parse(stored));
  }, [setLocation]);

  const { data: companies, isLoading } = useQuery<CompanyWithCleaners[]>({
    queryKey: ["/api/companies/nearby", pendingJob?.locationLatitude, pendingJob?.locationLongitude],
    enabled: !!pendingJob && 
             typeof pendingJob.locationLatitude === 'number' && 
             typeof pendingJob.locationLongitude === 'number' &&
             !isNaN(pendingJob.locationLatitude) &&
             !isNaN(pendingJob.locationLongitude),
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: pendingJob.locationLatitude.toString(),
        lon: pendingJob.locationLongitude.toString(),
      });
      const res = await fetch(`/api/companies/nearby?${params}`);
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
  });

  const handleSelectCompany = (company: CompanyWithCleaners) => {
    const basePrice = company.pricePerWash;
    const taxAmount = Number((basePrice * 0.05).toFixed(2)); // 5% tax
    const platformFee = 3;
    const totalPrice = Number((basePrice + taxAmount + platformFee).toFixed(2));
    
    const updatedJob = {
      ...pendingJob,
      companyId: company.id,
      price: totalPrice,
      basePrice,
      taxAmount,
      platformFee,
    };
    sessionStorage.setItem("pendingJob", JSON.stringify(updatedJob));
    setLocation("/customer/checkout");
  };

  if (!pendingJob) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Clean and minimal */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Select Company</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Available cleaners nearby
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation("/customer")}
              data-testid="button-back"
            >
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto w-full px-4 py-6 pb-24">

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-lg p-4">
                <Skeleton className="h-5 w-2/3 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Companies List - Modern cards */}
        {!isLoading && companies && companies.length > 0 && (
          <div className="space-y-3">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectCompany(company)}
                data-testid={`button-select-company-${company.id}`}
                className="w-full text-left border rounded-lg p-4 hover-elevate active-elevate-2 transition-all"
              >
                {/* Company Name and Price */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-foreground truncate">
                      {company.name}
                    </h3>
                    {company.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {company.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-foreground">
                      {(() => {
                        const base = company.pricePerWash;
                        const tax = Number((base * 0.05).toFixed(2));
                        const total = Number((base + tax + 3).toFixed(2));
                        return total;
                      })()} د.إ
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight">
                      {company.pricePerWash} د.إ + 5% tax + 3 د.إ fee
                    </div>
                  </div>
                </div>

                {/* Company Info - Compact badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {company.onDutyCleanersCount} available
                  </Badge>
                  
                  {company.rating && Number(company.rating) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {Number(company.rating).toFixed(1)}
                    </Badge>
                  )}

                  {company.distanceInMeters !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      {company.distanceInMeters}m
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                {company.totalJobsCompleted > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {company.totalJobsCompleted} jobs completed
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && companies && companies.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Companies Available</h3>
            <p className="text-muted-foreground text-sm mb-6">
              No companies with available cleaners near your location right now.
            </p>
            <Button variant="outline" onClick={() => setLocation("/customer")}>
              Go Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
