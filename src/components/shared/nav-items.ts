import {
  Folders,
  Images,
  Upload,
  LayoutTemplate,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

/** Primary navigation for the authenticated area (see NAVIGATION.md). */
export const NAV_ITEMS: NavItem[] = [
  { title: "Projects", href: "/projects", icon: Folders },
  { title: "Gallery", href: "/gallery", icon: Images },
  { title: "Uploads", href: "/uploads", icon: Upload },
  { title: "Templates", href: "/templates", icon: LayoutTemplate },
  { title: "Settings", href: "/settings", icon: Settings },
];
