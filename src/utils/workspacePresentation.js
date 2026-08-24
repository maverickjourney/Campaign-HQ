export const WORKSPACE_THEME_OPTIONS = [
  {
    value: "red",
    label: "Red",
    description:
      "Traditional campaign red.",
  },
  {
    value: "blue",
    label: "Blue",
    description:
      "Traditional campaign blue.",
  },
  {
    value: "purple",
    label: "Purple",
    description:
      "A blended battleground-inspired palette.",
  },
  {
    value: "neutral",
    label: "Campaign Navy",
    description:
      "Neutral patriotic Campaign Seat palette.",
  },
];


export function getRecommendedWorkspaceTheme(
  politicalParty,
) {
  switch (
    String(
      politicalParty ||
      "",
    )
      .trim()
      .toLowerCase()
  ) {
    case "republican":
      return "red";

    case "democratic":
      return "blue";

    default:
      return "neutral";
  }
}


export function normalizeWorkspaceTheme(
  value,
  politicalParty,
) {
  const normalized =
    String(
      value ||
      "",
    )
      .trim()
      .toLowerCase();

  if (
    [
      "red",
      "blue",
      "purple",
      "neutral",
      "custom",
    ].includes(
      normalized,
    )
  ) {
    return normalized;
  }

  return getRecommendedWorkspaceTheme(
    politicalParty,
  );
}


const THEME_PALETTES = {
  red: {
    primary: "#b81523",
    secondary: "#7f0914",
    deep: "#57070e",
    accent: "#ef3340",
    highlight: "#ff6673",
  },

  blue: {
    primary: "#155a9c",
    secondary: "#0d4279",
    deep: "#072c54",
    accent: "#2e86d1",
    highlight: "#73b9f3",
  },

  purple: {
    primary: "#653d91",
    secondary: "#4a2b70",
    deep: "#301b4c",
    accent: "#8d62bd",
    highlight: "#c0a0e3",
  },

  neutral: {
    primary: "#123a64",
    secondary: "#0b2b4e",
    deep: "#071d39",
    accent: "#2d6ca7",
    highlight: "#74afe3",
  },

  custom: {
    primary: "#123a64",
    secondary: "#0b2b4e",
    deep: "#071d39",
    accent: "#2d6ca7",
    highlight: "#74afe3",
  },
};


export function getWorkspaceThemePalette(
  workspace = {},
) {
  const theme =
    normalizeWorkspaceTheme(
      workspace.activeTheme ||
        workspace.active_theme,
      workspace.politicalParty ||
        workspace.political_party,
    );

  return {
    theme,

    ...THEME_PALETTES[
      theme
    ],
  };
}


export function getWorkspaceThemeStyle(
  workspace = {},
) {
  const palette =
    getWorkspaceThemePalette(
      workspace,
    );

  const primary =
    workspace.themePrimaryColor ||
    workspace.theme_primary_color ||
    palette.primary;

  const accent =
    workspace.themeAccentColor ||
    workspace.theme_accent_color ||
    palette.accent;

  return {
    "--workspace-primary":
      primary,

    "--workspace-secondary":
      palette.secondary,

    "--workspace-deep":
      palette.deep,

    "--workspace-accent":
      accent,

    "--workspace-highlight":
      palette.highlight,
  };
}


function clean(
  value,
) {
  return String(
    value ||
      "",
  ).trim();
}


export function getWorkspaceLocationLabel(
  workspace = {},
) {
  const type =
    clean(
      workspace.jurisdictionType ||
        workspace.jurisdiction_type,
    ).toLowerCase();

  const jurisdiction =
    clean(
      workspace.jurisdictionName ||
        workspace.jurisdiction_name,
    );

  const county =
    clean(
      workspace.countyName ||
        workspace.county_name,
    );

  const municipality =
    clean(
      workspace.municipalityName ||
        workspace.municipality_name,
    );

  const state =
    clean(
      workspace.stateRegion ||
        workspace.state_region,
    );

  const country =
    clean(
      workspace.countryCode ||
        workspace.country_code,
    );


  let primary =
    jurisdiction;


  if (
    type ===
      "county" &&
    county
  ) {
    primary =
      county;
  } else if (
    [
      "city",
      "town",
      "village",
    ].includes(type) &&
    municipality
  ) {
    primary =
      municipality;
  } else if (
    type ===
      "state" &&
    state
  ) {
    primary =
      state;
  } else if (
    type ===
      "federal"
  ) {
    primary =
      country === "US"
        ? "United States"
        : jurisdiction ||
          country;
  }


  if (
    !primary
  ) {
    primary =
      county ||
      municipality ||
      state ||
      clean(
        workspace.location,
      );
  }


  const parts = [
    primary,

    state &&
    state.toLowerCase() !==
      primary.toLowerCase()
      ? state
      : "",
  ].filter(Boolean);


  return (
    parts.join(", ") ||
    "Campaign location"
  );
}


export function getWorkspaceLocationMediaQuery(
  workspace = {},
) {
  const location =
    getWorkspaceLocationLabel(
      workspace,
    );

  if (
    !location ||
    location ===
      "Campaign location"
  ) {
    return "";
  }

  const type =
    clean(
      workspace.jurisdictionType ||
        workspace.jurisdiction_type,
    ).toLowerCase();


  if (
    type === "county"
  ) {
    return `${location} landscape aerial`;
  }

  if (
    [
      "city",
      "town",
      "village",
    ].includes(type)
  ) {
    return `${location} skyline landscape`;
  }

  return `${location} landscape`;
}
