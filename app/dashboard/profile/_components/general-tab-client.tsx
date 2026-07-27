"use client";

import React, { useEffect, useState } from "react";
import {
  Camera,
  Upload,
  Loader2,
  Shield,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileManagerClient } from "@/components/dashboard/file-manager-client";
import { ProfileWorkspaceSkeleton } from "@/components/ui/loading-states";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/use-permissions";
import { logFrontendAction } from "@/lib/api";
import {
  getAuthHeaders,
  getBackendApiRoot,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type UserProfile = {
  name?: string;
  email?: string;
  avatar_path?: string | null;
};

type PickerFile = {
  id?: number;
  media_details?: {
    url?: string;
    relative_path?: string;
    mime_type?: string;
  };
  url?: string;
  path?: string;
  mime_type?: string;
};

const extractPathFromUrl = (url: string) => {
  if (!url) return null;

  const storageIndex = url.indexOf("/storage/");
  if (storageIndex !== -1) {
    return url.substring(storageIndex + 9);
  }

  return url.replace(/^\/+/, "");
};

function SecureBlobAvatar({
  user,
  previewUrl,
  lastSaved,
  canFetch,
  className,
}: {
  user: UserProfile | undefined;
  previewUrl: string | null;
  lastSaved: number;
  canFetch: boolean;
  className?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    const fetchAvatar = async () => {
      setIsFetching(true);

      // Data or blob URLs don't need network fetching
      if (
        previewUrl &&
        (previewUrl.startsWith("data:") || previewUrl.startsWith("blob:"))
      ) {
        setBlobUrl(previewUrl);
        setIsFetching(false);
        return;
      }

      // Determine fetch URL
      let targetUrl: string | null = null;
      if (previewUrl) {
        if (previewUrl.startsWith("http")) {
          targetUrl = previewUrl;
        } else {
          targetUrl = `${getBackendApiRoot()}${previewUrl.startsWith("/") ? "" : "/"}${previewUrl}`;
        }
      } else if (canFetch) {
        targetUrl = `${getBackendApiRoot()}/profile/avatar?cb=${lastSaved}`;
      }

      if (!targetUrl) {
        setBlobUrl(null);
        setIsFetching(false);
        return;
      }

      try {
        const res = await fetch(targetUrl, {
          headers: getAuthHeaders(),
        });

        if (!res.ok) {
          throw new Error(`Avatar fetch returned ${res.status}`);
        }

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        if (isMounted) {
          setBlobUrl(objectUrl);
        }
      } catch {
        if (isMounted) {
          // If fetch with headers failed, fallback to direct previewUrl if it's http
          if (previewUrl && previewUrl.startsWith("http")) {
            setBlobUrl(previewUrl);
          } else {
            setBlobUrl(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    };

    fetchAvatar();

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [canFetch, lastSaved, previewUrl]);

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Operator")}&color=7F9CF5&background=EBF4FF`;

  if (isFetching && !blobUrl) {
    return (
      <div className={cn("bg-muted/50", className)}>
        <Skeleton className="h-full w-full rounded-full bg-muted/70" />
      </div>
    );
  }

  return (
    <img
      src={blobUrl || fallbackUrl}
      alt={user?.name || "Avatar"}
      className={cn("object-cover bg-muted", className)}
    />
  );
}

export function GeneralTabClient() {
  const queryClient = useQueryClient();
  const scopeKey = getWorkspaceScopeKey();
  const { hasAnyPermission, hasPermission } = usePermissions();

  const canViewProfile = hasAnyPermission(["view_profile", "edit_profile"]);
  const canEditProfile = hasPermission("edit_profile");
  const canManageStorage = hasPermission("manage_storage");
  const canBrowseAvatarLibrary =
    canEditProfile || hasAnyPermission(["view_storage", "manage_storage"]);

  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<number>(Date.now());

  const { data: user, isLoading: isFetchingUser } = useQuery({
    queryKey: ["authUserProfile", scopeKey],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/user`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }

      return res.json();
    },
    enabled: canViewProfile,
  });

  useEffect(() => {
    if (!user) return;

    setName(user.name || "");
    setEmail(user.email || "");
    setAvatarPath(user.avatar_path || null);
    setPreviewUrl(null);
  }, [user]);

  const updateProfileMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/profile/update`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          name,
          email,
          ...(avatarPath && { avatar_path: avatarPath }),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update profile");
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Profile saved successfully!");
      setPreviewUrl(null);
      if (data.user?.avatar_path) {
        setAvatarPath(data.user.avatar_path);
      }
      queryClient.setQueryData(["authUserProfile", scopeKey], {
        ...data.user,
        avatar_revision: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      setLastSaved(Date.now());
      logFrontendAction({
        module: "Profile Update",
        action: "updated",
        description: "Updated basic profile.",
      }).catch(() => {});
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "Failed to update profile"));
    },
  });

  const handleUpdateProfile = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditProfile) return;
    updateProfileMut.mutate();
  };

  const handleFileSelect = (file: PickerFile) => {
    if (!canEditProfile) return;

    const rawUrl = file?.media_details?.url || file?.url || file?.path;
    const relativePath = file?.media_details?.relative_path;
    if (!rawUrl) {
      toast.error("Error: Could not extract image path from selection.");
      return;
    }

    if (!file.media_details?.mime_type?.startsWith("image/")) {
      toast.error("Select an image file for your profile picture.");
      return;
    }

    setAvatarPath(relativePath || extractPathFromUrl(rawUrl));
    setPreviewUrl(rawUrl);
    setIsFileManagerOpen(false);
    toast.success("Avatar selected! Click 'Save Protocol' to apply.");
  };

  if (isFetchingUser) {
    return <ProfileWorkspaceSkeleton />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card
          id="tour-profile-avatar"
          className="relative col-span-1 overflow-hidden border-border/50 bg-card/40 shadow-sm backdrop-blur-xl"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Operator Avatar</CardTitle>
            <CardDescription>Update your visual identifier.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <div className="group relative rounded-full bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent p-1 transition-colors duration-500 hover:from-primary/40">
              <div className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted shadow-2xl">
                <SecureBlobAvatar
                  user={user}
                  previewUrl={previewUrl}
                  lastSaved={lastSaved}
                  canFetch={canViewProfile}
                  className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                />

                {canEditProfile && (
                  <button
                    type="button"
                    onClick={() => setIsFileManagerOpen(true)}
                    className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/60 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  >
                    <Upload className="mb-1 h-8 w-8 animate-bounce" />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      Change
                    </span>
                  </button>
                )}
              </div>

              {previewUrl && (
                <div className="absolute bottom-2 right-2 rounded-full bg-emerald-500 p-1 text-white shadow-lg ring-4 ring-background animate-in zoom-in">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
            </div>

            {previewUrl && (
              <p className="text-center text-xs font-bold text-amber-500 animate-pulse">
                Unsaved changes! Click Save Protocol.
              </p>
            )}
          </CardContent>
        </Card>

        <Card
          id="tour-profile-info"
          className="relative col-span-1 overflow-hidden border-border/50 bg-card/40 shadow-sm backdrop-blur-xl md:col-span-2"
        >
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
            <CardDescription>
              Update your contact details and registered name.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label
                    htmlFor="name"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="E.g. Sarah Connor"
                    required
                    disabled={!canEditProfile}
                    className="h-12 rounded-xl bg-muted/30 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    Encrypted Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="operator@system.os"
                    required
                    disabled={!canEditProfile}
                    className="h-12 rounded-xl bg-muted/30 focus-visible:ring-primary"
                  />
                </div>
              </div>

              {!canEditProfile && (
                <p className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  Profile editing is locked for your current role. You can
                  review your details here, but changes require the{" "}
                  <strong className="text-foreground">edit_profile</strong>{" "}
                  permission.
                </p>
              )}

              <div className="flex justify-end border-t border-border/40 pt-4">
                <Button
                  type="submit"
                  disabled={updateProfileMut.isPending || !canEditProfile}
                  className="h-12 rounded-xl bg-primary px-8 font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)_/_0.3)] transition-all hover:scale-[1.02] hover:bg-primary/90"
                >
                  {updateProfileMut.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-5 w-5" />
                  )}
                  Save Protocol
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
        <DialogContent className="flex h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-[2.5rem] border-border/50 bg-background p-0 shadow-2xl">
          <DialogTitle className="sr-only">Select Profile Picture</DialogTitle>
          <div className="z-10 flex shrink-0 items-center gap-4 border-b border-border/50 bg-card/60 px-8 py-5 backdrop-blur-xl">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                Select Profile Picture
              </h2>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                Browse existing media or upload if your storage role allows it.
              </p>
            </div>
          </div>
          <div className="file-picker-wrapper relative flex-1 overflow-hidden bg-muted/10 p-4 sm:p-6">
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .file-picker-wrapper > div > div:nth-child(1), .file-picker-wrapper > div > div:nth-child(2) > div:nth-child(2) { display: none !important; }
                  .file-picker-wrapper > div { height: 100% !important; min-height: 100% !important; margin: 0 !important; }
                `,
              }}
            />
            <FileManagerClient
              isPickerMode={true}
              onFileSelect={handleFileSelect}
              acceptedFileTypes="image/*"
              acceptedFileDescription="an image file"
              access={{
                canRead: canBrowseAvatarLibrary,
                canManage: canManageStorage,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
