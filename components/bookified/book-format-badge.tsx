import Image from "next/image";
import { getFormatMeta } from "@/lib/books/book-formats";
import { cn } from "@/lib/utils";

interface BookFormatBadgeProps {
  format?: string | null;
  className?: string;
  size?: "sm" | "md";
  variant?: "format" | "cover";
}

export function BookFormatBadge({
  format,
  className,
  size = "sm",
  variant = "format",
}: BookFormatBadgeProps) {
  const meta = getFormatMeta(format);
  if (!meta) return null;

  const isSmall = size === "sm";
  const isCover = variant === "cover";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md font-semibold uppercase tracking-wide shadow-sm",
        isCover
          ? "border border-primary/20 bg-primary/90 text-primary-foreground"
          : cn("text-primary-foreground", meta.accentClass),
        isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className,
      )}
      title={meta.label}
      aria-label={meta.label}
    >
      {!isCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.iconUrl}
          alt=""
          width={isSmall ? 12 : 14}
          height={isSmall ? 12 : 14}
          className="brightness-0 invert"
        />
      ) : null}
      <span>{meta.label}</span>
    </div>
  );
}

/** Grid/list cover badge — above reading progress, bottom-left */
export function BookCoverFormatBadge({
  format,
  className,
}: {
  format?: string | null;
  className?: string;
}) {
  return (
    <BookFormatBadge
      format={format}
      size="sm"
      variant="cover"
      className={cn("absolute bottom-3 left-2 z-10", className)}
    />
  );
}

/** Larger badge for selectors */
export function BookFormatOptionIcon({ format }: { format: string }) {
  const meta = getFormatMeta(format);
  if (!meta) return null;

  return (
    <Image
      src={meta.iconUrl}
      alt={meta.label}
      width={20}
      height={20}
      className="opacity-90"
    />
  );
}
