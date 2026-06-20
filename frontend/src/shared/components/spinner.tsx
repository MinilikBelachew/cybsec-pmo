import { cn } from "@/shared/utils/cn";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-4",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-transparent border-t-current",
          sizes[size]
        )}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
