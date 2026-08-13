// components/ui/user-avatar.tsx
"use client";

import React from "react";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: { avatar_path?: string | null; name?: string } | null;
  className?: string;
  id?: string;
  previewUrl?: string | null; 
  refreshTrigger?: number; 
}

export function UserAvatar({ user, className, id, previewUrl, refreshTrigger = 0 }: UserAvatarProps) {
  const fetchedSrc = useAvatarUrl(user, refreshTrigger);

  // If a previewUrl is provided (unsaved image), prioritize it over the fetched source
  const src = previewUrl || fetchedSrc;

  if (!src) {
    const initials = (user?.name ?? "Operator")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "OP";

    return (
      <span
        id={id}
        role="img"
        aria-label={`${user?.name ?? "Operator"} profile picture`}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground",
          className,
        )}
      >
        <span aria-hidden="true">{initials}</span>
      </span>
    );
  }

  return (
    <img
      id={id}
      src={src}
      alt={`${user?.name ?? "Operator"} profile picture`}
      className={cn(
        "rounded-full object-cover bg-muted",
        className
      )}
    />
  );
}