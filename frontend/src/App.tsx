import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAuth from "./components/RequireAuth";
import Landing from "./pages/Landing";
import SoftwareEngineering from "./pages/SoftwareEngineering";
import CodingOnboarding from "./pages/CodingOnboarding";
import SoftwareEngineeringWork from "./pages/SoftwareEngineeringWork";
import CareerDashboard from "./pages/CareerDashboard";
import ManagementConsulting from "./pages/ManagementConsulting";
import ManagementConsultingWork from "./pages/ManagementConsultingWork";
import Auth from "./pages/Auth";
import { ProgressProvider, useProgress } from "./progress/ProgressProvider";

function Resume() {
  const { progress } = useProgress();
  if (progress.journeyStage === "workplace") {
    return <Navigate to="/careers/software-engineering/work" replace />;
  }
  if (progress.journeyStage === "onboarding") {
    return <Navigate to="/careers/software-engineering/onboarding" replace />;
  }
  return <Navigate to="/careers/software-engineering" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProgressProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/careers/software-engineering"
              element={<SoftwareEngineering />}
            />
            <Route
              path="/careers/management-consulting"
              element={<ManagementConsulting />}
            />
            <Route element={<RequireAuth />}>
              <Route path="/resume" element={<Resume />} />
              <Route
                path="/careers/software-engineering/onboarding"
                element={<CodingOnboarding />}
              />
              <Route
                path="/careers/software-engineering/work"
                element={<SoftwareEngineeringWork />}
              />
              <Route
                path="/careers/management-consulting/work"
                element={<ManagementConsultingWork />}
              />
              <Route path="/dashboard" element={<CareerDashboard />} />
            </Route>
          </Routes>
        </ProgressProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
