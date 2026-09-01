"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Loader2,
  Shield,
  Image as ImageIcon,
  Trash2,
  FolderOpen,
  User,
  Sparkles,
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
import { usePermissions } from "@/hooks/use-permissions";
import { logFrontendAction } from "@/lib/api";
import {
  getAuthHeaders,
  getBackendApiRoot,
  getWorkspaceScopeKey,
} from "@/lib/runtime-context";
import { getErrorMessage } from "@/lib/errors";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { useTranslation } from "@/store/use-translation";
import { cn } from "@/lib/utils";

type UserProfile = {
  id?: number;
  name?: string;
  email?: string;
  avatar_path?: string | null;
  avatar_url?: string | null;
  avatar_revision?: number;
  updated_at?: string;
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

export function GeneralTabClient() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const scopeKey = getWorkspaceScopeKey();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { hasAnyPermission, hasPermission } = usePermissions();
  const canViewProfile = hasAnyPermission(["view_profile", "edit_profile"]);
  const canEditProfile = hasPermission("edit_profile");
  const canManageStorage = hasPermission("manage_storage");
  const canBrowseAvatarLibrary =
    canEditProfile || hasAnyPermission(["view_storage", "manage_storage"]);

  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarRevision, setAvatarRevision] = useState<number>(Date.now());
  const [isDragging, setIsDragging] = useState(false);

  const { data: user, isLoading: isFetchingUser } = useQuery({
    queryKey: ["authUserProfile", scopeKey],
    queryFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/user`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch user data");
      }

      return res.json() as Promise<UserProfile>;
    },
    enabled: canViewProfile,
  });

  const avatarUrl = useAvatarUrl(
    canViewProfile ? user || null : null,
    avatarRevision
  );

  useEffect(() => {
    if (!user) return;
    setName(user.name || "");
    setEmail(user.email || "");
  }, [user]);

  // 1. Direct Avatar File Upload Mutation
  const uploadAvatarMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);

      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = { ...authHeaders };
      delete headers["Content-Type"];

      const res = await fetch(`${getBackendApiRoot()}/profile/avatar`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to upload avatar image.");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success(t("profile.avatar_uploaded", "Profile photo updated successfully!"));
      setAvatarRevision(Date.now());
      queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      logFrontendAction({
        module: "Profile Settings",
        action: "updated",
        description: "Operator uploaded a new profile picture.",
      }).catch(() => {});
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, t("profile.avatar_update_failed", "Failed to upload photo")));
    },
  });

  // 2. Remove / Delete Avatar Mutation
  const deleteAvatarMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/profile/avatar`, {
        method: "DELETE",
        headers: getAuthHeaders({
          Accept: "application/json",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to remove avatar.");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success(t("profile.avatar_removed", "Profile photo removed."));
      setAvatarRevision(Date.now());
      queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      logFrontendAction({
        module: "Profile Settings",
        action: "updated",
        description: "Operator removed profile picture.",
      }).catch(() => {});
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, t("profile.avatar_update_failed", "Failed to remove avatar")));
    },
  });

  // 3. Update Basic Information Mutation
  const updateProfileMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getBackendApiRoot()}/profile/update`, {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update profile information.");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success(t("profile.saved_success", "Profile details saved successfully!"));
      queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      logFrontendAction({
        module: "Profile Settings",
        action: "updated",
        description: `Updated profile details: ${name} (${email})`,
      }).catch(() => {});
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, t("global.error", "Failed to update profile details")));
    },
  });

  // Handle direct native file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("profile.file_too_large", "Image must be smaller than 5MB"));
      return;
    }
    uploadAvatarMut.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (canEditProfile) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canEditProfile) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        toast.error(t("profile.invalid_image_type", "Please drop an image file (PNG, JPG, WebP)"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("profile.file_too_large", "Image must be smaller than 5MB"));
        return;
      }
      uploadAvatarMut.mutate(file);
    }
  };

  // Handle media library selection
  const handleMediaPickerSelect = async (file: PickerFile) => {
    const rawUrl = file.url || file.media_details?.url || "";
    const relativePath = file.media_details?.relative_path || file.path;
    const cleanPath = relativePath || (rawUrl.includes("/storage/") ? rawUrl.substring(rawUrl.indexOf("/storage/") + 9) : rawUrl.replace(/^\/+/, ""));

    if (cleanPath) {
      try {
        const res = await fetch(`${getBackendApiRoot()}/profile/update`, {
          method: "POST",
          headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
          body: JSON.stringify({
            avatar_path: cleanPath,
          }),
        });

        if (!res.ok) throw new Error("Failed to assign avatar from media library");

        toast.success(t("profile.media_avatar_success", "Profile photo updated from media library!"));
        setAvatarRevision(Date.now());
        queryClient.invalidateQueries({ queryKey: ["authUserProfile"] });
      } catch (err) {
        toast.error(getErrorMessage(err, t("profile.avatar_update_failed", "Failed to update avatar")));
      }
    }

    setIsFileManagerOpen(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile) return;
    updateProfileMut.mutate();
  };

  if (isFetchingUser) {
    return <ProfileWorkspaceSkeleton />;
  }

  const initials = (name || user?.name || "Operator")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const hasAvatar = Boolean(user?.avatar_path || avatarUrl);

  return (
    <>
      {/* Hidden native file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 animate-in fade-in duration-300">

        {/* AVATAR UPLOAD CARD */}
        <Card
          id="tour-profile-avatar"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative col-span-1 overflow-hidden border-border/50 bg-card/40 shadow-sm backdrop-blur-xl transition-all duration-300",
            isDragging && "ring-2 ring-primary border-primary bg-primary/5"
          )}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg font-bold">
                {t("profile.photo_title", "Operator Avatar")}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              {t("profile.photo_desc", "Visual identity displayed across topbar, sidebar, and ledgers.")}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center justify-center space-y-5 pb-6">
            <div className="relative group">
              <div className="relative h-32 w-32 overflow-hidden rounded-[2.5rem] border-2 border-dashed border-border/80 bg-muted/40 shadow-inner flex items-center justify-center transition-all duration-300 group-hover:border-primary/50">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name || "Operator"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-space text-3xl font-black text-muted-foreground/70 tracking-wider">
                    {initials}
                  </span>
                )}

                {/* Upload Overlay on Hover */}
                {canEditProfile && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 cursor-pointer text-primary"
                  >
                    <Upload className="h-6 w-6 animate-bounce" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {t("profile.upload_photo_btn", "Upload New Photo")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            {canEditProfile && (
              <div className="flex flex-col w-full gap-2 pt-1">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatarMut.isPending}
                  className="w-full h-10 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  {t("profile.upload_photo_btn", "Upload New Photo")}
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFileManagerOpen(true)}
                    disabled={uploadAvatarMut.isPending || !canBrowseAvatarLibrary}
                    className="flex-1 h-9 rounded-xl text-xs font-bold border-border/60 hover:bg-muted/80 cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    {t("profile.browse_media_btn", "Library")}
                  </Button>

                  {hasAvatar && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => deleteAvatarMut.mutate()}
                      disabled={deleteAvatarMut.isPending || uploadAvatarMut.isPending}
                      className="h-9 px-3 rounded-xl text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 cursor-pointer"
                    >
                      {deleteAvatarMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              {t("profile.avatar_tip", "Supports PNG, JPG, or WebP up to 5MB. Drag & drop supported.")}
            </p>
          </CardContent>
        </Card>

        {/* BASIC INFORMATION CARD */}
        <Card
          id="tour-profile-info"
          className="relative col-span-1 overflow-hidden border-border/50 bg-card/40 shadow-sm backdrop-blur-xl md:col-span-2"
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg font-bold">
                {t("profile.basic_info_title", "Basic Information")}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              {t("profile.basic_info_desc", "Update your registered operator name and identity address.")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

                {/* Full Name */}
                <div className="space-y-2.5">
                  <Label
                    htmlFor="name"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {t("profile.full_name_label", "Full Name")}
                  </Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("profile.name_placeholder", "E.g. Sarah Connor")}
                    required
                    disabled={!canEditProfile}
                    className="h-12 rounded-xl bg-muted/30 focus-visible:ring-primary font-medium"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-2.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {t("profile.email_label", "Encrypted Email Address")}
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
                    className="h-12 rounded-xl bg-muted/30 focus-visible:ring-primary font-medium"
                  />
                </div>
              </div>

              {!canEditProfile && (
                <p className="rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  {t("profile.role_locked_desc", "Profile editing is locked for your current role. Changes require the edit_profile permission.")}
                </p>
              )}

              {/* Form Action Button */}
              <div className="flex justify-end border-t border-border/40 pt-4">
                <Button
                  type="submit"
                  disabled={updateProfileMut.isPending || !canEditProfile}
                  className="h-12 rounded-xl bg-primary px-8 font-bold text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)_/_0.3)] transition-all hover:scale-[1.02] hover:bg-primary/90 cursor-pointer"
                >
                  {updateProfileMut.isPending ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-5 w-5" />
                  )}
                  {t("profile.save_btn", "Save Details")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Media Library Dialog */}
      <Dialog open={isFileManagerOpen} onOpenChange={setIsFileManagerOpen}>
        <DialogContent className="flex h-[85vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden rounded-[2.5rem] border-border/50 bg-background p-0 shadow-2xl">
          <DialogTitle className="sr-only">
            {t("profile.select_picture_title", "Select Profile Picture")}
          </DialogTitle>
          <div className="z-10 flex shrink-0 items-center gap-4 border-b border-border/50 bg-card/60 px-8 py-5 backdrop-blur-xl">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                {t("profile.select_picture_title", "Select Profile Picture")}
              </h2>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                {t("profile.select_picture_desc", "Browse existing media or select from your storage repository.")}
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
              onFileSelect={handleMediaPickerSelect}
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
