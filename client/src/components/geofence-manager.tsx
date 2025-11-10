import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Trash2, Plus, Edit } from "lucide-react";
import GeofenceEditor from "./geofence-editor";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CompanyGeofence } from "@shared/schema";

interface GeofenceManagerProps {
  companyId: number;
}

export default function GeofenceManager({ companyId }: GeofenceManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<CompanyGeofence | null>(null);
  const [geofenceName, setGeofenceName] = useState("");
  const [geofencePolygon, setGeofencePolygon] = useState<Array<[number, number]> | null>(null);
  const { toast } = useToast();

  // Fetch all geofences
  const { data: geofences, isLoading } = useQuery<CompanyGeofence[]>({
    queryKey: ["/api/company/geofences"],
  });

  // Create geofence mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; polygon: Array<[number, number]> }) => {
      return await apiRequest("POST", "/api/company/geofences", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/geofences"] });
      toast({
        title: "Geofence Created",
        description: "The geofence has been created successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create geofence",
        variant: "destructive",
      });
    },
  });

  // Update geofence mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; name?: string; polygon?: Array<[number, number]> }) => {
      const { id, ...updates } = data;
      return await apiRequest("PATCH", `/api/company/geofences/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/geofences"] });
      toast({
        title: "Geofence Updated",
        description: "The geofence has been updated successfully.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update geofence",
        variant: "destructive",
      });
    },
  });

  // Delete geofence mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/company/geofences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/geofences"] });
      toast({
        title: "Geofence Deleted",
        description: "The geofence has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete geofence",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingGeofence(null);
    setGeofenceName("");
    setGeofencePolygon(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (geofence: CompanyGeofence) => {
    setEditingGeofence(geofence);
    setGeofenceName(geofence.name);
    setGeofencePolygon(geofence.polygon as Array<[number, number]>);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGeofence(null);
    setGeofenceName("");
    setGeofencePolygon(null);
  };

  const handleSave = () => {
    if (!geofenceName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the geofence",
        variant: "destructive",
      });
      return;
    }

    if (!geofencePolygon || geofencePolygon.length < 3) {
      toast({
        title: "Invalid Geofence",
        description: "Please draw a geofence area with at least 3 points",
        variant: "destructive",
      });
      return;
    }

    if (editingGeofence) {
      // Update existing geofence
      const updates: { id: number; name?: string; polygon?: Array<[number, number]> } = {
        id: editingGeofence.id,
      };

      if (geofenceName !== editingGeofence.name) {
        updates.name = geofenceName;
      }

      if (JSON.stringify(geofencePolygon) !== JSON.stringify(editingGeofence.polygon)) {
        updates.polygon = geofencePolygon;
      }

      if (updates.name || updates.polygon) {
        updateMutation.mutate(updates);
      } else {
        handleCloseDialog();
      }
    } else {
      // Create new geofence
      createMutation.mutate({
        name: geofenceName,
        polygon: geofencePolygon,
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this geofence?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Areas</CardTitle>
          <CardDescription>Loading geofences...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="geofence-manager">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Service Areas</CardTitle>
              <CardDescription>
                Manage your service areas where cleaners can accept jobs
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate} size="sm" data-testid="button-create-geofence">
              <Plus className="h-4 w-4 mr-2" />
              Add Area
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!geofences || geofences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No service areas defined yet</p>
              <p className="text-sm">Create your first service area to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {geofences.map((geofence) => (
                <div
                  key={geofence.id}
                  className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                  data-testid={`geofence-item-${geofence.id}`}
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium" data-testid={`text-geofence-name-${geofence.id}`}>
                        {geofence.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(geofence.polygon as Array<[number, number]>).length} points
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(geofence)}
                      data-testid={`button-edit-${geofence.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(geofence.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${geofence.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGeofence ? "Edit Service Area" : "Create Service Area"}
            </DialogTitle>
            <DialogDescription>
              {editingGeofence 
                ? "Update the name or boundaries of your service area"
                : "Define a new service area where your cleaners can accept jobs"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="geofence-name">Area Name</Label>
              <Input
                id="geofence-name"
                placeholder="e.g., Downtown Dubai, Marina District"
                value={geofenceName}
                onChange={(e) => setGeofenceName(e.target.value)}
                data-testid="input-geofence-name"
              />
            </div>
            <div>
              <Label>Service Area Boundaries</Label>
              <div className="mt-2">
                <GeofenceEditor
                  initialGeofence={geofencePolygon || undefined}
                  onSave={setGeofencePolygon}
                  centerPosition={[25.2048, 55.2708]}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-geofence"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
