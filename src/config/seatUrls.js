const PUBLIC_PRODUCTION_ORIGIN =
  "https://campaignseat.com";

const APP_PRODUCTION_ORIGIN =
  "https://app.campaignseat.com";

const ADMIN_PRODUCTION_ORIGIN =
  "https://admin.campaignseat.com";

function browserOrigin() {
  return typeof window !== "undefined"
    ? window.location.origin
    : "";
}

function isLocalDevelopment() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  );
}

function buildUrl(origin, path = "/") {
  return new URL(
    path,
    origin.endsWith("/")
      ? origin
      : `${origin}/`,
  ).toString();
}

export function getPublicSiteOrigin() {
  return isLocalDevelopment()
    ? browserOrigin()
    : PUBLIC_PRODUCTION_ORIGIN;
}

export function getCampaignAppOrigin() {
  return isLocalDevelopment()
    ? browserOrigin()
    : APP_PRODUCTION_ORIGIN;
}

export function getPlatformAdminOrigin() {
  return isLocalDevelopment()
    ? browserOrigin()
    : ADMIN_PRODUCTION_ORIGIN;
}

export function publicSiteUrl(path = "/") {
  return buildUrl(
    getPublicSiteOrigin(),
    path,
  );
}

export function campaignAppUrl(path = "/") {
  return buildUrl(
    getCampaignAppOrigin(),
    path,
  );
}

export function platformAdminUrl(path = "/") {
  return buildUrl(
    getPlatformAdminOrigin(),
    path,
  );
}
