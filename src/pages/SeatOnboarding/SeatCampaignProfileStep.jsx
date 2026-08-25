import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Globe2,
  Landmark,
  MapPin,
  Palette,
  Phone,
  Save,
  Sparkles,
} from "lucide-react";

import {
  saveMySeatCampaignProfile,
} from "../../services/seatOnboarding";

import SeatDateField
  from "./SeatDateField";

import SeatOnboardingSelect
  from "./SeatOnboardingSelect";

import {
  WORKSPACE_THEME_OPTIONS,
  getRecommendedWorkspaceTheme,
} from "../../utils/workspacePresentation";


import {
  createCandidatePhotoSignedUrl,
  uploadCandidatePhoto,
} from "../../utils/candidatePhotoStorage";


import styles
  from "./SeatOnboarding.module.css";


const CAMPAIGN_TYPES = [
  {
    value:
      "candidate_campaign",
    label:
      "Candidate campaign",
    description:
      "Campaign for an individual candidate.",
  },
  {
    value:
      "ballot_measure",
    label:
      "Ballot measure",
    description:
      "Issue, referendum or ballot initiative.",
  },
  {
    value: "pac",
    label: "PAC",
    description:
      "Political action committee.",
  },
  {
    value:
      "party_organization",
    label:
      "Party organization",
  },
  {
    value:
      "elected_official",
    label:
      "Elected official",
  },
  {
    value:
      "advocacy_organization",
    label:
      "Advocacy organization",
  },
  {
    value: "other",
    label: "Other",
  },
];


const OFFICE_LEVELS = [
  {
    value: "",
    label:
      "Select office level",
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
    value:
      "school_board",
    label:
      "School Board",
  },
  {
    value:
      "special_district",
    label:
      "Special District",
  },
  {
    value: "other",
    label: "Other",
  },
  {
    value:
      "not_applicable",
    label:
      "Not applicable",
  },
];


const JURISDICTION_TYPES = [
  {
    value: "",
    label:
      "Select jurisdiction type",
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
    value: "city",
    label: "City",
  },
  {
    value: "town",
    label: "Town",
  },
  {
    value: "village",
    label: "Village",
  },
  {
    value: "district",
    label: "District",
  },
  {
    value:
      "school_district",
    label:
      "School District",
  },
  {
    value:
      "special_district",
    label:
      "Special District",
  },
  {
    value: "other",
    label: "Other",
  },
];


const PARTIES = [
  {
    value: "",
    label:
      "Select political party",
  },
  {
    value: "republican",
    label: "Republican",
  },
  {
    value: "democratic",
    label: "Democratic",
  },
  {
    value: "independent",
    label: "Independent",
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
    value: "nonpartisan",
    label: "Nonpartisan",
  },
  {
    value: "other",
    label: "Other",
  },
];


const TIMEZONES = [
  {
    value:
      "America/New_York",
    label:
      "Eastern Time",
    description:
      "ET · New York",
  },
  {
    value:
      "America/Chicago",
    label:
      "Central Time",
    description:
      "CT · Chicago",
  },
  {
    value:
      "America/Denver",
    label:
      "Mountain Time",
    description:
      "MT · Denver",
  },
  {
    value:
      "America/Phoenix",
    label:
      "Arizona Time",
    description:
      "Phoenix",
  },
  {
    value:
      "America/Los_Angeles",
    label:
      "Pacific Time",
    description:
      "PT · Los Angeles",
  },
  {
    value:
      "America/Anchorage",
    label:
      "Alaska Time",
  },
  {
    value:
      "Pacific/Honolulu",
    label:
      "Hawaii Time",
  },
];


function browserTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      "America/New_York"
    );
  } catch {
    return "America/New_York";
  }
}


export default function SeatCampaignProfileStep({
  onboarding,
}) {
  const savedProfile =
    useMemo(
      () =>
        (
          onboarding?.steps ||
          []
        ).find(
          (step) =>
            step.step_key ===
            "product_profile",
        )?.step_data ||
        {},
      [
        onboarding,
      ],
    );


  const savedAddress =
    savedProfile
      .campaign_address ||
    {};


  const defaultTimezone =
    savedProfile.timezone ||
    browserTimezone();


  const [
    form,
    setForm,
  ] =
    useState({
      campaign_type:
        savedProfile
          .campaign_type ||
        "candidate_campaign",

      campaign_name:
        savedProfile
          .campaign_name ||
        onboarding
          ?.account_name ||
        "",

      candidate_name:
        savedProfile
          .candidate_name ||
        onboarding
          ?.full_name ||
        "",

      candidate_photo_path:
        savedProfile
          .candidate_photo_path ||
        "",

      legal_committee_name:
        savedProfile
          .legal_committee_name ||
        "",

      office_sought:
        savedProfile
          .office_sought ||
        "",

      office_level:
        savedProfile
          .office_level ||
        "",

      district_label:
        savedProfile
          .district_label ||
        "",

      jurisdiction_name:
        savedProfile
          .jurisdiction_name ||
        "",

      jurisdiction_type:
        savedProfile
          .jurisdiction_type ||
        "",

      political_party:
        savedProfile
          .political_party ||
        "",

      recommended_theme:
        savedProfile
          .recommended_theme ||
        getRecommendedWorkspaceTheme(
          savedProfile
            .political_party,
        ),

      active_theme:
        savedProfile
          .active_theme ||
        getRecommendedWorkspaceTheme(
          savedProfile
            .political_party,
        ),

      theme_source:
        savedProfile
          .theme_source ||
        "recommended",

      next_election_date:
        savedProfile
          .next_election_date ||
        "",

      primary_election_date:
        savedProfile
          .primary_election_date ||
        "",

      general_election_date:
        savedProfile
          .general_election_date ||
        "",

      timezone:
        defaultTimezone,

      campaign_email:
        savedProfile
          .campaign_email ||
        onboarding?.email ||
        "",

      campaign_phone:
        savedProfile
          .campaign_phone ||
        "",

      website_url:
        savedProfile
          .website_url ||
        "",

      address_line1:
        savedAddress.line1 ||
        "",

      address_line2:
        savedAddress.line2 ||
        "",

      address_city:
        savedAddress.city ||
        "",

      state_region:
        savedProfile
          .state_region ||
        savedAddress
          .state_region ||
        "",

      county_name:
        savedProfile
          .county_name ||
        "",

      municipality_name:
        savedProfile
          .municipality_name ||
        "",

      postal_code:
        savedProfile
          .postal_code ||
        savedAddress
          .postal_code ||
        "",

      country_code:
        savedProfile
          .country_code ||
        savedAddress
          .country_code ||
        "US",

      disclaimer_text:
        savedProfile
          .disclaimer_text ||
        "",
    });


  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");


  const [
    candidatePhotoPreviewUrl,
    setCandidatePhotoPreviewUrl,
  ] =
    useState("");

  const [
    candidatePhotoUploading,
    setCandidatePhotoUploading,
  ] =
    useState(false);


  useEffect(
    () => {
      let cancelled =
        false;

      const loadSavedPhoto =
        async () => {
          const storagePath =
            String(
              form
                .candidate_photo_path ||
              "",
            ).trim();

          if (!storagePath) {
            setCandidatePhotoPreviewUrl(
              "",
            );

            return;
          }

          const previewUrl =
            await createCandidatePhotoSignedUrl(
              storagePath,
              600,
            );

          if (!cancelled) {
            setCandidatePhotoPreviewUrl(
              previewUrl ||
              "",
            );
          }
        };

      void loadSavedPhoto();

      return () => {
        cancelled =
          true;
      };
    },
    [
      form
        .candidate_photo_path,
    ],
  );


  const isCandidate =
    form.campaign_type ===
    "candidate_campaign";


  const setValue =
    (
      field,
      value,
    ) => {
      setForm(
        (current) => ({
          ...current,
          [field]: value,
        }),
      );
    };


  const update =
    (field) =>
      (event) =>
        setValue(
          field,
          event.target.value,
        );


  const selectPoliticalParty =
    (
      politicalParty,
    ) => {
      const recommendedTheme =
        getRecommendedWorkspaceTheme(
          politicalParty,
        );


      setForm(
        (current) => ({
          ...current,

          political_party:
            politicalParty,

          recommended_theme:
            recommendedTheme,

          active_theme:
            current.theme_source ===
              "campaign_branding"
              ? current.active_theme
              : recommendedTheme,

          theme_source:
            current.theme_source ===
              "campaign_branding"
              ? "campaign_branding"
              : "recommended",
        }),
      );
    };


  const selectWorkspaceTheme =
    (
      activeTheme,
    ) => {
      setForm(
        (current) => ({
          ...current,

          active_theme:
            activeTheme,

          recommended_theme:
            getRecommendedWorkspaceTheme(
              current
                .political_party,
            ),

          theme_source:
            "campaign_branding",
        }),
      );
    };


  const locationPreview =
    (() => {
      const type =
        String(
          form
            .jurisdiction_type ||
          "",
        ).toLowerCase();

      let primary =
        form
          .jurisdiction_name;


      if (
        type ===
          "county"
      ) {
        primary =
          form.county_name;
      } else if (
        [
          "city",
          "town",
          "village",
        ].includes(type)
      ) {
        primary =
          form
            .municipality_name;
      } else if (
        type ===
          "state"
      ) {
        primary =
          form.state_region;
      }


      return [
        primary,
        form.state_region &&
        form.state_region !==
          primary
          ? form.state_region
          : "",
      ]
        .filter(Boolean)
        .join(", ");
    })();


  const handleCandidatePhoto =
    async (event) => {
      const file =
        event.currentTarget
          .files?.[0];

      event.currentTarget.value =
        "";

      if (!file) {
        return;
      }

      setError("");

      setCandidatePhotoUploading(
        true,
      );

      try {
        const uploaded =
          await uploadCandidatePhoto(
            file,
          );

        setValue(
          "candidate_photo_path",
          uploaded.storagePath,
        );

        setCandidatePhotoPreviewUrl(
          uploaded.previewUrl ||
          "",
        );
      } catch (
        photoError
      ) {
        setError(
          photoError
            ?.message ||
            "Candidate photo could not be uploaded.",
        );
      } finally {
        setCandidatePhotoUploading(
          false,
        );
      }
    };


  const submit =
    async (event) => {
      event.preventDefault();

      if (saving) {
        return;
      }

      setError("");
      setSaving(true);

      try {
        await saveMySeatCampaignProfile(
          form,
        );

        window.location.reload();
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Campaign Profile could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    };


  return (
    <form
      className={
        styles.profileCard
      }
      onSubmit={submit}
    >
      <div
        className={
          styles.profileHeading
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Campaign profile
          </span>

          <h2>
            Tell us about the campaign.
          </h2>

          <p>
            These details become the foundation of your Campaign Seat workspace when onboarding is activated.
          </p>
        </div>

        <Landmark size={27} />
      </div>


      <section
        className={
          styles.profileSection
        }
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <Building2 size={20} />

          <div>
            <strong>
              Campaign identity
            </strong>

            <span>
              Official and public campaign information.
            </span>
          </div>
        </div>

        <div
          className={[
            styles.profileGrid,
            styles.polishedFormGrid,
          ].join(" ")}
        >
          <label
            className={
              styles.profileWide
            }
          >
            Campaign / workspace name

            <input
              value={
                form.campaign_name
              }
              onChange={update(
                "campaign_name",
              )}
              required
            />
          </label>

          <SeatOnboardingSelect
            label="Campaign type"
            value={
              form.campaign_type
            }
            options={
              CAMPAIGN_TYPES
            }
            onChange={(value) =>
              setValue(
                "campaign_type",
                value,
              )
            }
            required
          />

          <label>
            Candidate name

            <input
              value={
                form.candidate_name
              }
              onChange={update(
                "candidate_name",
              )}
              required={
                isCandidate
              }
            />
          </label>

          {isCandidate ? (
            <div
              className={[
                styles.profileWide,
                styles.candidatePhotoField,
              ].join(" ")}
            >
              <span>
                Candidate photo
              </span>

              <div
                className={
                  styles.candidatePhotoControl
                }
              >
                <div
                  className={
                    styles.candidatePhotoPreview
                  }
                  data-candidate-photo-frame="onboarding"
                >
                  {candidatePhotoPreviewUrl ? (
                    <img
                      src={
                        candidatePhotoPreviewUrl
                      }
                      alt="Candidate preview"
                      data-candidate-photo="onboarding"
                      decoding="async"
                      loading="eager"
                      draggable="false"
                    />
                  ) : (
                    <Camera
                      size={24}
                    />
                  )}
                </div>

                <div
                  className={
                    styles.candidatePhotoCopy
                  }
                >
                  <strong>
                    Campaign profile photo
                  </strong>

                  <small>
                    Upload it once here and it will automatically appear throughout Campaign HQ after Activation.
                  </small>

                  <label
                    className={
                      styles.candidatePhotoUploadButton
                    }
                  >
                    <Camera
                      size={15}
                    />

                    {candidatePhotoUploading
                      ? "Uploading…"
                      : candidatePhotoPreviewUrl
                        ? "Change photo"
                        : "Upload photo"}

                    <input
                      type="file"
                      accept="image/*"
                      disabled={
                        candidatePhotoUploading
                      }
                      onChange={
                        handleCandidatePhoto
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          <label
            className={
              styles.profileWide
            }
          >
            Legal committee name

            <input
              value={
                form
                  .legal_committee_name
              }
              onChange={update(
                "legal_committee_name",
              )}
              placeholder="Optional"
            />
          </label>
        </div>
      </section>


      <section
        className={
          styles.profileSection
        }
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <MapPin size={20} />

          <div>
            <strong>
              Office & jurisdiction
            </strong>

            <span>
              Where this campaign is running.
            </span>
          </div>
        </div>

        <div
          className={[
            styles.profileGrid,
            styles.polishedFormGrid,
          ].join(" ")}
        >
          <label>
            Office sought

            <input
              value={
                form.office_sought
              }
              onChange={update(
                "office_sought",
              )}
              placeholder="County Commissioner"
              required={
                isCandidate
              }
            />
          </label>

          <SeatOnboardingSelect
            label="Office level"
            value={
              form.office_level
            }
            options={
              OFFICE_LEVELS
            }
            onChange={(value) =>
              setValue(
                "office_level",
                value,
              )
            }
            required={
              isCandidate
            }
          />

          <label>
            District / seat

            <input
              value={
                form.district_label
              }
              onChange={update(
                "district_label",
              )}
              placeholder="District 6"
            />
          </label>

          <SeatOnboardingSelect
            label="Jurisdiction type"
            value={
              form
                .jurisdiction_type
            }
            options={
              JURISDICTION_TYPES
            }
            onChange={(value) =>
              setValue(
                "jurisdiction_type",
                value,
              )
            }
          />

          <label
            className={
              styles.profileWide
            }
          >
            Jurisdiction name

            <input
              value={
                form
                  .jurisdiction_name
              }
              onChange={update(
                "jurisdiction_name",
              )}
              placeholder={
                [
                  "district",
                  "school_district",
                  "special_district",
                  "other",
                ].includes(
                  form.jurisdiction_type,
                )
                  ? "District or jurisdiction name"
                  : "Derived from the structured location below"
              }
              required={
                isCandidate &&
                [
                  "district",
                  "school_district",
                  "special_district",
                  "other",
                ].includes(
                  form.jurisdiction_type,
                )
              }
            />
          </label>

          <label>
            State / region

            <input
              value={
                form.state_region
              }
              onChange={update(
                "state_region",
              )}
              placeholder="Florida"
            />
          </label>

          <label>
            County

            <input
              value={
                form.county_name
              }
              onChange={update(
                "county_name",
              )}
              placeholder="Palm Beach County"
              required={
                form.jurisdiction_type ===
                "county"
              }
            />
          </label>

          <label>
            Municipality

            <input
              value={
                form
                  .municipality_name
              }
              onChange={update(
                "municipality_name",
              )}
              placeholder="City, town or village"
              required={
                [
                  "city",
                  "town",
                  "village",
                ].includes(
                  form.jurisdiction_type,
                )
              }
            />
          </label>

          <SeatOnboardingSelect
            label="Political party"
            value={
              form.political_party
            }
            options={PARTIES}
            onChange={
              selectPoliticalParty
            }
            required={
              isCandidate
            }
          />
        </div>
      </section>


        <div
          className={
            styles.locationTruthPreview
          }
        >
          <MapPin size={18} />

          <div>
            <strong>
              Campaign Seat location
            </strong>

            <span>
              {locationPreview ||
                "Complete the structured jurisdiction fields above."}
            </span>

            <small>
              This location drives the Workspace screen, regional imagery and campaign geography.
            </small>
          </div>
        </div>


      <section
        className={[
          styles.profileSection,
          styles.brandingSection,
        ].join(" ")}
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <Palette size={20} />

          <div>
            <strong>
              Workspace appearance
            </strong>

            <span>
              Choose the color system this campaign will use across Campaign HQ.
            </span>
          </div>
        </div>


        <div
          className={
            styles.themeRecommendation
          }
        >
          <Sparkles size={17} />

          <span>
            Campaign Seat recommends{" "}
            <strong>
              {getRecommendedWorkspaceTheme(
                form.political_party,
              ) === "red"
                ? "Red"
                : getRecommendedWorkspaceTheme(
                      form.political_party,
                    ) === "blue"
                  ? "Blue"
                  : "Campaign Navy"}
            </strong>
            {" "}for the selected political affiliation. You can choose another palette.
          </span>
        </div>


        <div
          className={
            styles.secureThemeGrid
          }
        >
          {WORKSPACE_THEME_OPTIONS.map(
            (themeOption) => {
              const selected =
                form.active_theme ===
                themeOption.value;


              return (
                <button
                  key={
                    themeOption.value
                  }
                  type="button"
                  className={[
                    styles.secureThemeCard,
                    selected
                      ? styles.secureThemeCardSelected
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-theme={
                    themeOption.value
                  }
                  onClick={() =>
                    selectWorkspaceTheme(
                      themeOption.value,
                    )
                  }
                >
                  <span
                    className={
                      styles.secureThemeSwatch
                    }
                  />

                  <span>
                    <strong>
                      {themeOption.label}
                    </strong>

                    <small>
                      {themeOption.description}
                    </small>
                  </span>

                  {selected ? (
                    <span
                      className={
                        styles.secureThemeSelected
                      }
                    >
                      Selected
                    </span>
                  ) : null}
                </button>
              );
            },
          )}
        </div>


        <p
          className={
            styles.themePersistenceNote
          }
        >
          This choice belongs to the campaign workspace. Campaign leadership can change it later without affecting other Campaign Seat workspaces.
        </p>
      </section>


      <section
        className={[
          styles.profileSection,
          styles.electionSection,
        ].join(" ")}
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <CalendarDays
            size={20}
          />

          <div>
            <strong>
              Election calendar
            </strong>

            <span>
              Dates that drive Campaign HQ countdowns and scheduling.
            </span>
          </div>
        </div>

        <div
          className={[
            styles.profileGrid,
            styles.polishedFormGrid,
            styles.electionGrid,
          ].join(" ")}
        >
          <SeatDateField
            label="Next election date"
            value={
              form
                .next_election_date
            }
            onChange={(value) =>
              setValue(
                "next_election_date",
                value,
              )
            }
            required={
              isCandidate
            }
          />

          <SeatDateField
            label="Primary election"
            value={
              form
                .primary_election_date
            }
            onChange={(value) =>
              setValue(
                "primary_election_date",
                value,
              )
            }
          />

          <SeatDateField
            label="General election"
            value={
              form
                .general_election_date
            }
            onChange={(value) =>
              setValue(
                "general_election_date",
                value,
              )
            }
          />

          <SeatOnboardingSelect
            label="Timezone"
            value={
              form.timezone
            }
            options={TIMEZONES}
            onChange={(value) =>
              setValue(
                "timezone",
                value,
              )
            }
            required
          />
        </div>
      </section>


      <section
        className={
          styles.profileSection
        }
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <Globe2 size={20} />

          <div>
            <strong>
              Campaign contact
            </strong>

            <span>
              Operational contact information for the workspace.
            </span>
          </div>
        </div>

        <div
          className={[
            styles.profileGrid,
            styles.polishedFormGrid,
          ].join(" ")}
        >
          <label>
            Campaign email

            <input
              type="email"
              value={
                form.campaign_email
              }
              onChange={update(
                "campaign_email",
              )}
              required
            />
          </label>

          <label>
            Campaign phone

            <input
              value={
                form.campaign_phone
              }
              onChange={update(
                "campaign_phone",
              )}
            />
          </label>

          <label
            className={
              styles.profileWide
            }
          >
            Website

            <input
              type="url"
              value={
                form.website_url
              }
              onChange={update(
                "website_url",
              )}
              placeholder="https://"
            />
          </label>

          <label
            className={
              styles.profileWide
            }
          >
            Address line 1

            <input
              value={
                form.address_line1
              }
              onChange={update(
                "address_line1",
              )}
            />
          </label>

          <label
            className={
              styles.profileWide
            }
          >
            Address line 2

            <input
              value={
                form.address_line2
              }
              onChange={update(
                "address_line2",
              )}
            />
          </label>

          <label>
            City

            <input
              value={
                form.address_city
              }
              onChange={update(
                "address_city",
              )}
            />
          </label>

          <label>
            Postal code

            <input
              value={
                form.postal_code
              }
              onChange={update(
                "postal_code",
              )}
            />
          </label>

          <label>
            Country code

            <input
              maxLength={2}
              value={
                form.country_code
              }
              onChange={update(
                "country_code",
              )}
            />
          </label>
        </div>
      </section>


      <section
        className={
          styles.profileSection
        }
      >
        <div
          className={
            styles.profileSectionTitle
          }
        >
          <Phone size={20} />

          <div>
            <strong>
              Compliance
            </strong>

            <span>
              Optional campaign disclaimer for future materials and communications.
            </span>
          </div>
        </div>

        <label>
          Disclaimer

          <textarea
            value={
              form.disclaimer_text
            }
            onChange={update(
              "disclaimer_text",
            )}
            placeholder="Paid for by..."
            rows={3}
          />
        </label>
      </section>


      {error && (
        <div
          className={
            styles.error
          }
          role="alert"
        >
          {error}
        </div>
      )}


      <div
        className={
          styles.profileActions
        }
      >
        <div>
          <strong>
            Save campaign profile
          </strong>

          <span>
            Your saved information remains editable until Activation.
          </span>
        </div>

        <button
          className={
            styles.primary
          }
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <Save size={18} />
              Saving…
            </>
          ) : (
            <>
              Save & Continue
              <ArrowRight
                size={18}
              />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
