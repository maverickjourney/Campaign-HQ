import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute/ProtectedRoute";
import Calendar from "./pages/Calendar/Calendar";
import RoleDashboard from "./pages/RoleDashboard/RoleDashboard";
import Approvals from "./pages/Approvals/Approvals";
import Communications from "./pages/Communications/Communications";
import Contacts from "./pages/Contacts/Contacts";
import Files from "./pages/Files/Files";
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
import Team from "./pages/Team/Team";
import RoleTasks from "./pages/RoleTasks/RoleTasks";
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
              <Approvals />
            </ProtectedRoute>
          }
        />

        <Route
          path="/communications"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Communications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/contacts"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Contacts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/files"
          element={
            <ProtectedRoute allowedExperiences={LEADERSHIP_EXPERIENCES}>
              <Files />
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
              <Team />
            </ProtectedRoute>
          }
        />

        <Route
          path="/workspace/settings"
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
