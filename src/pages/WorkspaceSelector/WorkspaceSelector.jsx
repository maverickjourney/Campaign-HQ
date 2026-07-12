import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  LockKeyhole,
  LogOut,
  Search,
  ShieldCheck,
  UsersRound,
  Vote,
} from "lucide-react";

import {
  CAMPAIGN_WORKSPACE,
  clearCampaignSession,
  getAccessMode,
  getCurrentUser,
  getRoleLabel,
  getUserInitials,
  saveWorkspace,
} from "../../utils/campaignSession";
import styles from "./WorkspaceSelector.module.css";

export default function WorkspaceSelector() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const user = getCurrentUser();
  const accessMode = getAccessMode();
  const roleLabel = getRoleLabel(accessMode);
  const isAdmin = accessMode === "admin";

  const workspaceMatchesSearch = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    return [
      CAMPAIGN_WORKSPACE.name,
      CAMPAIGN_WORKSPACE.description,
      CAMPAIGN_WORKSPACE.location,
      user.name,
      roleLabel,
    ].some((value) => {
      return value.toLowerCase().includes(normalizedSearch);
    });
  }, [searchTerm, user.name, roleLabel]);

  const handleSelectWorkspace = () => {
    saveWorkspace();
    navigate("/dashboard");
  };

  const handleLogout = () => {
    clearCampaignSession();
    navigate("/");
  };

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden="true" />
      <div className={styles.backgroundGrid} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.brandMark} aria-hidden="true">
              <span>HQ</span>
            </div>

            <div className={styles.brandCopy}>
              <strong>Campaign HQ</strong>
              <span>Campaign Operations Center</span>
            </div>
          </div>

          <div className={styles.profile}>
            <div className={styles.avatar} aria-hidden="true">
              {getUserInitials(user.name)}
            </div>

            <div className={styles.profileCopy}>
              <strong>{user.name}</strong>
              <span>{roleLabel}</span>
            </div>

            <button
              className={styles.logoutButton}
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={19} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.primaryContent}>
          <div className={styles.intro}>
            <div>
              <p className={styles.eyebrow}>
                {isAdmin
                  ? "Administrative campaign access"
                  : "Your campaign workspace"}
              </p>

              <h1>Select a workspace</h1>

              <p className={styles.description}>
                Welcome, {user.name}. Choose the campaign you want to
                enter. Your {isAdmin ? "administrator" : "client"} access
                will be applied automatically.
              </p>
            </div>

            <div className={styles.workspaceCount}>
              <span>1</span>

              <div>
                <strong>Active workspace</strong>
                <small>Ready to open</small>
              </div>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={19} strokeWidth={1.8} />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search your workspaces"
                aria-label="Search campaign workspaces"
              />
            </div>

            <div className={styles.accessBadge}>
              <ShieldCheck size={18} strokeWidth={1.8} />
              <span>{roleLabel} access</span>
            </div>
          </div>

          <div className={styles.workspaceArea}>
            {workspaceMatchesSearch ? (
              <button
                className={styles.workspaceCard}
                type="button"
                onClick={handleSelectWorkspace}
              >
                <div className={styles.cardTopLine} aria-hidden="true" />

                <div className={styles.cardHeader}>
                  <div className={styles.campaignIdentity}>
                    <div className={styles.campaignMark} aria-hidden="true">
                      <span>EA</span>
                      <Vote size={21} strokeWidth={1.8} />
                    </div>

                    <div>
                      <div className={styles.titleRow}>
                        <h2>Elizabeth Accomando</h2>

                        <span className={styles.activeStatus}>
                          <CheckCircle2 size={15} strokeWidth={2.2} />
                          Active
                        </span>
                      </div>

                      <p>Wellington Council Campaign</p>
                    </div>
                  </div>
                </div>

                <div className={styles.detailsGrid}>
                  <div className={styles.detail}>
                    <CalendarDays size={19} strokeWidth={1.8} />

                    <div>
                      <span>Election Day</span>
                      <strong>August 18, 2026</strong>
                    </div>
                  </div>

                  <div className={styles.detail}>
                    <ShieldCheck size={19} strokeWidth={1.8} />

                    <div>
                      <span>Your access</span>
                      <strong>{roleLabel}</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.workspaceTools}>
                  <span>
                    <FolderKanban size={16} strokeWidth={1.8} />
                    Campaign files
                  </span>

                  <span>
                    <UsersRound size={16} strokeWidth={1.8} />
                    Team activity
                  </span>

                  <span>
                    <CalendarDays size={16} strokeWidth={1.8} />
                    Events
                  </span>
                </div>

                <div className={styles.enterRow}>
                  <div>
                    <span>Wellington, Florida</span>
                    <strong>
                      Open {isAdmin ? "admin" : "client"} workspace
                    </strong>
                  </div>

                  <div className={styles.arrowButton} aria-hidden="true">
                    <ArrowRight size={21} strokeWidth={2} />
                  </div>
                </div>
              </button>
            ) : (
              <div className={styles.emptyState}>
                <Search size={30} strokeWidth={1.5} />
                <h2>No workspaces found</h2>
                <p>Try searching for Elizabeth, Wellington or campaign.</p>

                <button type="button" onClick={() => setSearchTerm("")}>
                  Clear search
                </button>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.sidePanel}>
          <div className={styles.sidePanelHeader}>
            <div className={styles.lockIcon}>
              {isAdmin ? (
                <ShieldCheck size={22} strokeWidth={1.8} />
              ) : (
                <LockKeyhole size={22} strokeWidth={1.8} />
              )}
            </div>

            <div>
              <p>{isAdmin ? "Administrator access" : "Secure access"}</p>

              <h2>
                {isAdmin
                  ? "Campaign controls are available"
                  : "Your campaign data is protected"}
              </h2>
            </div>
          </div>

          <p className={styles.sideDescription}>
            {isAdmin
              ? "You signed in through the Administrator Portal. Your account can access campaign-wide management controls."
              : "You signed in through the Client Portal. You will see the campaign tools and information assigned to you."}
          </p>

          <div className={styles.securityList}>
            <div>
              <CheckCircle2 size={18} strokeWidth={2} />
              <span>Role-based campaign access</span>
            </div>

            <div>
              <CheckCircle2 size={18} strokeWidth={2} />
              <span>Protected files and contacts</span>
            </div>

            <div>
              <CheckCircle2 size={18} strokeWidth={2} />
              <span>
                {isAdmin
                  ? "Administrative campaign controls"
                  : "Centralized campaign activity"}
              </span>
            </div>
          </div>

          <div className={styles.supportBox}>
            <span>Need different access?</span>

            <p>
              Sign out and choose the correct portal, or contact the
              campaign administrator for permission.
            </p>
          </div>

          <div className={styles.authorizedUse}>
            <ShieldCheck size={17} strokeWidth={1.8} />
            <span>Authorized campaign use only</span>
          </div>
        </aside>
      </main>

      <footer className={styles.footer}>
        <span>© 2026 Campaign HQ</span>
        <span>Secure campaign operations platform</span>
      </footer>
    </div>
  );
}
