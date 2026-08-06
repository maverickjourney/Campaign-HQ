import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const project = process.cwd();

const files = {
  locked: path.join(
    project,
    "docs/ui/CampaignSidebar.locked.css",
  ),

  shell: path.join(
    project,
    "src/components/CampaignWorkspaceShell/" +
      "CampaignWorkspaceShell.module.css",
  ),

  dashboard: path.join(
    project,
    "src/pages/DashboardReferencePreview/" +
      "DashboardReferencePreview.module.css",
  ),
};

const blocks = [
  [
    "/* CLEAN WORKSPACE SWITCHER — START */",
    "/* CLEAN WORKSPACE SWITCHER — END */",
  ],
  [
    "/* CENTER WORKSPACE CHEVRON — START */",
    "/* CENTER WORKSPACE CHEVRON — END */",
  ],
  [
    "/* COMPACT SIGNED-IN PROFILE V2 — START */",
    "/* COMPACT SIGNED-IN PROFILE V2 — END */",
  ],
];

function extract(source, start, end, filename) {
  const firstStart = source.indexOf(start);
  const firstEnd = source.indexOf(end);

  if (firstStart === -1 || firstEnd === -1) {
    throw new Error(
      `Missing sidebar block in ${filename}:\n  ${start}`,
    );
  }

  const secondStart = source.indexOf(
    start,
    firstStart + start.length,
  );

  if (secondStart !== -1) {
    throw new Error(
      `Duplicate sidebar block in ${filename}:\n  ${start}`,
    );
  }

  return source
    .slice(firstStart, firstEnd + end.length)
    .replace(/\r\n/g, "\n")
    .trim();
}

for (const filename of Object.values(files)) {
  if (!fs.existsSync(filename)) {
    throw new Error(
      `Missing sidebar lock file:\n  ${filename}`,
    );
  }
}

const sources = Object.fromEntries(
  Object.entries(files).map(([key, filename]) => [
    key,
    fs.readFileSync(filename, "utf8"),
  ]),
);

for (const [start, end] of blocks) {
  const approved = extract(
    sources.locked,
    start,
    end,
    files.locked,
  );

  for (const target of ["shell", "dashboard"]) {
    const actual = extract(
      sources[target],
      start,
      end,
      files[target],
    );

    if (actual !== approved) {
      throw new Error(
        `${target} sidebar drift detected:\n  ${start}`,
      );
    }
  }
}

console.log(
  "PASS: HQ and shared campaign tabs use the exact " +
  "same approved sidebar.",
);
