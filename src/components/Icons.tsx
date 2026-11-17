import type { LucideIcon } from "lucide-react";

// One icon size and stroke across the desk. Icons are decorative; the text next to them carries the meaning.
export function Ic({ i: Icon, s = 16 }: { i: LucideIcon; s?: number }) {
  return <Icon className="ic" size={s} strokeWidth={1.75} aria-hidden="true" />;
}

export function SheetHead({ i, children }: { i: LucideIcon; children: React.ReactNode }) {
  return <h2 className="sheet__head"><Ic i={i} s={18} />{children}</h2>;
}
