/*
 * SEAT CORE
 * Shared product + module manifest.
 *
 * Campaign Seat is the first product using Seat Core.
 * Future products such as District Seat and Firm Seat should
 * extend this manifest instead of copying navigation structures.
 */

export const SEAT_BREAKPOINTS = Object.freeze({
  phone: 480,
  mobile: 760,
  tablet: 1024,
  desktop: 1280,
});

export const SEAT_PAGE_CONTRACT = Object.freeze({
  minimumTouchTarget: 44,
  supportsLoadingState: true,
  supportsEmptyState: true,
  supportsErrorState: true,
  supportsMobile: true,
  supportsTablet: true,
  supportsDesktop: true,
});

export const SEAT_CORE_MODULES = Object.freeze([
  {
    key: "dashboard",
    label: "HQ",
    route: "/dashboard",
    group: "core",
    required: true,
  },
  {
    key: "inbox",
    label: "Inbox",
    route: "/inbox",
    group: "core",
  },
  {
    key: "calendar",
    label: "Calendar",
    route: "/calendar",
    group: "core",
  },
  {
    key: "tasks",
    label: "Tasks",
    route: "/tasks",
    group: "core",
  },
  {
    key: "commitments",
    label: "Commitments",
    route: "/commitments",
    group: "core",
  },
  {
    key: "waiting_on",
    label: "Waiting On",
    route: "/waiting-on",
    group: "core",
  },
  {
    key: "contacts",
    label: "Contacts",
    route: "/contacts",
    group: "core",
  },
  {
    key: "documents",
    label: "Documents",
    route: "/files",
    group: "core",
  },
  {
    key: "approvals",
    label: "Approvals",
    route: "/approvals",
    group: "core",
  },
  {
    key: "team",
    label: "Team",
    route: "/team",
    group: "core",
    required: true,
  },
  {
    key: "inventory",
    label: "Inventory",
    route: "/inventory",
    group: "core",
  },
]);

export const SEAT_PLATFORM_MODULES = Object.freeze([
  {
    key: "ai",
    label: "AI",
    route: "/workspace/ai",
    group: "platform",
  },
  {
    key: "integrations",
    label: "Integrations",
    route: "/workspace/integrations",
    group: "platform",
  },
  {
    key: "plan_usage",
    label: "Plan & Usage",
    route: "/workspace/usage",
    group: "platform",
  },
  {
    key: "settings",
    label: "Settings",
    route: "/workspace/settings",
    group: "platform",
  },
  {
    key: "support",
    label: "Support",
    route: "/support",
    group: "platform",
  },
]);

export const CAMPAIGN_SEAT_MODULES = Object.freeze([
  {
    key: "candidate",
    label: "Candidate",
    route: "/workspace/candidate-profile",
    group: "campaign",
  },
  {
    key: "volunteers",
    label: "Volunteers",
    route: "/volunteers",
    group: "campaign",
  },
  {
    key: "fundraising",
    label: "Fundraising",
    route: "/fundraising",
    group: "campaign",
  },
  {
    key: "events",
    label: "Events",
    route: "/events",
    group: "campaign",
  },
  {
    key: "social_media",
    label: "Social Media",
    route: "/social-media",
    group: "campaign",
  },
  {
    key: "media_center",
    label: "Media Center",
    route: "/media-center",
    group: "campaign",
  },
  {
    key: "reports_analytics",
    label: "Reports & Analytics",
    route: "/reports-analytics",
    group: "campaign",
  },
]);

export const SEAT_PRODUCTS = Object.freeze({
  campaign: {
    key: "campaign",
    productName: "Campaign Seat",
    shortName: "Campaign",
    workspaceLabel: "Campaign Workspace",
    hqLabel: "Campaign HQ",
    askAiLabel: "Ask Campaign HQ",
    toolGroupLabel: "Campaign tools",
    productModules: CAMPAIGN_SEAT_MODULES,
  },

  district: {
    key: "district",
    productName: "District Seat",
    shortName: "District",
    workspaceLabel: "District Workspace",
    hqLabel: "District HQ",
    askAiLabel: "Ask District HQ",
    toolGroupLabel: "District tools",
    productModules: [],
  },

  firm: {
    key: "firm",
    productName: "Firm Seat",
    shortName: "Firm",
    workspaceLabel: "Firm Workspace",
    hqLabel: "Firm HQ",
    askAiLabel: "Ask Firm HQ",
    toolGroupLabel: "Firm tools",
    productModules: [],
  },
});

export const ACTIVE_SEAT_PRODUCT =
  SEAT_PRODUCTS.campaign;

export function getSeatCoreModules() {
  return [...SEAT_CORE_MODULES];
}

export function getSeatProductModules(
  product = ACTIVE_SEAT_PRODUCT,
) {
  return [...(product.productModules || [])];
}

export function getSeatEnabledModuleKeys(
  product = ACTIVE_SEAT_PRODUCT,
) {
  return [
    ...SEAT_CORE_MODULES,
    ...(product.productModules || []),
  ].map((module) => module.key);
}

export function getSeatModuleByKey(
  key,
  product = ACTIVE_SEAT_PRODUCT,
) {
  return [
    ...SEAT_CORE_MODULES,
    ...SEAT_PLATFORM_MODULES,
    ...(product.productModules || []),
  ].find((module) => module.key === key) || null;
}
