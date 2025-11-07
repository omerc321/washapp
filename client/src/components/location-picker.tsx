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
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          {loading && !address ? "Getting location..." : "Tap map to change"}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={loading}
          data-testid="button-use-current-location"
          className="h-8 text-xs"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <MapPin className="h-3 w-3 mr-1" />
              Current
            </>
          )}
        </Button>
      </div>

      <div 
        className="relative w-full h-[180px] rounded-md overflow-hidden border"
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
        <div className="p-2 bg-muted rounded-md">
          <p className="text-xs text-muted-foreground" data-testid="text-selected-address">
            {address}
          </p>
        </div>
      )}

      <Button
        type="button"
        className="w-full h-9 text-sm"
        onClick={handleConfirm}
        disabled={!address || loading}
        data-testid="button-confirm-location"
      >
        Confirm Location
      </Button>
    </div>
  );
}
