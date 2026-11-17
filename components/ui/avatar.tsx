import { cn } from "@/lib/utils";

type AvatarProps = { src?: string | null; name?: string | null; className?: string };
export function Avatar({ src, name, className }: AvatarProps) {
  const initials = (name || "KYRO").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <span className={cn("relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600", className)}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}
