import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Accessibility,
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Database,
  Download,
  Eye,
  FileText,
  KeyRound,
  Link2,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Phone,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  UsersRound,
  Vote,
  Zap,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  CampaignWorkspaceShell,
} from "../../components/CampaignWorkspaceShell/CampaignWorkspaceShell";

import {
  CampaignMobileSetup,
} from "../../components/CampaignMobileSetup/CampaignMobileSetup";

import SecurityOnboardingGate from "../../components/security/SecurityOnboardingGate/SecurityOnboardingGate";

import {
  useProfileSettings,
} from "../../hooks/useProfileSettings";

import {
  useCandidateProfileManagement,
} from "../../hooks/useCandidateProfileManagement";

import {
  dataUrlToCandidatePhotoFile,
  persistWorkspaceCandidatePhoto,
  uploadCandidatePhoto,
} from "../../utils/candidatePhotoStorage";

import {
  usePlatformSmsPreferences,
} from "../../hooks/usePlatformSmsPreferences";

import {
  usePlatformNotificationPreferences,
} from "../../hooks/usePlatformNotificationPreferences";

import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
  hasCampaignPermission,
} from "../../utils/campaignSession";

import EmailContactsOnboarding from "../../components/integrations/EmailContactsOnboarding/EmailContactsOnboarding";

import styles from "./ProfileSettings.module.css";

const LOCAL_SETTINGS_KEY =
  "campaign-seat-profile-settings-v1";

const TABS = [
  {
    id: "profile",
    label: "Profile",
    icon: UserRound,
  },
  {
    id: "account",
    label: "Account",
    icon: BadgeCheck,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: BellRing,
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Link2,
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: Palette,
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
  },
  {
    id: "team",
    label: "Team Access",
    icon: UsersRound,
  },
];

function loadLocalSettings({
  roleLabel,
  workspace,
}) {
  const defaults = {
    title: roleLabel || "",
    phone: "",
    location:
      workspace?.location ||
      "Wellington, FL",
    timeZone:
      "America/New_York",
    bio: "",
    avatarDataUrl: "",
    theme: "light",
    compactMode: false,
    reducedMotion: false,
    largeText: false,
    notifications: {
      campaignUpdates: true,
      taskReminders: true,
      approvals: true,
      fieldAlerts: true,
      weeklySummary: true,
      marketing: false,
    },
  };

  try {
    const saved =
      window.sessionStorage.getItem(
        LOCAL_SETTINGS_KEY,
      );

    if (!saved) {
      return defaults;
    }

    const parsed =
      JSON.parse(saved);

    return {
      ...defaults,
      ...parsed,
      notifications: {
        ...defaults.notifications,
        ...parsed.notifications,
      },
    };
  } catch {
    return defaults;
  }
}

function normalizePlatformSmsPhone(
  value,
) {
  const raw =
    String(
      value || "",
    ).trim();

  if (
    /^\+[1-9][0-9]{7,14}$/
      .test(
        raw,
      )
  ) {
    return raw;
  }

  const digits =
    raw.replace(
      /[^0-9]/g,
      "",
    );

  if (
    digits.length === 10
  ) {
    return `+1${digits}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith(
      "1",
    )
  ) {
    return `+${digits}`;
  }

  return "";
}


function PreferenceToggle({
  checked,
  description,
  disabled = false,
  label,
  onChange,
}) {
  return (
    <button
      className={[
        styles.toggle,
        checked
          ? styles.toggleActive
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>

      <i aria-hidden="true">
        <b />
      </i>
    </button>
  );
}

function SettingsRow({
  action,
  description,
  icon: Icon,
  label,
  status,
}) {
  return (
    <article
      className={
        styles.settingRow
      }
    >
      <span
        className={
          styles.settingIcon
        }
      >
        <Icon size={18} />
      </span>

      <div
        className={
          styles.settingText
        }
      >
        <strong>{label}</strong>
        <small>{description}</small>
      </div>

      {status ? (
        <span
          className={
            styles.inlineStatus
          }
        >
          {status}
        </span>
      ) : null}

      {action}
    </article>
  );
}

export default function ProfileSettings() {
  const navigate =
    useNavigate();

  const user =
    getCurrentUser();

  const workspace =
    getCurrentWorkspace();

  const roleLabel =
    getRoleLabel();

  const isCandidateProfile =
    /candidate/i.test(
      String(
        roleLabel || "",
      ),
    );

  const leadershipAccess =
    /candidate|consultant|manager|owner|administrator/i
      .test(roleLabel);

  const canManageTeam =
    hasCampaignPermission(
      "workspace.invite_members",
    );

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    () => {
      const requestedTab =
        new URLSearchParams(
          window.location.search,
        ).get("tab");

      return TABS.some(
        (tab) =>
          tab.id ===
          requestedTab,
      )
        ? requestedTab
        : "profile";
    },
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [
    localMessage,
    setLocalMessage,
  ] = useState("");

  const [
    localSettings,
    setLocalSettings,
  ] = useState(
    () =>
      loadLocalSettings({
        roleLabel,
        workspace,
      }),
  );

  const {
    profile,
    isLoading,
    isSaving,
    error,
    success,
    updateField,
    saveProfile,
  } = useProfileSettings({
    userId: user.id,
    workspaceId:
      workspace.id,
    initialName:
      user.name,
    initialEmail:
      user.email,
  });

  const {
    photoPreviewUrl:
      candidatePhotoPreviewUrl,

    isLoading:
      candidatePhotoLoading,

    error:
      candidatePhotoProfileError,

    refresh:
      refreshCandidateProfile,
  } = useCandidateProfileManagement({
    workspaceId:
      workspace.id,

    initialWorkspace:
      workspace,
  });

  const [
    candidatePhotoSaving,
    setCandidatePhotoSaving,
  ] = useState(false);

  const candidatePhotoMigrationRef =
    useRef(false);


  const {
    subscription:
      smsSubscription,
    isLoading:
      smsIsLoading,
    error:
      smsLoadError,
    setPreference:
      setSmsPreference,
    sendTestMessage:
      sendSmsTestMessage,
  } =
    usePlatformSmsPreferences({
      userId:
        user.id,
    });

  const {
    preferences:
      platformNotificationPreferences,
    isLoading:
      notificationPreferencesLoading,
    isSaving:
      notificationPreferencesSaving,
    error:
      notificationPreferencesError,
    updatePreference:
      updatePlatformNotificationPreference,
  } =
    usePlatformNotificationPreferences({
      userId:
        user.id,
    });

  const [
    smsPhone,
    setSmsPhone,
  ] =
    useState(
      "",
    );

  const [
    smsConsentChecked,
    setSmsConsentChecked,
  ] =
    useState(
      false,
    );

  const [
    smsIsSaving,
    setSmsIsSaving,
  ] =
    useState(
      false,
    );

  const [
    smsFeedback,
    setSmsFeedback,
  ] =
    useState(
      "",
    );

  const [
    smsActionError,
    setSmsActionError,
  ] =
    useState(
      "",
    );

  useEffect(
    () => {
      if (
        smsSubscription
          ?.phone_e164
      ) {
        setSmsPhone(
          smsSubscription
            .phone_e164,
        );
      }

      setSmsConsentChecked(
        smsSubscription
          ?.status ===
          "active",
      );
    },
    [
      smsSubscription,
    ],
  );

  const persistLocal =
    (next) => {
      setLocalSettings(next);

      try {
        window.sessionStorage.setItem(
          LOCAL_SETTINGS_KEY,
          JSON.stringify(next),
        );

        setLocalMessage(
          "Personal preferences saved in this browser session.",
        );
      } catch {
        setLocalMessage(
          "The browser could not save this preference.",
        );
      }
    };

  const updateLocal =
    (field, value) => {
      persistLocal({
        ...localSettings,
        [field]: value,
      });
    };

  const updateNotification =
    async (
      field,
      value,
    ) => {
      setFormError(
        "",
      );

      try {
        await updatePlatformNotificationPreference(
          field,
          value,
        );

        persistLocal({
          ...localSettings,
          notifications: {
            ...localSettings.notifications,
            [field]: value,
          },
        });

        setLocalMessage(
          "Notification preferences saved to your Campaign Seat account.",
        );
      } catch (
        notificationError
      ) {
        setFormError(
          notificationError
            ?.message ||
            "Campaign Seat could not save the notification preference.",
        );
      }
    };

  const enablePlatformSms =
    async () => {
      const normalizedPhone =
        normalizePlatformSmsPhone(
          smsPhone,
        );

      if (
        !normalizedPhone
      ) {
        setSmsActionError(
          "Enter a valid U.S. mobile number, for example (555) 555-5555.",
        );
        setSmsFeedback(
          "",
        );
        return;
      }

      if (
        !smsConsentChecked
      ) {
        setSmsActionError(
          "Check the optional SMS consent box before enabling text notifications.",
        );
        setSmsFeedback(
          "",
        );
        return;
      }

      setSmsIsSaving(true);
      setSmsActionError("");
      setSmsFeedback("");

      try {
        await setSmsPreference({
          phoneE164:
            normalizedPhone,
          consented:
            true,
          source:
            "campaign_seat_settings",
        });

        setSmsPhone(
          normalizedPhone,
        );

        setSmsFeedback(
          "Text notifications are enabled for your Campaign Seat account.",
        );
      } catch (
        preferenceError
      ) {
        setSmsActionError(
          preferenceError
            ?.message ||
            "Campaign Seat could not enable text notifications.",
        );
      } finally {
        setSmsIsSaving(false);
      }
    };


  const disablePlatformSms =
    async () => {
      setSmsIsSaving(true);
      setSmsActionError("");
      setSmsFeedback("");

      try {
        await setSmsPreference({
          phoneE164:
            "",
          consented:
            false,
          source:
            "campaign_seat_settings",
        });

        setSmsConsentChecked(false);

        setSmsFeedback(
          "Text notifications are turned off for your Campaign Seat account.",
        );
      } catch (
        preferenceError
      ) {
        setSmsActionError(
          preferenceError
            ?.message ||
            "Campaign Seat could not turn off text notifications.",
        );
      } finally {
        setSmsIsSaving(false);
      }
    };


  const sendPlatformSmsTest =
    async () => {
      setSmsIsSaving(true);
      setSmsActionError("");
      setSmsFeedback("");

      try {
        await sendSmsTestMessage(
          "Campaign Seat: Your text notifications are connected. Message frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to cancel.",
        );

        setSmsFeedback(
          "Campaign Seat submitted the test text to the messaging provider.",
        );
      } catch (
        testError
      ) {
        setSmsActionError(
          "Campaign Seat could not send the test text yet. If the toll-free sender is still under carrier review, try again after approval.",
        );
      } finally {
        setSmsIsSaving(false);
      }
    };


  useEffect(
    () => {
      if (
        !isCandidateProfile ||
        candidatePhotoMigrationRef.current ||
        candidatePhotoLoading ||
        candidatePhotoPreviewUrl ||
        !localSettings["avatarDataUrl"] ||
        !workspace?.id
      ) {
        return;
      }

      candidatePhotoMigrationRef.current =
        true;

      let cancelled =
        false;

      const migrateExistingPreview =
        async () => {
          setCandidatePhotoSaving(
            true,
          );

          try {
            const file =
              await dataUrlToCandidatePhotoFile(
                localSettings[
                  "avatarDataUrl"
                ],
              );

            const uploaded =
              await uploadCandidatePhoto(
                file,
              );

            await persistWorkspaceCandidatePhoto({
              workspaceId:
                workspace.id,

              storagePath:
                uploaded.storagePath,
            });

            if (!cancelled) {
              await refreshCandidateProfile();

              updateLocal(
                "avatarDataUrl",
                "",
              );

              setLocalMessage(
                "Candidate photo saved securely and synced across Campaign HQ.",
              );
            }
          } catch (
            migrationError
          ) {
            if (!cancelled) {
              setFormError(
                migrationError
                  ?.message ||
                  "The existing candidate photo preview could not be synced.",
              );
            }
          } finally {
            if (!cancelled) {
              setCandidatePhotoSaving(
                false,
              );
            }
          }
        };

      void migrateExistingPreview();

      return () => {
        cancelled =
          true;
      };
    },
    [
      candidatePhotoLoading,
      candidatePhotoPreviewUrl,
      isCandidateProfile,
      localSettings,
      refreshCandidateProfile,
      workspace?.id,
    ],
  );


  const handleAvatar =
    async (event) => {
      const file =
        event.currentTarget
          .files?.[0];

      event.currentTarget.value =
        "";

      if (!file) {
        return;
      }


      if (
        !isCandidateProfile
      ) {
        if (
          !file.type.startsWith(
            "image/",
          )
        ) {
          setFormError(
            "Choose a supported image file.",
          );
          return;
        }

        if (
          file.size >
          1.5 * 1024 * 1024
        ) {
          setFormError(
            "Choose a profile photo smaller than 1.5 MB.",
          );
          return;
        }

        const reader =
          new FileReader();

        reader.onload = () => {
          updateLocal(
            "avatarDataUrl",
            reader.result,
          );

          setFormError("");
        };

        reader.onerror = () => {
          setFormError(
            "The profile photo could not be prepared.",
          );
        };

        reader.readAsDataURL(
          file,
        );

        return;
      }


      setCandidatePhotoSaving(
        true,
      );

      setFormError("");

      try {
        const uploaded =
          await uploadCandidatePhoto(
            file,
          );

        await persistWorkspaceCandidatePhoto({
          workspaceId:
            workspace.id,

          storagePath:
            uploaded.storagePath,
        });

        await refreshCandidateProfile();

        updateLocal(
          "avatarDataUrl",
          "",
        );

        setLocalMessage(
          "Candidate photo saved securely and synced across Campaign HQ.",
        );
      } catch (
        photoError
      ) {
        setFormError(
          photoError
            ?.message ||
            "The candidate photo could not be saved.",
        );
      } finally {
        setCandidatePhotoSaving(
          false,
        );
      }
    };


  const handleSubmit =
    async (event) => {
      event.preventDefault();
      setFormError("");

      try {
        await saveProfile();

        persistLocal(
          localSettings,
        );
      } catch (saveError) {
        setFormError(
          saveError?.message ||
          "The profile could not be saved.",
        );
      }
    };

  const avatarPreviewUrl =
    isCandidateProfile
      ? (
          candidatePhotoPreviewUrl ||
          localSettings[
            "avatarDataUrl"
          ] ||
          ""
        )
      : (
          localSettings[
            "avatarDataUrl"
          ] ||
          ""
        );

  const combinedError =
    formError ||
    candidatePhotoProfileError ||
    error;

  const combinedSuccess =
    success || localMessage;

  const initials =
    getUserInitials(
      profile.fullName ||
      user.name,
    );

  return (
    <CampaignWorkspaceShell
      activeItem=""
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
              Account command center
            </span>

            <h1>
              Profile & Settings
            </h1>

            <p>
              Manage your identity,
              security, communications,
              campaign access and
              workspace preferences.
            </p>
          </div>

          <span
            className={
              styles.secureBadge
            }
          >
            <ShieldCheck
              size={18}
            />
            Protected account
          </span>
        </header>

        <nav
          className={
            styles.tabs
          }
          role="tablist"
          aria-label="Profile and settings sections"
        >
          {TABS.map(
            (tab) => {
              const Icon =
                tab.icon;

              return (
                <button
                  key={tab.id}
                  className={
                    styles.tabButton
                  }
                  data-active={
                    activeTab ===
                    tab.id
                  }
                  type="button"
                  role="tab"
                  aria-selected={
                    activeTab ===
                    tab.id
                  }
                  onClick={() => {
                    setActiveTab(
                      tab.id,
                    );

                    setLocalMessage(
                      "",
                    );
                  }}
                >
                  <Icon
                    size={16}
                  />
                  {tab.label}
                </button>
              );
            },
          )}
        </nav>

        {combinedError ? (
          <section
            className={[
              styles.banner,
              styles.errorBanner,
            ].join(" ")}
            role="alert"
          >
            <AlertTriangle
              size={19}
            />

            <div>
              <strong>
                Settings need attention
              </strong>

              <p>
                {combinedError}
              </p>
            </div>
          </section>
        ) : null}

        {combinedSuccess ? (
          <section
            className={[
              styles.banner,
              styles.successBanner,
            ].join(" ")}
            role="status"
          >
            <BadgeCheck
              size={19}
            />

            <strong>
              {combinedSuccess}
            </strong>
          </section>
        ) : null}

        {activeTab ===
        "profile" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <div
              className={
                styles.profileGrid
              }
            >
              <section
                className={[
                  styles.card,
                  styles.profileCard,
                ].join(" ")}
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
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
                      Profile information
                    </h2>

                    <p>
                      Manage how your
                      identity appears
                      throughout Campaign
                      Seat.
                    </p>
                  </div>
                </header>

                <form
                  className={
                    styles.profileForm
                  }
                  onSubmit={
                    handleSubmit
                  }
                >
                  <div
                    className={
                      styles.avatarColumn
                    }
                  >
                    <div
                      className={
                        styles.avatar
                      }
                      data-candidate-photo-frame="profile"
                    >
                      {avatarPreviewUrl ? (
                        <img
                          src={
                            avatarPreviewUrl
                          }
                          alt=""
                          data-candidate-photo="profile"
                          decoding="async"
                          loading="eager"
                          draggable="false"
                        />
                      ) : (
                        <span>
                          {initials}
                        </span>
                      )}
                    </div>

                    <label
                      className={
                        styles.avatarButton
                      }
                    >
                      <Camera
                        size={16}
                      />
                      {candidatePhotoSaving
                        ? "Saving photo…"
                        : "Change photo"}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handleAvatar
                        }
                      />
                    </label>

                    <small
                      className={
                        styles.avatarHint
                      }
                    >
                      Profile-photo preview
                      stays in this browser
                      session until secure
                      avatar storage is
                      connected.
                    </small>
                  </div>

                  <div
                    className={
                      styles.formGrid
                    }
                  >
                    <label
                      className={
                        styles.field
                      }
                    >
                      <span>
                        Full name
                      </span>

                      <div
                        className={
                          styles.input
                        }
                      >
                        <UserRound
                          size={17}
                        />

                        <input
                          type="text"
                          value={
                            profile.fullName
                          }
                          onChange={(
                            event,
                          ) =>
                            updateField(
                              "fullName",
                              event.target
                                .value,
                            )
                          }
                          maxLength={160}
                          disabled={
                            isLoading ||
                            isSaving
                          }
                          required
                        />
                      </div>
                    </label>

                    <label
                      className={
                        styles.field
                      }
                    >
                      <span>
                        Title
                      </span>

                      <div
                        className={
                          styles.input
                        }
                      >
                        <BadgeCheck
                          size={17}
                        />

                        <input
                          type="text"
                          value={
                            localSettings
                              .title
                          }
                          onChange={(
                            event,
                          ) =>
                            updateLocal(
                              "title",
                              event.target
                                .value,
                            )
                          }
                          placeholder={
                            roleLabel
                          }
                        />
                      </div>
                    </label>

                    <label
                      className={
                        styles.field
                      }
                    >
                      <span>
                        Sign-in email
                      </span>

                      <div
                        className={
                          styles.input
                        }
                      >
                        <Mail
                          size={17}
                        />

                        <input
                          type="email"
                          value={
                            profile.email
                          }
                          disabled
                          readOnly
                        />
                      </div>
                    </label>

                    <label
                      className={
                        styles.field
                      }
                    >
                      <span>
                        Phone
                      </span>

                      <div
                        className={
                          styles.input
                        }
                      >
                        <Phone
                          size={17}
                        />

                        <input
                          type="tel"
                          value={
                            localSettings
                              .phone
                          }
                          onChange={(
                            event,
                          ) =>
                            updateLocal(
                              "phone",
                              event.target
                                .value,
                            )
                          }
                          placeholder="Add phone number"
                        />
                      </div>
                    </label>

                    <label
                      className={
                        styles.field
                      }
                    >
                      <span>
                        Location
                      </span>

                      <div
                        className={
                          styles.input
                        }
                      >
                        <MapPin
                          size={17}
                        />

                        <input
                          type="text"
                          value={
                            localSettings
                              .location
                          }
                          onChange={(
                            event,
                          ) =>
                            updateLocal(
                              "location",
                              event.target
                                .value,
                            )
                          }
                        />
                      </div>
                    </label>

                    <label
                      className={
                        styles.field
                      }
                    >
                      <span>
                        Time zone
                      </span>

                      <div
                        className={
                          styles.input
                        }
                      >
                        <Clock3
                          size={17}
                        />

                        <select
                          value={
                            localSettings
                              .timeZone
                          }
                          onChange={(
                            event,
                          ) =>
                            updateLocal(
                              "timeZone",
                              event.target
                                .value,
                            )
                          }
                        >
                          <option
                            value="America/New_York"
                          >
                            Eastern Time
                          </option>

                          <option
                            value="America/Chicago"
                          >
                            Central Time
                          </option>

                          <option
                            value="America/Denver"
                          >
                            Mountain Time
                          </option>

                          <option
                            value="America/Los_Angeles"
                          >
                            Pacific Time
                          </option>
                        </select>
                      </div>
                    </label>

                    <label
                      className={[
                        styles.field,
                        styles.fullWidth,
                      ].join(" ")}
                    >
                      <span>
                        Bio
                      </span>

                      <textarea
                        value={
                          localSettings
                            .bio
                        }
                        onChange={(
                          event,
                        ) =>
                          updateLocal(
                            "bio",
                            event.target
                              .value,
                          )
                        }
                        maxLength={600}
                        placeholder="Add campaign responsibilities, experience or contact notes."
                      />

                      <small
                        className={
                          styles.helperText
                        }
                      >
                        Additional fields
                        currently save in this
                        browser session. Full
                        name uses the protected
                        campaign-profile save.
                      </small>
                    </label>

                    <div
                      className={[
                        styles.formActions,
                        styles.fullWidth,
                      ].join(" ")}
                    >
                      <button
                        className={
                          styles.primaryButton
                        }
                        type="submit"
                        disabled={
                          isLoading ||
                          isSaving
                        }
                      >
                        <Save
                          size={17}
                        />

                        {isSaving
                          ? "Saving…"
                          : "Save changes"}
                      </button>

                      <button
                        className={
                          styles.secondaryButton
                        }
                        type="button"
                        onClick={() =>
                          navigate(
                            "/dashboard",
                          )
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              </section>

              <aside
                className={
                  styles.sideStack
                }
              >
                <section
                  className={[
                    styles.card,
                    styles.summaryCard,
                  ].join(" ")}
                >
                  <header
                    className={
                      styles.cardHeader
                    }
                  >
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
                        Campaign identity
                      </h2>

                      <p>
                        Current workspace
                        and access role.
                      </p>
                    </div>
                  </header>

                  <div
                    className={
                      styles.identityHero
                    }
                  >
                    <span>
                      {getUserInitials(
                        workspace.name,
                      )}
                    </span>

                    <div>
                      <strong>
                        {workspace.name}
                      </strong>

                      <small>
                        {
                          workspace.description
                        }
                      </small>

                      <em>
                        {roleLabel}
                      </em>
                    </div>
                  </div>

                  <div
                    className={
                      styles.summaryList
                    }
                  >
                    <div
                      className={
                        styles.summaryRow
                      }
                    >
                      <span>
                        Account status
                      </span>

                      <strong>
                        Active
                      </strong>
                    </div>

                    <div
                      className={
                        styles.summaryRow
                      }
                    >
                      <span>
                        Security
                      </span>

                      <strong>
                        MFA protected
                      </strong>
                    </div>

                    <div
                      className={
                        styles.summaryRow
                      }
                    >
                      <span>
                        Workspace
                      </span>

                      <strong>
                        District 6
                      </strong>
                    </div>
                  </div>
                </section>

                <section
                  className={[
                    styles.card,
                    styles.quickActions,
                  ].join(" ")}
                >
                  <header
                    className={
                      styles.cardHeader
                    }
                  >
                    <span
                      className={
                        styles.cardIcon
                      }
                    >
                      <Zap
                        size={20}
                      />
                    </span>

                    <div>
                      <h2>
                        Quick settings
                      </h2>

                      <p>
                        Open related
                        campaign controls.
                      </p>
                    </div>
                  </header>

                  <button
                    className={
                      styles.quickButton
                    }
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "security",
                      )
                    }
                  >
                    <ShieldCheck
                      size={17}
                    />

                    Security & MFA

                    <ChevronRight
                      size={16}
                    />
                  </button>

                  <button
                    className={
                      styles.quickButton
                    }
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        "notifications",
                      )
                    }
                  >
                    <BellRing
                      size={17}
                    />

                    Notifications

                    <ChevronRight
                      size={16}
                    />
                  </button>

                  <button
                    className={
                      styles.quickButton
                    }
                    type="button"
                    onClick={() =>
                      navigate(
                        "/workspace/campaign-settings",
                      )
                    }
                  >
                    <Settings2
                      size={17}
                    />

                    Campaign settings

                    <ChevronRight
                      size={16}
                    />
                  </button>

                  <button
                    className={
                      styles.quickButton
                    }
                    type="button"
                    onClick={() =>
                      navigate(
                        "/team/access",
                      )
                    }
                  >
                    <UsersRound
                      size={17}
                    />

                    Team permissions

                    <ChevronRight
                      size={16}
                    />
                  </button>
                </section>
              </aside>
            </div>

            <div
              className={
                styles.settingsGrid
              }
            >
              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <ShieldCheck
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Security & access
                    </h2>

                    <p>
                      Account protection
                      and workspace access.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.settingsRows
                  }
                >
                  <SettingsRow
                    icon={
                      KeyRound
                    }
                    label="Two-step verification"
                    description="Manage verified sign-in methods."
                    status="Enabled"
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            "security",
                          )
                        }
                      >
                        Review
                      </button>
                    }
                  />

                  <SettingsRow
                    icon={
                      UsersRound
                    }
                    label="Team access"
                    description="Review roles and campaign permissions."
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            "/team/access",
                          )
                        }
                      >
                        Open
                      </button>
                    }
                  />

                  <SettingsRow
                    icon={
                      Eye
                    }
                    label="Login activity"
                    description="Session history will appear after production session tracking is activated."
                    status="Planned"
                  />
                </div>
              </section>

              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <Mail
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Email preferences
                    </h2>

                    <p>
                      Choose the campaign
                      updates you receive.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.toggleList
                  }
                >
                  <PreferenceToggle
                    checked={
                      platformNotificationPreferences
                        .campaignUpdates
                    }
                    disabled={
                      notificationPreferencesLoading ||
                      notificationPreferencesSaving
                    }
                    label="Campaign updates"
                    description="Important campaign announcements and changes."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "campaignUpdates",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      platformNotificationPreferences
                        .taskReminders
                    }
                    label="Task & reminder emails"
                    description="Assignments, due dates and waiting-on reminders."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "taskReminders",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      platformNotificationPreferences
                        .weeklySummary
                    }
                    label="Weekly summary"
                    description="Campaign activity and performance recap."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "weeklySummary",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      localSettings
                        .notifications
                        .marketing
                    }
                    label="Product updates"
                    description="Campaign Seat product tips and release information."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "marketing",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeTab ===
        "account" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <div
              className={
                styles.settingsGrid
              }
            >
              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <BadgeCheck
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Account details
                    </h2>

                    <p>
                      Sign-in identity and
                      campaign membership.
                    </p>
                  </div>
                </header>

                <dl
                  className={
                    styles.detailList
                  }
                >
                  <div>
                    <dt>
                      Full name
                    </dt>

                    <dd>
                      {profile.fullName ||
                        user.name}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Sign-in email
                    </dt>

                    <dd>
                      {profile.email ||
                        user.email}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Campaign role
                    </dt>

                    <dd>
                      {roleLabel}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Workspace
                    </dt>

                    <dd>
                      {workspace.name}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Account status
                    </dt>

                    <dd>
                      Active and protected
                    </dd>
                  </div>
                </dl>
              </section>

              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <LockKeyhole
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Account actions
                    </h2>

                    <p>
                      Security-sensitive
                      account controls.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.settingsRows
                  }
                >
                  <SettingsRow
                    icon={
                      KeyRound
                    }
                    label="Password recovery"
                    description="Start the protected password-reset process."
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            "/forgot-password",
                          )
                        }
                      >
                        Begin
                      </button>
                    }
                  />

                  <SettingsRow
                    icon={
                      ShieldCheck
                    }
                    label="Authenticator security"
                    description="Review primary and backup authenticators."
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            "security",
                          )
                        }
                      >
                        Manage
                      </button>
                    }
                  />

                  <SettingsRow
                    icon={
                      UserRound
                    }
                    label="Manage candidate"
                    description="Manage the candidate photo, bio, race, public contact information and campaign identity."
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            "/workspace/candidate-profile",
                          )
                        }
                      >
                        Open
                      </button>
                    }
                  />

                  <SettingsRow
                    icon={
                      Settings2
                    }
                    label="Campaign identity"
                    description="Edit the workspace name, office and campaign details."
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            "/workspace/campaign-settings",
                          )
                        }
                      >
                        Open
                      </button>
                    }
                  />
                </div>
              </section>
            </div>

            <section
              className={[
                styles.card,
                styles.dangerCard,
              ].join(" ")}
            >
              <header
                className={
                  styles.cardHeader
                }
              >
                <span
                  className={
                    styles.cardIcon
                  }
                >
                  <AlertTriangle
                    size={20}
                  />
                </span>

                <div>
                  <h2>
                    Protected account actions
                  </h2>

                  <p>
                    Irreversible controls
                    remain disabled until
                    production account
                    recovery and audit
                    protections are
                    finalized.
                  </p>
                </div>
              </header>

              <div
                className={
                  styles.dangerRow
                }
              >
                <div>
                  <strong>
                    Export my account data
                  </strong>

                  <small>
                    Secure export is not
                    connected yet.
                  </small>
                </div>

                <button
                  type="button"
                  disabled
                >
                  <Download
                    size={16}
                  />
                  Export
                </button>
              </div>

              <div
                className={
                  styles.dangerRow
                }
              >
                <div>
                  <strong>
                    Delete my account
                  </strong>

                  <small>
                    Account deletion is
                    intentionally disabled
                    during the initial
                    three-user rollout.
                  </small>
                </div>

                <button
                  type="button"
                  disabled
                >
                  <Trash2
                    size={16}
                  />
                  Delete
                </button>
              </div>
            </section>
          </section>
        ) : null}

        {notificationPreferencesError &&
        activeTab ===
          "notifications" ? (
          <div
            className={[
              styles.banner,
              styles.errorBanner,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <AlertTriangle
              size={18}
            />

            <p>
              {
                notificationPreferencesError
              }
            </p>
          </div>
        ) : null}

        {activeTab ===
        "notifications" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <div
              className={
                styles.settingsGrid
              }
            >
              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <BellRing
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Notification channels
                    </h2>

                    <p>
                      Control the updates
                      that require your
                      attention.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.toggleList
                  }
                >
                  <PreferenceToggle
                    checked={
                      localSettings
                        .notifications
                        .campaignUpdates
                    }
                    label="Campaign updates"
                    description="Important workspace and campaign changes."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "campaignUpdates",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      localSettings
                        .notifications
                        .taskReminders
                    }
                    disabled={
                      notificationPreferencesLoading ||
                      notificationPreferencesSaving
                    }
                    label="Tasks and reminders"
                    description="Due dates, assignments and waiting-on activity."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "taskReminders",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      platformNotificationPreferences
                        .approvals
                    }
                    disabled={
                      notificationPreferencesLoading ||
                      notificationPreferencesSaving
                    }
                    label="Approval requests"
                    description="Items requiring review or campaign authorization."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "approvals",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      platformNotificationPreferences
                        .fieldAlerts
                    }
                    disabled={
                      notificationPreferencesLoading ||
                      notificationPreferencesSaving
                    }
                    label="Field-operation alerts"
                    description="Route issues, volunteer reports and urgent field updates."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "fieldAlerts",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      localSettings
                        .notifications
                        .weeklySummary
                    }
                    disabled={
                      notificationPreferencesLoading ||
                      notificationPreferencesSaving
                    }
                    label="Weekly campaign summary"
                    description="A campaign-wide recap of activity and outstanding work."
                    onChange={(
                      value,
                    ) =>
                      updateNotification(
                        "weeklySummary",
                        value,
                      )
                    }
                  />
                </div>
              </section>

              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <Smartphone
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Delivery readiness
                    </h2>

                    <p>
                      Prepare this device
                      for campaign
                      notifications.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.channelGrid
                  }
                >
                  <article>
                    <Mail
                      size={21}
                    />

                    <strong>
                      Email
                    </strong>

                    <small>
                      {
                        profile.email ||
                        user.email
                      }
                    </small>

                    <span>
                      Primary channel
                    </span>
                  </article>

                  <article>
                    <BellRing
                      size={21}
                    />

                    <strong>
                      Browser alerts
                    </strong>

                    <small>
                      Device permission is
                      managed below.
                    </small>

                    <span>
                      Device-specific
                    </span>
                  </article>

                  <article>
                    <MessageSquare
                      size={21}
                    />

                    <strong>
                      SMS
                    </strong>

                    <small>
                      {smsIsLoading
                        ? "Checking text notification status..."
                        : smsSubscription
                              ?.status ===
                            "active"
                          ? smsSubscription
                              .phone_e164
                          : "Optional Campaign Seat text notifications are off."}
                    </small>

                    <span>
                      {smsSubscription
                        ?.status ===
                      "active"
                        ? "Connected"
                        : "Optional"}
                    </span>
                  </article>
                </div>
              </section>

              <section
                className={[
                  styles.settingsCard,
                  styles.smsSettingsCard,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <MessageSquare
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Text notifications
                    </h2>

                    <p>
                      Optional Campaign Seat account notifications,
                      onboarding updates and customer-support texts.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.smsSettingsBody
                  }
                >
                  <div
                    className={
                      styles.smsStatusStrip
                    }
                  >
                    <div>
                      <strong>
                        {smsIsLoading
                          ? "Checking SMS status"
                          : smsSubscription
                                ?.status ===
                              "active"
                            ? "Text notifications enabled"
                            : smsSubscription
                                  ?.status ===
                                "opted_out"
                              ? "Text notifications turned off"
                              : "Text notifications not enabled"}
                      </strong>

                      <small>
                        {smsSubscription
                          ?.status ===
                        "active"
                          ? `Campaign Seat may text ${smsSubscription.phone_e164} for the platform messages you opted into.`
                          : "SMS is optional and is not required to use Campaign Seat."}
                      </small>
                    </div>

                    <span
                      className={[
                        styles.smsStatusBadge,
                        smsSubscription
                              ?.status ===
                            "active"
                          ? styles.smsStatusBadgeActive
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {smsSubscription
                        ?.status ===
                      "active"
                        ? "Active"
                        : "Off"}
                    </span>
                  </div>

                  {smsSubscription
                    ?.status ===
                  "active" ? (
                    <>
                      <div
                        className={
                          styles.smsMeta
                        }
                      >
                        <span>
                          <strong>
                            Mobile number
                          </strong>
                          <small>
                            {
                              smsSubscription
                                .phone_e164
                            }
                          </small>
                        </span>

                        <span>
                          <strong>
                            Consent recorded
                          </strong>
                          <small>
                            {smsSubscription
                              .consented_at
                              ? new Date(
                                  smsSubscription
                                    .consented_at,
                                )
                                  .toLocaleString()
                              : "Recorded"}
                          </small>
                        </span>
                      </div>

                      <div
                        className={
                          styles.smsActions
                        }
                      >
                        <button
                          className={
                            styles.smsPrimaryButton
                          }
                          type="button"
                          disabled={
                            smsIsSaving ||
                            smsIsLoading
                          }
                          onClick={
                            sendPlatformSmsTest
                          }
                        >
                          <MessageSquare
                            size={16}
                          />
                          {smsIsSaving
                            ? "Working..."
                            : "Send test text"}
                        </button>

                        <button
                          className={
                            styles.smsSecondaryButton
                          }
                          type="button"
                          disabled={
                            smsIsSaving ||
                            smsIsLoading
                          }
                          onClick={
                            disablePlatformSms
                          }
                        >
                          Turn off SMS
                        </button>
                      </div>

                      <p
                        className={
                          styles.smsChangeNumberNote
                        }
                      >
                        To use a different mobile number, turn off SMS and
                        enroll the new number with fresh consent.
                      </p>
                    </>
                  ) : (
                    <>
                      <label
                        className={
                          styles.field
                        }
                      >
                        <span>
                          Mobile phone number
                        </span>

                        <div
                          className={
                            styles.input
                          }
                        >
                          <Phone
                            size={17}
                          />

                          <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="(555) 555-5555"
                            value={
                              smsPhone
                            }
                            disabled={
                              smsIsSaving ||
                              smsIsLoading
                            }
                            onChange={(
                              event,
                            ) => {
                              setSmsPhone(
                                event
                                  .currentTarget
                                  .value,
                              );
                              setSmsActionError("");
                              setSmsFeedback("");
                            }}
                          />
                        </div>

                        <small
                          className={
                            styles.helperText
                          }
                        >
                          U.S. numbers are normalized to +1 format when saved.
                        </small>
                      </label>

                      <label
                        className={
                          styles.smsConsent
                        }
                      >
                        <input
                          type="checkbox"
                          checked={
                            smsConsentChecked
                          }
                          disabled={
                            smsIsSaving ||
                            smsIsLoading
                          }
                          onChange={(
                            event,
                          ) => {
                            setSmsConsentChecked(
                              event
                                .currentTarget
                                .checked,
                            );
                            setSmsActionError("");
                            setSmsFeedback("");
                          }}
                        />

                        <span>
                          I agree to receive recurring SMS text messages from Campaign Seat,
                          operated by CC Innovation Group LLC, at the mobile number provided
                          for account notifications, onboarding communications and customer
                          support. Message frequency varies. Message and data rates may apply.
                          Reply HELP for help or STOP to cancel. Consent is optional and is not
                          a condition of creating or using a Campaign Seat account.
                        </span>
                      </label>

                      <p
                        className={
                          styles.smsLegalLinks
                        }
                      >
                        <a
                          href="/terms/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Terms and Conditions
                        </a>

                        <span>·</span>

                        <a
                          href="/privacy/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Privacy Policy
                        </a>
                      </p>

                      <div
                        className={
                          styles.smsActions
                        }
                      >
                        <button
                          className={
                            styles.smsPrimaryButton
                          }
                          type="button"
                          disabled={
                            smsIsSaving ||
                            smsIsLoading ||
                            !smsPhone.trim() ||
                            !smsConsentChecked
                          }
                          onClick={
                            enablePlatformSms
                          }
                        >
                          <Check
                            size={16}
                          />
                          {smsIsSaving
                            ? "Saving..."
                            : "Enable text notifications"}
                        </button>
                      </div>
                    </>
                  )}

                  {smsLoadError ? (
                    <p
                      className={
                        styles.smsError
                      }
                    >
                      {smsLoadError}
                    </p>
                  ) : null}

                  {smsActionError ? (
                    <p
                      className={
                        styles.smsError
                      }
                    >
                      {smsActionError}
                    </p>
                  ) : null}

                  {smsFeedback ? (
                    <p
                      className={
                        styles.smsSuccess
                      }
                    >
                      {smsFeedback}
                    </p>
                  ) : null}

                  <div
                    className={
                      styles.smsComplianceNote
                    }
                  >
                    <ShieldCheck
                      size={17}
                    />

                    <span>
                      Campaign Seat platform SMS is separate from campaign
                      voter/contact outreach. This setting controls only your
                      own Campaign Seat account notifications.
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <CampaignMobileSetup
              userId={user.id}
              roleLabel={roleLabel}
            />
          </section>
        ) : null}

        {activeTab ===
        "security" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <section
              className={
                styles.securitySummary
              }
            >
              <article>
                <ShieldCheck
                  size={22}
                />

                <div>
                  <strong>
                    Protected leadership
                    account
                  </strong>

                  <small>
                    Two-step verification
                    is required for sensitive
                    campaign controls.
                  </small>
                </div>
              </article>

              <article>
                <KeyRound
                  size={22}
                />

                <div>
                  <strong>
                    Backup verification
                    method
                  </strong>

                  <small>
                    Add a second trusted
                    verification method for
                    recovery protection.
                  </small>
                </div>
              </article>

              <article>
                <Database
                  size={22}
                />

                <div>
                  <strong>
                    Audit controls
                  </strong>

                  <small>
                    Production activity
                    history will record
                    sensitive account
                    changes.
                  </small>
                </div>
              </article>
            </section>

            {leadershipAccess ? (
              <SecurityOnboardingGate />
            ) : (
              <section
                className={
                  styles.disclosure
                }
              >
                <ShieldCheck
                  size={20}
                />

                Two-step verification
                management is restricted to
                protected leadership accounts.
              </section>
            )}
          </section>
        ) : null}

        {activeTab ===
        "integrations" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <EmailContactsOnboarding
                workspaceId={
                  workspace.id
                }
              />

              <div
              className={
                styles.integrationGrid
              }
            >
              <article
                className={
                  styles.integrationCard
                }
              >
                <span
                  className={
                    styles.integrationIcon
                  }
                >
                  <Mail
                    size={23}
                  />
                </span>

                <div
                  className={
                    styles.integrationContent
                  }
                >
                  <strong>
                    Campaign email & inbox
                  </strong>

                  <p>
                    Review campaign
                    conversations, email
                    workflows and message
                    assignments.
                  </p>

                  <span>
                    Campaign workspace
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/inbox",
                    )
                  }
                >
                  Open Inbox
                </button>
              </article>

              <article
                className={
                  styles.integrationCard
                }
              >
                <span
                  className={
                    styles.integrationIcon
                  }
                >
                  <CalendarDays
                    size={23}
                  />
                </span>

                <div
                  className={
                    styles.integrationContent
                  }
                >
                  <strong>
                    Campaign calendar
                  </strong>

                  <p>
                    Coordinate events,
                    meetings, field shifts
                    and campaign deadlines.
                  </p>

                  <span>
                    Shared calendar
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/calendar",
                    )
                  }
                >
                  Open Calendar
                </button>
              </article>

              <article
                className={
                  styles.integrationCard
                }
              >
                <span
                  className={
                    styles.integrationIcon
                  }
                >
                  <FileText
                    size={23}
                  />
                </span>

                <div
                  className={
                    styles.integrationContent
                  }
                >
                  <strong>
                    Campaign documents
                  </strong>

                  <p>
                    Access approved files,
                    campaign materials and
                    shared documentation.
                  </p>

                  <span>
                    Shared workspace
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/documents",
                    )
                  }
                >
                  Open Documents
                </button>
              </article>

              <article
                className={
                  styles.integrationCard
                }
              >
                <span
                  className={
                    styles.integrationIcon
                  }
                >
                  <MessageSquare
                    size={23}
                  />
                </span>

                <div
                  className={
                    styles.integrationContent
                  }
                >
                  <strong>
                    Social media
                  </strong>

                  <p>
                    Prepare and coordinate
                    campaign social
                    content and approvals.
                  </p>

                  <span>
                    Campaign tool
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/social-media",
                    )
                  }
                >
                  Open Social Media
                </button>
              </article>

              <article
                className={
                  styles.integrationCard
                }
              >
                <span
                  className={
                    styles.integrationIcon
                  }
                >
                  <UsersRound
                    size={23}
                  />
                </span>

                <div
                  className={
                    styles.integrationContent
                  }
                >
                  <strong>
                    Team permissions
                  </strong>

                  <p>
                    Manage initial user
                    access, roles and
                    campaign permissions.
                  </p>

                  <span>
                    Protected control
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/team/access",
                    )
                  }
                >
                  Manage Access
                </button>
              </article>

              <article
                className={
                  styles.integrationCard
                }
              >
                <span
                  className={
                    styles.integrationIcon
                  }
                >
                  <Link2
                    size={23}
                  />
                </span>

                <div
                  className={
                    styles.integrationContent
                  }
                >
                  <strong>
                    External connections
                  </strong>

                  <p>
                    Manage Google,
                    Microsoft, campaign
                    email and provider
                    contact connections in
                    Email & Contacts above.
                  </p>

                  <span>
                    Managed securely
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.scrollTo({
                      top: 0,
                      behavior: "smooth",
                    });
                  }}
                >
                  Review connections
                </button>
              </article>
            </div>
          </section>
        ) : null}

        {activeTab ===
        "preferences" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <div
              className={
                styles.settingsGrid
              }
            >
              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <Palette
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Appearance
                    </h2>

                    <p>
                      Choose your preferred
                      Campaign Seat
                      experience.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.themeGrid
                  }
                >
                  {[
                    {
                      id: "light",
                      label: "Light",
                      icon: Sun,
                    },
                    {
                      id: "dark",
                      label: "Dark",
                      icon: Moon,
                    },
                    {
                      id: "system",
                      label: "System",
                      icon: Monitor,
                    },
                  ].map(
                    (option) => {
                      const Icon =
                        option.icon;

                      return (
                        <button
                          key={
                            option.id
                          }
                          className={[
                            styles.themeOption,
                            localSettings
                              .theme ===
                            option.id
                              ? styles.themeActive
                              : "",
                          ]
                            .filter(
                              Boolean,
                            )
                            .join(" ")}
                          type="button"
                          onClick={() =>
                            updateLocal(
                              "theme",
                              option.id,
                            )
                          }
                        >
                          <Icon
                            size={23}
                          />

                          <span>
                            {
                              option.label
                            }
                          </span>

                          {localSettings
                            .theme ===
                          option.id ? (
                            <Check
                              size={16}
                            />
                          ) : null}
                        </button>
                      );
                    },
                  )}
                </div>

                <p
                  className={
                    styles.disclosureText
                  }
                >
                  Appearance choices are
                  being saved as a
                  preference preview.
                  Global theme application
                  will be activated after
                  accessibility testing.
                </p>
              </section>

              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <Accessibility
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Accessibility
                    </h2>

                    <p>
                      Adjust content
                      density and motion
                      preferences.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.toggleList
                  }
                >
                  <PreferenceToggle
                    checked={
                      localSettings
                        .compactMode
                    }
                    label="Compact mode"
                    description="Show more campaign information in less space."
                    onChange={(
                      value,
                    ) =>
                      updateLocal(
                        "compactMode",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      localSettings
                        .reducedMotion
                    }
                    label="Reduce motion"
                    description="Minimize nonessential interface animation."
                    onChange={(
                      value,
                    ) =>
                      updateLocal(
                        "reducedMotion",
                        value,
                      )
                    }
                  />

                  <PreferenceToggle
                    checked={
                      localSettings
                        .largeText
                    }
                    label="Larger interface text"
                    description="Increase text size for improved readability."
                    onChange={(
                      value,
                    ) =>
                      updateLocal(
                        "largeText",
                        value,
                      )
                    }
                  />
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeTab ===
        "billing" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <div
              className={
                styles.billingGrid
              }
            >
              <section
                className={[
                  styles.card,
                  styles.planCard,
                ].join(" ")}
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <CircleDollarSign
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Workspace plan
                    </h2>

                    <p>
                      Initial private
                      campaign rollout.
                    </p>
                  </div>

                  <span
                    className={
                      styles.planBadge
                    }
                  >
                    Production preview
                  </span>
                </header>

                <div
                  className={
                    styles.planBody
                  }
                >
                  <h3>
                    Campaign Seat
                    private workspace
                  </h3>

                  <p>
                    The initial rollout is
                    being prepared for
                    Chris, Elizabeth and
                    Patrick. Billing and
                    invoice processing are
                    not connected yet.
                  </p>

                  <div
                    className={
                      styles.planList
                    }
                  >
                    <span>
                      <Check
                        size={16}
                      />
                      Private campaign
 <Check
                        size={16}
                      />
                      Private campaign
                      workspace
                    </span>

                    <span>
                      <Check
                        size={16}
                      />
                      Protected leadership
                      access
                    </span>

                    <span>
                      <Check
                        size={16}
                      />
                      Shared campaign
                      operations
                    </span>

                    <span>
                      <Check
                        size={16}
                      />
                      Production-readiness
                      review
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled
                  >
                    <CreditCard
                      size={17}
                    />
                    Billing setup pending
                  </button>
                </div>
              </section>

              <section
                className={
                  styles.settingsCard
                }
              >
                <header
                  className={
                    styles.cardHeader
                  }
                >
                  <span
                    className={
                      styles.cardIcon
                    }
                  >
                    <FileText
                      size={20}
                    />
                  </span>

                  <div>
                    <h2>
                      Billing records
                    </h2>

                    <p>
                      Invoices and payment
                      history.
                    </p>
                  </div>
                </header>

                <div
                  className={
                    styles.emptyState
                  }
                >
                  <CreditCard
                    size={32}
                  />

                  <strong>
                    No billing account is
                    connected
                  </strong>

                  <p>
                    Billing will remain
                    inaccessible until an
                    authorized
                    administrator
                    completes production
                    setup.
                  </p>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {activeTab ===
        "team" ? (
          <section
            className={
              styles.tabPanel
            }
          >
            <section
              className={[
                styles.card,
                styles.teamOverview,
              ].join(" ")}
            >
              <header
                className={
                  styles.cardHeader
                }
              >
                <span
                  className={
                    styles.cardIcon
                  }
                >
                  <UsersRound
                    size={20}
                  />
                </span>

                <div>
                  <h2>
                    Initial campaign access
                  </h2>

                  <p>
                    Prepare the private
                    workspace for the first
                    three campaign users.
                  </p>
                </div>

                <button
                  className={
                    styles.primaryButton
                  }
                  type="button"
                  onClick={() =>
                    navigate(
                      "/team/access",
                    )
                  }
                  disabled={
                    !leadershipAccess
                  }
                >
                  Manage Team Access
                </button>
              </header>

              <div
                className={
                  styles.teamGrid
                }
              >
                <article
                  className={
                    styles.teamCard
                  }
                >
                  <span
                    className={
                      styles.teamAvatar
                    }
                  >
                    CI
                  </span>

                  <div>
                    <strong>
                      Chris
                    </strong>

                    <small>
                      Campaign manager
                    </small>

                    <em>
                      Initial access
                    </em>
                  </div>
                </article>

                <article
                  className={
                    styles.teamCard
                  }
                >
                  <span
                    className={
                      styles.teamAvatar
                    }
                  >
                    EA
                  </span>

                  <div>
                    <strong>
                      Elizabeth
                    </strong>

                    <small>
                      Candidate
                    </small>

                    <em>
                      Initial access
                    </em>
                  </div>
                </article>

                <article
                  className={
                    styles.teamCard
                  }
                >
                  <span
                    className={
                      styles.teamAvatar
                    }
                  >
                    P
                  </span>

                  <div>
                    <strong>
                      Patrick
                    </strong>

                    <small>
                      Role to confirm in
                      Team Access
                    </small>

                    <em>
                      Planned access
                    </em>
                  </div>
                </article>
              </div>
            </section>

            <div
              className={
                styles.permissionGrid
              }
            >
              <article
                className={
                  styles.permissionCard
                }
              >
                <ShieldCheck
                  size={22}
                />

                <strong>
                  Your current role
                </strong>

                <span>
                  {roleLabel}
                </span>

                <p>
                  Your access is calculated
                  from the selected
                  campaign membership.
                </p>
              </article>

              <article
                className={
                  styles.permissionCard
                }
              >
                <UsersRound
                  size={22}
                />

                <strong>
                  Invite members
                </strong>

                <span>
                  {canManageTeam
                    ? "Authorized"
                    : "Restricted"}
                </span>

                <p>
                  Team invitations require
                  the workspace invitation
                  permission.
                </p>
              </article>

              <article
                className={
                  styles.permissionCard
                }
              >
                <LockKeyhole
                  size={22}
                />

                <strong>
                  Sensitive controls
                </strong>

                <span>
                  MFA required
                </span>

                <p>
                  Protected changes require
                  a verified leadership
                  session.
                </p>
              </article>
            </div>

            <section
              className={
                styles.disclosure
              }
            >
              <ShieldCheck
                size={20}
              />

              Planned-user cards describe
              the requested initial
              rollout. Actual accounts,
              invitations and permissions
              must be confirmed in Team
              Access before production use.
            </section>
          </section>
        ) : null}
      </main>
    </CampaignWorkspaceShell>
  );
}
