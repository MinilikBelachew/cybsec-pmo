"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/utils/cn";
import {
  avatarColorFromId,
  initialsFromName,
} from "@/shared/utils/employee-avatar";

const SIZE_CLASSES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
} as const;

export type EmployeeAvatarProps = {
  name: string;
  employeeId: string;
  profileImageUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
};

export function EmployeeAvatar({
  name,
  employeeId,
  profileImageUrl,
  size = "sm",
  className,
}: EmployeeAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = initialsFromName(name);
  const colorClass = avatarColorFromId(employeeId);
  const showImage = Boolean(profileImageUrl?.trim()) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [profileImageUrl]);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border/50",
        SIZE_CLASSES[size],
        !showImage && cn("font-bold text-white", colorClass),
        className,
      )}
      title={name}
    >
      {showImage ? (
        <img
          src={profileImageUrl!}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
