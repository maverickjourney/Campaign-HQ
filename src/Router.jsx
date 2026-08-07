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
import VolunteerFieldAssignment from "./pages/VolunteerFieldAssignment/VolunteerFieldAssignment";
import FieldOperations from "./pages/FieldOperations/FieldOperations";
import Login from "./pages/Login/Login";
import ForgotPassword from "./pages/PasswordRecovery/ForgotPassword";
import ResetPassword from "./pages/PasswordRecovery/ResetPassword";
import MfaChallenge from "./pages/Mfa/MfaChallenge";
import MfaSetup from "./pages/Mfa/MfaSetup";
import InvitationAccept from "./pages/InvitationAccept/InvitationAccept";
import ProfileSettings from "./pages/ProfileSettings/ProfileSettings";
import Invitations from "./pages/Team/Invitations";
import TeamAccess from "./pages/TeamAccess/TeamAccess";
import TeamReferencePreview from "./pages/TeamReferencePreview/TeamReferencePreview";
import RoleTasks from "./pages/RoleTasks/RoleTasks";
import CommitmentsReferencePreview from "./pages/CommitmentsReferencePreview/CommitmentsReferencePreview";
import WaitingOnReferencePreview from "./pages/WaitingOnReferencePreview/WaitingOnReferencePreview";
import WorkspaceSettings from "./pages/WorkspaceSettings/WorkspaceSettings";
import WorkspaceSelector from "./pages/WorkspaceSelector/WorkspaceSelector";
import Support from "./pages/Support/Support";
import SupportLauncher from "./components/SupportLauncher/SupportLauncher";

const LEADERSHIP_EXPERIENCES = [
  "owner",
  "candidate",
  "manager",
];

const VOLUNTEER_EXPERIENCES = [
  "volunteer",
];

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

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
          path="/workspace/settings"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <ProfileSettings />
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <SupportLauncher />
    </BrowserRouter>
  );
}
