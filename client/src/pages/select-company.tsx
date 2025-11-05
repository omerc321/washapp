import { useEffect, useState } from "react";
import { useNavigate } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Star } from "lucide-react";
import { CompanyWithCleaners } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function SelectCompany() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingJob, setPendingJob] = useState<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingJob");
    if (!stored) {
      navigate("/customer");
      return;
    }
    setPendingJob(JSON.parse(stored));
  }, [navigate]);

  const { data: companies, isLoading } = useQuery<CompanyWithCleaners[]>({
    queryKey: ["/api/companies/nearby", pendingJob?.locationLatitude, pendingJob?.locationLongitude],
    enabled: !!pendingJob,
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
    const updatedJob = {
      ...pendingJob,
      companyId: company.id,
      price: company.pricePerWash,
    };
    sessionStorage.setItem("pendingJob", JSON.stringify(updatedJob));
    navigate("/customer/checkout");
  };

  if (!pendingJob) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Select Company
          </h1>
          <p className="text-muted-foreground">
            Companies with available cleaners nearby
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Companies List */}
        {!isLoading && companies && companies.length > 0 && (
          <div className="space-y-4">
            {companies.map((company) => (
              <Card key={company.id} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground">
                        {company.name}
                      </h3>
                      {company.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {company.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        ${company.pricePerWash}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{company.onDutyCleanersCount} available</span>
                    </div>
                    
                    {company.rating > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 fill-current text-yellow-500" />
                        <span>{company.rating.toFixed(1)}</span>
                      </div>
                    )}

                    {company.distanceInMeters !== undefined && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{company.distanceInMeters}m away</span>
                      </div>
                    )}
                  </div>

                  {company.totalJobsCompleted > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {company.totalJobsCompleted} jobs completed
                    </p>
                  )}
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSelectCompany(company)}
                    data-testid={`button-select-company-${company.id}`}
                  >
                    Select & Pay ${company.pricePerWash}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && companies && companies.length === 0 && (
          <Card className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Companies Available</h3>
            <p className="text-muted-foreground mb-4">
              There are no companies with available cleaners near your location at the moment.
            </p>
            <Button variant="outline" onClick={() => navigate("/customer")}>
              Go Back
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
