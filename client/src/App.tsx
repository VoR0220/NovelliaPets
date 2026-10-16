import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PetsPage } from "./pages/PetsPage";
import { PetDetailPage } from "./pages/PetDetailPage";
import { NewPetPage } from "./pages/NewPetPage";
import { FamiliesPage } from "./pages/FamiliesPage";
import { FamilyDetailPage } from "./pages/FamilyDetailPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { human, loading } = useAuth();
  if (loading) return <div className="main">Loading…</div>;
  if (!human) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="pets" element={<PetsPage />} />
        <Route path="pets/new" element={<NewPetPage />} />
        <Route path="pets/:petId" element={<PetDetailPage />} />
        <Route path="families" element={<FamiliesPage />} />
        <Route path="families/:familyId" element={<FamilyDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
