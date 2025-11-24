import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Complaint } from "@shared/schema";
import { useState, useMemo } from "react";
import { AlertCircle, CheckCircle2, DollarSign, Search } from "lucide-react";

export default function CompanyComplaints() {
  const { toast } = useToast();
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [status, setStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchReference, setSearchReference] = useState<string>("");

  const { data: complaints = [], isLoading } = useQuery<Complaint[]>({
    queryKey: ["/api/company/complaints"],
  });

  // Filter complaints based on status and search
  const filteredComplaints = useMemo(() => {
    return complaints.filter((complaint) => {
      const matchesStatus = statusFilter === "all" || complaint.status === statusFilter;
      const matchesSearch = searchReference === "" || 
        complaint.referenceNumber.toLowerCase().includes(searchReference.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [complaints, statusFilter, searchReference]);

  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedComplaint) return;
      
      const response = await fetch(`/api/company/complaints/${selectedComplaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update complaint");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/complaints"] });
      setSelectedComplaint(null);
      setStatus("");
      setResolution("");
      toast({
        title: "Complaint Updated",
        description: "The complaint status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update complaint",
      });
    },
  });

  const refundMutation = useMutation({
    mutationFn: async (complaintId: number) => {
      const response = await fetch(`/api/complaints/${complaintId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process refund");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/complaints"] });
      setSelectedComplaint(null);
      toast({
        title: "Refund Processed",
        description: "The refund has been processed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Refund Failed",
        description: error.message || "Failed to process refund",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "secondary",
      in_progress: "default",
      resolved: "outline",
      refunded: "outline",
    };
    const labels: Record<string, string> = {
      pending: "Pending",
      in_progress: "In Progress",
      resolved: "Resolved",
      refunded: "Refunded",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    return type === 'refund_request' ? (
      <Badge variant="destructive">Refund Request</Badge>
    ) : (
      <Badge variant="secondary">General</Badge>
    );
  };

  const openComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setStatus(complaint.status);
    setResolution(complaint.resolution || "");
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Customer Complaints
          </h1>
          <p className="text-muted-foreground">
            Manage and resolve customer issues
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Complaints</CardTitle>
            <CardDescription>
              {filteredComplaints.length} of {complaints.length} complaints
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by reference number..."
                    value={searchReference}
                    onChange={(e) => setSearchReference(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-reference"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filteredComplaints.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {complaints.length === 0 ? "No complaints yet" : "No complaints match your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Job ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComplaints.map((complaint) => (
                      <TableRow key={complaint.id} data-testid={`complaint-row-${complaint.id}`}>
                        <TableCell className="font-mono text-sm">
                          {complaint.referenceNumber}
                        </TableCell>
                        <TableCell>#{complaint.jobId}</TableCell>
                        <TableCell>{getTypeBadge(complaint.type)}</TableCell>
                        <TableCell>{getStatusBadge(complaint.status)}</TableCell>
                        <TableCell className="text-sm">
                          {complaint.customerPhone}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(complaint.createdAt).toLocaleDateString('en-AE', {
                            timeZone: 'Asia/Dubai',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openComplaint(complaint)}
                            data-testid={`button-view-${complaint.id}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Complaint Detail Dialog */}
        {selectedComplaint && (
          <Dialog open={!!selectedComplaint} onOpenChange={() => setSelectedComplaint(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Complaint Details</DialogTitle>
                <DialogDescription>
                  Reference: {selectedComplaint.referenceNumber}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Complaint Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Job ID</p>
                    <p className="text-lg">#{selectedComplaint.jobId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Type</p>
                    <div className="mt-1">{getTypeBadge(selectedComplaint.type)}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Customer</p>
                    <p>{selectedComplaint.customerPhone}</p>
                    {selectedComplaint.customerEmail && (
                      <p className="text-sm text-muted-foreground">{selectedComplaint.customerEmail}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p>{new Date(selectedComplaint.createdAt).toLocaleString('en-AE', {
                      timeZone: 'Asia/Dubai',
                    })}</p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedComplaint.description}</p>
                </div>

                {/* Update Status */}
                {selectedComplaint.status !== 'refunded' && (
                  <>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {status === 'resolved' && (
                      <div className="space-y-2">
                        <Label>Resolution *</Label>
                        <Textarea
                          placeholder="Explain how the issue was resolved..."
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          rows={4}
                          data-testid="textarea-resolution"
                        />
                        <p className="text-xs text-muted-foreground">
                          This will be sent to the customer
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateStatusMutation.mutate()}
                        disabled={updateStatusMutation.isPending || (status === 'resolved' && !resolution.trim())}
                        data-testid="button-update-status"
                      >
                        {updateStatusMutation.isPending ? "Updating..." : "Update Status"}
                      </Button>

                      {selectedComplaint.type === 'refund_request' && selectedComplaint.status !== 'refunded' && (
                        <Button
                          variant="destructive"
                          onClick={() => refundMutation.mutate(selectedComplaint.id)}
                          disabled={refundMutation.isPending}
                          data-testid="button-process-refund"
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          {refundMutation.isPending ? "Processing..." : "Process Refund"}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Show resolution if resolved */}
                {selectedComplaint.resolution && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Resolution</p>
                    <p className="text-sm bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      {selectedComplaint.resolution}
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
