import {
  Briefcase,
  Building2,
  Calculator,
  FileCheck2,
  Globe,
  Landmark,
  Megaphone,
  Scale,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Icons an admin can pick for a service category. Stored on the category as the key. */
export const categoryIcons: Record<string, { icon: LucideIcon; label: string }> = {
  briefcase: { icon: Briefcase, label: "Briefcase" },
  "building-2": { icon: Building2, label: "Building" },
  calculator: { icon: Calculator, label: "Calculator" },
  "shield-check": { icon: ShieldCheck, label: "Shield" },
  globe: { icon: Globe, label: "Globe" },
  landmark: { icon: Landmark, label: "Government" },
  scale: { icon: Scale, label: "Legal" },
  "file-check-2": { icon: FileCheck2, label: "Document" },
  megaphone: { icon: Megaphone, label: "Marketing" },
  users: { icon: Users, label: "People" },
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = categoryIcons[name]?.icon ?? Briefcase;
  return <Icon className={className} />;
}
