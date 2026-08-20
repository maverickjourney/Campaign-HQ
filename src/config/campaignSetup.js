export const CAMPAIGN_TYPES = [
  {
    value: "candidate_campaign",
    label: "Candidate campaign",
  },
  {
    value: "ballot_measure",
    label: "Ballot initiative or measure",
  },
  {
    value: "pac",
    label: "Political committee / PAC",
  },
  {
    value: "party_organization",
    label: "Political party organization",
  },
  {
    value: "elected_official",
    label: "Elected official / public office",
  },
  {
    value: "advocacy_organization",
    label: "Advocacy organization",
  },
  {
    value: "other",
    label: "Other",
  },
];

export const POLITICAL_PARTIES = [
  {
    value: "republican",
    label: "Republican",
    recommendedTheme: "red",
  },
  {
    value: "democratic",
    label: "Democratic",
    recommendedTheme: "blue",
  },
  {
    value: "independent",
    label: "Independent",
    recommendedTheme: "neutral",
  },
  {
    value: "libertarian",
    label: "Libertarian",
    recommendedTheme: "neutral",
  },
  {
    value: "green",
    label: "Green",
    recommendedTheme: "neutral",
  },
  {
    value: "nonpartisan",
    label: "Nonpartisan",
    recommendedTheme: "neutral",
  },
  {
    value: "other",
    label: "Other / not listed",
    recommendedTheme: "neutral",
  },
];

export const OFFICE_LEVELS = [
  ["federal", "Federal"],
  ["state", "State"],
  ["county", "County"],
  ["municipal", "Municipal / city"],
  ["school_board", "School board"],
  ["special_district", "Special district"],
  ["other", "Other"],
  ["not_applicable", "Not applicable"],
].map(([value, label]) => ({
  value,
  label,
}));

export const JURISDICTION_TYPES = [
  ["federal", "Federal"],
  ["state", "State"],
  ["county", "County"],
  ["city", "City"],
  ["town", "Town"],
  ["village", "Village"],
  ["district", "District"],
  ["school_district", "School district"],
  ["special_district", "Special district"],
  ["other", "Other"],
].map(([value, label]) => ({
  value,
  label,
}));

export const CAMPAIGN_MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    required: true,
  },
  {
    key: "inbox",
    label: "Inbox & communications",
  },
  {
    key: "calendar",
    label: "Calendar",
  },
  {
    key: "tasks",
    label: "Tasks",
  },
  {
    key: "commitments",
    label: "Commitments",
  },
  {
    key: "waiting_on",
    label: "Waiting On",
  },
  {
    key: "contacts",
    label: "Contacts",
  },
  {
    key: "documents",
    label: "Documents & files",
  },
  {
    key: "approvals",
    label: "Approvals",
  },
  {
    key: "team",
    label: "Team & access",
    required: true,
  },
  {
    key: "volunteers",
    label: "Volunteers & field",
  },
  {
    key: "fundraising",
    label: "Fundraising",
  },
  {
    key: "events",
    label: "Events",
  },
  {
    key: "social_media",
    label: "Social media",
  },
  {
    key: "media_center",
    label: "Media center",
  },
  {
    key: "reports_analytics",
    label: "Reports & analytics",
  },
];

export const SETUP_STEPS = [
  {
    key: "campaign_identity",
    label: "Campaign identity",
    required: true,
  },
  {
    key: "election_details",
    label: "Election details",
    required: true,
  },
  {
    key: "branding",
    label: "Branding",
    required: true,
  },
  {
    key: "security",
    label: "Security",
    required: true,
  },
  {
    key: "team",
    label: "Team",
    required: true,
  },
  {
    key: "communications",
    label: "Email & contacts",
    required: true,
  },
  {
    key: "calendar",
    label: "Calendar",
    required: true,
  },
  {
    key: "files",
    label: "Files",
    required: true,
  },
  {
    key: "texting",
    label: "Campaign texting",
    required: false,
  },
  {
    key: "review",
    label: "Review & activate",
    required: true,
  },
];

export const INTEGRATION_PROVIDERS = [
  {
    key: "google",
    label: "Google Workspace",
    services: [
      "email",
      "calendar",
      "contacts",
      "files",
    ],
  },
  {
    key: "microsoft",
    label: "Microsoft 365",
    services: [
      "email",
      "calendar",
      "contacts",
      "files",
    ],
  },
  {
    key: "twilio",
    label: "Campaign texting",
    services: [
      "sms",
      "whatsapp",
    ],
  },
];

export function getRecommendedThemeForParty(
  politicalParty,
) {
  return (
    POLITICAL_PARTIES.find(
      (party) =>
        party.value ===
        politicalParty,
    )?.recommendedTheme ||
    "neutral"
  );
}

export function getDefaultEnabledModules() {
  return CAMPAIGN_MODULES.map(
    (module) => module.key,
  );
}
