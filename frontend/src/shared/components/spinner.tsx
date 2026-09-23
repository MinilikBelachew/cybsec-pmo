import { cn } from "@/shared/utils/cn";

export type SpinnerSize = "xs" | "sm" | "md" | "lg";

type SpinnerProps = {
  /** Visual size. Default `md` for page/section loads; use `xs`/`sm` in buttons. */
  size?: SpinnerSize;
  /** When true, wraps in a flex center box (page/section loaders). Default false for inline/button use. */
  centered?: boolean;
  /** Accessible label announced to screen readers. */
  label?: string;
  className?: string;
};

const SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-8",
  lg: "size-11",
};

const SPOKE_COUNT = 12;

/**
 * Shared loading indicator — modern spoke style (neutral, no primary color).
 *
 * @example
 * <Spinner size="sm" />
 * <Spinner size="md" centered className="h-screen" />
 */
export function Spinner({
  size = "md",
  centered = false,
  label = "Loading",
  className,
}: SpinnerProps) {
  const indicator = (
    <span
      className={cn(
        "relative inline-block shrink-0 animate-spin",
        SIZE_CLASS[size],
        !centered && className,
      )}
      role={centered ? undefined : "status"}
      aria-label={centered ? undefined : label}
      aria-hidden={centered ? true : undefined}
    >
      {Array.from({ length: SPOKE_COUNT }, (_, index) => (
        <span
          key={index}
          className="absolute inset-0 flex justify-center"
          style={{ transform: `rotate(${index * (360 / SPOKE_COUNT)}deg)` }}
        >
          <span
            className="mt-[4%] h-[26%] w-[11%] rounded-full bg-muted-foreground"
            style={{ opacity: 0.12 + (0.88 * index) / (SPOKE_COUNT - 1) }}
          />
        </span>
      ))}
    </span>
  );

  if (!centered) {
    return indicator;
  }

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="status"
      aria-label={label}
    >
      {indicator}
    </div>
  );
}
