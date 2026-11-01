import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AccountStatus from "../components/AccountStatus";

function Auth() {
  const { configured, user, signIn, signUp, resendConfirmation, verifyEmail, requestPasswordReset, updatePassword, changePassword } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset" | "verify" | "change">(() => {
    const requestedMode = searchParams.get("mode");
    return requestedMode === "signup" || requestedMode === "reset" || requestedMode === "verify" || requestedMode === "change" ? requestedMode : "signin";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const verificationStarted = useRef(false);
  const resetToken = searchParams.get("token_hash") ?? searchParams.get("token") ?? "";
  const verificationType = searchParams.get("type") ?? "signup";
  const requestedPath = (location.state as { from?: string } | null)?.from;
  const from = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/resume";

  useEffect(() => {
    if (user && mode !== "reset" && mode !== "change") navigate(from, { replace: true });
  }, [from, mode, navigate, user]);

  useEffect(() => {
    if (mode !== "verify" || !resetToken || verificationStarted.current) return;
    verificationStarted.current = true;
    setSubmitting(true);
    void verifyEmail(resetToken, verificationType)
      .then(() => { setMode("signin"); setMessage("Email confirmed. You can now sign in."); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to verify this email."))
      .finally(() => setSubmitting(false));
  }, [mode, resetToken, verificationType, verifyEmail]);

  if (user && mode !== "reset" && mode !== "change") {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        navigate(from, { replace: true });
      } else if (mode === "signup") {
        const hasSession = await signUp(email, password);
        if (hasSession) navigate(from, { replace: true });
        else {
          setConfirmationPending(true);
          setMessage(
            "A confirmation email should arrive shortly. Check your spam folder too.",
          );
        }
      } else if (mode === "forgot") {
        await requestPasswordReset(email);
        setMessage("If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.");
      } else if (mode === "reset") {
        await updatePassword(resetToken, password);
        setPassword("");
        setMode("signin");
        setMessage("Password updated. You can now sign in with your new password.");
      } else {
        await changePassword(currentPassword, password);
        setCurrentPassword("");
        setPassword("");
        setMode("signin");
        navigate("/auth", { replace: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to authenticate.");
    } finally {
      setSubmitting(false);
    }
  };

  const resendConfirmationEmail = async () => {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await resendConfirmation(email);
      setMessage("If that address has an unconfirmed account, a new confirmation email has been sent.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resend the confirmation email.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-page-header">
        <Link to="/" className="auth-brand">perspective</Link>
        <AccountStatus />
      </header>
      <section className="auth-card">
        <p className="eyebrow">YOUR CAREER EXPERIENCE</p>
        <h1>{mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your account." : mode === "forgot" ? "Reset your password." : mode === "verify" ? "Confirming your email." : mode === "change" ? "Change your password." : "Choose a new password."}</h1>
        <p className="auth-description">
          {mode === "signin" || mode === "signup"
            ? "Sign in to save your progress and pick up where you left off."
            : mode === "forgot"
              ? "Enter your account email and we’ll send a password reset link."
              : mode === "change" ? "Choose a new password for your Perspective account." : "Choose a new password for your Perspective account."}
        </p>

        {!configured ? (
          <div className="auth-setup-message">
            <strong>Supabase setup needed</strong>
            <p>
              Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env.local, then restart the frontend.
            </p>
          </div>
        ) : (
          <>
            {(mode === "signin" || mode === "signup") && <div className="auth-mode-switch" role="tablist" aria-label="Account action">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                onClick={() => { setMode("signin"); setMessage(""); setError(""); setConfirmationPending(false); }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => { setMode("signup"); setMessage(""); setError(""); setConfirmationPending(false); }}
              >
                Create account
              </button>
            </div>}
            {mode !== "verify" && <form className="auth-form" onSubmit={submit}>
              {(mode === "signin" || mode === "signup" || mode === "forgot") && <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>}
              {mode === "change" && <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>}
              {mode !== "forgot" && <label>
                {mode === "change" ? "New password" : "Password"}
                <input
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {(mode === "signup" || mode === "reset" || mode === "change") && <small>Use at least 8 characters.</small>}
              </label>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-message" role="status">{message}</p>}
              <button type="submit" disabled={submitting}>
                {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "change" ? "Change password" : "Update password"}
              </button>
            </form>}
            {mode === "signin" && <button className="auth-text-link" type="button" onClick={() => { setMode("forgot"); setMessage(""); setError(""); }}>
              Forgot password?
            </button>}
            {(mode === "signin" || (confirmationPending && mode === "signup")) && <button className="auth-text-link" type="button" disabled={submitting || !email.trim()} onClick={() => void resendConfirmationEmail()}>
              Resend confirmation email
            </button>}
            {(mode === "forgot" || mode === "reset" || mode === "change") && <button className="auth-text-link" type="button" onClick={() => { setMode("signin"); setMessage(""); setError(""); }}>
              Back to sign in
            </button>}
          </>
        )}
      </section>
    </main>
  );
}

export default Auth;
