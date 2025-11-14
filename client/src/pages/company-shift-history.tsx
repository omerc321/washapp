import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { ArrowLeft, Download, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import ExcelJS from "exceljs";

type CleanerWithUser = {
  id: number;
  userId: number;
  displayName: string | null;
  email: string | null;
};

type ShiftHistoryItem = {
  id: number;
  cleanerId: number;
  companyId: number;
  shiftStart: string;
  shiftEnd: string | null;
  durationMinutes: number | null;
  cleanerName: string;
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
};

export default function CompanyShiftHistory() {
  const { currentUser } = useAuth();
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch cleaners
  const { data: cleaners = [] } = useQuery<CleanerWithUser[]>({
    queryKey: ["/api/company/cleaners"],
    enabled: !!currentUser?.companyId,
  });

  // Fetch shift history with proper query construction
  const { data: shiftHistory = [], isLoading } = useQuery<ShiftHistoryItem[]>({
    queryKey: ["/api/company/shift-history", selectedCleanerId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCleanerId !== "all") {
        params.append("cleanerId", selectedCleanerId);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }
      
      const url = `/api/company/shift-history${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch shift history");
      return response.json();
    },
    enabled: !!currentUser?.companyId,
  });

  // Filter by search query (cleaner name)
  const filteredShifts = shiftHistory.filter(shift => 
    shift.cleanerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export to Excel
  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Shift History");

    // Define columns
    worksheet.columns = [
      { header: "Cleaner Name", key: "cleanerName", width: 25 },
      { header: "Start Date", key: "startDate", width: 20 },
      { header: "Start Time", key: "startTime", width: 15 },
      { header: "End Date", key: "endDate", width: 20 },
      { header: "End Time", key: "endTime", width: 15 },
      { header: "Duration (Hours)", key: "duration", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ];

    // Add data
    filteredShifts.forEach(shift => {
      const startDate = new Date(shift.shiftStart);
      const endDate = shift.shiftEnd ? new Date(shift.shiftEnd) : null;
      const durationHours = shift.durationMinutes ? (shift.durationMinutes / 60).toFixed(2) : "Ongoing";

      worksheet.addRow({
        cleanerName: shift.cleanerName || `Cleaner #${shift.cleanerId}`,
        startDate: format(startDate, "PPP"),
        startTime: format(startDate, "p"),
        endDate: endDate ? format(endDate, "PPP") : "-",
        endTime: endDate ? format(endDate, "p") : "-",
        duration: durationHours,
        status: shift.shiftEnd ? "Completed" : "Ongoing",
      });
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Generate file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shift-history-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/company">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Shift History</h1>
            <p className="text-muted-foreground">
              View and export shift records for your cleaners
            </p>
          </div>
          <Button 
            onClick={exportToExcel}
            disabled={filteredShifts.length === 0}
            data-testid="button-export-excel"
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter shift history by cleaner, date range, and name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Cleaner Select */}
              <div className="space-y-2">
                <Label htmlFor="cleaner-filter">Cleaner</Label>
                <Select value={selectedCleanerId} onValueChange={setSelectedCleanerId}>
                  <SelectTrigger id="cleaner-filter" data-testid="select-cleaner-filter">
                    <SelectValue placeholder="All Cleaners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cleaners</SelectItem>
                    {cleaners.map((cleaner) => (
                      <SelectItem key={cleaner.id} value={cleaner.id.toString()}>
                        {cleaner.displayName || cleaner.email || `Cleaner #${cleaner.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>

              {/* Search by Name */}
              <div className="space-y-2">
                <Label htmlFor="search-name">Search Name</Label>
                <Input
                  id="search-name"
                  type="text"
                  placeholder="Search cleaner name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-name"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCleanerId("all");
                  setStartDate("");
                  setEndDate("");
                  setSearchQuery("");
                }}
                data-testid="button-clear-filters"
              >
                Clear All Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""}
        </div>

        {/* Shift History Table */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredShifts.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Shift History Found</p>
            <p className="text-muted-foreground">
              {shiftHistory.length === 0
                ? "No shifts have been recorded yet."
                : "No shifts match your current filters."}
            </p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cleaner Name</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Total Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShifts.map((shift) => {
                  const isOngoing = !shift.shiftEnd;
                  const durationText = shift.durationMinutes != null
                    ? `${Math.floor(shift.durationMinutes / 60)}h ${shift.durationMinutes % 60}m`
                    : "Ongoing";

                  return (
                    <TableRow key={shift.id} data-testid={`shift-row-${shift.id}`}>
                      <TableCell data-testid={`shift-date-${shift.id}`}>
                        {format(new Date(shift.shiftStart), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell data-testid={`shift-cleaner-${shift.id}`}>
                        {shift.cleanerName || `Cleaner #${shift.cleanerId}`}
                      </TableCell>
                      <TableCell data-testid={`shift-start-${shift.id}`}>
                        {format(new Date(shift.shiftStart), "h:mm a")}
                      </TableCell>
                      <TableCell data-testid={`shift-end-${shift.id}`}>
                        {shift.shiftEnd ? format(new Date(shift.shiftEnd), "h:mm a") : (
                          <Badge variant="default">Ongoing</Badge>
                        )}
                      </TableCell>
                      <TableCell data-testid={`shift-duration-${shift.id}`}>
                        {isOngoing ? (
                          <Badge variant="default">Ongoing</Badge>
                        ) : (
                          durationText
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
