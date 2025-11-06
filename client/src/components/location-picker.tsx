import { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from "lucide-react";

// Fix default marker icon issue with Leaflet + Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationPickerProps {
  onLocationSelect: (location: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialPosition?: [number, number];
}

function MapClickHandler({ onLocationClick }: { onLocationClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to update map view when position changes
function MapViewController({ position }: { position: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [map, position]);
  
  return null;
}

export default function LocationPicker({ onLocationSelect, initialPosition = [1.3521, 103.8198] }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>(initialPosition);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      // Use Nominatim (OpenStreetMap's free geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          headers: {
            "User-Agent": "CarWashPro/1.0",
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const formattedAddress = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setAddress(formattedAddress);
        return formattedAddress;
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    } finally {
      setLoading(false);
    }
    
    // Fallback: use coordinates as address if geocoding fails
    const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    setAddress(fallbackAddress);
    return fallbackAddress;
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPosition([lat, lng]);
    await reverseGeocode(lat, lng);
  }, [reverseGeocode]);

  const handleConfirm = () => {
    if (address) {
      onLocationSelect({
        address,
        latitude: position[0],
        longitude: position[1],
      });
    }
  };

  // Get user's current location
  const handleUseCurrentLocation = useCallback(() => {
    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (location) => {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          setPosition([lat, lng]);
          await reverseGeocode(lat, lng);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
      alert("Geolocation is not supported by your browser");
    }
  }, [reverseGeocode]);

  // Automatically get current location on mount
  useEffect(() => {
    handleUseCurrentLocation();
  }, [handleUseCurrentLocation]);

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Select Your Location
        </Label>
        <p className="text-sm text-muted-foreground">
          {loading && !address ? "Getting your location..." : "Click on the map to change your location"}
        </p>
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleUseCurrentLocation}
          disabled={loading}
          data-testid="button-use-current-location"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Getting location...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" />
              Use Current Location
            </>
          )}
        </Button>

        <div 
          className="relative w-full h-[300px] rounded-md overflow-hidden border"
          data-testid="map-container"
        >
          <MapContainer
            center={position}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={position} />
            <MapClickHandler onLocationClick={handleMapClick} />
            <MapViewController position={position} />
          </MapContainer>
        </div>

        {address && (
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm font-medium">Selected Location:</p>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-selected-address">
              {address}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          onClick={handleConfirm}
          disabled={!address || loading}
          data-testid="button-confirm-location"
        >
          Confirm Location
        </Button>
      </div>
    </Card>
  );
}
