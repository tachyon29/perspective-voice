import { useEffect, useState } from "react";
import { Check, ChevronDown, Info, UserRound, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProgress } from "../progress/ProgressProvider";

function AccountStatus() {
  const { user, loading, notice, clearNotice, signOut } = useAuth();
  const { saveStatus, retrySave } = useProgress();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const displayName = user?.email?.split("@")[0] ?? "Guest";
  const initial = displayName.trim().charAt(0).toUpperCase() || "G";
  const saveLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not synced" : "Saved";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(clearNotice, 5500);
    return () => window.clearTimeout(timeout);
  }, [clearNotice, notice]);

  const avatar = user ? (
    <span className="account-avatar-initial" aria-hidden="true">{initial}</span>
  ) : (
    <UserRound size={17} strokeWidth={1.7} aria-hidden="true" />
  );

  return (
    <div className="account-status">
      {user ? (
        <button
          className="account-trigger"
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="account-avatar">{avatar}</span>
          <span className="account-trigger-copy">
            <strong>{displayName}</strong>
            <small><i className={`account-state-dot is-${saveStatus}`} />Signed in · {saveLabel}</small>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      ) : (
        <Link className="account-trigger" to="/auth">
          <span className="account-avatar">{avatar}</span>
          <span className="account-trigger-copy">
            <strong>Guest</strong>
            <small><i className="account-state-dot" />{loading ? "Checking status" : "Signed out"}</small>
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </Link>
      )}

      {user && menuOpen && (
        <div className="account-menu" role="menu">
          <div className="account-menu-profile">
            <span className="account-avatar">{avatar}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <div className="account-menu-state">
            <i className="account-state-dot is-signed-in" />
            You’re signed in
          </div>
          <div className="account-menu-state account-save-state">
            <i className={`account-state-dot is-${saveStatus}`} />
            Progress {saveLabel.toLowerCase()}
          </div>
          {saveStatus === "error" && (
            <>
              <p className="account-menu-error" role="status">
                Your latest progress could not reach Supabase.
              </p>
              <button
                className="account-retry-save"
                type="button"
                role="menuitem"
                onClick={async () => {
                  setRetryMessage("");
                  try {
                    await retrySave();
                    setRetryMessage("Progress saved.");
                  } catch {
                    setRetryMessage("Still unable to sync. Check your connection and try again.");
                  }
                }}
              >
                Retry save
              </button>
              {retryMessage && <p className="account-menu-error" role="status">{retryMessage}</p>}
            </>
          )}
          <Link to="/resume" role="menuitem" onClick={() => setMenuOpen(false)}>
            Resume journey
          </Link>
          <Link to="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)}>
            Career dashboard
          </Link>
          <Link to="/auth?mode=change" role="menuitem" onClick={() => setMenuOpen(false)}>
            Change password
          </Link>
          {signOutError && <p className="account-menu-error" role="alert">{signOutError}</p>}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setSignOutError("");
              try {
                await signOut();
                setMenuOpen(false);
              } catch {
                setSignOutError("Could not sign out. Please try again.");
              }
            }}
          >
            Sign out
          </button>
        </div>
      )}

      {notice && (
        <div className={`account-notice is-${notice.kind}`} role="status" aria-live="polite">
          {notice.kind === "success" ? <Check size={14} /> : <Info size={14} />}
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss message" onClick={clearNotice}>
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountStatus;
