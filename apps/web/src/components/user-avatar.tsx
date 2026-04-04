"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAvatarUrl } from "@/hooks/use-avatar-url";
import { buildAvatarUrlFromHash } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  /** Pre-computed SHA-256 hash from the backend. Used synchronously. */
  avatarHash?: string | null;
  /** Email address for client-side hash (current user's own profile only). */
  email?: string | null;
  /** Display name used for alt text and initials fallback. */
  name?: string | null;
  /** Avatar pixel size for the gravatar request. */
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  avatarHash,
  email,
  name,
  size = 80,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  // Sync path: use pre-computed hash from backend
  const syncUrl = avatarHash ? buildAvatarUrlFromHash(avatarHash, size) : null;
  // Async path: compute hash client-side (only for own profile)
  const asyncUrl = useAvatarUrl(!syncUrl ? email : null, size);

  const avatarUrl = syncUrl ?? asyncUrl;
  const displayName = name ?? email ?? "?";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Avatar className={cn(className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
      <AvatarFallback className={cn("text-xs font-medium", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
