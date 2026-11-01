import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { EmailOtpType, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, type APIUser } from "../lib/supabase";

interface AuthContextValue {
  user: APIUser | null;
  loading: boolean;
  configured: boolean;
  notice: AuthNotice | null;
  clearNotice: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resendConfirmation: (email: string) => Promise<void>;
  verifyEmail: (token: string, type: EmailOtpType) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (token: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export interface AuthNotice {
  id: number;
  kind: "success" | "info" | "error";
  message: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: SupabaseUser | null): APIUser | null {
  if (!user?.email) return null;
  return {
    id: user.id,
    email: user.email,
    email_verified: Boolean(user.email_confirmed_at),
  };
}

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env.local.");
  return supabase;
}

function emailRedirect(mode: "verify" | "reset") {
  return `${window.location.origin}/auth?mode=${mode}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<APIUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  const publishNotice = useCallback((message: string, kind: AuthNotice["kind"] = "success") => {
    setNotice({ id: Date.now(), kind, message });
  }, []);
  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(mapUser(session?.user ?? null));
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(mapUser(data.session?.user ?? null));
      setLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: Boolean(supabase),
    notice,
    clearNotice,
    signIn: async (email, password) => {
      const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      publishNotice("You’re signed in.");
    },
    signUp: async (email, password) => {
      const { data, error } = await requireSupabase().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: emailRedirect("verify") },
      });
      if (error) throw error;
      publishNotice(data.session ? "Your account is ready." : "Check your email to confirm your account.", data.session ? "success" : "info");
      return Boolean(data.session);
    },
    resendConfirmation: async (email) => {
      const { error } = await requireSupabase().auth.resend({
        type: "signup", email, options: { emailRedirectTo: emailRedirect("verify") },
      });
      if (error) throw error;
    },
    verifyEmail: async (token, type) => {
      if (!token) {
        const { data, error } = await requireSupabase().auth.getSession();
        if (error || !data.session) throw error ?? new Error("This confirmation link is missing its token. Request a new email.");
        return;
      }
      const { error } = await requireSupabase().auth.verifyOtp({ token_hash: token, type });
      if (error) throw error;
    },
    requestPasswordReset: async (email) => {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: emailRedirect("reset") });
      if (error) throw error;
    },
    updatePassword: async (_token, password) => {
      const { error } = await requireSupabase().auth.updateUser({ password });
      if (error) throw error;
    },
    changePassword: async (currentPassword, newPassword) => {
      const client = requireSupabase();
      const { data, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!data.user?.email) throw new Error("Sign in again before changing your password.");
      const { error: signInError } = await client.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
      if (signInError) throw new Error("Current password is incorrect.");
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await client.auth.signOut();
      publishNotice("Password changed. Please sign in again.", "info");
    },
    signOut: async () => {
      const { error } = await requireSupabase().auth.signOut();
      if (error) throw error;
      publishNotice("You’re signed out.");
    },
  }), [clearNotice, loading, notice, publishNotice, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
