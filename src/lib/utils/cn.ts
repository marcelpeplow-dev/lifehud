/** Merge class names, filtering falsy values. Minimal alternative to clsx/cn. */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
