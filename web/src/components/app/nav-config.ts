import {
  Newspaper,
  History,
  CalendarCheck,
  CalendarClock,
  RefreshCw,
  CalendarRange,
  MessageCircle,
  CalendarCog,
  ChartColumn,
  Armchair,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarX2,
  BadgePercent,
  Puzzle,
  Shapes,
  Ticket,
  TicketPercent,
  Mailbox,
  Undo2,
  DoorOpen,
  ClipboardList,
  CreditCard,
  Landmark,
  Mail,
  MailOpen,
  FolderLock,
  FileSignature,
  PenLine,
  FolderTree,
  Gift,
  LayoutDashboard,
  MapPin,
  MessagesSquare,
  ReceiptText,
  Receipt,
  Settings,
  ShieldCheck,
  Store,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Staff permission required to see the item (admin area only). */
  permission?: string;
  /** Show in the mobile bottom tab bar (customer area). */
  tab?: boolean;
  /** Extra words the command palette matches on. */
  keywords?: string;
};

export type NavItem = NavLink & {
  /** Nested pages, shown indented under the parent. */
  children?: NavLink[];
};

export type NavSection = { title: string; items: NavItem[] };

export const customerNav: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tab: true, keywords: "home overview" }],
  },
  {
    title: "Workspace",
    items: [
      { href: "/dashboard/workspace", label: "My bookings", icon: CalendarCheck, tab: true, keywords: "bookings pass check-in code passes membership" },
      { href: "/dashboard/workspace/book", label: "Book a space", icon: Armchair, keywords: "desk office studio event booking" },
      { href: "/dashboard/mailbox", label: "Mailbox", icon: Mailbox, keywords: "virtual office mail letters parcels business address scan forward" },
    ],
  },
  {
    title: "My business",
    items: [
      { href: "/dashboard/businesses", label: "My Businesses", icon: Building2, keywords: "company cac compliance calendar deadlines health score vat paye annual returns" },
      { href: "/dashboard/consultations", label: "Consultations", icon: CalendarClock, keywords: "advice officer meeting call tax legal book session" },
      { href: "/dashboard/services", label: "Services", icon: Store, tab: true, keywords: "register tax website order" },
      { href: "/dashboard/orders", label: "Orders", icon: ClipboardList, tab: true, keywords: "track filing progress" },
    ],
  },
  {
    title: "Account",
    items: [
      { href: "/dashboard/documents", label: "Documents", icon: FolderLock, keywords: "vault certificate upload" },
      { href: "/dashboard/agreements", label: "Agreements", icon: FileSignature, keywords: "sign contract virtual office legal download" },
      { href: "/dashboard/billing", label: "Billing & payments", icon: Receipt, keywords: "payments transactions invoices receipts" },
      { href: "/dashboard/messages", label: "Messages", icon: MessagesSquare, keywords: "support chat officer" },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, keywords: "profile password phone" },
    ],
  },
];

/** Settings pages, shared by the sidebar group and the in-page tabs. */
export const settingsLinks: NavLink[] = [
  { href: "/admin/settings/payments", label: "Payment gateways", icon: CreditCard, permission: "settings.manage", keywords: "paystack flutterwave stripe keys" },
  { href: "/admin/settings/bank-transfer", label: "Bank transfer", icon: Landmark, permission: "settings.manage", keywords: "account number transfer" },
  { href: "/admin/settings/email", label: "Email delivery", icon: Mail, permission: "settings.manage", keywords: "smtp resend mailgun sender" },
  { href: "/admin/settings/email-templates", label: "Email templates", icon: MailOpen, permission: "settings.manage", keywords: "wording notifications messages" },
  { href: "/admin/settings/whatsapp", label: "WhatsApp", icon: MessageCircle, permission: "settings.manage", keywords: "whatsapp cloud api meta templates notifications sms" },
  { href: "/admin/settings/booking", label: "Space booking", icon: CalendarCog, permission: "settings.manage", keywords: "book.reenite.com booking site pause switch online booking" },
  { href: "/admin/settings/signatory", label: "Signatory", icon: PenLine, permission: "settings.manage", keywords: "founder signature legal documents sign" },
];

/** Tabs inside the Workspace section. */
export const workspaceLinks: NavLink[] = [
  { href: "/admin/workspace", label: "Locations", icon: MapPin, permission: "workspace.manage", keywords: "opening hours address" },
  { href: "/admin/workspace/spaces", label: "Spaces", icon: DoorOpen, permission: "workspace.manage", keywords: "desk office studio hall rates capacity" },
  { href: "/admin/workspace/plans", label: "Passes & memberships", icon: Ticket, permission: "workspace.manage", keywords: "flexible plan 3 days a week membership discount" },
  { href: "/admin/workspace/addons", label: "Add-ons", icon: Puzzle, permission: "workspace.manage", keywords: "extras projector refreshments" },
  { href: "/admin/workspace/policies", label: "Cancellation", icon: Undo2, permission: "workspace.manage", keywords: "refund policy" },
  { href: "/admin/workspace/closures", label: "Closures", icon: CalendarX2, permission: "workspace.manage", keywords: "blackout holiday closed" },
  { href: "/admin/workspace/types", label: "Space types", icon: Shapes, permission: "workspace.manage", keywords: "hot desk shared exclusive" },
];

export const adminNav: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview stats" }],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders.view_assigned", keywords: "pipeline filing" },
      { href: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view", keywords: "users suspend" },
      { href: "/admin/legal", label: "Legal documents", icon: FileSignature, permission: "documents.manage", keywords: "agreements contracts sign virtual office upload" },
      { href: "/admin/blog", label: "Blog", icon: Newspaper, permission: "content.manage", keywords: "posts articles news write publish seo wordpress" },
      { href: "/admin/mail", label: "Mail", icon: Mailbox, permission: "mail.manage", keywords: "virtual office mailbox letters parcels scan forward collect" },
      { href: "/admin/compliance", label: "Compliance", icon: CalendarRange, permission: "compliance.manage", keywords: "deadlines overdue vat paye annual returns tcc customers businesses" },
      { href: "/admin/consultations", label: "Consultations", icon: CalendarClock, permission: "consultations.view_assigned", keywords: "advice sessions meetings officer video call" },
      { href: "/admin/appointments", label: "Appointments", icon: CalendarCheck, permission: "appointments.manage", keywords: "meetings clients book schedule reminders late no-show punctuality calendar" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      {
        href: "/admin/services",
        label: "Services",
        icon: Briefcase,
        keywords: "catalogue",
        children: [
          { href: "/admin/services", label: "All services", icon: Briefcase, permission: "services.manage", keywords: "catalogue pricing intake forms" },
          { href: "/admin/services/categories", label: "Categories", icon: FolderTree, permission: "services.manage", keywords: "groups" },
          { href: "/admin/services/bundles", label: "Bundles", icon: Gift, permission: "services.manage", keywords: "packages offers" },
        ],
      },
      {
        href: "/admin/workspace",
        label: "Workspace",
        icon: Armchair,
        keywords: "locations spaces",
        children: [
          { href: "/admin/workspace", label: "Locations", icon: MapPin, permission: "workspace.manage", keywords: "opening hours address" },
          { href: "/admin/workspace/spaces", label: "Spaces", icon: DoorOpen, permission: "workspace.manage", keywords: "rates capacity desk studio hall" },
          { href: "/admin/workspace/plans", label: "Passes & memberships", icon: BadgePercent, permission: "workspace.manage", keywords: "flexible plan membership discount" },
          { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, permission: "bookings.manage", keywords: "check-in calendar" },
        ],
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        href: "/admin/finance",
        label: "Finance",
        icon: Wallet,
        keywords: "money",
        children: [
          { href: "/admin/finance", label: "Payments", icon: Wallet, permission: "payments.view", keywords: "revenue refunds receipts" },
          { href: "/admin/finance/transfers", label: "Transfers to review", icon: Landmark, permission: "payments.verify", keywords: "bank transfer proof approve" },
          { href: "/admin/finance/invoices", label: "Invoices", icon: ReceiptText, permission: "invoices.manage", keywords: "bill customer" },
          { href: "/admin/finance/coupons", label: "Coupons", icon: TicketPercent, permission: "coupons.manage", keywords: "discount code promo voucher offer" },
          { href: "/admin/finance/renewals", label: "Renewals", icon: RefreshCw, permission: "payments.view", keywords: "auto renew renewals failed cards overdue invoices reminders money owed" },
        ],
      },
      { href: "/admin/analytics", label: "Analytics", icon: ChartColumn, permission: "reports.view", keywords: "reports revenue occupancy export csv" },
      { href: "/admin/staff", label: "Staff & Roles", icon: ShieldCheck, permission: "staff.manage", keywords: "team invite permissions" },
      { href: "/admin/activity", label: "Activity log", icon: History, permission: "audit.view", keywords: "audit trail who changed sign in login security" },
      {
        href: "/admin/settings",
        label: "Settings",
        icon: Settings,
        keywords: "configuration",
        children: settingsLinks,
      },
      { href: "/admin/profile", label: "My profile", icon: UserRound, keywords: "password account" },
    ],
  },
];

/** Orders are visible to anyone who can see all orders or just their assigned ones. */
const permissionAliases: Record<string, string[]> = {
  "orders.view_assigned": ["orders.view_assigned", "orders.view_all"],
  "consultations.view_assigned": ["consultations.view_assigned", "consultations.manage"],
};

function permitted(link: NavLink, permissions: string[]): boolean {
  if (!link.permission || permissions.includes("*")) {
    return true;
  }
  const accepted = permissionAliases[link.permission] ?? [link.permission];
  return accepted.some((permission) => permissions.includes(permission));
}

/** Hrefs the staff member may see. A parent with children is visible when any child is. */
export function allowedAdminHrefs(permissions: string[]): string[] {
  return adminNav.flatMap((section) =>
    section.items.flatMap((item) => {
      if (item.children) {
        const children = item.children.filter((child) => permitted(child, permissions)).map((child) => child.href);
        return children.length ? [item.href, ...children] : [];
      }
      return permitted(item, permissions) ? [item.href] : [];
    }),
  );
}

/** Applies an allow-list to a nav tree, dropping empty parents and sections. */
export function filterNav(sections: NavSection[], allowed?: string[]): NavSection[] {
  if (!allowed) {
    return sections;
  }
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => (item.children ? { ...item, children: item.children.filter((child) => allowed.includes(child.href)) } : item))
        .filter((item) => (item.children ? item.children.length > 0 : allowed.includes(item.href))),
    }))
    .filter((section) => section.items.length > 0);
}
