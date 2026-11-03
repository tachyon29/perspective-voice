import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CareerReflection } from "../utils/careerReflection";
import {
  CAREER_REFLECTION_IMPORT_OWNER_KEY,
  loadCareerReflection,
} from "../utils/careerReflection";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

export type JourneyStage = "career" | "onboarding" | "workplace";
export type SavedWorkplaceView = "ticket" | "repository" | "slack" | "dm-priya" | "dm-arjun" | "dm-maya" | "dm-rahul";
export type SavedPullRequestStatus = "not-created" | "in-review" | "merged";
export type TeamMemberName = "Priya" | "Arjun" | "Maya" | "Rahul";
export type TicketTriageChoice = "route" | "service" | "tests";

export interface OnboardingProgress {
  currentMission: number;
  completedMissions: number[];
  missionDrafts?: Record<number, { missionId: number; code: string; output: string }>;
  completedMissionSnapshots?: Record<number, { code: string; output: string }>;
  code: string;
  success: boolean;
  output: string;
  tutorMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface SavedTeammateMessage { author: "You" | "Priya"; text: string }
export interface SavedDirectMessage { author: "You" | TeamMemberName; text: string }
export type SavedDirectMessages = Record<TeamMemberName, SavedDirectMessage[]>;

export interface WorkplaceProgress {
  view: SavedWorkplaceView;
  activeTicketId?: string;
  ticketDrafts?: Record<string, string>;
  ticketOutputs?: Record<string, string>;
  completedTickets?: string[];
  ticketChatMessages?: Record<string, Array<{ role: "user" | "assistant"; content: string }>>;
  systemDesignDraft?: { nodes: Array<{ id: "client" | "api_gateway" | "payment_service" | "idempotency_store" | "payments_db" | "queue" | "worker" | "monitoring"; x: number; y: number }>; connections: string[] };
  systemDesignReview?: { success: boolean; message: string; passed: string[]; missing: string[] } | null;
  seenTicketGuides?: string[];
  selectedFileName: string;
  paymentCode: string;
  checkOutput: string;
  checksPassed: boolean;
  pullRequestStatus: SavedPullRequestStatus;
  gitStep: number;
  gitCommand: string;
  commitMessage: string;
  gitOutput: string;
  teammateMessages: SavedTeammateMessage[];
  directMessages?: SavedDirectMessages;
  teamWelcomeStep?: number;
  teamWelcomeCompleted?: boolean;
  teamWelcomeVersion?: number;
  teamMeetingStep?: number;
  teamMeetingCompleted?: boolean;
  teamCallAccepted?: boolean;
  teamMeetingVersion?: number;
  ticketTriageChoice?: TicketTriageChoice;
}

export type ConsultingCaseStage = "team-intro" | "kickoff" | "analysis" | "team-checkin" | "recommendation" | "client-readout" | "reflection";
export type ConsultingDriver = "sales" | "costs" | "localOperations";
export type ConsultingProbabilities = Record<ConsultingDriver, number>;

export interface ManagementConsultingProgress {
  stage: ConsultingCaseStage;
  teamIntroStep: number;
  kickoffAcknowledged: boolean;
  selectedStore: string | null;
  storeSelectionConfirmed: boolean;
  selectedHypothesis: string | null;
  profitFormulaDraft: string;
  formulaCompleted: boolean;
  probabilityAllocation: ConsultingProbabilities;
  probabilitySubmitted: boolean;
  revisedProbabilityAllocation: ConsultingProbabilities;
  probabilityRevised: boolean;
  selectedRecommendation: string | null;
  selectedEvidence: string[];
  clientQuestionAnswered: boolean;
  clientAnswer: string | null;
  chatMessages: Array<{ author: "You" | "Maya" | "Leena" | "Dev"; text: string }>;
}

export interface CareerProgress {
  journeyStage: JourneyStage;
  onboarding: OnboardingProgress | null;
  workplace: WorkplaceProgress | null;
  reflection: CareerReflection | null;
  managementConsulting: ManagementConsultingProgress | null;
  managementConsultingReflection: CareerReflection | null;
}

export type ProgressSaveStatus = "saved" | "saving" | "error";

interface ProgressContextValue {
  progress: CareerProgress;
  loading: boolean;
  error: string | null;
  saveStatus: ProgressSaveStatus;
  retryLoad: () => void;
  retrySave: () => Promise<void>;
  saveProgress: (next: CareerProgress) => Promise<void>;
  saveProgressUpdate: (update: (previous: CareerProgress) => CareerProgress) => Promise<void>;
  updateProgress: (update: (previous: CareerProgress) => CareerProgress) => void;
}

const defaultProgress: CareerProgress = {
  journeyStage: "career",
  onboarding: null,
  workplace: null,
  reflection: null,
  managementConsulting: null,
  managementConsultingReflection: null,
};

const ProgressContext = createContext<ProgressContextValue | null>(null);
const CACHE_PREFIX = "perspective-progress-cache:";
interface CachedProgress { savedAt: number; syncState: "pending" | "saved"; progress: CareerProgress }

function readCache(userId: string): CachedProgress | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) as CachedProgress : null;
    return parsed?.progress && typeof parsed.savedAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, progress: CareerProgress, syncState: "pending" | "saved" = "pending") {
  try {
    const previous = readCache(userId);
    const savedAt = Math.max(Date.now(), (previous?.savedAt ?? 0) + 1);
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify({ savedAt, syncState, progress }));
  } catch {
    // Supabase remains the durable store when browser storage is unavailable.
  }
}

function normalizeProgress(value: unknown): CareerProgress {
  if (!value || typeof value !== "object") return { ...defaultProgress };
  const data = value as Partial<CareerProgress>;
  return {
    ...defaultProgress,
    ...data,
    journeyStage: data.journeyStage === "onboarding" || data.journeyStage === "workplace" ? data.journeyStage : "career",
  };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<CareerProgress>(defaultProgress);
  const [loading, setLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<ProgressSaveStatus>("saved");
  const [readyForWrites, setReadyForWrites] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const latestProgress = useRef(progress);
  const lastPersisted = useRef("");
  const pendingSave = useRef<number | null>(null);
  latestProgress.current = progress;

  const writeProgress = useCallback(async (userId: string, value: CareerProgress) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("user_progress").upsert({
      user_id: userId,
      progress: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    const serialized = JSON.stringify(value);
    lastPersisted.current = serialized;
    if (JSON.stringify(latestProgress.current) === serialized) {
      writeCache(userId, value, "saved");
      setSaveStatus("saved");
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(Boolean(user));
    setError(null);
    setReadyForWrites(false);
    if (pendingSave.current !== null) window.clearTimeout(pendingSave.current);
    pendingSave.current = null;

    if (!user) {
      latestProgress.current = defaultProgress;
      setProgress(defaultProgress);
      setLoadedUserId(null);
      setLoading(false);
      setSaveStatus("saved");
      lastPersisted.current = "";
      return () => { active = false; };
    }

    const cached = readCache(user.id);
    const cachedValue = cached ? normalizeProgress(cached.progress) : null;
    latestProgress.current = cachedValue ?? defaultProgress;
    setProgress(cachedValue ?? defaultProgress);

    void (async () => {
      try {
        if (!supabase) throw new Error("Supabase is not configured.");
        const { data, error: loadError } = await supabase
          .from("user_progress")
          .select("progress")
          .eq("user_id", user.id)
          .maybeSingle();
        if (loadError) throw loadError;
        if (!active) return;
        const latestCache = readCache(user.id) ?? cached;
        const latestCachedValue = latestCache ? normalizeProgress(latestCache.progress) : null;
        const cacheIsPending = Boolean(latestCache?.syncState === "pending" && latestCachedValue);
        const loaded = cacheIsPending ? latestCachedValue! : normalizeProgress(data?.progress);
        if (!loaded.reflection) {
          const localReflection = loadCareerReflection();
          let owner: string | null = null;
          try { owner = localStorage.getItem(CAREER_REFLECTION_IMPORT_OWNER_KEY); } catch { /* browser storage optional */ }
          if (localReflection && (!owner || owner === user.id)) {
            loaded.reflection = localReflection;
            try { localStorage.setItem(CAREER_REFLECTION_IMPORT_OWNER_KEY, user.id); } catch { /* import still works in memory */ }
          }
        }
        latestProgress.current = loaded;
        setProgress(loaded);
        setReadyForWrites(true);
        setLoadedUserId(user.id);
        setLoading(false);
        setSaveStatus("saved");
        writeCache(user.id, loaded, cacheIsPending ? "pending" : "saved");
        lastPersisted.current = cacheIsPending ? "" : JSON.stringify(loaded);
        if (cacheIsPending) {
          try { await writeProgress(user.id, loaded); }
          catch { if (active) setSaveStatus("error"); }
        }
      } catch (loadError) {
        if (!active) return;
        if (cachedValue) {
          latestProgress.current = cachedValue;
          setProgress(cachedValue);
          setReadyForWrites(true);
          setLoadedUserId(user.id);
          setLoading(false);
          setSaveStatus("error");
          setError(null);
        } else {
          console.error("Could not load saved career progress.", loadError);
          setProgress(defaultProgress);
          setError("We couldn't load your saved progress from Supabase. Check your Supabase connection and table policies.");
          setLoadedUserId(user.id);
          setLoading(false);
          setSaveStatus("error");
        }
      }
    })();
    return () => { active = false; };
  }, [authLoading, loadAttempt, user, writeProgress]);

  useEffect(() => {
    if (!user) return;
    const cacheKey = `${CACHE_PREFIX}${user.id}`;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== cacheKey || !event.newValue) return;
      const cached = readCache(user.id);
      if (!cached) return;
      latestProgress.current = normalizeProgress(cached.progress);
      setProgress(latestProgress.current);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user]);

  useEffect(() => {
    if (!user || loading || !readyForWrites) return;
    const serialized = JSON.stringify(progress);
    if (serialized === lastPersisted.current) return;
    setSaveStatus("saving");
    pendingSave.current = window.setTimeout(() => {
      pendingSave.current = null;
      void writeProgress(user.id, progress).catch((saveError: unknown) => {
        console.error("Could not save career progress.", saveError);
        if (JSON.stringify(latestProgress.current) === serialized) setSaveStatus("error");
      });
    }, 500);
    return () => {
      if (pendingSave.current !== null) window.clearTimeout(pendingSave.current);
      pendingSave.current = null;
    };
  }, [loading, progress, readyForWrites, user, writeProgress]);

  const saveProgress = useCallback(async (next: CareerProgress) => {
    if (user && !readyForWrites) throw new Error("Saved progress is not loaded yet.");
    latestProgress.current = next;
    setProgress(next);
    if (!user) return;
    writeCache(user.id, next);
    if (pendingSave.current !== null) window.clearTimeout(pendingSave.current);
    pendingSave.current = null;
    setSaveStatus("saving");
    try { await writeProgress(user.id, next); }
    catch (saveError) {
      if (JSON.stringify(latestProgress.current) === JSON.stringify(next)) setSaveStatus("error");
      throw saveError;
    }
  }, [readyForWrites, user, writeProgress]);

  const saveProgressUpdate = useCallback(async (update: (previous: CareerProgress) => CareerProgress) => {
    if (user && !readyForWrites) throw new Error("Saved progress is not loaded yet.");
    const next = update(latestProgress.current);
    latestProgress.current = next;
    setProgress(next);
    if (!user) return;
    writeCache(user.id, next);
    if (pendingSave.current !== null) window.clearTimeout(pendingSave.current);
    pendingSave.current = null;
    setSaveStatus("saving");
    try { await writeProgress(user.id, next); }
    catch (saveError) {
      if (JSON.stringify(latestProgress.current) === JSON.stringify(next)) setSaveStatus("error");
      throw saveError;
    }
  }, [readyForWrites, user, writeProgress]);

  const updateProgress = useCallback((update: (previous: CareerProgress) => CareerProgress) => {
    const next = update(latestProgress.current);
    latestProgress.current = next;
    setProgress(next);
    if (user && readyForWrites) writeCache(user.id, next);
  }, [readyForWrites, user]);

  const retryLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);
  const retrySave = useCallback(async () => {
    if (!user) return;
    if (!readyForWrites) throw new Error("Saved progress is not loaded yet.");
    const snapshot = latestProgress.current;
    setSaveStatus("saving");
    try { await writeProgress(user.id, snapshot); }
    catch (saveError) {
      if (JSON.stringify(latestProgress.current) === JSON.stringify(snapshot)) setSaveStatus("error");
      throw saveError;
    }
  }, [readyForWrites, user, writeProgress]);

  const isLoading = loading || Boolean(user && loadedUserId !== user.id);
  const value = useMemo(
    () => ({ progress, loading: isLoading, error, saveStatus, retryLoad, retrySave, saveProgress, saveProgressUpdate, updateProgress }),
    [error, isLoading, progress, retryLoad, retrySave, saveProgress, saveProgressUpdate, saveStatus, updateProgress],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const value = useContext(ProgressContext);
  if (!value) throw new Error("useProgress must be used inside ProgressProvider.");
  return value;
}
