import { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Mail,
  Menu,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  Vote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { CampaignSidebar } from "../../components/CampaignSidebar/CampaignSidebar";
import { ActivityCenter } from "../../components/ActivityCenter/ActivityCenter";
import { CampaignSearch } from "../../components/CampaignSearch/CampaignSearch";
import { CampaignDateTime } from "../../components/CampaignDateTime/CampaignDateTime";
import { CampaignMobileSetup } from "../../components/CampaignMobileSetup/CampaignMobileSetup";
import {
  getCurrentUser,
  getCurrentWorkspace,
  getRoleLabel,
  getUserInitials,
} from "../../utils/campaignSession";
import { useProfileSettings } from "../../hooks/useProfileSettings";
import MfaSecurityPanel from "../../components/security/MfaSecurityPanel/MfaSecurityPanel";

import sidebarStyles from "../Team/Team.module.css";
import styles from "./ProfileSettings.module.css";

export default function ProfileSettings() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const workspace = getCurrentWorkspace();
  const roleLabel = getRoleLabel();
  const leadershipAccess =
    /candidate|consultant|manager|owner|administrator/i.test(roleLabel);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formError, setFormError] = useState("");

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
    workspaceId: workspace.id,
    initialName: user.name,
    initialEmail: user.email,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      await saveProfile();
    } catch (saveError) {
      setFormError(
        saveError?.message || "The profile could not be saved.",
      );
    }
  };

  return (
    <div className={styles.app}>
      <CampaignSidebar
        activePage=""
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        styles={sidebarStyles}
        accessDescription="Review your campaign identity and personal account details."
        showLeadership={leadershipAccess}
      />

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuButton}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <span className={styles.breadcrumb}>
                Campaign HQ
                <ChevronRight size={13} />
                Profile settings
              </span>
              <strong>Account settings</strong>
            </div>
          </div>

          <div className={styles.topbarActions}>
            <CampaignDateTime />
            <CampaignSearch />
            <ActivityCenter />
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.pageHeader}>
            <div>
              <span className={styles.eyebrow}>Account and devices</span>
              <h1>Profile settings</h1>
              <p>
                Manage your personal profile, review the campaign identity and
                prepare this device for Campaign HQ phone notifications.
              </p>
            </div>

            <div className={styles.securityBadge}>
              <ShieldCheck size={18} />
              <span>Protected account</span>
            </div>
          </section>

          {(error || formError) && (
            <section className={styles.errorBanner} role="alert">
              <ShieldCheck size={20} />
              <div>
                <strong>Profile settings need attention</strong>
                <p>{formError || error}</p>
              </div>
            </section>
          )}

          {success && (
            <section className={styles.successBanner} role="status">
              <BadgeCheck size={20} />
              <strong>{success}</strong>
            </section>
          )}

          <div className={styles.contentGrid}>
            <section className={styles.settingsCard}>
              <header className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <UserRound size={20} />
                </div>
                <div>
                  <span>Personal account</span>
                  <h2>Your profile</h2>
                </div>
              </header>

              <form className={styles.profileForm} onSubmit={handleSubmit}>
                <div className={styles.profileHero}>
                  <div className={styles.largeAvatar}>
                    {getUserInitials(profile.fullName || user.name)}
                  </div>
                  <div>
                    <strong>{profile.fullName || user.name}</strong>
                    <span>{roleLabel}</span>
                  </div>
                </div>

                <label>
                  <span>Full name</span>
                  <div className={styles.inputWrap}>
                    <UserRound size={18} />
                    <input
                      type="text"
                      value={profile.fullName}
                      onChange={(event) =>
                        updateField("fullName", event.target.value)
                      }
                      maxLength={160}
                      disabled={isLoading || isSaving}
                      required
                    />
                  </div>
                </label>

                <label>
                  <span>Sign-in email</span>
                  <div className={styles.inputWrap}>
                    <Mail size={18} />
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      readOnly
                    />
                  </div>
                  <small>
                    Sign-in email changes require an account security update
                    and are not changed from this page.
                  </small>
                </label>

                <button
                  className={styles.saveButton}
                  type="submit"
                  disabled={isLoading || isSaving}
                >
                  <Save size={18} />
                  {isSaving ? "Saving profile…" : "Save profile"}
                </button>
              </form>
            </section>

            <section className={styles.identityCard}>
              <header className={styles.cardHeader}>
                <div className={styles.cardIcon}>
                  <Vote size={20} />
                </div>
                <div>
                  <span>Sidebar identity</span>
                  <h2>Campaign profile</h2>
                </div>
              </header>

              <div
                className={styles.identityPreview}
                data-party={
                  workspace.politicalParty ||
                  workspace.political_party ||
                  "republican"
                }
              >
                <div className={styles.candidateAvatar}>
                  {getUserInitials(workspace.name)}
                </div>
                <div className={styles.identityCopy}>
                  <strong>{workspace.name}</strong>
                  <span>{workspace.description}</span>
                  <small>{roleLabel}</small>
                </div>
              </div>

              <div className={styles.identityDetails}>
                <div>
                  <span>Candidate</span>
                  <strong>{workspace.name}</strong>
                </div>
                <div>
                  <span>Office</span>
                  <strong>{workspace.description}</strong>
                </div>
                <div>
                  <span>Access role</span>
                  <strong>{roleLabel}</strong>
                </div>
              </div>

              <div className={styles.identityNotice}>
                <Settings size={18} />
                <p>
                  Candidate name and office come from Workspace Settings.
                  Access role comes from Team Access.
                </p>
              </div>

              {leadershipAccess && (
                <div className={styles.identityActions}>
                  <button
                    type="button"
                    onClick={() => navigate("/workspace/settings")}
                  >
                    <Settings size={17} />
                    Edit campaign details
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/team/access")}
                  >
                    <UsersRound size={17} />
                    Manage access role
                  </button>
                </div>
              )}
            </section>
          </div>

          {leadershipAccess && (
            <MfaSecurityPanel />
          )}

          <CampaignMobileSetup
            userId={user.id}
            roleLabel={roleLabel}
          />
        </main>
      </div>
    </div>
  );
}
