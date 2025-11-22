import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Upload, Image as ImageIcon } from "lucide-react";
import type { PlatformSetting } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<PlatformSetting>({
    queryKey: ["/api/admin/platform-settings"],
    refetchOnWindowFocus: false,
  });

  // Initialize form fields when settings are loaded
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "");
      setCompanyAddress(settings.companyAddress || "");
      setVatNumber(settings.vatRegistrationNumber || "");
      if (settings.logoUrl) {
        setLogoPreview(settings.logoUrl);
      }
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      companyName: string;
      companyAddress: string;
      vatRegistrationNumber: string;
      logoUrl?: string;
    }) => {
      return await apiRequest("PATCH", "/api/admin/platform-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platform-settings"] });
      toast({
        title: "Settings Updated",
        description: "Platform settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Logo must be less than 5MB.",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let logoUrl = settings?.logoUrl;

    // Upload logo if changed
    if (logoFile) {
      const formData = new FormData();
      formData.append("logo", logoFile);

      try {
        const response = await fetch("/api/upload/logo", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to upload logo");
        }

        const { url } = await response.json();
        logoUrl = url;
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: "Failed to upload logo. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    updateSettingsMutation.mutate({
      companyName,
      companyAddress,
      vatRegistrationNumber: vatNumber,
      logoUrl,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" data-testid="icon-settings" />
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Platform Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt & Branding Settings</CardTitle>
          <CardDescription>
            Update company information that appears on receipts and the PWA home screen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                data-testid="input-company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Washapp.ae"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyAddress">Company Address</Label>
              <Textarea
                id="companyAddress"
                data-testid="input-company-address"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="Dubai, United Arab Emirates"
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vatNumber">VAT Registration Number</Label>
              <Input
                id="vatNumber"
                data-testid="input-vat-number"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="Enter VAT registration number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Platform Logo</Label>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <Input
                    id="logo"
                    data-testid="input-logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Upload a square logo (recommended 512x512px). Used in receipts and PWA home screen.
                  </p>
                </div>
                {logoPreview && (
                  <div className="shrink-0">
                    <div className="w-24 h-24 border rounded-lg overflow-hidden bg-white flex items-center justify-center">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="max-w-full max-h-full object-contain"
                        data-testid="img-logo-preview"
                      />
                    </div>
                  </div>
                )}
                {!logoPreview && (
                  <div className="w-24 h-24 border rounded-lg bg-muted flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                data-testid="button-save-settings"
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? (
                  <>
                    <Upload className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
