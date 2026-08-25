import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  Globe2,
  LockKeyhole,
  Mail,
  MapPin,
  Palette,
  Rocket,
  Save,
  ShieldCheck,
  UserRound,
  Vote,
  X,
} from "lucide-react";

import {
  Link,
  useParams,
} from "react-router-dom";

import PlatformAdminShell
  from "../../components/admin/PlatformAdminShell/PlatformAdminShell";

import {
  loadPlatformWorkspaceEditor,
  previewPlatformWorkspaceDraft,
  publishPlatformWorkspaceDraft,
  savePlatformWorkspaceDraft,
} from "../../services/platformAdminData";

import styles
  from "./PlatformAdmin.module.css";


const PARTY_OPTIONS = [
  {
    value: "",
    label: "Select party",
  },
  {
    value: "republican",
    label: "Republican",
  },
  {
    value: "democrat",
    label: "Democratic",
  },
  {
    value: "independent",
    label: "Independent",
  },
  {
    value: "nonpartisan",
    label: "Nonpartisan",
  },
  {
    value: "libertarian",
    label: "Libertarian",
  },
  {
    value: "green",
    label: "Green",
  },
  {
    value: "other",
    label: "Other",
  },
];


const CAMPAIGN_TYPE_OPTIONS = [
  {
    value: "",
    label: "Select campaign type",
  },
  {
    value: "candidate_campaign",
    label: "Candidate Campaign",
  },
  {
    value: "political_committee",
    label: "Political Committee",
  },
  {
    value: "pac",
    label: "PAC",
  },
  {
    value: "issue_campaign",
    label: "Issue Campaign",
  },
  {
    value: "party_organization",
    label: "Party Organization",
  },
  {
    value: "other",
    label: "Other",
  },
];


const OFFICE_LEVEL_OPTIONS = [
  {
    value: "",
    label: "Select office level",
  },
  {
    value: "federal",
    label: "Federal",
  },
  {
    value: "state",
    label: "State",
  },
  {
    value: "county",
    label: "County",
  },
  {
    value: "municipal",
    label: "Municipal",
  },
  {
    value: "district",
    label: "Special District",
  },
  {
    value: "other",
    label: "Other",
  },
];


const JURISDICTION_OPTIONS = [
  {
    value: "",
    label: "Select jurisdiction type",
  },
  {
    value: "state",
    label: "State",
  },
  {
    value: "county",
    label: "County",
  },
  {
    value: "municipality",
    label: "City / Municipality",
  },
  {
    value: "district",
    label: "District",
  },
  {
    value: "other",
    label: "Other",
  },
];


const TIMEZONE_OPTIONS = [
  {
    value: "",
    label: "Select timezone",
  },
  {
    value: "America/New_York",
    label: "Eastern Time",
  },
  {
    value: "America/Chicago",
    label: "Central Time",
  },
  {
    value: "America/Denver",
    label: "Mountain Time",
  },
  {
    value: "America/Phoenix",
    label: "Arizona Time",
  },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time",
  },
  {
    value: "America/Anchorage",
    label: "Alaska Time",
  },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii Time",
  },
];


const THEME_OPTIONS = [
  {
    value: "",
    label: "Select campaign theme",
  },
  {
    value: "red",
    label: "Red Campaign",
  },
  {
    value: "blue",
    label: "Blue Campaign",
  },
  {
    value: "neutral",
    label: "Neutral",
  },
  {
    value: "navy",
    label: "Navy",
  },
  {
    value: "custom",
    label: "Custom",
  },
];


const FIELD_GROUPS = [
  {
    id: "campaign",
    label: "Campaign",
    title: "Campaign",
    description:
      "Core campaign identity and the office this workspace represents.",
    Icon: Building2,

    fields: [
      {
        key: "name",
        label: "Workspace name",
        required: true,
      },
      {
        key: "candidate_name",
        label: "Candidate name",
      },
      {
        key: "political_party",
        label: "Political party",
        type: "select",
        options: PARTY_OPTIONS,
      },
      {
        key: "campaign_type",
        label: "Campaign type",
        type: "select",
        options:
          CAMPAIGN_TYPE_OPTIONS,
      },
      {
        key: "legal_committee_name",
        label: "Legal committee name",
      },
      {
        key: "office_sought",
        label: "Office sought",
      },
      {
        key: "office_level",
        label: "Office level",
        type: "select",
        options:
          OFFICE_LEVEL_OPTIONS,
      },
      {
        key: "district_label",
        label: "District",
      },
    ],
  },

  {
    id: "election",
    label: "Election & District",
    title: "Election & District",
    description:
      "Election schedule, jurisdiction and geographic campaign information.",
    Icon: Vote,

    fields: [
      {
        key: "election_date",
        label: "Election date",
        type: "date",
      },
      {
        key: "primary_election_date",
        label: "Primary election date",
        type: "date",
      },
      {
        key: "general_election_date",
        label: "General election date",
        type: "date",
      },
      {
        key: "timezone",
        label: "Timezone",
        type: "select",
        options: TIMEZONE_OPTIONS,
      },
      {
        key: "jurisdiction_name",
        label: "Jurisdiction",
      },
      {
        key: "jurisdiction_type",
        label: "Jurisdiction type",
        type: "select",
        options:
          JURISDICTION_OPTIONS,
      },
      {
        key: "location",
        label: "Display location",
      },
      {
        key: "state_region",
        label: "State",
      },
      {
        key: "county_name",
        label: "County",
      },
      {
        key: "municipality_name",
        label: "City / municipality",
      },
      {
        key: "postal_code",
        label: "Postal code",
      },
      {
        key: "country_code",
        label: "Country",
      },
    ],
  },

  {
    id: "contact",
    label: "Contact & Digital",
    title: "Contact & Digital",
    description:
      "Operational and public contact information used across Campaign Seat.",
    Icon: Mail,

    fields: [
      {
        key: "campaign_email",
        label: "Campaign email",
        type: "email",
      },
      {
        key: "campaign_phone",
        label: "Campaign phone",
        type: "tel",
      },
      {
        key: "website_url",
        label: "Campaign website",
        type: "url",
      },
      {
        key: "candidate_public_email",
        label: "Candidate public email",
        type: "email",
      },
      {
        key: "candidate_public_phone",
        label: "Candidate public phone",
        type: "tel",
      },
    ],
  },

  {
    id: "branding",
    label: "Branding",
    title: "Branding",
    description:
      "Control the campaign's visual identity without exposing technical theme settings.",
    Icon: Palette,

    fields: [
      {
        key: "active_theme",
        label: "Campaign theme",
        type: "select",
        options: THEME_OPTIONS,
      },
      {
        key: "theme_primary_color",
        label: "Primary color",
        type: "color",
      },
      {
        key: "theme_accent_color",
        label: "Accent color",
        type: "color",
      },
    ],
  },

  {
    id: "profile",
    label: "Candidate Profile",
    title: "Candidate Profile",
    description:
      "Public-facing candidate information and campaign copy.",
    Icon: UserRound,

    fields: [
      {
        key: "description",
        label: "Workspace description",
        type: "textarea",
      },
      {
        key: "candidate_bio",
        label: "Candidate bio",
        type: "textarea",
      },
      {
        key: "disclaimer_text",
        label: "Campaign disclaimer",
        type: "textarea",
      },
    ],
  },
];


const ALL_FIELDS =
  FIELD_GROUPS.flatMap(
    (group) =>
      group.fields,
  );


const FIELD_LABELS =
  Object.fromEntries(
    ALL_FIELDS.map(
      (field) => [
        field.key,
        field.label,
      ],
    ),
  );


function formFromWorkspace(
  workspace,
) {
  const result = {};

  for (
    const field of
    ALL_FIELDS
  ) {
    const value =
      workspace?.[
        field.key
      ];

    result[field.key] =
      value === null ||
      value === undefined
        ? ""
        : String(value);
  }

  return result;
}


function normalizeFormValue(
  key,
  value,
) {
  const normalized =
    String(
      value ?? "",
    ).trim();

  if (key === "name") {
    return normalized;
  }

  return normalized
    ? normalized
    : null;
}


function comparableWorkspaceValue(
  workspace,
  key,
) {
  const value =
    workspace?.[key];

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return String(value).trim();
}


function buildPayload(
  baseWorkspace,
  form,
) {
  const payload = {};

  for (
    const field of
    ALL_FIELDS
  ) {
    const next =
      normalizeFormValue(
        field.key,
        form[field.key],
      );

    const current =
      comparableWorkspaceValue(
        baseWorkspace,
        field.key,
      );

    if (next !== current) {
      payload[field.key] =
        next;
    }
  }

  return payload;
}


function displayValue(
  value,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not set";
  }

  return String(value);
}


function FieldControl({
  field,
  value,
  onChange,
}) {
  if (
    field.type ===
    "textarea"
  ) {
    return (
      <textarea
        value={value || ""}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      />
    );
  }

  if (
    field.type ===
    "select"
  ) {
    return (
      <div
        className={
          styles.premiumSelectWrap
        }
      >
        <select
          value={value || ""}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
        >
          {field.options.map(
            (option) => (
              <option
                key={
                  `${field.key}-${option.value}`
                }
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            ),
          )}
        </select>
      </div>
    );
  }

  if (
    field.type ===
    "color"
  ) {
    const validColor =
      /^#[0-9a-f]{6}$/i.test(
        value || "",
      )
        ? value
        : "#102d52";

    return (
      <div
        className={
          styles.premiumColorControl
        }
      >
        <input
          className={
            styles.premiumColorPicker
          }
          type="color"
          value={validColor}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
        />

        <input
          type="text"
          value={value || ""}
          placeholder="#102d52"
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
        />
      </div>
    );
  }

  return (
    <input
      type={
        field.type ||
        "text"
      }
      value={value || ""}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
    />
  );
}


export default function PlatformAdminWorkspaceEditor() {
  const {
    workspaceId,
  } = useParams();

  const [
    editor,
    setEditor,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({});

  const [
    preview,
    setPreview,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    previewing,
    setPreviewing,
  ] = useState(false);

  const [
    publishing,
    setPublishing,
  ] = useState(false);

  const [
    publishConfirmOpen,
    setPublishConfirmOpen,
  ] = useState(false);

  const [
    publishAcknowledged,
    setPublishAcknowledged,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState("");


  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const result =
          await loadPlatformWorkspaceEditor(
            workspaceId,
          );

        if (!active) {
          return;
        }

        setEditor(result);

        setForm(
          formFromWorkspace(
            result?.preview ||
            result?.workspace,
          ),
        );
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Workspace could not be loaded.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [workspaceId]);


  const unsavedPayload =
    useMemo(
      () =>
        buildPayload(
          editor?.preview ||
            editor?.workspace ||
            {},
          form,
        ),
      [
        editor,
        form,
      ],
    );


  const fullDraftPayload =
    useMemo(
      () =>
        buildPayload(
          editor?.workspace ||
            {},
          form,
        ),
      [
        editor,
        form,
      ],
    );


  const hasUnsavedChanges =
    Object.keys(
      unsavedPayload,
    ).length > 0;


  const unsavedCount =
    Object.keys(
      unsavedPayload,
    ).length;


  const savedDraftKeys =
    Object.keys(
      editor?.draft
        ?.payload || {},
    );


  const changeField =
    (
      key,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [key]: value,
        }),
      );

      setNotice("");
      setError("");
      setPreview(null);
    };


  const saveDraft =
    async () => {
      if (
        !hasUnsavedChanges
      ) {
        return;
      }

      if (
        !String(
          form.name || "",
        ).trim()
      ) {
        setError(
          "Workspace name is required.",
        );

        return;
      }

      if (
        !Object.keys(
          fullDraftPayload,
        ).length
      ) {
        setError(
          "There are no draft changes compared with the published workspace.",
        );

        return;
      }

      setSaving(true);
      setError("");
      setNotice("");

      try {
        const result =
          await savePlatformWorkspaceDraft(
            workspaceId,
            fullDraftPayload,
            editor?.draft
              ?.revision_number ||
              0,
          );

        setEditor(result);

        setForm(
          formFromWorkspace(
            result?.preview ||
            result?.workspace,
          ),
        );

        setPreview(null);

        setNotice(
          "Draft saved safely. The campaign is still seeing the published version.",
        );
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Draft could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    };


  const loadPreview =
    async () => {
      if (
        !editor?.draft?.id ||
        hasUnsavedChanges
      ) {
        return;
      }

      setPreviewing(true);
      setError("");
      setNotice("");

      try {
        const result =
          await previewPlatformWorkspaceDraft(
            workspaceId,
          );

        setPreview(
          result?.preview ||
          null,
        );
      } catch (previewError) {
        setError(
          previewError instanceof Error
            ? previewError.message
            : "Preview could not be loaded.",
        );
      } finally {
        setPreviewing(false);
      }
    };


  const openPublishConfirm =
    () => {
      if (
        !editor?.draft?.id ||
        editor?.draft_is_stale ||
        hasUnsavedChanges
      ) {
        return;
      }

      setPublishAcknowledged(
        false,
      );

      setPublishConfirmOpen(
        true,
      );
    };


  const publishDraft =
    async () => {
      if (
        !editor?.draft?.id ||
        !publishAcknowledged
      ) {
        return;
      }

      setPublishing(true);
      setError("");
      setNotice("");

      try {
        const result =
          await publishPlatformWorkspaceDraft(
            workspaceId,
            editor.draft.id,
          );

        setEditor(result);

        setForm(
          formFromWorkspace(
            result?.preview ||
            result?.workspace,
          ),
        );

        setPreview(null);

        setPublishConfirmOpen(
          false,
        );

        setPublishAcknowledged(
          false,
        );

        setNotice(
          "Published successfully. The campaign now sees the updated workspace.",
        );
      } catch (publishError) {
        setError(
          publishError instanceof Error
            ? publishError.message
            : "Draft could not be published.",
        );
      } finally {
        setPublishing(false);
      }
    };


  const resetUnsavedChanges =
    () => {
      setForm(
        formFromWorkspace(
          editor?.preview ||
          editor?.workspace,
        ),
      );

      setPreview(null);
      setError("");
      setNotice("");
    };


  if (loading) {
    return (
      <PlatformAdminShell
        title="Manage Workspace"
        description="Loading campaign workspace…"
      >
        <div
          className={
            styles.adminEmpty
          }
        >
          Loading workspace…
        </div>
      </PlatformAdminShell>
    );
  }


  return (
    <PlatformAdminShell
      title={
        editor?.customer
          ?.display_name ||
        editor?.workspace
          ?.name ||
        "Manage Workspace"
      }
      description="Configure the campaign workspace safely. Draft changes remain private until you explicitly publish them."
      actions={
        <Link
          className={
            styles.secondaryAction
          }
          to="/admin/customers"
        >
          <ArrowLeft size={16} />
          Customers
        </Link>
      }
    >
      <div
        className={
          styles.premiumWorkspaceManager
        }
      >
        {error && (
          <div
            className={
              styles.adminError
            }
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            className={
              styles.workspaceNotice
            }
          >
            <CheckCircle2
              size={18}
            />

            {notice}
          </div>
        )}

        {editor?.draft_is_stale && (
          <div
            className={
              styles.workspaceStaleWarning
            }
          >
            <AlertTriangle
              size={18}
            />

            <div>
              <strong>
                Draft needs review
              </strong>

              <span>
                The published workspace changed after this draft was created. Reload and review it before publishing.
              </span>
            </div>
          </div>
        )}

        <section
          className={
            styles.premiumWorkspaceStatus
          }
        >
          <article>
            <div
              className={
                styles.premiumStatusIcon
              }
            >
              <Globe2 size={18} />
            </div>

            <div>
              <span>
                Published
              </span>

              <strong>
                {editor?.workspace
                  ?.name ||
                  "Workspace"}
              </strong>
            </div>
          </article>

          <article>
            <div
              className={
                styles.premiumStatusIcon
              }
            >
              <Save size={18} />
            </div>

            <div>
              <span>
                Draft
              </span>

              <strong>
                {editor?.draft
                  ? `Revision ${editor.draft.revision_number}`
                  : "No saved draft"}
              </strong>
            </div>
          </article>

          <article>
            <div
              className={
                styles.premiumStatusIcon
              }
            >
              <Eye size={18} />
            </div>

            <div>
              <span>
                Campaign currently sees
              </span>

              <strong>
                Published version
              </strong>
            </div>
          </article>

          <article>
            <div
              className={
                styles.premiumStatusIcon
              }
            >
              <ShieldCheck
                size={18}
              />
            </div>

            <div>
              <span>
                Admin security
              </span>

              <strong>
                MFA verified
              </strong>
            </div>
          </article>
        </section>


        <section
          className={
            styles.premiumWorkflowBar
          }
        >
          <div
            className={
              styles.premiumWorkflowStatus
            }
          >
            <span
              className={[
                styles.premiumStatusDot,
                hasUnsavedChanges
                  ? styles.premiumStatusDotDirty
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />

            <div>
              <strong>
                {hasUnsavedChanges
                  ? `${unsavedCount} unsaved ${
                    unsavedCount === 1
                      ? "change"
                      : "changes"
                  }`
                  : editor?.draft
                    ? `Draft revision ${editor.draft.revision_number} saved`
                    : "Published workspace unchanged"}
              </strong>

              <span>
                Draft changes are invisible to the campaign until Publish.
              </span>
            </div>
          </div>

          <div
            className={
              styles.premiumWorkflowActions
            }
          >
            {hasUnsavedChanges && (
              <button
                type="button"
                className={
                  styles.premiumQuietButton
                }
                onClick={
                  resetUnsavedChanges
                }
              >
                Reset
              </button>
            )}

            <button
              type="button"
              className={
                styles.premiumPreviewButton
              }
              disabled={
                !editor?.draft?.id ||
                hasUnsavedChanges ||
                previewing ||
                publishing
              }
              onClick={
                loadPreview
              }
            >
              <Eye size={16} />

              {previewing
                ? "Loading…"
                : "Preview"}
            </button>

            <button
              type="button"
              className={
                styles.premiumSaveButton
              }
              disabled={
                !hasUnsavedChanges ||
                saving ||
                publishing
              }
              onClick={
                saveDraft
              }
            >
              <Save size={16} />

              {saving
                ? "Saving…"
                : "Save Draft"}
            </button>

            <button
              type="button"
              className={
                styles.premiumPublishButton
              }
              disabled={
                !editor?.draft?.id ||
                editor?.draft_is_stale ||
                hasUnsavedChanges ||
                publishing
              }
              onClick={
                openPublishConfirm
              }
            >
              <Rocket size={16} />
              Publish
            </button>
          </div>
        </section>


        <nav
          className={
            styles.premiumSectionNav
          }
        >
          {FIELD_GROUPS.map(
            (group) => {
              const Icon =
                group.Icon;

              return (
                <a
                  key={
                    group.id
                  }
                  href={`#workspace-${group.id}`}
                >
                  <Icon size={15} />
                  {group.label}
                </a>
              );
            },
          )}
        </nav>


        <div
          className={
            styles.premiumWorkspaceSections
          }
        >
          {FIELD_GROUPS.map(
            (group) => {
              const Icon =
                group.Icon;

              return (
                <section
                  id={`workspace-${group.id}`}
                  key={
                    group.id
                  }
                  className={
                    styles.premiumWorkspaceSection
                  }
                >
                  <header
                    className={
                      styles.premiumSectionHeader
                    }
                  >
                    <div
                      className={
                        styles.premiumSectionIcon
                      }
                    >
                      <Icon size={20} />
                    </div>

                    <div>
                      <h2>
                        {group.title}
                      </h2>

                      <p>
                        {group.description}
                      </p>
                    </div>
                  </header>

                  <div
                    className={
                      styles.premiumFieldGrid
                    }
                  >
                    {group.fields.map(
                      (field) => (
                        <label
                          key={
                            field.key
                          }
                          className={
                            field.type ===
                            "textarea"
                              ? styles.premiumWideField
                              : undefined
                          }
                        >
                          <span>
                            {field.label}

                            {field.required
                              ? " *"
                              : ""}
                          </span>

                          <FieldControl
                            field={
                              field
                            }
                            value={
                              form[
                                field.key
                              ]
                            }
                            onChange={(
                              value,
                            ) =>
                              changeField(
                                field.key,
                                value,
                              )
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>


                  {group.id ===
                    "branding" && (
                    <div
                      className={
                        styles.premiumBrandMeta
                      }
                    >
                      <Palette size={17} />

                      <div>
                        <strong>
                          Campaign Seat recommendation
                        </strong>

                        <span>
                          Recommended theme:{" "}
                          {editor
                            ?.workspace
                            ?.recommended_theme ||
                            "Not set"}
                        </span>
                      </div>
                    </div>
                  )}


                  {group.id ===
                    "profile" && (
                    <div
                      className={
                        styles.premiumMediaNotice
                      }
                    >
                      <UserRound
                        size={19}
                      />

                      <div>
                        <strong>
                          Candidate photo
                        </strong>

                        <span>
                          Candidate media should be managed visually through Campaign Assets instead of entering a storage path here.
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              );
            },
          )}
        </div>


        {preview && (
          <section
            className={
              styles.premiumPreviewPanel
            }
          >
            <header>
              <div>
                <Eye size={19} />

                <div>
                  <span>
                    Private Admin Preview
                  </span>

                  <h2>
                    Published vs Draft
                  </h2>
                </div>
              </div>

              <strong>
                Not live
              </strong>
            </header>

            <div
              className={
                styles.premiumPreviewIdentity
              }
            >
              <span>
                {preview
                  .political_party ||
                  "Campaign"}
              </span>

              <h3>
                {preview
                  .candidate_name ||
                  preview.name}
              </h3>

              <p>
                {[
                  preview
                    .office_sought,
                  preview
                    .district_label,
                  preview
                    .jurisdiction_name,
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  preview.location ||
                  ""}
              </p>
            </div>

            <div
              className={
                styles.premiumCompareList
              }
            >
              {savedDraftKeys.map(
                (key) => (
                  <article
                    key={key}
                  >
                    <strong>
                      {FIELD_LABELS[
                        key
                      ] || key}
                    </strong>

                    <div>
                      <span>
                        Published
                      </span>

                      <b>
                        {displayValue(
                          editor
                            ?.workspace?.[
                            key
                          ],
                        )}
                      </b>
                    </div>

                    <div>
                      <span>
                        Draft
                      </span>

                      <b>
                        {displayValue(
                          preview?.[
                            key
                          ],
                        )}
                      </b>
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>
        )}


        <section
          className={
            styles.premiumEndCard
          }
        >
          <LockKeyhole
            size={20}
          />

          <div>
            <strong>
              Protected publishing workflow
            </strong>

            <span>
              Save Draft keeps changes private. Preview lets you review them safely. Publish is the only action that updates the campaign's live workspace.
            </span>
          </div>
        </section>


        {publishConfirmOpen && (
          <div
            className={
              styles.premiumModalBackdrop
            }
            role="presentation"
          >
            <section
              className={
                styles.premiumPublishModal
              }
              role="dialog"
              aria-modal="true"
              aria-labelledby="publish-workspace-title"
            >
              <header>
                <div
                  className={
                    styles.premiumPublishIcon
                  }
                >
                  <Rocket
                    size={22}
                  />
                </div>

                <div>
                  <span>
                    Final action
                  </span>

                  <h2
                    id="publish-workspace-title"
                  >
                    Publish workspace changes?
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setPublishConfirmOpen(
                      false,
                    )
                  }
                  aria-label="Close publish confirmation"
                >
                  <X size={19} />
                </button>
              </header>

              <p
                className={
                  styles.premiumPublishLead
                }
              >
                This will immediately replace the published campaign workspace with Draft Revision{" "}
                {editor?.draft
                  ?.revision_number}
                .
              </p>

              <div
                className={
                  styles.premiumPublishChanges
                }
              >
                <span>
                  Fields going live
                </span>

                <div>
                  {savedDraftKeys.map(
                    (key) => (
                      <strong
                        key={
                          key
                        }
                      >
                        {FIELD_LABELS[
                          key
                        ] || key}
                      </strong>
                    ),
                  )}
                </div>
              </div>

              <label
                className={
                  styles.premiumPublishCheck
                }
              >
                <input
                  type="checkbox"
                  checked={
                    publishAcknowledged
                  }
                  onChange={(
                    event,
                  ) =>
                    setPublishAcknowledged(
                      event.target
                        .checked,
                    )
                  }
                />

                <span>
                  I understand these changes will become visible to the campaign immediately.
                </span>
              </label>

              <footer>
                <button
                  type="button"
                  className={
                    styles.premiumQuietButton
                  }
                  disabled={
                    publishing
                  }
                  onClick={() =>
                    setPublishConfirmOpen(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    styles.premiumPublishButton
                  }
                  disabled={
                    !publishAcknowledged ||
                    publishing
                  }
                  onClick={
                    publishDraft
                  }
                >
                  <Rocket size={16} />

                  {publishing
                    ? "Publishing…"
                    : "Publish to Campaign"}
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </PlatformAdminShell>
  );
}
