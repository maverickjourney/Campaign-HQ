import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import ProtectedRoute from "./components/auth/ProtectedRoute/ProtectedRoute";
import Dashboard from "./pages/Dashboard/Dashboard";
import Login from "./pages/Login/Login";
import WorkspaceSelector from "./pages/WorkspaceSelector/WorkspaceSelector";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

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
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
