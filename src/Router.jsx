import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute/ProtectedRoute";
import Calendar from "./pages/Calendar/Calendar";
import RoleDashboard from "./pages/RoleDashboard/RoleDashboard";
import ApprovalsReferencePreview from "./pages/ApprovalsReferencePreview/ApprovalsReferencePreview";
import VolunteersReferencePreview from "./pages/VolunteersReferencePreview/VolunteersReferencePreview";
import CampaignToolComingSoon from "./pages/CampaignToolComingSoon/CampaignToolComingSoon";
import InboxReferencePreview from "./pages/InboxReferencePreview/InboxReferencePreview";
import ContactsReferencePreview from "./pages/ContactsReferencePreview/ContactsReferencePreview";
import DocumentsReferencePreview from "./pages/DocumentsReferencePreview/DocumentsReferencePreview";
import Inventory from "./pages/Inventory/Inventory";
import PlanUsage from "./pages/PlanUsage/PlanUsage";
import Integrations from "./pages/Integrations/Integrations";
import VolunteerFieldAssignment from "./pages/VolunteerFieldAssignment/VolunteerFieldAssignment";
import FieldOperations from "./pages/FieldOperations/FieldOperations";
import Login from "./pages/Login/Login";
import ForgotPassword from "./pages/PasswordRecovery/ForgotPassword";
import ResetPassword from "./pages/PasswordRecovery/ResetPassword";
import MfaChallenge from "./pages/Mfa/MfaChallenge";
import MfaSetup from "./pages/Mfa/MfaSetup";
import InvitationAccept from "./pages/InvitationAccept/InvitationAccept";
import ProfileSettings from "./pages/ProfileSettings/ProfileSettings";
import NylasOAuthCallback from "./pages/NylasOAuthCallback/NylasOAuthCallback";
import NylasCalendarOAuthCallback from "./pages/NylasCalendarOAuthCallback/NylasCalendarOAuthCallback";
import Invitations from "./pages/Team/Invitations";
import TeamAccess from "./pages/TeamAccess/TeamAccess";
import TeamReferencePreview from "./pages/TeamReferencePreview/TeamReferencePreview";
import RoleTasks from "./pages/RoleTasks/RoleTasks";
import CommitmentsReferencePreview from "./pages/CommitmentsReferencePreview/CommitmentsReferencePreview";
import WaitingOnReferencePreview from "./pages/WaitingOnReferencePreview/WaitingOnReferencePreview";
import WorkspaceSettings from "./pages/WorkspaceSettings/WorkspaceSettings";
import CandidateProfileManagement from "./pages/CandidateProfileManagement/CandidateProfileManagement";
import CampaignSetupWizard from "./pages/CampaignSetupWizard/CampaignSetupWizard";
import WorkspaceSelector from "./pages/WorkspaceSelector/WorkspaceSelector";
import Support from "./pages/Support/Support";
import SupportLauncher from "./components/SupportLauncher/SupportLauncher";
import PlatformAdminGuard from "./components/auth/PlatformAdminGuard/PlatformAdminGuard";
import PlatformAdminLogin from "./pages/PlatformAdmin/PlatformAdminLogin";
import PlatformAdminHome from "./pages/PlatformAdmin/PlatformAdminHome";
import PlatformAdminCustomers from "./pages/PlatformAdmin/PlatformAdminCustomers";
import PlatformAdminCustomer360 from "./pages/PlatformAdmin/PlatformAdminCustomer360";
import PlatformAdminWorkspaceEditor from "./pages/PlatformAdmin/PlatformAdminWorkspaceEditor";
import PlatformAdminNewClient from "./pages/PlatformAdmin/PlatformAdminNewClient";
import PlatformAdminProposalBuilder from "./pages/PlatformAdmin/PlatformAdminProposalBuilder";
import PlatformAdminProposalPreview from "./pages/PlatformAdmin/PlatformAdminProposalPreview";
import PlatformAdminReleases from "./pages/PlatformAdmin/PlatformAdminReleases";
import SeatProposal from "./pages/SeatProposal/SeatProposal";
import SeatOnboardingStart from "./pages/SeatOnboarding/SeatOnboardingStart";
import SeatOnboardingSignIn from "./pages/SeatOnboarding/SeatOnboardingSignIn";
import SeatOnboardingContinue from "./pages/SeatOnboarding/SeatOnboardingContinue";





import PublicCampaignSeat from "./pages/PublicCampaignSeat/PublicCampaignSeat";


class PublicWebsiteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(
      "Campaign Seat public website render error:",
      error,
      info,
    );
  }

  render() {
    if (this.state.error) {
      const error = this.state.error;

      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "48px",
            color: "#111827",
            background: "#ffffff",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "920px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                color: "#b91c1c",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.12em",
              }}
            >
              CAMPAIGN SEAT PUBLIC WEBSITE — RUNTIME ERROR
            </div>

            <h1
              style={{
                marginTop: "14px",
                fontSize: "34px",
              }}
            >
              The public page hit a render error.
            </h1>

            <p
              style={{
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              Screenshot the error below and send it back.
              This diagnostic is local only.
            </p>

            <pre
              style={{
                overflowX: "auto",
                marginTop: "24px",
                padding: "22px",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                color: "#7f1d1d",
                background: "#fff7f7",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: 1.55,
              }}
            >
              {String(
                error?.stack ||
                error?.message ||
                error,
              )}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const LEADERSHIP_EXPERIENCES = [
  "owner",
  "candidate",
  "manager",
];

const VOLUNTEER_EXPERIENCES = [
  "volunteer",
];

export default function Router() {
  const hostname =
    window.location.hostname
      .trim()
      .toLowerCase();

  /*
   * CAMPAIGN SEAT CANONICAL ADMIN DOMAIN
   *
   * Stable Vercel project aliases are technical addresses only.
   * Send normal Admin traffic to the branded production domain.
   * Unique deployment URLs remain available for troubleshooting.
   */
  const isPlatformAdminTechnicalAlias =
    hostname ===
      "campaign-seat-admin.vercel.app" ||
    hostname ===
      "campaign-seat-admin-maverickjourneys-projects.vercel.app";

  if (isPlatformAdminTechnicalAlias) {
    const canonicalAdminUrl =
      new URL(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        "https://admin.campaignseat.com",
      );

    window.location.replace(
      canonicalAdminUrl.toString(),
    );

    return null;
  }

  /*
   * CAMPAIGN SEAT BUILD SURFACE OVERRIDE
   *
   * Separate Vercel projects may force their intended surface
   * at build time while production custom domains continue to
   * enforce hostname separation.
   */
  const buildSurface =
    String(
      import.meta.env.VITE_SEAT_SURFACE ||
      "",
    )
      .trim()
      .toLowerCase();

  const isPlatformAdminHostname =
    buildSurface === "admin" ||
    hostname ===
      "admin.campaignseat.com";

  const isCampaignAppHostname =
    buildSurface === "app" ||
    hostname ===
      "app.campaignseat.com";

  const isPublicWebsiteHostname =
    hostname ===
      "campaignseat.com" ||
    hostname ===
      "www.campaignseat.com";

  const isLocalDevelopmentHostname =
    hostname === "127.0.0.1" ||
    hostname === "localhost";

  const isPublicWebsitePreviewPath =
    isLocalDevelopmentHostname &&
    (
      window.location.pathname ===
        "/public-preview" ||
      window.location.pathname.startsWith(
        "/sms-consent",
      ) ||
      window.location.pathname.startsWith(
        "/privacy",
      ) ||
      window.location.pathname.startsWith(
        "/terms",
      )
    );

  /*
   * CAMPAIGN SEAT HOSTNAME SEPARATION
   *
   * campaignseat.com
   *   -> public Campaign Seat website
   *
   * app.campaignseat.com
   *   -> campaign/client application
   *
   * admin.campaignseat.com
   *   -> Seat Platform Admin only
   *
   * Local development keeps /admin routes available on
   * 127.0.0.1 and localhost.
   */
  if (
    isPublicWebsiteHostname ||
    isPublicWebsitePreviewPath
  ) {
    const localPublicPreview =
      isLocalDevelopmentHostname;

    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicWebsiteErrorBoundary>
<PublicCampaignSeat
                  page="home"
                />
              </PublicWebsiteErrorBoundary>
            }
          />

          <Route
            path="/public-preview"
            element={
              <PublicWebsiteErrorBoundary>
<PublicCampaignSeat
                  page="home"
                />
              </PublicWebsiteErrorBoundary>
            }
          />

          <Route
            path="/sms-consent/*"
            element={
              <PublicWebsiteErrorBoundary>
<PublicCampaignSeat
                  page="sms-consent"
                />
              </PublicWebsiteErrorBoundary>
            }
          />

          <Route
            path="/privacy/*"
            element={
              <PublicWebsiteErrorBoundary>
<PublicCampaignSeat
                  page="privacy"
                />
              </PublicWebsiteErrorBoundary>
            }
          />

          <Route
            path="/terms/*"
            element={
              <PublicWebsiteErrorBoundary>
<PublicCampaignSeat
                  page="terms"
                />
              </PublicWebsiteErrorBoundary>
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to={
                  localPublicPreview
                    ? "/public-preview"
                    : "/"
                }
                replace
              />
            }
          />
        </Routes>
      </BrowserRouter>
    );
  }

  if (isPlatformAdminHostname) {
    return (
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to="/admin"
                replace
              />
            }
          />

          <Route
            path="/login"
            element={
              <Navigate
                to="/admin/login"
                replace
              />
            }
          />

          <Route
            path="/admin/login"
            element={
              <PlatformAdminLogin />
            }
          />

          <Route
            path="/forgot-password"
            element={
              <ForgotPassword />
            }
          />

          <Route
            path="/reset-password"
            element={
              <ResetPassword />
            }
          />

          <Route
            path="/mfa/challenge"
            element={
              <MfaChallenge />
            }
          />

          <Route
            path="/mfa/setup"
            element={
              <MfaSetup />
            }
          />

          <Route
            path="/admin"
            element={
              <PlatformAdminGuard>
                <PlatformAdminHome />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/releases"
            element={
              <PlatformAdminGuard>
                <PlatformAdminReleases />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/customers"
            element={
              <PlatformAdminGuard>
                <PlatformAdminCustomers />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/workspaces/:workspaceId"
            element={
              <PlatformAdminGuard>
                <PlatformAdminWorkspaceEditor />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/customers/:workspaceId"
            element={
              <PlatformAdminGuard>
                <PlatformAdminCustomer360 />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/customers/new"
            element={
              <PlatformAdminGuard>
                <PlatformAdminNewClient />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/deals/:dealCode/proposal"
            element={
              <PlatformAdminGuard>
                <PlatformAdminProposalBuilder />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="/admin/proposals/:proposalId"
            element={
              <PlatformAdminGuard>
                <PlatformAdminProposalPreview />
              </PlatformAdminGuard>
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to="/admin"
                replace
              />
            }
          />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        {isCampaignAppHostname ? (
          <Route
            path="/admin/*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />
        ) : (
          <>
        <Route
          path="/admin/login"
          element={<PlatformAdminLogin />}
        />
        <Route
          path="/admin"
          element={
            <PlatformAdminGuard>
              <PlatformAdminHome />
            </PlatformAdminGuard>
          }
        />
        <Route
          path="/admin/customers"
          element={
            <PlatformAdminGuard>
              <PlatformAdminCustomers />
            </PlatformAdminGuard>
          }
        />
        <Route
          path="/admin/workspaces/:workspaceId"
          element={
            <PlatformAdminGuard>
              <PlatformAdminWorkspaceEditor />
            </PlatformAdminGuard>
          }
        />

        <Route
          path="/admin/customers/:workspaceId"
          element={
            <PlatformAdminGuard>
              <PlatformAdminCustomer360 />
            </PlatformAdminGuard>
          }
        />
        <Route
          path="/admin/customers/new"
          element={
            <PlatformAdminGuard>
              <PlatformAdminNewClient />
            </PlatformAdminGuard>
          }
        />
        <Route
          path="/admin/deals/:dealCode/proposal"
          element={
            <PlatformAdminGuard>
              <PlatformAdminProposalBuilder />
            </PlatformAdminGuard>
          }
        />
        <Route
          path="/admin/proposals/:proposalId"
          element={
            <PlatformAdminGuard>
              <PlatformAdminProposalPreview />
            </PlatformAdminGuard>
          }
        />
          </>
        )}

        <Route
          path="/proposal/:token"
          element={<SeatProposal />}
        />

        <Route
          path="/onboarding/sign-in"
          element={<SeatOnboardingSignIn />}
        />

        <Route
          path="/onboarding/:token"
          element={<SeatOnboardingStart />}
        />

        <Route
          path="/onboarding/continue"
          element={<SeatOnboardingContinue />}
        />


        <Route
          path="/support"
          element={<Support />}
        />

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/mfa/challenge"
          element={<MfaChallenge />}
        />

        <Route
          path="/mfa/setup"
          element={<MfaSetup />}
        />
        <Route path="/invite" element={<InvitationAccept />} />

        <Route
          path="/profile/settings"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspaces"
          element={
            <ProtectedRoute>
              <WorkspaceSelector />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <RoleTasks />
            </ProtectedRoute>
          }
        />

        <Route
          path="/commitments"
          element={
            <ProtectedRoute
              allowedExperiences={
                LEADERSHIP_EXPERIENCES
              }
            >
              <CommitmentsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/waiting-on"
          element={
            <ProtectedRoute
              allowedExperiences={
                LEADERSHIP_EXPERIENCES
              }
            >
              <WaitingOnReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/field-operations"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <FieldOperations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/field-assignment"
          element={
            <ProtectedRoute allowedExperiences={VOLUNTEER_EXPERIENCES}>
              <VolunteerFieldAssignment />
            </ProtectedRoute>
          }
        />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Calendar />
            </ProtectedRoute>
          }
        />

        <Route
          path="/approvals"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <ApprovalsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/approvals-preview"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <ApprovalsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inbox"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <InboxReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/volunteers"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <VolunteersReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/fundraising"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CampaignToolComingSoon toolKey="fundraising" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CampaignToolComingSoon toolKey="events" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/social-media"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CampaignToolComingSoon toolKey="social-media" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/media-center"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CampaignToolComingSoon toolKey="media-center" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports-analytics"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CampaignToolComingSoon toolKey="reports-analytics" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contacts"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <ContactsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contacts-preview"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <ContactsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/documents"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <DocumentsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/documents-preview"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <DocumentsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/files"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <DocumentsReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Inventory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/team/access"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <TeamAccess />
            </ProtectedRoute>
          }
        />

        <Route
          path="/team/invitations"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Invitations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/team"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <TeamReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/team-preview"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <TeamReferencePreview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/oauth/nylas/callback"
          element={
            <NylasOAuthCallback />
          }
        />

        <Route
          path="/oauth/nylas/calendar/callback"
          element={
            <ProtectedRoute
              allowedExperiences={
                LEADERSHIP_EXPERIENCES
              }
            >
              <NylasCalendarOAuthCallback />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/integrations"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Integrations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/usage"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <PlanUsage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/settings"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/candidate-profile"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CandidateProfileManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/campaign-settings"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <WorkspaceSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/setup"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <CampaignSetupWizard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SupportLauncher />
    </BrowserRouter>
  );
}
