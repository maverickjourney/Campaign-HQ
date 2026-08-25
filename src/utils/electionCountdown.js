const DAY_MS =
  24 * 60 * 60 * 1000;

const DEFAULT_CAMPAIGN_TIME_ZONE =
  "America/New_York";

const TIME_ZONE_ALIASES = {
  "eastern time":
    "America/New_York",

  eastern:
    "America/New_York",

  et:
    "America/New_York",

  "central time":
    "America/Chicago",

  central:
    "America/Chicago",

  ct:
    "America/Chicago",

  "mountain time":
    "America/Denver",

  mountain:
    "America/Denver",

  mt:
    "America/Denver",

  "pacific time":
    "America/Los_Angeles",

  pacific:
    "America/Los_Angeles",

  pt:
    "America/Los_Angeles",
};


function resolveCampaignTimeZone(
  value,
) {
  const normalized =
    String(value || "")
      .trim();

  if (!normalized) {
    return DEFAULT_CAMPAIGN_TIME_ZONE;
  }

  const alias =
    TIME_ZONE_ALIASES[
      normalized.toLowerCase()
    ];

  if (alias) {
    return alias;
  }

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          normalized,
      },
    ).format(
      new Date(),
    );

    return normalized;
  } catch {
    return DEFAULT_CAMPAIGN_TIME_ZONE;
  }
}


function parseCalendarDate(
  value,
) {
  const match =
    String(value || "")
      .trim()
      .match(
        /^(\d{4})-(\d{2})-(\d{2})/,
      );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const timestamp =
    Date.UTC(
      year,
      month - 1,
      day,
    );

  const verified =
    new Date(timestamp);

  if (
    verified.getUTCFullYear() !==
      year ||
    verified.getUTCMonth() !==
      month - 1 ||
    verified.getUTCDate() !==
      day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}


function getCalendarDateInTimeZone(
  value,
  timeZone,
) {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      },
    ).formatToParts(
      date,
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ],
      ),
    );

  return {
    year:
      Number(values.year),

    month:
      Number(values.month),

    day:
      Number(values.day),
  };
}


function calendarSerial({
  year,
  month,
  day,
}) {
  return Date.UTC(
    year,
    month - 1,
    day,
  );
}


export function getDaysUntilElection(
  electionDateValue,
  campaignTimeZone,
  now = new Date(),
) {
  const electionDate =
    parseCalendarDate(
      electionDateValue,
    );

  if (!electionDate) {
    return null;
  }

  const timeZone =
    resolveCampaignTimeZone(
      campaignTimeZone,
    );

  const today =
    getCalendarDateInTimeZone(
      now,
      timeZone,
    );

  if (!today) {
    return null;
  }

  const difference =
    calendarSerial(
      electionDate,
    ) -
    calendarSerial(
      today,
    );

  return Math.max(
    0,
    Math.round(
      difference /
        DAY_MS,
    ),
  );
}
