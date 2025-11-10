import { useState, useCallback, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polygon, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface GeofenceEditorProps {
  initialGeofence?: Array<[number, number]>;
  onSave: (geofence: Array<[number, number]> | null) => void;
  centerPosition?: [number, number];
}

function MapClickHandler({ 
  onLocationClick, 
  disabled 
}: { 
  onLocationClick: (lat: number, lng: number) => void;
  disabled: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (!disabled) {
        onLocationClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function MapViewController({ position }: { position: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [map, position]);
  
  return null;
}

export default function GeofenceEditor({ 
  initialGeofence, 
  onSave,
  centerPosition = [25.2048, 55.2708]
}: GeofenceEditorProps) {
  const [points, setPoints] = useState<Array<[number, number]>>(initialGeofence || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { toast } = useToast();
  const lastSavedGeofenceRef = useRef<string>();

  useEffect(() => {
    const currentGeofence = JSON.stringify(initialGeofence);
    if (!isDirty && currentGeofence !== lastSavedGeofenceRef.current) {
      lastSavedGeofenceRef.current = currentGeofence;
      setPoints(initialGeofence || []);
    }
  }, [initialGeofence, isDirty]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isDrawing) {
      setPoints(prev => [...prev, [lat, lng]]);
      setIsDirty(true);
    }
  }, [isDrawing]);

  const handleStartDrawing = () => {
    setPoints([]);
    setIsDrawing(true);
    setIsDirty(true);
    toast({
      title: "Drawing Mode Active",
      description: "Click on the map to add points to your geofence area",
    });
  };

  const handleFinishDrawing = () => {
    if (points.length < 3) {
      toast({
        title: "Not Enough Points",
        description: "Please add at least 3 points to create a geofence area",
        variant: "destructive",
      });
      return;
    }
    setIsDrawing(false);
    toast({
      title: "Geofence Created",
      description: `Geofence area with ${points.length} points created. Click Save to apply changes.`,
    });
  };

  const handleClear = () => {
    setPoints([]);
    setIsDrawing(false);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (points.length === 0) {
      onSave(null);
      setIsDirty(false);
    } else if (points.length < 3) {
      toast({
        title: "Invalid Geofence",
        description: "Please add at least 3 points or clear the geofence",
        variant: "destructive",
      });
      return;
    } else {
      onSave(points);
      setIsDirty(false);
    }
  };

  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(prev => prev.slice(0, -1));
      setIsDirty(true);
    }
  };

  return (
    <Card data-testid="card-geofence-editor">
      <CardHeader>
        <CardTitle>Working Area Geofence</CardTitle>
        <CardDescription>
          Define your company's service area by clicking points on the map to create a boundary
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {!isDrawing ? (
            <Button
              onClick={handleStartDrawing}
              variant="default"
              data-testid="button-start-drawing"
            >
              <MapPin className="w-4 h-4 mr-2" />
              {points.length > 0 ? "Redraw Geofence" : "Draw Geofence"}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleFinishDrawing}
                variant="default"
                disabled={points.length < 3}
                data-testid="button-finish-drawing"
              >
                Finish Drawing ({points.length} points)
              </Button>
              <Button
                onClick={handleUndo}
                variant="outline"
                disabled={points.length === 0}
                data-testid="button-undo"
              >
                Undo Last Point
              </Button>
            </>
          )}
          
          {points.length > 0 && !isDrawing && (
            <>
              <Button
                onClick={handleClear}
                variant="outline"
                data-testid="button-clear"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={handleSave}
                variant="default"
                data-testid="button-save-geofence"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Geofence
              </Button>
            </>
          )}
        </div>

        <div className="border rounded-md overflow-hidden" style={{ height: "500px" }}>
          <MapContainer
            center={centerPosition}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            data-testid="map-geofence"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewController position={centerPosition} />
            <MapClickHandler onLocationClick={handleMapClick} disabled={!isDrawing} />
            
            {points.length > 0 && (
              <Polygon
                positions={points}
                pathOptions={{
                  color: isDrawing ? "#3b82f6" : "#10b981",
                  fillColor: isDrawing ? "#3b82f6" : "#10b981",
                  fillOpacity: 0.2,
                  weight: 2,
                }}
              />
            )}
          </MapContainer>
        </div>

        {points.length > 0 && (
          <p className="text-sm text-muted-foreground" data-testid="text-point-count">
            Geofence area defined with {points.length} points
            {points.length < 3 && " (minimum 3 required)"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
