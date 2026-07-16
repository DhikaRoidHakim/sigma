import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import AssetDetailPage from "@/pages/AssetDetailPage";
import PublicAssetPage from "@/pages/PublicAssetPage";
import OfficesPage from "@/pages/OfficesPage";
import RoomsPage from "@/pages/RoomsPage";
import UsersPage from "@/pages/UsersPage";
import RolesPage from "@/pages/RolesPage";

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 size={28} className="animate-spin text-[#01567A]" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return children;
};

const PermissionRoute = ({ perm, children }) => {
  const { hasPerm } = useAuth();
  if (!hasPerm(perm)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/public/assets/:id" element={<PublicAssetPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/offices" element={<OfficesPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/users" element={<PermissionRoute perm="users.manage"><UsersPage /></PermissionRoute>} />
            <Route path="/roles" element={<PermissionRoute perm="roles.manage"><RolesPage /></PermissionRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
