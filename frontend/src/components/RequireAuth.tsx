import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProgress } from "../progress/ProgressProvider";

function RequireAuth() {
  const { user, loading: authLoading } = useAuth();
  const { loading: progressLoading, error, retryLoad } = useProgress();
  const location = useLocation();

  if (authLoading || (user && progressLoading)) {
    return <main className="auth-loading">Loading your Perspective workspace…</main>;
  }

  if (user && error) {
    return (
      <main className="auth-loading auth-load-error">
        <p>{error}</p>
        <button onClick={retryLoad}>Try again</button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default RequireAuth;
