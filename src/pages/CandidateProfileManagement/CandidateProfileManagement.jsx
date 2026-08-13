import {
  useState,
} from "react";

import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  FileText,
  Globe2,
  Landmark,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  Vote,
} from "lucide-react";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  useCandidateProfileManagement,
} from "../../hooks/useCandidateProfileManagement";

import {
  useFilesCommandCenter,
} from "../../hooks/useFilesCommandCenter";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";

import styles from "./CandidateProfileManagement.module.css";

const OFFICE_LEVELS = [
  ["", "Choose level"],
  ["federal", "Federal"],
  ["state", "State"],
  ["county", "County"],
  ["municipal", "Municipal"],
  [
    "school_board",
    "School board",
  ],
  [
    "special_district",
    "Special district",
  ],
  ["other", "Other"],
];

const JURISDICTION_TYPES = [
  ["", "Choose type"],
  ["federal", "Federal"],
  ["state", "State"],
  ["county", "County"],
  ["city", "City"],
  ["town", "Town"],
  ["village", "Village"],
  ["district", "District"],
  [
    "school_district",
    "School district",
  ],
  [
    "special_district",
    "Special district",
  ],
  ["other", "Other"],
];

export default function CandidateProfileManagement() {
  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const roleLabel =
    getRoleLabel();

  const canManageCandidate =
    /candidate|consultant|manager|owner|administrator/i.test(
      roleLabel,
    );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    selectedPhotoName,
    setSelectedPhotoName,
  ] = useState("");

  const {
    profile,
    photoPreviewUrl,
    isLoading,
    isSaving,
    error,
    success,
    hasChanges,
    updateField,
    setCandidatePhoto,
    resetChanges,
    refresh,
    saveCandidateProfile,
  } =
    useCandidateProfileManagement({
      workspaceId:
        workspace.id,

      initialWorkspace:
        workspace,
    });

  const {
    isSaving:
      isFileSaving,
    uploadFiles,
  } =
    useFilesCommandCenter({
      workspaceId:
        workspace.id,

      userId:
        user.id,
    });

  const handlePhoto =
    async (event) => {
      const file =
        event.currentTarget
          .files?.[0];

      event.currentTarget.value =
        "";

      if (!file) {
        return;
      }

      setFormError("");
      setSelectedPhotoName(
        file.name,
      );

      if (
        !file.type.startsWith(
          "image/",
        )
      ) {
        setFormError(
          "Choose an image file for the candidate photo.",
        );
        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        setFormError(
          "Choose a candidate photo smaller than 5 MB.",
        );
        return;
      }

      try {
        const uploaded =
          await uploadFiles(
            [file],
            "Candidate Profile",
          );

        const savedFile =
          uploaded?.[0];

        if (
          !savedFile
            ?.storage_path
        ) {
          throw new Error(
            "Candidate photo upload did not return a storage path.",
          );
        }

        await setCandidatePhoto(
          savedFile
            .storage_path,
        );
      } catch (
        uploadError
      ) {
        setSelectedPhotoName("");
        setSelectedPhotoName("");
        setFormError(
          uploadError
            ?.message ||
            "Candidate photo could not be uploaded.",
        );
      }
    };

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      setFormError("");

      try {
        await saveCandidateProfile();
      } catch (
        saveError
      ) {
        setFormError(
          saveError
            ?.message ||
            "Candidate profile could not be saved.",
        );
      }
    };

  const combinedError =
    formError ||
    error;

  const initials =
    getUserInitials(
      profile.candidateName ||
      "Candidate",
    );

  return (
    <CampaignWorkspaceShell
      activeItem="Candidate"
    >
      <main
        className={
          styles.page
        }
      >
        <header
          className={
            styles.pageHeader
          }
        >
          <div>
            <span
              className={
                styles.eyebrow
              }
            >
              Leadership · Candidate management
            </span>

            <h1>
              Manage Candidate
            </h1>

            <p>
              Manage the candidate identity,
              campaign profile, race information
              and public contact details for this
              workspace.
            </p>
          </div>

          <div
            className={
              styles.headerActions
            }
          >
            <button
              type="button"
              onClick={
                refresh
              }
              disabled={
                isLoading ||
                isSaving
              }
            >
              <RefreshCw
                className={
                  isLoading
                    ? styles.spinning
                    : ""
                }
                size={17}
              />

              Refresh
            </button>

            <span
              className={
                styles.roleBadge
              }
            >
              <ShieldCheck
                size={17}
              />

              {roleLabel}
            </span>
          </div>
        </header>

        <section
          className={
            styles.securityNotice
          }
        >
          <ShieldCheck
            size={23}
          />

          <div>
            <strong>
              Candidate identity is separate
              from candidate login security
            </strong>

            <p>
              Campaign leadership can manage
              the candidate profile here.
              Passwords, MFA and personal
              authentication remain controlled
              by the candidate&apos;s own
              account.
            </p>
          </div>
        </section>

        {!canManageCandidate ? (
          <section
            className={
              styles.restricted
            }
          >
            <ShieldCheck
              size={42}
            />

            <h2>
              Leadership access required
            </h2>

            <p>
              Your current campaign role cannot
              manage the candidate profile.
            </p>
          </section>
        ) : (
          <form
            onSubmit={
              handleSubmit
            }
          >
            {combinedError ? (
              <section
                className={
                  styles.errorBanner
                }
                role="alert"
              >
                <AlertTriangle
                  size={20}
                />

                <div>
                  <strong>
                    Candidate profile needs
                    attention
                  </strong>

                  <p>
                    {combinedError}
                  </p>
                </div>
              </section>
            ) : null}

            {success ? (
              <section
                className={
                  styles.successBanner
                }
                role="status"
              >
                <CheckCircle2
                  size={20}
                />

                <strong>
                  {success}
                </strong>
              </section>
            ) : null}

            <section
              className={
                styles.candidateHero
              }
            >
              <div
                className={
                  styles.photoWrap
                }
              >
                <div
                  className={
                    styles.photo
                  }
                >
                  {photoPreviewUrl ? (
                    <img
                      src={
                        photoPreviewUrl
                      }
                      alt={
                        profile
                          .candidateName ||
                        "Candidate"
                      }
                    />
                  ) : (
                    <span>
                      {initials}
                    </span>
                  )}
                </div>

                <label
                  className={
                    styles.photoButton
                  }
                >
                  {isFileSaving ? (
                    <LoaderCircle
                      className={
                        styles.spinning
                      }
                      size={17}
                    />
                  ) : (
                    <Camera
                      size={17}
                    />
                  )}

                  {isFileSaving
                    ? "Uploading…"
                    : "Upload candidate photo"}

                  <input
                    type="file"
                    accept="image/*"
                    disabled={
                      isFileSaving ||
                      isSaving
                    }
                    onChange={
                      handlePhoto
                    }
                  />
                </label>

                {selectedPhotoName ? (
                  <div
                    className={
                      styles.photoSelection
                    }
                  >
                    <CheckCircle2
                      size={16}
                    />

                    <div>
                      <strong>
                        Selected photo
                      </strong>

                      <span>
                        {selectedPhotoName}
                      </span>
                    </div>
                  </div>
                ) : (
                  <small>
                    JPG, PNG or WebP. Maximum
                    5 MB. Stored inside the
                    campaign&apos;s protected
                    Documents storage.
                  </small>
                )}
              </div>

              <div
                className={
                  styles.heroIdentity
                }
              >
                <span>
                  Candidate profile
                </span>

                <h2>
                  {profile
                    .candidateName ||
                    "Candidate name"}
                </h2>

                <p>
                  {[
                    profile
                      .officeSought,
                    profile
                      .districtLabel,
                    profile
                      .jurisdictionName,
                  ]
                    .filter(Boolean)
                    .join(" · ") ||
                    "Add the office, district and jurisdiction below."}
                </p>

                <div
                  className={
                    styles.heroMeta
                  }
                >
                  <span>
                    <Building2
                      size={15}
                    />
                    {profile
                      .publicCampaignName ||
                      workspace.name}
                  </span>

                  <span>
                    <UserRound
                      size={15}
                    />
                    Managed by campaign
                    leadership
                  </span>
                </div>
              </div>
            </section>

            <div
              className={
                styles.grid
              }
            >
              <section
                className={
                  styles.card
                }
              >
                <header>
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <UserRound
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Candidate identity
                    </h2>

                    <p>
                      Candidate-facing identity
                      and public contact
                      information.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.fields
                  }
                >
                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Candidate name
                    </span>

                    <input
                      type="text"
                      value={
                        profile
                          .candidateName
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "candidateName",
                          event
                            .target
                            .value,
                        )
                      }
                      maxLength={160}
                      required
                    />
                  </label>

                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Candidate biography
                    </span>

                    <textarea
                      value={
                        profile
                          .candidateBio
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "candidateBio",
                          event
                            .target
                            .value,
                        )
                      }
                      maxLength={4000}
                      rows={7}
                      placeholder="Candidate background, community roots, experience and campaign biography."
                    />

                    <small>
                      {
                        profile
                          .candidateBio
                          .length
                      }
                      /4000
                    </small>
                  </label>

                  <label>
                    <span>
                      Public candidate email
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Mail
                        size={17}
                      />

                      <input
                        type="email"
                        value={
                          profile
                            .candidatePublicEmail
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "candidatePublicEmail",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="candidate@example.com"
                      />
                    </div>
                  </label>

                  <label>
                    <span>
                      Public candidate phone
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Phone
                        size={17}
                      />

                      <input
                        type="tel"
                        value={
                          profile
                            .candidatePublicPhone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "candidatePublicPhone",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="(561) 555-0123"
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section
                className={
                  styles.card
                }
              >
                <header>
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <Vote
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Race & campaign
                    </h2>

                    <p>
                      Official campaign identity,
                      office and jurisdiction.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.fields
                  }
                >
                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Public campaign name
                    </span>

                    <input
                      type="text"
                      value={
                        profile
                          .publicCampaignName
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "publicCampaignName",
                          event
                            .target
                            .value,
                        )
                      }
                      maxLength={120}
                      placeholder="Elizabeth Accomando for Palm Beach County"
                    />
                  </label>

                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Legal committee name
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Landmark
                        size={17}
                      />

                      <input
                        type="text"
                        value={
                          profile
                            .legalCommitteeName
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "legalCommitteeName",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Official committee name"
                      />
                    </div>
                  </label>

                  <label>
                    <span>
                      Office sought
                    </span>

                    <input
                      type="text"
                      value={
                        profile
                          .officeSought
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "officeSought",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="County Commissioner"
                    />
                  </label>

                  <label>
                    <span>
                      Office level
                    </span>

                    <select
                      value={
                        profile
                          .officeLevel
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "officeLevel",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      {OFFICE_LEVELS.map(
                        ([
                          value,
                          label,
                        ]) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      District
                    </span>

                    <input
                      type="text"
                      value={
                        profile
                          .districtLabel
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "districtLabel",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="District 6"
                    />
                  </label>

                  <label>
                    <span>
                      Jurisdiction type
                    </span>

                    <select
                      value={
                        profile
                          .jurisdictionType
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "jurisdictionType",
                          event
                            .target
                            .value,
                        )
                      }
                    >
                      {JURISDICTION_TYPES.map(
                        ([
                          value,
                          label,
                        ]) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Jurisdiction
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <MapPin
                        size={17}
                      />

                      <input
                        type="text"
                        value={
                          profile
                            .jurisdictionName
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "jurisdictionName",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Palm Beach County, Florida"
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section
                className={
                  styles.card
                }
              >
                <header>
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <CalendarDays
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Election & campaign contacts
                    </h2>

                    <p>
                      Election dates and official
                      campaign communication
                      information.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.fields
                  }
                >
                  <label>
                    <span>
                      Primary election
                    </span>

                    <input
                      type="date"
                      value={
                        profile
                          .primaryElectionDate
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "primaryElectionDate",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      General election
                    </span>

                    <input
                      type="date"
                      value={
                        profile
                          .generalElectionDate
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "generalElectionDate",
                          event
                            .target
                            .value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Campaign email
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Mail
                        size={17}
                      />

                      <input
                        type="email"
                        value={
                          profile
                            .campaignEmail
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "campaignEmail",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="campaign@example.com"
                      />
                    </div>
                  </label>

                  <label>
                    <span>
                      Campaign phone
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Phone
                        size={17}
                      />

                      <input
                        type="tel"
                        value={
                          profile
                            .campaignPhone
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "campaignPhone",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Campaign office phone"
                      />
                    </div>
                  </label>

                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Campaign website
                    </span>

                    <div
                      className={
                        styles.inputIcon
                      }
                    >
                      <Globe2
                        size={17}
                      />

                      <input
                        type="url"
                        value={
                          profile
                            .websiteUrl
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "websiteUrl",
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="https://..."
                      />
                    </div>
                  </label>

                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Time zone
                    </span>

                    <input
                      type="text"
                      value={
                        profile
                          .timezone
                      }
                      onChange={(
                        event,
                      ) =>
                        updateField(
                          "timezone",
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="America/New_York"
                    />
                  </label>

                  <label
                    className={
                      styles.full
                    }
                  >
                    <span>
                      Campaign disclaimer
                    </span>

                    <div
                      className={
                        styles.textareaIcon
                      }
                    >
                      <FileText
                        size={17}
                      />

                      <textarea
                        value={
                          profile
                            .disclaimerText
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "disclaimerText",
                            event
                              .target
                              .value,
                          )
                        }
                        rows={4}
                        placeholder="Paid for by..."
                      />
                    </div>
                  </label>
                </div>
              </section>
            </div>

            <footer
              className={
                styles.saveBar
              }
            >
              <div>
                <strong>
                  {hasChanges
                    ? "Unsaved candidate changes"
                    : "Candidate profile is current"}
                </strong>

                <span>
                  Changes here do not alter
                  the candidate&apos;s password,
                  MFA or personal login.
                </span>
              </div>

              <div
                className={
                  styles.saveActions
                }
              >
                <button
                  type="button"
                  onClick={() => {
                    resetChanges();
                    setSelectedPhotoName("");
                  }}
                  disabled={
                    !hasChanges ||
                    isSaving
                  }
                >
                  Reset
                </button>

                <button
                  className={
                    styles.primary
                  }
                  type="submit"
                  disabled={
                    !hasChanges ||
                    isSaving ||
                    isFileSaving
                  }
                >
                  {isSaving ? (
                    <LoaderCircle
                      className={
                        styles.spinning
                      }
                      size={18}
                    />
                  ) : (
                    <Save
                      size={18}
                    />
                  )}

                  {isSaving
                    ? "Saving…"
                    : "Save candidate profile"}
                </button>
              </div>
            </footer>
          </form>
        )}
      </main>
    </CampaignWorkspaceShell>
  );
}
