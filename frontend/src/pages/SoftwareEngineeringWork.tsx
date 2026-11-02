import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowUp, Orbit } from "lucide-react";
import { Link } from "react-router-dom";
import CodeEditor from "../components/CodeEditor";
import AccountStatus from "../components/AccountStatus";
import SarvamVoiceControl from "../components/SarvamVoiceControl";
import { requestAIReply, type AIChatMessage } from "../lib/aiChat";
import { backendFetch } from "../lib/api";
import {
  useProgress,
  type SavedDirectMessages,
  type SavedWorkplaceView,
  type TeamMemberName,
  type TicketTriageChoice,
  type WorkplaceProgress,
} from "../progress/ProgressProvider";
import {
  createEmptyReflection,
  REFLECTION_METRICS,
  type CareerReflection,
  type ReflectionMetricKey,
} from "../utils/careerReflection";

type WorkspaceView = SavedWorkplaceView;
type PullRequestStatus = "not-created" | "in-review" | "merged";
type TicketId = "PAY-142" | "DATA-208" | "API-317" | "PLAT-214";

interface EngineeringTicket {
  id: Exclude<TicketId, "PAY-142">;
  title: string;
  summary: string;
  context: string;
  priority: string;
  category: string;
  fileName: string;
  language: string;
  starterCode: string;
  instruction: string;
  acceptance: string[];
}

const engineeringTickets: EngineeringTicket[] = [
  {
    id: "DATA-208",
    title: "Speed up payment history queries",
    summary: "The payment history page has become slow as the payments table has grown.",
    context: "The current query scans the table to build a recent customer summary. Fix the status filter, return the top two customers by successful payment volume since October 1, and add a composite index so the database can find matching rows without a full scan.",
    priority: "High",
    category: "Database performance",
    fileName: "payment_history.sql",
    language: "sql",
    starterCode: `-- Table: payments(id, customer_id, amount_cents, status, created_at)\n-- Add an index for the filters, then return the top two customer totals.\n\nSELECT customer_id, SUM(amount_cents) AS total_cents\nFROM payments\nWHERE status = 'complete'\n  AND created_at >= '2026-10-01'\nGROUP BY customer_id\nORDER BY total_cents DESC\nLIMIT 2;`,
    instruction: "Write MySQL-compatible SQL to correct the history query and improve its lookup path. The editor runs it against an isolated sample dataset and checks the query plan.",
    acceptance: [
      "Only successful payments from October 1 onward are included.",
      "The two largest customer totals are returned in descending order.",
      "A composite (status, created_at) index is used instead of a table scan.",
    ],
  },
  {
    id: "API-317",
    title: "Fix transaction pagination boundaries",
    summary: "Customers see a missing transaction at the end of every page.",
    context: "The endpoint uses one-based page numbers, but its slice end is off by one. Correct the helper so full pages, the final partial page, and a page beyond the end all behave consistently.",
    priority: "Normal",
    category: "API bug",
    fileName: "pagination.py",
    language: "python",
    starterCode: `def page_items(items, page, page_size):\n    start = (page - 1) * page_size\n    end = start + page_size - 1  # Check the slice boundary\n    return items[start:end]`,
    instruction: "Fix the off-by-one bug in this API helper. Run the checks to verify page 1, page 2, the final partial page, and an out-of-range page.",
    acceptance: [
      "Pages use one-based numbering.",
      "Each full page contains the requested number of items.",
      "The final item is not dropped and a page past the end is empty.",
    ],
  },
  {
    id: "PLAT-214",
    title: "Invalidate stale payment-method pricing",
    summary: "A price update succeeds, but checkout keeps showing the old amount.",
    context: "The pricing service caches payment-method prices. Updates write the new value to the source map but leave the old cache entry in place. Fix the invalidation path so the next read sees the new price without clearing unrelated cache entries.",
    priority: "Normal",
    category: "Caching bug",
    fileName: "pricing_cache.py",
    language: "python",
    starterCode: `cache = {}\n\ndef get_price(method_id, prices):\n    if method_id not in cache:\n        cache[method_id] = prices[method_id]\n    return cache[method_id]\n\ndef update_price(method_id, new_price, prices):\n    prices[method_id] = new_price\n    # Invalidate only this payment method's cached price`,
    instruction: "Fix cache invalidation after a price update. The checks read a price, update it, and verify the next request sees the fresh value.",
    acceptance: [
      "The source price is updated.",
      "A cached value for the updated method is invalidated.",
      "Other payment-method cache entries remain untouched.",
    ],
  },
];

interface TeammateMessage {
  author: "You" | "Priya";
  text: string;
}

async function requestSarvamTeammateReply(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  checksPassed: boolean,
  pullRequestStatus: PullRequestStatus,
  persona: string,
  role: string,
  context: Record<string, string>,
): Promise<string> {
  const response = await backendFetch("/workplace/teammate/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, checks_passed: checksPassed, pull_request_status: pullRequestStatus, persona, role, context }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail ?? "Sarvam could not reply.");
  return result.reply as string;
}

const teamMembers: Array<{
  initial: string;
  name: TeamMemberName;
  role: string;
  detail: string;
}> = [
  {
    initial: "P",
    name: "Priya",
    role: "Backend Engineer",
    detail: "Builds the payment services customers rely on every day.",
  },
  {
    initial: "A",
    name: "Arjun",
    role: "Senior Engineer",
    detail: "Helps shape the backend architecture and keeps services reliable.",
  },
  {
    initial: "M",
    name: "Maya",
    role: "Engineering Manager",
    detail: "Leads Payments Engineering and connects the team’s work to customer needs.",
  },
];

const teamWelcomeMessages = [
  {
    teammate: "Maya" as const,
    message: "Welcome to NovaPay! We help people and businesses accept and send payments online. Payments Engineering builds the services that make those transactions work safely and reliably. We’re glad you’re joining us.",
  },
  {
    teammate: "Arjun" as const,
    message: "A quick architecture tour: requests enter through an API route, payment rules live in the service layer, and payment records are stored for later tracking. We keep those pieces separate so they’re easier to maintain and test. In this repo, routes.py and payments.py show the main path.",
  },
  {
    teammate: "Priya" as const,
    message: "Customers use NovaPay to pay for things online and expect the charge to happen once. If a connection times out, they might retry. We need the service to recognize that retry and avoid charging them twice—that’s a small piece of work with a real customer impact.",
  },
];

const teamMeetingUpdates = [
  {
    teammate: "Priya" as const,
    heading: "Payment retries",
    message: "Yesterday I reviewed what happens when a customer’s payment request times out. They may retry, so we need to make sure the same request can’t create a second charge. PAY-142 is ready for that fix.",
  },
  {
    teammate: "Arjun" as const,
    heading: "Service structure",
    message: "I traced the request path for the ticket. It comes through routes.py, then create_payment in payments.py handles the payment logic. Keep the change there, and make sure a different key or no key still creates a new payment as expected.",
  },
  {
    teammate: "Maya" as const,
    heading: "Your first assignment",
    message: "Thanks for the updates. Aman, I’m assigning PAY-142 to you: add idempotency protection to payment creation so a retry with the same key returns the original payment. Please keep the existing behavior for new keys and requests without a key, and use the tests to check all three cases. Welcome to the team—we’re here if you need help.",
  },
];

const defaultDirectMessages: SavedDirectMessages = {
  Priya: [{ author: "Priya", text: "Welcome to Payments Engineering! Glad you’re here. PAY-142 is your first ticket; message me if you want to talk through anything." }],
  Arjun: [{ author: "Arjun", text: "Welcome aboard. I’m Arjun, one of the senior engineers. I’m happy to help you find your way around the service." }],
  Maya: [{ author: "Maya", text: "Welcome to the team! I’m Maya, the engineering manager. Take your time with the first ticket and reach out if you need context." }],
};

function getPriyaReply(
  question: string,
  checksPassed: boolean,
  pullRequestStatus: PullRequestStatus,
) {
  const normalized = question.toLowerCase();

  if (/idempot|same key|retry|duplicate/.test(normalized)) {
    return "An idempotency key identifies one payment attempt. Save the payment against that key, then return the saved payment when the same key comes back. A different key is a new attempt; requests without a key should keep creating payments as they do now.";
  }

  if (/test|check|where.*(test|assert)/.test(normalized)) {
    return checksPassed
      ? "The PAY-142 checks are passing now. They cover a repeated key, a different key, and requests without a key. The existing test_payments.py file shows the team's test style."
      : "Start with test_payments.py to see the existing expectations. In the workspace, Run checks exercises the retry cases from the ticket and tells you which behavior still needs work.";
  }

  if (/git|commit|push|branch|pull request|\bpr\b/.test(normalized)) {
    if (pullRequestStatus === "merged") {
      return "PAY-142 is merged. Nice work taking it from the failing behavior through tests, a commit, and review.";
    }
    if (pullRequestStatus === "in-review") {
      return "Your change is pushed and PR #31 is open. I reviewed the retry behavior and approved it; you can merge it from the pull request panel.";
    }
    return checksPassed
      ? "The checks are green. Run the Git workflow one command at a time: create a branch, stage payments.py, commit with a PAY-142- description, push, then use gh pr create --fill."
      : "First get the PAY-142 checks passing. Then the workspace will guide you through branching, staging, committing with a PAY-142- description, pushing, and opening a PR.";
  }

  if (/route|endpoint|request|where.*start|where.*look/.test(normalized)) {
    return "I’d trace the request from routes.py into create_payment in payments.py. The handler is where request details enter; the service function is where we decide whether to reuse or create a payment.";
  }

  return "I can help with PAY-142. What have you tried so far? You can describe the behavior you’re seeing, or trace the request from routes.py into payments.py and tell me where you got stuck.";
}

const repositoryFiles = [
  {
    name: "payments.py",
    description: "Creates payment records and returns their status. Each call currently creates a new payment, even when a request is retried.",
    code: `_payments = []
_next_payment_id = 1

def create_payment(customer_id, amount, idempotency_key=None):
    global _next_payment_id

    payment = {
        "id": f"pay_{_next_payment_id:04d}",
        "customer_id": customer_id,
        "amount": amount,
        "status": "pending",
    }
    _payments.append(payment)
    _next_payment_id += 1
    return payment`,
  },
  {
    name: "routes.py",
    description: "Connects incoming API requests to payment service functions.",
    code: `@app.post("/payments")
def create_payment_route(request):
    return create_payment(
        request.customer_id,
        request.amount,
        request.idempotency_key,
    )`,
  },
  {
    name: "test_payments.py",
    description: "Covers payment creation, safe retries, separate requests, and requests without an idempotency key.",
    code: `def test_create_payment_returns_pending_payment():
    payment = create_payment("cus_123", 25.00)

    assert payment["status"] == "pending"
    assert payment["amount"] == 25.00


def test_retry_with_same_key_returns_original_payment():
    first = create_payment("cus_123", 25.00, "checkout-123")
    retry = create_payment("cus_123", 25.00, "checkout-123")

    assert retry == first


def test_different_key_creates_a_separate_payment():
    first = create_payment("cus_123", 25.00, "checkout-123")
    second = create_payment("cus_123", 25.00, "checkout-456")

    assert second["id"] != first["id"]


def test_requests_without_key_still_create_payments():
    first = create_payment("cus_123", 25.00)
    second = create_payment("cus_123", 25.00)

    assert second["id"] != first["id"]`,
  },
];

const ticketTriageOptions: Array<{
  id: TicketTriageChoice;
  title: string;
  fileName: string;
  description: string;
  guidance: string;
}> = [
  {
    id: "route",
    title: "Trace the request",
    fileName: "routes.py",
    description: "See how a customer request reaches the payment service.",
    guidance: "Following the route into create_payment() shows where the request enters and where the business logic begins.",
  },
  {
    id: "service",
    title: "Inspect payment logic",
    fileName: "payments.py",
    description: "Start where payment records are created.",
    guidance: "This is the service function PAY-142 changes. Compare its current behavior with the ticket before editing.",
  },
  {
    id: "tests",
    title: "Read the existing tests",
    fileName: "test_payments.py",
    description: "Learn what the service already promises to do.",
    guidance: "Existing tests show the team’s expectations. Check what they cover before deciding which retry cases need protection.",
  },
];

function SoftwareEngineeringWork() {
  const { progress, updateProgress, saveProgress, saveProgressUpdate } = useProgress();
  const savedWorkplace = progress.workplace;
  const [activeTicketId, setActiveTicketId] = useState<TicketId>(
    (savedWorkplace?.activeTicketId as TicketId | undefined) ?? "PAY-142",
  );
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, string>>(
    savedWorkplace?.ticketDrafts ?? {},
  );
  const [ticketOutputs, setTicketOutputs] = useState<Record<string, string>>(
    savedWorkplace?.ticketOutputs ?? {},
  );
  const [completedTickets, setCompletedTickets] = useState<string[]>(
    savedWorkplace?.completedTickets ?? [],
  );
  const [ticketChatMessages, setTicketChatMessages] = useState<Record<string, AIChatMessage[]>>(
    savedWorkplace?.ticketChatMessages ?? {},
  );
  const [ticketChatDraft, setTicketChatDraft] = useState("");
  const [ticketChatProvider, setTicketChatProvider] = useState<"gemini" | "sarvam">("gemini");
  const [isTicketChatReplying, setIsTicketChatReplying] = useState(false);
  const [ticketTriageChoice, setTicketTriageChoice] = useState<TicketTriageChoice | null>(
    savedWorkplace?.ticketTriageChoice ?? null,
  );
  const savedFile = repositoryFiles.find(
    (file) => file.name === savedWorkplace?.selectedFileName,
  ) ?? repositoryFiles[0];
  const [view, setView] = useState<WorkspaceView>(
    ticketTriageChoice === null && savedWorkplace?.pullRequestStatus !== "merged"
      ? "ticket"
      : savedWorkplace?.view ?? "ticket",
  );
  const [selectedFile, setSelectedFile] = useState(savedFile);
  const [paymentCode, setPaymentCode] = useState(
    savedWorkplace?.paymentCode ?? repositoryFiles[0].code,
  );
  const [isChecking, setIsChecking] = useState(false);
  const [checkOutput, setCheckOutput] = useState(savedWorkplace?.checkOutput ?? "");
  const [checksPassed, setChecksPassed] = useState(savedWorkplace?.checksPassed ?? false);
  const [pullRequestStatus, setPullRequestStatus] =
    useState<PullRequestStatus>(savedWorkplace?.pullRequestStatus ?? "not-created");
  const ticketTriageRequired =
    activeTicketId === "PAY-142" && ticketTriageChoice === null && pullRequestStatus !== "merged";
  const [gitStep, setGitStep] = useState(savedWorkplace?.gitStep ?? 0);
  const [gitCommand, setGitCommand] = useState(savedWorkplace?.gitCommand ?? "");
  const [commitMessage, setCommitMessage] = useState(savedWorkplace?.commitMessage ?? "");
  const [isRunningGit, setIsRunningGit] = useState(false);
  const [gitOutput, setGitOutput] = useState(savedWorkplace?.gitOutput ?? "");
  const [teammateQuestion, setTeammateQuestion] = useState("");
  const [isTeammateReplying, setIsTeammateReplying] = useState(false);
  const [teammateMessages, setTeammateMessages] = useState<TeammateMessage[]>(savedWorkplace?.teammateMessages ?? [
    {
      author: "Priya",
      text: "Hey, I saw PAY-142 is assigned to you. The request handler is in routes.py, and the payment creation logic is in payments.py. Let me know where you want a hand.",
    },
  ]);
  const [directMessages, setDirectMessages] = useState<SavedDirectMessages>(
    savedWorkplace?.directMessages ?? defaultDirectMessages,
  );
  const [teamWelcomeStep, setTeamWelcomeStep] = useState(
    savedWorkplace?.teamWelcomeVersion === 1
      ? Math.min(savedWorkplace.teamWelcomeStep ?? 0, teamWelcomeMessages.length)
      : 0,
  );
  const [teamWelcomeCompleted, setTeamWelcomeCompleted] = useState(
    savedWorkplace?.teamWelcomeVersion === 1 && savedWorkplace.teamWelcomeCompleted === true,
  );
  const [teamMeetingStep, setTeamMeetingStep] = useState(
    savedWorkplace?.teamWelcomeVersion === 1 && savedWorkplace?.teamMeetingVersion === 2
      ? Math.min(savedWorkplace.teamMeetingStep ?? 0, teamMeetingUpdates.length)
      : 0,
  );
  const [teamMeetingCompleted, setTeamMeetingCompleted] = useState(
    savedWorkplace?.teamWelcomeVersion === 1 && savedWorkplace.teamMeetingVersion === 2 && savedWorkplace.teamMeetingCompleted === true,
  );
  const [teamCallAccepted, setTeamCallAccepted] = useState(
    savedWorkplace?.teamWelcomeVersion === 1 && savedWorkplace.teamMeetingVersion === 2 && savedWorkplace.teamCallAccepted === true,
  );
  const [directMessageDraft, setDirectMessageDraft] = useState("");
  const [isDirectReplying, setIsDirectReplying] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reflection, setReflection] = useState<CareerReflection>(
    () => progress.reflection ?? createEmptyReflection(),
  );
  const [reflectionSaved, setReflectionSaved] = useState(
    () => progress.reflection !== null,
  );
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [reflectionSaveError, setReflectionSaveError] = useState("");
  const selectedTeammate = teamMembers.find(
    (member) => `dm-${member.name.toLowerCase()}` === view,
  );
  const mayaVoiceHistory = directMessages.Maya ?? defaultDirectMessages.Maya;
  const selectedTriageOption = ticketTriageOptions.find(
    (option) => option.id === ticketTriageChoice,
  );
  const activeAdditionalTicket = engineeringTickets.find((ticket) => ticket.id === activeTicketId);
  const activeTicketCode = activeTicketId === "PAY-142"
    ? paymentCode
    : ticketDrafts[activeTicketId] ?? activeAdditionalTicket?.starterCode ?? "";
  const activeTicketTitle = activeAdditionalTicket?.title ?? "Add idempotency protection to payment creation";
  const activeTicketBrief = activeAdditionalTicket?.context ?? "A retry with the same key should return the original payment; new or missing keys create a new payment.";
  const activeTicketChatMessages = ticketChatMessages[activeTicketId] ?? [];
  const ticketChatVisible = view === "ticket" || view === "repository";

  const buildWorkplaceProgress = (
    overrides: Partial<WorkplaceProgress> = {},
  ): WorkplaceProgress => ({
    view,
    activeTicketId,
    ticketDrafts,
    ticketOutputs,
    completedTickets,
    ticketChatMessages,
    selectedFileName: selectedFile.name,
    paymentCode,
    checkOutput,
    checksPassed,
    pullRequestStatus,
    gitStep,
    gitCommand,
    commitMessage,
    gitOutput,
    teammateMessages,
    directMessages,
    ticketTriageChoice: ticketTriageChoice ?? undefined,
    teamWelcomeStep,
    teamWelcomeCompleted,
    teamWelcomeVersion: 1,
    teamMeetingStep,
    teamMeetingCompleted,
    teamCallAccepted,
    teamMeetingVersion: 2,
    ...overrides,
  });

  const persistWorkplaceMessages = (patch: Partial<WorkplaceProgress>) =>
    saveProgressUpdate((previous) => ({
      ...previous,
      journeyStage: "workplace",
      workplace: {
        ...(previous.workplace ?? buildWorkplaceProgress()),
        ...patch,
      },
    }));

  const saveActiveTicketChat = (ticketId: TicketId, messages: AIChatMessage[]) => {
    setTicketChatMessages((previous) => ({ ...previous, [ticketId]: messages }));
    void saveProgressUpdate((previous) => ({
      ...previous,
      journeyStage: "workplace",
      workplace: {
        ...(previous.workplace ?? buildWorkplaceProgress()),
        ticketChatMessages: {
          ...(previous.workplace?.ticketChatMessages ?? ticketChatMessages),
          [ticketId]: messages,
        },
      },
    })).catch((saveError: unknown) => console.error("Could not save the ticket help conversation.", saveError));
  };

  const askOrbitAboutTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = ticketChatDraft.trim();
    if (!question || isTicketChatReplying) return;

    const ticketId = activeTicketId;
    const messagesBefore = ticketChatMessages[ticketId] ?? [];
    const messagesAfterUser: AIChatMessage[] = [...messagesBefore, { role: "user", content: question }];
    saveActiveTicketChat(ticketId, messagesAfterUser);
    setTicketChatDraft("");
    setIsTicketChatReplying(true);
    try {
      const reply = await requestAIReply({
        mode: "teammate",
        provider: ticketChatProvider,
        message: question,
        history: messagesBefore.slice(-8),
        persona: "ORBIT",
        role: "Software Engineering Guide",
        context: {
          ticketId,
          ticketTitle: activeTicketTitle,
          ticketBrief: activeTicketBrief,
          currentCode: activeTicketCode,
          fileName: activeAdditionalTicket?.fileName ?? selectedFile.name,
          checkOutput: ticketOutputs[activeTicketId] ?? checkOutput,
          checksPassed: String(completedTickets.includes(ticketId) || (ticketId === "PAY-142" && checksPassed)),
          acceptanceCriteria: activeAdditionalTicket?.acceptance.join("; ") ?? "Same key returns the original payment; a new or missing key creates a payment.",
        },
      });
      saveActiveTicketChat(ticketId, [...messagesAfterUser, { role: "assistant", content: reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ORBIT couldn't reply just now. Try again in a moment.";
      saveActiveTicketChat(ticketId, [...messagesAfterUser, { role: "assistant", content: message }]);
    } finally {
      setIsTicketChatReplying(false);
    }
  };

  const mergePullRequest = () => {
    setPullRequestStatus("merged");
    const mergedProgress = {
      ...progress,
      journeyStage: "workplace" as const,
      workplace: buildWorkplaceProgress({ pullRequestStatus: "merged" }),
    };
    void saveProgress(mergedProgress).catch((saveError: unknown) => {
      console.error("Could not save the completed workplace task.", saveError);
    });
  };

  useEffect(() => {
    updateProgress((previous) => ({
      ...previous,
      journeyStage: "workplace",
      workplace: buildWorkplaceProgress(),
    }));
  }, [
    view,
    activeTicketId,
    ticketDrafts,
    ticketOutputs,
    completedTickets,
    ticketChatMessages,
    selectedFile.name,
    paymentCode,
    checkOutput,
    checksPassed,
    pullRequestStatus,
    gitStep,
    gitCommand,
    commitMessage,
    gitOutput,
    teammateMessages,
    directMessages,
    ticketTriageChoice,
    teamWelcomeStep,
    teamWelcomeCompleted,
    teamMeetingStep,
    teamMeetingCompleted,
    teamCallAccepted,
    updateProgress,
  ]);

  const startTicketTriage = (choice: TicketTriageChoice) => {
    const option = ticketTriageOptions.find((item) => item.id === choice);
    if (!option) return;
    const file = repositoryFiles.find((item) => item.name === option.fileName);
    if (!file) return;
    setTicketTriageChoice(choice);
    setSelectedFile(file);
    setCheckOutput("");
    setView("repository");
    void saveProgress({
      ...progress,
      journeyStage: "workplace",
      workplace: buildWorkplaceProgress({
        view: "repository",
        selectedFileName: file.name,
        checkOutput: "",
        ticketTriageChoice: choice,
      }),
    }).catch((saveError: unknown) => {
      console.error("Could not save the PAY-142 investigation starting point.", saveError);
    });
  };

  const selectEngineeringTicket = (ticketId: TicketId) => {
    setActiveTicketId(ticketId);
    setView("ticket");
  };

  const updateActiveTicketCode = (value: string) => {
    if (activeTicketId === "PAY-142") {
      updatePaymentCode(value);
      return;
    }
    setTicketDrafts((previous) => ({ ...previous, [activeTicketId]: value }));
    setTicketOutputs((previous) => ({ ...previous, [activeTicketId]: "" }));
    setCompletedTickets((previous) => previous.filter((ticketId) => ticketId !== activeTicketId));
    setCheckOutput("");
  };

  const acknowledgeTeamWelcome = () => {
    const nextStep = Math.min(teamWelcomeStep + 1, teamWelcomeMessages.length);
    setTeamWelcomeStep(nextStep);
    const completesWelcome = nextStep === teamWelcomeMessages.length;
    if (completesWelcome) setTeamWelcomeCompleted(true);
    void saveProgress({
      ...progress,
      journeyStage: "workplace",
      workplace: buildWorkplaceProgress({
        teamWelcomeStep: nextStep,
        teamWelcomeCompleted: completesWelcome,
        teamWelcomeVersion: 1,
      }),
    }).catch((saveError: unknown) => {
      console.error("Could not save the team introduction progress.", saveError);
    });
  };

  const acceptTeamCall = () => {
    setTeamCallAccepted(true);
    setTeamMeetingCompleted(false);
    setTeamMeetingStep(0);
    void saveProgress({
      ...progress,
      journeyStage: "workplace",
      workplace: buildWorkplaceProgress({
        teamCallAccepted: true,
        teamMeetingCompleted: false,
        teamMeetingStep: 0,
        teamMeetingVersion: 2,
      }),
    }).catch((saveError: unknown) => {
      console.error("Could not save the team meeting invitation.", saveError);
    });
  };

  const acknowledgeMeetingUpdate = () => {
    const nextStep = Math.min(teamMeetingStep + 1, teamMeetingUpdates.length);
    setTeamMeetingStep(nextStep);
    void saveProgress({
      ...progress,
      journeyStage: "workplace",
      workplace: buildWorkplaceProgress({ teamMeetingStep: nextStep }),
    }).catch((saveError: unknown) => {
      console.error("Could not save the team meeting progress.", saveError);
    });
  };

  const openAssignedTicket = () => {
    setTeamMeetingCompleted(true);
    setView("ticket");
    void saveProgress({
      ...progress,
      journeyStage: "workplace",
      workplace: buildWorkplaceProgress({
        view: "ticket",
        teamMeetingStep: teamMeetingUpdates.length,
        teamMeetingCompleted: true,
        teamMeetingVersion: 2,
      }),
    }).catch((saveError: unknown) => {
      console.error("Could not save the meeting completion checkpoint.", saveError);
    });
  };

  const sendDirectMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTeammate) return;
    const text = directMessageDraft.trim();
    if (!text) return;
    const previousMessages = directMessages[selectedTeammate.name] ?? defaultDirectMessages[selectedTeammate.name];
    const history = previousMessages.slice(-8).map((message) => ({
      role: message.author === "You" ? "user" as const : "assistant" as const,
      content: message.text,
    }));
    const messagesAfterUser = [...previousMessages, { author: "You" as const, text }];
    setDirectMessages((previous) => ({
      ...previous,
      [selectedTeammate.name]: messagesAfterUser,
    }));
    void persistWorkplaceMessages({
      directMessages: { ...directMessages, [selectedTeammate.name]: messagesAfterUser },
    }).catch((saveError: unknown) => console.error("Could not save your teammate message.", saveError));
    setDirectMessageDraft("");
    setIsDirectReplying(true);
    try {
      const reply = await requestSarvamTeammateReply(
        text, history, checksPassed, pullRequestStatus,
        selectedTeammate.name, selectedTeammate.role,
        {
          ticketId: activeTicketId, ticketTitle: activeTicketTitle, ticketBrief: activeTicketBrief,
          fileName: activeAdditionalTicket?.fileName ?? selectedFile.name,
          fileContent: selectedFile.code, checkOutput: ticketOutputs[activeTicketId] ?? checkOutput,
          paymentCode, currentCode: activeTicketCode,
        },
      );
      const nextMessages = [...messagesAfterUser, { author: selectedTeammate.name, text: reply }];
      setDirectMessages((previous) => ({
        ...previous,
        [selectedTeammate.name]: nextMessages,
      }));
      void persistWorkplaceMessages({
        directMessages: { ...directMessages, [selectedTeammate.name]: nextMessages },
      }).catch((saveError: unknown) => console.error("Could not save the teammate reply.", saveError));
    } catch (error) {
      const statusMessage = error instanceof Error ? error.message : "Sarvam is temporarily unavailable. Please try again.";
      const nextMessages = [...messagesAfterUser, { author: selectedTeammate.name, text: statusMessage }];
      setDirectMessages((previous) => ({
        ...previous,
        [selectedTeammate.name]: nextMessages,
      }));
      void persistWorkplaceMessages({
        directMessages: { ...directMessages, [selectedTeammate.name]: nextMessages },
      }).catch((saveError: unknown) => console.error("Could not save the teammate reply.", saveError));
    } finally {
      setIsDirectReplying(false);
    }
  };

  const startVoiceMessage = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceStatus("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) voiceChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void sendVoiceMessage(new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
      setVoiceStatus("Recording… select Stop when you’re done speaking (25 seconds max).");
      voiceTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          setIsRecordingVoice(false);
          setVoiceStatus("Recording limit reached. Sending to your teammate…");
        }
      }, 25_000);
    } catch {
      setVoiceStatus("Microphone access was blocked. Allow microphone access and try again.");
    }
  };

  const stopVoiceMessage = () => {
    if (recorderRef.current?.state === "recording") {
      if (voiceTimerRef.current) clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
      recorderRef.current.stop();
      setIsRecordingVoice(false);
      setVoiceStatus(`${selectedTeammate?.name ?? "Your teammate"} is listening…`);
    }
  };

  const sendVoiceMessage = async (audio: Blob) => {
    if (!selectedTeammate) return;
    const teammateName = selectedTeammate.name;
    const previousMessages = directMessages[teammateName] ?? defaultDirectMessages[teammateName];
    const history = previousMessages.slice(-8).map((message) => ({ role: message.author === "You" ? "user" : "assistant", content: message.text }));
    setIsDirectReplying(true);
    try {
      const body = new FormData();
      const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      body.append("audio", audio, `voice.${extension}`);
      body.append("history", JSON.stringify(history));
      body.append("checks_passed", String(checksPassed));
      body.append("pull_request_status", pullRequestStatus);
      body.append("persona", selectedTeammate.name);
      body.append("context", JSON.stringify({
        ticketId: activeTicketId, ticketTitle: activeTicketTitle, ticketBrief: activeTicketBrief,
        fileName: activeAdditionalTicket?.fileName ?? selectedFile.name,
        fileContent: selectedFile.code, checkOutput: ticketOutputs[activeTicketId] ?? checkOutput,
        paymentCode, currentCode: activeTicketCode,
      }));
      const response = await backendFetch("/workplace/teammate/voice", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Voice message failed.");
      const afterUser = [...previousMessages, { author: "You" as const, text: result.transcript }];
      const nextMessages = [...afterUser, { author: teammateName, text: result.reply }];
      setDirectMessages((previous) => ({ ...previous, [teammateName]: nextMessages }));
      void persistWorkplaceMessages({ directMessages: { ...directMessages, [teammateName]: nextMessages } })
        .catch((saveError: unknown) => console.error("Could not save the voice conversation.", saveError));
      if (result.audio) {
        const binary = atob(result.audio as string);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const audioUrl = URL.createObjectURL(new Blob([bytes], { type: result.audio_mime_type || "audio/wav" }));
        const playback = new Audio(audioUrl);
        playback.onended = () => URL.revokeObjectURL(audioUrl);
        void playback.play();
      }
      setVoiceStatus(`Heard (${result.language_code}): ${result.transcript}${result.spoken_language_code ? ` · reply voice ${result.spoken_language_code}` : " · text reply received"}`);
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : "Could not send the voice message.");
    } finally {
      setIsDirectReplying(false);
    }
  };

  const updatePaymentCode = (value: string) => {
    setPaymentCode(value);
    setCheckOutput("");
    setChecksPassed(false);
    setPullRequestStatus("not-created");
    setGitStep(0);
    setGitCommand("");
    setCommitMessage("");
    setGitOutput("");
  };

  const runGitCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = gitCommand.trim();
    if (!command || isRunningGit || pullRequestStatus !== "not-created") return;

    setIsRunningGit(true);

    try {
      const response = await backendFetch("/workplace/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, step: gitStep }),
      });
      const result = await response.json();
      const commandResult = result.stdout || result.stderr || "No command output.";
      setGitOutput((previous) =>
        [previous, `$ ${command}`, commandResult].filter(Boolean).join("\n"),
      );
      if (result.accepted) {
        setGitStep(result.next_step);
        setGitCommand("");
      }
      if (result.commit_message) setCommitMessage(result.commit_message);
      if (result.complete) setPullRequestStatus("in-review");
    } catch {
      setGitOutput((previous) =>
        [previous, `$ ${command}`, "Could not connect to the Perspective backend."]
          .filter(Boolean)
          .join("\n"),
      );
    } finally {
      setIsRunningGit(false);
    }
  };

  const runChecks = async () => {
    setIsChecking(true);
    const ticketId = activeTicketId;
    if (ticketId === "PAY-142") {
      setCheckOutput("Running PAY-142 checks...");
      setChecksPassed(false);
    } else {
      setTicketOutputs((previous) => ({ ...previous, [ticketId]: "Running checks…" }));
    }

    try {
      const response = await backendFetch("/workplace/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeTicketCode, ticket_id: ticketId }),
      });
      const result = await response.json();
      const output = result.stdout || result.stderr || "Checks did not pass.";
      if (ticketId === "PAY-142") {
        setChecksPassed(result.success);
        setCheckOutput(output);
      } else {
        setTicketOutputs((previous) => ({ ...previous, [ticketId]: output }));
        if (result.success) {
          setCompletedTickets((previous) => previous.includes(ticketId) ? previous : [...previous, ticketId]);
        }
      }
    } catch {
      if (ticketId === "PAY-142") setCheckOutput("Could not connect to the Perspective backend.");
      else setTicketOutputs((previous) => ({ ...previous, [ticketId]: "Could not connect to the Perspective backend." }));
    } finally {
      setIsChecking(false);
    }
  };

  const askPriya = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = teammateQuestion.trim();
    if (!question) return;

    const history = teammateMessages.slice(-8).map((message) => ({
      role: message.author === "You" ? "user" as const : "assistant" as const,
      content: message.text,
    }));
    const messagesAfterUser = [...teammateMessages, { author: "You" as const, text: question }];
    setTeammateMessages(messagesAfterUser);
    void persistWorkplaceMessages({ teammateMessages: messagesAfterUser })
      .catch((saveError: unknown) => console.error("Could not save your message to Priya.", saveError));
    setTeammateQuestion("");
    setIsTeammateReplying(true);
    try {
      const reply = await requestAIReply({
        mode: "teammate", message: question, history,
        persona: "Priya", role: "Backend Engineer",
        context: {
          ticketId: activeTicketId, ticketTitle: activeTicketTitle, ticketBrief: activeTicketBrief,
          checksPassed: String(checksPassed), pullRequestStatus,
          fileName: activeAdditionalTicket?.fileName ?? selectedFile.name,
          fileContent: selectedFile.code,
          checkOutput: ticketOutputs[activeTicketId] ?? checkOutput,
          paymentCode, currentCode: activeTicketCode,
        },
      });
      const nextMessages = [...messagesAfterUser, { author: "Priya" as const, text: reply }];
      setTeammateMessages(nextMessages);
      void persistWorkplaceMessages({ teammateMessages: nextMessages })
        .catch((saveError: unknown) => console.error("Could not save Priya's reply.", saveError));
    } catch {
      const fallback = activeAdditionalTicket
        ? `I’m having trouble reaching the team service. For ${activeAdditionalTicket.id}, start by checking this behavior: ${activeAdditionalTicket.context}`
        : getPriyaReply(question, checksPassed, pullRequestStatus);
      const nextMessages = [...messagesAfterUser, { author: "Priya" as const, text: fallback }];
      setTeammateMessages(nextMessages);
      void persistWorkplaceMessages({ teammateMessages: nextMessages })
        .catch((saveError: unknown) => console.error("Could not save Priya's reply.", saveError));
    } finally {
      setIsTeammateReplying(false);
    }
  };

  const appendVoiceMeetingExchange = (transcript: string, reply: string) => {
    const messages = [
      ...mayaVoiceHistory,
      { author: "You" as const, text: transcript },
      { author: "Maya" as const, text: reply },
    ];
    setDirectMessages((previous) => ({ ...previous, Maya: messages }));
    void persistWorkplaceMessages({ directMessages: { ...directMessages, Maya: messages } })
      .catch((saveError: unknown) => console.error("Could not save the standup voice exchange.", saveError));
  };

  const saveReflection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const savedReflection = { ...reflection, savedAt: new Date().toISOString() };
    setReflection(savedReflection);
    setIsSavingReflection(true);
    setReflectionSaveError("");
    try {
      await saveProgress({ ...progress, journeyStage: "workplace", reflection: savedReflection });
      setReflectionSaved(true);
    } catch {
      setReflectionSaveError("Your reflection could not sync. Check your connection and save again.");
    } finally {
      setIsSavingReflection(false);
    }
  };

  const updateReflectionMetric = (key: ReflectionMetricKey, value: number) => {
    setReflection((previous) => ({
      ...previous,
      metrics: { ...previous.metrics, [key]: value },
    }));
    setReflectionSaved(false);
  };

  if (!teamCallAccepted && !teamMeetingCompleted) {
    return (
      <main className="workplace-page incoming-call-page">
        <header className="workplace-topbar">
          <Link className="workplace-brand" to="/">perspective</Link>
          <span className="workplace-divider" />
          <strong className="company-name">NovaPay</strong>
          <span className="team-name">Payments Engineering</span>
          <span className="project-home-label">PROJECT HOME</span>
          <AccountStatus />
        </header>
        <div className="workplace-layout">
          <aside className="workplace-rail" aria-label="Workspace navigation">
            <p className="workplace-rail-label">WORKSPACE</p>
            <div className="project-rail-item active"><span className="rail-icon">H</span>Project home</div>
            <div className="project-rail-item"><span className="rail-icon">T</span>Your first task <span className="rail-lock">After standup</span></div>
            <div className="project-rail-item"><span className="rail-icon">R</span>Repository</div>
            <div className="project-rail-item"><span className="rail-icon">#</span>#engineering</div>
            <div className="workplace-rail-spacer" />
            <div className="team-presence"><span className="presence-dot" /><span>Team online</span></div>
          </aside>
          <section className="workplace-main project-home-main">
            <div className="workplace-welcome">
              <p className="eyebrow">YOUR FIRST DAY · NOVAPAY</p>
              <h1>Welcome to Payments Engineering.</h1>
              <p>
                NovaPay helps people and businesses move money online. Your team builds the services that accept payment requests, apply the payment rules, and keep each transaction on track.
              </p>
            </div>
            <section className="project-home-overview">
              <div className="project-home-overview-heading">
                <div><p className="eyebrow">THE PRODUCT</p><h2>Payments people can count on</h2></div>
                <span>NovaPay · Payments Engineering</span>
              </div>
              <div className="payment-flow-overview" aria-label="How a payment flows through the service">
                <div><span>01</span><strong>Customer pays</strong><small>A payment request is sent</small></div>
                <b aria-hidden="true">→</b>
                <div><span>02</span><strong>Service processes</strong><small>Rules handle the request</small></div>
                <b aria-hidden="true">→</b>
                <div><span>03</span><strong>Payment is tracked</strong><small>The result is recorded</small></div>
              </div>
              <div className="project-home-next-step">
                <div className="project-next-step-icon">01</div>
                <div><span>UP NEXT</span><strong>{teamWelcomeCompleted ? "Team standup" : "Meet your team"}</strong><p>{teamWelcomeCompleted ? "Join the team call to hear updates and receive your first assignment from Maya." : "Maya, Arjun, and Priya will introduce the team, its architecture, and the customers you support."}</p></div>
                <span className="project-step-status">{teamWelcomeCompleted ? "Call incoming" : `${Math.min(teamWelcomeStep + 1, teamWelcomeMessages.length)} of ${teamWelcomeMessages.length}`}</span>
              </div>
            </section>
            <section className="project-team-intro" aria-labelledby="project-team-intro-title">
              <header className="project-team-intro-header">
                <div><p className="eyebrow">A QUICK HELLO</p><h2 id="project-team-intro-title">Meet your team</h2></div>
                <span>{Math.min(teamWelcomeStep + 1, teamWelcomeMessages.length)} / {teamWelcomeMessages.length}</span>
              </header>
              <div className="project-team-intro-thread" aria-live="polite">
                {teamWelcomeMessages.slice(0, Math.min(teamWelcomeStep + 1, teamWelcomeMessages.length)).map((intro, index) => {
                  const member = teamMembers.find((person) => person.name === intro.teammate)!;
                  return (
                    <div className="project-team-intro-exchange" key={intro.teammate}>
                      <article className="project-team-intro-message">
                        <span className={`team-member-avatar avatar-${member.initial.toLowerCase()}`} aria-hidden="true">{member.initial}</span>
                        <div><div><strong>{member.name}</strong><span>{member.role}</span></div><p>{intro.message}</p></div>
                      </article>
                      {index < teamWelcomeStep && <div className="project-team-intro-ack"><span>A</span><div><strong>You</strong><p>Okay, got it.</p></div></div>}
                    </div>
                  );
                })}
              </div>
              <footer className="project-team-intro-footer">
                {teamWelcomeStep < teamWelcomeMessages.length ? (
                  <><span>Next: {teamWelcomeMessages[teamWelcomeStep + 1]?.teammate ?? "join the team call"}</span><button type="button" onClick={acknowledgeTeamWelcome}>Okay, got it <span aria-hidden="true">→</span></button></>
                ) : (
                  <span className="project-team-intro-complete" role="status">You’re introduced. Maya’s call invite is here.</span>
                )}
              </footer>
            </section>
          </section>
        </div>

        {teamWelcomeCompleted && (
        <div className="team-call-backdrop">
          <section className="team-call-dialog" role="dialog" aria-modal="true" aria-labelledby="team-call-title">
            <div className="team-call-avatar-stack" aria-hidden="true">
              {teamMembers.map((member) => (
                <span className={`team-member-avatar avatar-${member.initial.toLowerCase()}`} key={member.name}>{member.initial}</span>
              ))}
            </div>
            <p className="team-call-incoming"><span /> INCOMING TEAM CALL</p>
            <h2 id="team-call-title">Maya is inviting you to a meeting</h2>
            <p className="team-call-subtitle">Payments Engineering · Team standup</p>
            <p className="team-call-description">Priya and Arjun will share a quick update. Maya will walk you through your first ticket.</p>
            <div className="team-call-participants">Maya · Arjun · Priya <span>3 people</span></div>
            <button className="accept-team-call" type="button" onClick={acceptTeamCall}>
              <span aria-hidden="true">✓</span> Accept and join
            </button>
          </section>
        </div>
        )}
      </main>
    );
  }

  if (!teamMeetingCompleted) {
    const visibleMeetingUpdates = Math.min(teamMeetingStep + 1, teamMeetingUpdates.length);
    return (
      <main className="team-meeting-page">
        <header className="team-meeting-topbar">
          <Link className="workplace-brand" to="/">perspective</Link>
          <span className="workplace-divider" />
          <strong className="company-name">NovaPay</strong>
          <span className="team-name">Payments Engineering</span>
          <span className="meeting-mode-label"><span /> TEAM MEETING</span>
          <AccountStatus />
        </header>

        <div className="team-meeting-content">
          <div className="team-meeting-titlebar">
            <div>
              <p className="eyebrow">DAY ONE · TEAM STANDUP</p>
              <h1>Payments team sync</h1>
              <p>Hear what the team is working on, then get your first assignment from Maya.</p>
            </div>
            <div className="meeting-live-indicator"><span /> IN PROGRESS</div>
          </div>

          <div className="team-meeting-room">
            <aside className="meeting-sidebar">
              <div className="meeting-sidebar-section">
                <p className="meeting-sidebar-label">IN THIS MEETING</p>
                {teamMembers.map((member) => (
                  <div className="meeting-attendee" key={member.name}>
                    <span className={`team-member-avatar avatar-${member.initial.toLowerCase()}`}>
                      {member.initial}
                    </span>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.role}</span>
                    </div>
                    <i aria-label="Present" />
                  </div>
                ))}
                <div className="meeting-attendee current-user">
                  <span className="team-intro-you-avatar">A</span>
                  <div><strong>You</strong><span>New team member</span></div>
                  <i aria-label="Present" />
                </div>
              </div>
              <div className="meeting-agenda">
                <p className="meeting-sidebar-label">AGENDA</p>
                <div className={teamMeetingStep < 3 ? "agenda-current" : "agenda-done"}>
                  <span>01</span> Team updates
                </div>
                <div className={teamMeetingStep >= 2 ? "agenda-current" : ""}>
                  <span>02</span> First assignment
                </div>
              </div>
            </aside>

            <section className="team-meeting-main" aria-labelledby="meeting-room-title">
              <div className="meeting-room-header">
                <div>
                  <span className="meeting-room-icon">N</span>
                  <div><h2 id="meeting-room-title">Payments Engineering</h2><span>Team standup · Day one</span></div>
                </div>
                <span className="meeting-update-count">
                  {teamMeetingStep < teamMeetingUpdates.length
                    ? `UPDATE ${teamMeetingStep + 1} OF ${teamMeetingUpdates.length}`
                    : "ASSIGNMENT CONFIRMED"}
                </span>
              </div>

              <div className="meeting-transcript" aria-live="polite">
                {teamMeetingUpdates.slice(0, visibleMeetingUpdates).map((update, index) => {
                  const member = teamMembers.find((person) => person.name === update.teammate)!;
                  return (
                    <div className="meeting-update-group" key={update.teammate}>
                      <article className="meeting-update-card">
                        <div className="meeting-update-meta">
                          <span className={`team-member-avatar avatar-${member.initial.toLowerCase()}`}>
                            {member.initial}
                          </span>
                          <div><strong>{member.name}</strong><span>{member.role}</span></div>
                          <small>{update.heading}</small>
                        </div>
                        <p>{update.message}</p>
                      </article>
                      {index < teamMeetingStep && (
                        <div className="meeting-user-response"><span>A</span><strong>You</strong><p>Okay, got it.</p></div>
                      )}
                      {update.teammate === "Maya" && teamMeetingStep >= 2 && (
                        <article className="meeting-assignment-card">
                          <div><span>ASSIGNED TO YOU</span><strong>PAY-142</strong></div>
                          <h3>Add idempotency protection to payment creation</h3>
                          <p>Return the original payment when a customer retries with the same key.</p>
                        </article>
                      )}
                    </div>
                  );
                })}
              </div>

              <section className="meeting-voice-help" aria-label="Ask the team by voice">
                <div className="meeting-voice-history" aria-live="polite">
                  {mayaVoiceHistory.slice(-4).map((message, index) => (
                    <p key={`${index}-${message.author}`}><strong>{message.author === "You" ? "You" : "Maya"}:</strong> {message.text}</p>
                  ))}
                </div>
                <SarvamVoiceControl
                  mode="teammate"
                  persona="Maya"
                  role="Engineering Manager"
                  history={mayaVoiceHistory.slice(-8).map((message) => ({ role: message.author === "You" ? "user" as const : "assistant" as const, content: message.text }))}
                  context={{
                    ticket: "PAY-142 — add idempotency protection to payment creation so retries with the same key return the original payment.",
                    meeting: "NovaPay Payments Engineering day-one standup. The user is meeting Priya (Backend Engineer), Arjun (Senior Engineer), and Maya (Engineering Manager).",
                    updates: teamMeetingUpdates.map((update) => `${update.teammate}: ${update.message}`).join("\n"),
                    currentFile: selectedFile.name,
                    currentCode: paymentCode,
                    checkOutput,
                  }}
                  onExchange={appendVoiceMeetingExchange}
                  label="Ask Maya by voice"
                />
              </section>

              <footer className="meeting-action-bar">
                {teamMeetingStep < teamMeetingUpdates.length ? (
                  <>
                    <span>{teamMeetingUpdates[teamMeetingStep + 1]?.teammate
                      ? `Next update: ${teamMeetingUpdates[teamMeetingStep + 1].teammate}`
                      : "Maya has your first assignment"}</span>
                    <button type="button" onClick={acknowledgeMeetingUpdate}>
                      Okay, got it <span aria-hidden="true">→</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span>Maya has assigned PAY-142 to you.</span>
                    <button type="button" onClick={openAssignedTicket}>
                      Review your ticket <span aria-hidden="true">→</span>
                    </button>
                  </>
                )}
              </footer>
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="workplace-page">
      <header className="workplace-topbar">
        <Link className="workplace-brand" to="/">perspective</Link>
        <span className="workplace-divider" />
        <strong className="company-name">NovaPay</strong>
        <span className="team-name">Payments Engineering</span>
        <Link className="workplace-dashboard-link" to="/dashboard">
          Dashboard
        </Link>
        <Link className="workplace-exit" to="/careers/software-engineering">
          Exit workspace
        </Link>
        <AccountStatus />
      </header>

      <div className={`workplace-layout${ticketChatVisible ? " has-ticket-orbit" : ""}`}>
        <aside className="workplace-rail" aria-label="Workspace navigation">
          <p className="workplace-rail-label">WORKSPACE</p>
          <button
            className={view === "ticket" ? "active" : ""}
            onClick={() => setView("ticket")}
          >
            <span className="rail-icon">T</span>
            Your task
          </button>
          <button
            className={`${view === "repository" ? "active" : ""}${ticketTriageRequired ? " needs-triage" : ""}`}
            onClick={() => setView(ticketTriageRequired || activeTicketId !== "PAY-142" ? "ticket" : "repository")}
            title={ticketTriageRequired ? "Choose a starting point on PAY-142 first" : activeTicketId !== "PAY-142" ? "Open the selected ticket workspace" : undefined}
          >
            <span className="rail-icon">R</span>
            Repository
            {ticketTriageRequired && <small>Start on ticket</small>}
          </button>
          <button
            className={view === "slack" ? "active" : ""}
            onClick={() => setView("slack")}
          >
            <span className="rail-icon">#</span>
            #engineering
          </button>
          <p className="workplace-rail-label direct-message-label">DIRECT MESSAGES</p>
          {teamMembers.map((member) => {
            const teammateView = `dm-${member.name.toLowerCase()}` as WorkspaceView;
            return (
              <button
                className={`direct-message-nav${view === teammateView ? " active" : ""}`}
                key={member.name}
                onClick={() => setView(teammateView)}
              >
                <span className={`rail-icon teammate-rail-avatar avatar-${member.initial.toLowerCase()}`}>
                  {member.initial}
                </span>
                {member.name}
              </button>
            );
          })}
          <div className="workplace-rail-spacer" />
          <div className="team-presence">
            <span className="presence-dot" />
            <span>Team online</span>
          </div>
        </aside>

        <section className="workplace-main">
          <div className="workplace-welcome">
            <p className="eyebrow">YOUR FIRST DAY</p>
            <h1>Welcome to NovaPay.</h1>
            <p>
              You’ve joined Payments Engineering as a software engineer. Your
              team builds the services that handle customer payments.
            </p>
          </div>

          {view === "ticket" && (
            <section className="engineering-ticket-queue" aria-label="Team ticket queue">
              <div className="engineering-ticket-queue-heading">
                <div><p className="eyebrow">TEAM BACKLOG</p><strong>Choose a ticket to explore</strong></div>
                <span>{completedTickets.length + (pullRequestStatus === "merged" ? 1 : 0)} of 4 complete</span>
              </div>
              <div className="engineering-ticket-queue-list">
                <button type="button" className={`engineering-ticket-queue-item${activeTicketId === "PAY-142" ? " active" : ""}`} onClick={() => selectEngineeringTicket("PAY-142")}>
                  <span className="queue-ticket-id">PAY-142</span><strong>Add payment idempotency</strong><small>{pullRequestStatus === "merged" ? "Complete" : "Payments · Feature"}</small>
                  <i className={pullRequestStatus === "merged" ? "done" : ""} aria-hidden="true" />
                </button>
                {engineeringTickets.map((ticket) => {
                  const hasDraft = Boolean(ticketDrafts[ticket.id] && ticketDrafts[ticket.id] !== ticket.starterCode);
                  const complete = completedTickets.includes(ticket.id);
                  return (
                    <button type="button" key={ticket.id} className={`engineering-ticket-queue-item${activeTicketId === ticket.id ? " active" : ""}`} onClick={() => selectEngineeringTicket(ticket.id)}>
                      <span className="queue-ticket-id">{ticket.id}</span><strong>{ticket.title}</strong><small>{complete ? "Complete" : hasDraft ? "In progress" : ticket.category}</small>
                      <i className={complete ? "done" : ""} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {view === "ticket" ? activeTicketId === "PAY-142" ? (
            <article className="work-ticket">
              <div className="ticket-heading-row">
                <div className="ticket-id">PAY-142</div>
                <span
                  className={`ticket-status${pullRequestStatus === "merged" ? " done" : checksPassed ? " ready" : ""}`}
                >
                  {pullRequestStatus === "merged"
                    ? "MERGED"
                    : pullRequestStatus === "in-review"
                      ? "IN REVIEW"
                      : checksPassed
                        ? "READY FOR REVIEW"
                        : "OPEN"}
                </span>
              </div>
              <h2>Add idempotency protection to payment creation</h2>
              <p className="ticket-summary">
                A customer can retry a payment request when their connection
                times out. Today, each retry can create another charge.
              </p>

              <div className="ticket-meta">
                <div>
                  <span>TEAM</span>
                  <strong>Payments Engineering</strong>
                </div>
                <div>
                  <span>PRIORITY</span>
                  <strong>Normal</strong>
                </div>
                <div>
                  <span>TYPE</span>
                  <strong>Feature</strong>
                </div>
              </div>

              <div className="ticket-section">
                <h3>What needs to change</h3>
                <p>
                  Support an idempotency key on payment creation. When the same
                  key is sent again, return the original payment instead of
                  creating a duplicate.
                </p>
                <p>
                  Think of the key as a receipt for one attempt: the same key
                  means “show me that payment again,” while a new key means a
                  new payment attempt.
                </p>
              </div>

              <div className="ticket-section">
                <h3>Acceptance criteria</h3>
                <ul>
                  <li className={checksPassed ? "criterion-passed" : ""}>
                    The first request with a key creates a payment.
                  </li>
                  <li className={checksPassed ? "criterion-passed" : ""}>
                    Repeating that key returns the original payment.
                  </li>
                  <li className={checksPassed ? "criterion-passed" : ""}>
                    A different key can create a separate payment.
                  </li>
                  <li className={checksPassed ? "criterion-passed" : ""}>
                    Requests without a key continue to create payments.
                  </li>
                </ul>
              </div>

              {ticketTriageChoice ? (
                <section className="ticket-triage-complete" aria-label="Investigation starting point">
                  <span className="ticket-triage-check" aria-hidden="true">✓</span>
                  <div>
                    <span>INVESTIGATION STARTED</span>
                    <strong>{selectedTriageOption?.title} · {selectedTriageOption?.fileName}</strong>
                    <p>{selectedTriageOption?.guidance}</p>
                  </div>
                  <button type="button" onClick={() => setView("repository")}>Return to repository →</button>
                </section>
              ) : ticketTriageRequired ? (
                <section className="ticket-triage" id="ticket-triage" aria-labelledby="ticket-triage-title">
                  <div className="ticket-triage-heading">
                    <p className="eyebrow">BEFORE YOU CODE</p>
                    <h3 id="ticket-triage-title">Where would you start?</h3>
                    <p>There’s no single right path. Pick one part of the service to investigate first.</p>
                  </div>
                  <div className="ticket-triage-options">
                    {ticketTriageOptions.map((option) => (
                      <button
                        className="ticket-triage-option"
                        type="button"
                        key={option.id}
                        onClick={() => startTicketTriage(option.id)}
                      >
                        <span className="triage-file-mark">{option.fileName.endsWith(".py") ? "PY" : ""}</span>
                        <span className="triage-option-copy">
                          <strong>{option.title}</strong>
                          <small>{option.fileName}</small>
                          <span>{option.description}</span>
                        </span>
                        <span className="triage-option-arrow" aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="ticket-footer">
                <p>
                  {pullRequestStatus === "merged"
                    ? "PAY-142 is complete. Your change is merged."
                    : pullRequestStatus === "in-review"
                      ? "Your pull request is with the team for review."
                      : checksPassed
                        ? "All checks pass. Submit your change for review."
                        : "Start by tracing the current payment creation flow."}
                </p>
                <button
                  onClick={() => {
                    if (ticketTriageRequired) {
                      document.getElementById("ticket-triage")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      return;
                    }
                    setView("repository");
                  }}
                >
                  {ticketTriageRequired
                    ? "Choose a starting point ↑"
                    : checksPassed ? "View pull request →" : "Inspect repository →"}
                </button>
              </div>
            </article>
          ) : activeAdditionalTicket ? (
            <article className="work-ticket additional-work-ticket">
              <div className="ticket-heading-row">
                <div className="ticket-id">{activeAdditionalTicket.id}</div>
                <span className={`ticket-status${completedTickets.includes(activeAdditionalTicket.id) ? " done" : ""}`}>
                  {completedTickets.includes(activeAdditionalTicket.id) ? "COMPLETE" : ticketDrafts[activeAdditionalTicket.id] && ticketDrafts[activeAdditionalTicket.id] !== activeAdditionalTicket.starterCode ? "IN PROGRESS" : "OPEN"}
                </span>
              </div>
              <h2>{activeAdditionalTicket.title}</h2>
              <p className="ticket-summary">{activeAdditionalTicket.summary}</p>
              <div className="ticket-meta">
                <div><span>TEAM</span><strong>Payments Engineering</strong></div>
                <div><span>PRIORITY</span><strong>{activeAdditionalTicket.priority}</strong></div>
                <div><span>TYPE</span><strong>{activeAdditionalTicket.category}</strong></div>
              </div>
              <div className="ticket-section"><h3>What’s happening</h3><p>{activeAdditionalTicket.context}</p></div>
              <div className="ticket-section"><h3>Acceptance criteria</h3><ul>{activeAdditionalTicket.acceptance.map((criterion, index) => <li className={completedTickets.includes(activeAdditionalTicket.id) ? "criterion-passed" : ""} key={`${activeAdditionalTicket.id}-${index}`}>{criterion}</li>)}</ul></div>
              <section className="ticket-workbench">
                <div className="ticket-workbench-heading"><div><p className="eyebrow">{activeAdditionalTicket.id} / {activeAdditionalTicket.fileName}</p><h3>Your workspace</h3></div><span>{activeAdditionalTicket.language.toUpperCase()}</span></div>
                <p>{activeAdditionalTicket.instruction}</p>
                <CodeEditor key={activeAdditionalTicket.id} language={activeAdditionalTicket.language} value={activeTicketCode} onChange={updateActiveTicketCode} />
                <div className="workplace-check-actions"><button type="button" onClick={() => void runChecks()} disabled={isChecking}>{isChecking ? "Running checks…" : "Run checks"}</button><span>Runs against a small, isolated fixture. No external database required.</span></div>
                {ticketOutputs[activeAdditionalTicket.id] && <div className={`workplace-check-output${completedTickets.includes(activeAdditionalTicket.id) ? " passed" : ""}`}><div className="terminal-label">TEST OUTPUT</div><pre>{ticketOutputs[activeAdditionalTicket.id]}</pre></div>}
              </section>
            </article>
          ) : null : view === "repository" ? (
            <section className="repository-view">
              <div className="repository-heading">
                <div>
                  <p className="eyebrow">NOVAPAY / PAYMENTS-SERVICE</p>
                  <h2>Repository</h2>
                </div>
                <span className="repository-branch">main</span>
              </div>
              <p className="repository-intro">
                A small service that creates and tracks customer payments.
                Start with the route, follow the service call, then look at its
                tests. You only need to change payments.py for this ticket; run
                the checks as you go and use the first failure’s hint to guide
                your next step.
              </p>
              {selectedTriageOption && (
                <section className="ticket-triage-guidance" aria-live="polite">
                  <div>
                    <p className="eyebrow">YOUR INVESTIGATION START</p>
                    <strong>{selectedTriageOption.title} · {selectedTriageOption.fileName}</strong>
                    <p>{selectedTriageOption.guidance}</p>
                  </div>
                  {selectedFile.name !== "payments.py" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(repositoryFiles[0]);
                        setCheckOutput("");
                      }}
                    >
                      Continue to payments.py →
                    </button>
                  )}
                </section>
              )}
              <div className="repository-browser">
                <nav className="repository-files" aria-label="Repository files">
                  <p>FILES</p>
                  {repositoryFiles.map((file) => (
                    <button
                      className={selectedFile.name === file.name ? "active" : ""}
                      key={file.name}
                      onClick={() => {
                        setSelectedFile(file);
                        setCheckOutput("");
                      }}
                    >
                      <span className="file-mark">{file.name.endsWith(".py") ? "PY" : ""}</span>
                      {file.name}
                    </button>
                  ))}
                </nav>
                <div className="repository-file-content">
                  <div className="repository-file-header">
                    <strong>{selectedFile.name}</strong>
                    <span>{selectedFile.name === "payments.py" ? "EDITABLE" : "READ ONLY"}</span>
                  </div>
                  <p>{selectedFile.description}</p>
                  {selectedFile.name === "payments.py" ? (
                    <>
                      <CodeEditor value={paymentCode} onChange={updatePaymentCode} />
                      <div className="workplace-check-actions">
                        <button onClick={runChecks} disabled={isChecking}>
                          {isChecking ? "Running checks..." : "Run checks"}
                        </button>
                        <span>Checks each PAY-142 requirement and gives a hint if one fails.</span>
                      </div>
                      {checkOutput && (
                        <div className={`workplace-check-output${checksPassed ? " passed" : ""}`}>
                          <div className="terminal-label">TEST OUTPUT</div>
                          <pre>{checkOutput}</pre>
                        </div>
                      )}
                      {checksPassed && pullRequestStatus === "not-created" && (
                        <section className="git-workflow-panel">
                          <p className="eyebrow">READY FOR REVIEW</p>
                          <h3>Commit and open a pull request</h3>
                          <p>
                            Use the terminal to create a branch, commit your
                            change, push it, then open a pull request with the
                            GitHub CLI.
                          </p>
                          <ol className="git-command-guide">
                            {[
                              "git checkout -b feature/pay-142-idempotency",
                              "git status",
                              "git add payments.py",
                              'git commit -m "PAY-142- <description>"',
                              "git push -u origin feature/pay-142-idempotency",
                              "gh pr create --fill",
                            ].map((step, index) => (
                              <li
                                className={
                                  index === gitStep
                                    ? "current"
                                    : index < gitStep
                                      ? "complete"
                                      : ""
                                }
                                key={step}
                              >
                                <code>{step}</code>
                              </li>
                            ))}
                          </ol>
                          <div className="workplace-terminal-header">
                            <span>terminal</span>
                            <span>
                              {gitStep < 6 ? `STEP ${gitStep + 1} OF 6` : "WORKFLOW COMPLETE"}
                            </span>
                          </div>
                          <form className="workplace-terminal-form" onSubmit={runGitCommand}>
                            <label className="visually-hidden" htmlFor="workplace-git-command">
                              Enter one Git command
                            </label>
                            <span className="terminal-prompt">$</span>
                            <input
                              id="workplace-git-command"
                              autoComplete="off"
                              spellCheck={false}
                              value={gitCommand}
                              onChange={(event) => setGitCommand(event.target.value)}
                              placeholder={
                                gitStep === 3
                                  ? 'git commit -m "PAY-142- Add idempotency protection"'
                                  : "Enter the next command..."
                              }
                              disabled={gitStep >= 6 || isRunningGit}
                            />
                            <button type="submit" disabled={gitStep >= 6 || isRunningGit}>
                              {isRunningGit ? "Running..." : "Run command"}
                            </button>
                          </form>
                          {gitOutput && (
                            <div className="workplace-check-output">
                              <div className="terminal-label">TERMINAL OUTPUT</div>
                              <pre>{gitOutput}</pre>
                            </div>
                          )}
                        </section>
                      )}
                      {pullRequestStatus !== "not-created" && (
                        <section className="pull-request-review">
                          <div className="pull-request-heading">
                            <div>
                              <p className="eyebrow">PULL REQUEST #31</p>
                              <h3>{commitMessage || "PAY-142- Add idempotency protection"}</h3>
                            </div>
                            <span className={`pull-request-state${pullRequestStatus === "merged" ? " merged" : ""}`}>
                              {pullRequestStatus === "merged" ? "MERGED" : "OPEN"}
                            </span>
                          </div>
                          <p className="pull-request-summary">
                            Ensure retries with the same idempotency key return
                            the original payment.
                          </p>
                          <div className="reviewer-note">
                            <div className="reviewer-avatar">P</div>
                            <div>
                              <strong>Priya · Senior Engineer</strong>
                              <p>
                                The retry checks look good. The same key returns
                                the original payment, while new keys and requests
                                without a key create separate payments. Approved.
                              </p>
                            </div>
                          </div>
                          {pullRequestStatus === "in-review" ? (
                            <button
                              className="merge-pull-request"
                              onClick={mergePullRequest}
                            >
                              Merge pull request
                            </button>
                          ) : (
                            <>
                              <p className="merged-confirmation">
                                PAY-142 is complete and the change is merged into main.
                              </p>
                              <section className="work-reflection">
                                <p className="eyebrow">AFTER THE TASK</p>
                                <h3>Your reflection</h3>
                                <p className="reflection-intro">
                                  Rate how the work felt. These ratings are for
                                  your own reflection, not a career-fit score.
                                </p>
                                {reflectionSaved ? (
                                  <div className="reflection-summary">
                                    <div className="reflection-average">
                                      <span>Average experience rating</span>
                                      <strong>
                                        {(
                                          Object.values(reflection.metrics).reduce(
                                            (total, value) => total + value,
                                            0,
                                          ) / REFLECTION_METRICS.length
                                        ).toFixed(1)}
                                        <small> / 5</small>
                                      </strong>
                                    </div>
                                    <div className="reflection-metric-summary">
                                      {REFLECTION_METRICS.map((metric) => (
                                        <div key={metric.key}>
                                          <span>{metric.label}</span>
                                          <strong>{reflection.metrics[metric.key]} / 5</strong>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="career-likelihood-summary">
                                      <span>Likelihood you’d choose this career</span>
                                      <strong>{reflection.careerLikelihood} / 10</strong>
                                    </div>
                                    {reflection.note && (
                                      <div className="reflection-note-summary">
                                        <span>Your note</span>
                                        <p>{reflection.note}</p>
                                      </div>
                                    )}
                                    <button
                                      className="edit-reflection"
                                      onClick={() => setReflectionSaved(false)}
                                    >
                                      Edit reflection
                                    </button>
                                    <Link className="reflection-dashboard-link" to="/dashboard">
                                      View career dashboard →
                                    </Link>
                                  </div>
                                ) : (
                                  <form className="reflection-form" onSubmit={saveReflection}>
                                    {REFLECTION_METRICS.map((metric) => (
                                      <fieldset className="reflection-rating" key={metric.key}>
                                        <legend>{metric.label}</legend>
                                        <div className="rating-scale" role="group" aria-label={metric.label}>
                                          {[1, 2, 3, 4, 5].map((value) => (
                                            <button
                                              type="button"
                                              className={`rating-option rating-level-${value}${reflection.metrics[metric.key] === value ? " selected" : ""}`}
                                              key={value}
                                              aria-label={`${value} out of 5`}
                                              aria-pressed={reflection.metrics[metric.key] === value}
                                              onClick={() => updateReflectionMetric(metric.key, value)}
                                            >
                                              {value}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="rating-scale-labels">
                                          <span>Not at all</span>
                                          <span>A lot</span>
                                        </div>
                                      </fieldset>
                                    ))}
                                    <label className="career-likelihood-control">
                                      How likely are you to choose software engineering as a career?
                                      <span className="likelihood-value">
                                        {reflection.careerLikelihood} <small>/ 10</small>
                                      </span>
                                      <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        step="1"
                                        value={reflection.careerLikelihood}
                                        style={{
                                          "--likelihood-progress": `${((reflection.careerLikelihood - 1) / 9) * 100}%`,
                                        } as CSSProperties & { "--likelihood-progress": string }}
                                        onChange={(event) => {
                                          setReflection({
                                            ...reflection,
                                            careerLikelihood: Number(event.target.value),
                                          });
                                          setReflectionSaved(false);
                                        }}
                                      />
                                      <span className="likelihood-scale-labels">
                                        <span>Not likely</span>
                                        <span>Very likely</span>
                                      </span>
                                    </label>
                                    <label className="reflection-note-field">
                                      Add a note for your future self <span>(optional)</span>
                                      <textarea
                                        rows={3}
                                        value={reflection.note}
                                        onChange={(event) => {
                                          setReflection({ ...reflection, note: event.target.value });
                                          setReflectionSaved(false);
                                        }}
                                        placeholder="What do you want to remember about this experience?"
                                      />
                                    </label>
                                    <button
                                      type="submit"
                                      disabled={isSavingReflection || Object.values(reflection.metrics).some((value) => value === 0)}
                                    >
                                      {isSavingReflection ? "Saving…" : "Save reflection"}
                                    </button>
                                    {reflectionSaveError && <p className="reflection-save-error" role="alert">{reflectionSaveError}</p>}
                                  </form>
                                )}
                              </section>
                            </>
                          )}
                        </section>
                      )}
                    </>
                  ) : (
                    <pre><code>{selectedFile.code}</code></pre>
                  )}
                </div>
              </div>
              <button className="back-to-ticket" onClick={() => setView("ticket")}>
                ← Back to PAY-142
              </button>
            </section>
          ) : view === "slack" ? (
            <section className="slack-view">
              <div className="slack-channel-header">
                <div>
                  <p className="eyebrow">NOVAPAY · PAYMENTS ENGINEERING</p>
                  <h2>#engineering</h2>
                </div>
                <span>3 members</span>
              </div>
              <div className="slack-context-note">
                Conversation about your current task, PAY-142.
              </div>
              <div className="slack-messages" aria-live="polite">
                {teammateMessages.map((message, index) => (
                  <article
                    className={`slack-message${message.author === "You" ? " from-user" : ""}`}
                    key={`${index}-${message.author}`}
                  >
                    <div className={`slack-avatar${message.author === "You" ? " user-avatar" : ""}`}>
                      {message.author === "You" ? "A" : "P"}
                    </div>
                    <div className="slack-message-body">
                      <div className="slack-message-meta">
                        <strong>{message.author === "You" ? "You" : "Priya"}</strong>
                        {message.author === "Priya" && <span>Backend Engineer</span>}
                      </div>
                      <p>{message.text}</p>
                    </div>
                  </article>
                ))}
                {isTeammateReplying && <p className="ai-reply-status">Priya is replying…</p>}
              </div>
              <form className="slack-compose" onSubmit={askPriya}>
                <label className="visually-hidden" htmlFor="priya-question">
                  Ask Priya for help with PAY-142
                </label>
                <textarea
                  id="priya-question"
                  rows={3}
                  value={teammateQuestion}
                  onChange={(event) => setTeammateQuestion(event.target.value)}
                  placeholder="Ask Priya for help with PAY-142..."
                />
                <div className="slack-compose-footer">
                  <span>Priya · Backend Engineer</span>
                  <button type="submit" disabled={!teammateQuestion.trim() || isTeammateReplying}>
                    {isTeammateReplying ? "Waiting for Priya…" : "Send message"}
                  </button>
                </div>
              </form>
            </section>
          ) : selectedTeammate ? (
            <section className="direct-message-view">
              <header className="direct-message-header">
                <span className={`team-member-avatar avatar-${selectedTeammate.initial.toLowerCase()}`}>
                  {selectedTeammate.initial}
                </span>
                <div>
                  <p className="eyebrow">DIRECT MESSAGE</p>
                  <h2>{selectedTeammate.name}</h2>
                  <span>{selectedTeammate.role} · Payments Engineering</span>
                </div>
              </header>
              <div className="direct-message-history" aria-live="polite">
                {(directMessages[selectedTeammate.name] ?? defaultDirectMessages[selectedTeammate.name]).map((message, index) => (
                  <article
                    className={`direct-message${message.author === "You" ? " from-user" : ""}`}
                    key={`${index}-${message.author}`}
                  >
                    <span className={`slack-avatar${message.author === "You" ? " user-avatar" : ""}`}>
                      {message.author === "You" ? "A" : selectedTeammate.initial}
                    </span>
                    <div>
                      <div className="slack-message-meta">
                        <strong>{message.author === "You" ? "You" : selectedTeammate.name}</strong>
                        {message.author !== "You" && <span>{selectedTeammate.role}</span>}
                      </div>
                      <p>{message.text}</p>
                    </div>
                  </article>
                ))}
                {isDirectReplying && <p className="ai-reply-status">{selectedTeammate.name} is replying…</p>}
              </div>
              <form className="slack-compose" onSubmit={sendDirectMessage}>
                <label className="visually-hidden" htmlFor="direct-message-draft">
                  Message {selectedTeammate.name}
                </label>
                <textarea
                  id="direct-message-draft"
                  rows={3}
                  value={directMessageDraft}
                  onChange={(event) => setDirectMessageDraft(event.target.value)}
                  placeholder={`Message ${selectedTeammate.name}...`}
                />
                <div className="slack-compose-footer">
                  <span>Private conversation with {selectedTeammate.name} · Hindi, Hinglish, or English</span>
                  <button className="voice-message-button" type="button" onClick={isRecordingVoice ? stopVoiceMessage : () => void startVoiceMessage()} disabled={isDirectReplying}>
                    {isRecordingVoice ? "Stop recording" : `Speak to ${selectedTeammate.name}`}
                  </button>
                  <button type="submit" disabled={!directMessageDraft.trim() || isDirectReplying}>
                    {isDirectReplying ? "Waiting for reply…" : "Send message"}
                  </button>
                </div>
                {voiceStatus && <p className="voice-message-status" role="status">{voiceStatus}</p>}
              </form>
            </section>
          ) : null}
        </section>
        {ticketChatVisible && (
          <aside className="workplace-orbit-panel" aria-label={`ORBIT help for ${activeTicketId}`}>
            <header className="workplace-orbit-header">
              <span className="workplace-orbit-mark"><Orbit size={17} strokeWidth={1.8} aria-hidden="true" /></span>
              <div><strong>ORBIT</strong><small>{activeTicketId} · Ticket guide</small></div>
              <label className="workplace-orbit-model">
                <span>MODEL</span>
                <select value={ticketChatProvider} onChange={(event) => setTicketChatProvider(event.target.value as "gemini" | "sarvam")} aria-label="Choose ORBIT chat model">
                  <option value="gemini">Gemini</option>
                  <option value="sarvam">Sarvam</option>
                </select>
              </label>
            </header>
            <div className="workplace-orbit-messages" aria-live="polite">
              {activeTicketChatMessages.length === 0 && (
                <p className="tutor-chat-message assistant">I’m here to help with {activeTicketId}. Tell me what you’ve tried or where you’re stuck, and we’ll work through it together.</p>
              )}
              {activeTicketChatMessages.map((message, index) => (
                <p className={`tutor-chat-message ${message.role}`} key={`${activeTicketId}-${index}-${message.role}`}>{message.content}</p>
              ))}
              {isTicketChatReplying && <p className="tutor-chat-status">ORBIT is thinking…</p>}
            </div>
            <form className="workplace-orbit-compose" onSubmit={askOrbitAboutTicket}>
              <textarea
                value={ticketChatDraft}
                onChange={(event) => setTicketChatDraft(event.target.value)}
                placeholder={`Ask about ${activeTicketId}…`}
                aria-label={`Ask ORBIT about ${activeTicketId}`}
                rows={2}
                maxLength={4000}
              />
              <button type="submit" disabled={!ticketChatDraft.trim() || isTicketChatReplying} aria-label="Send question to ORBIT">
                <ArrowUp size={16} />
              </button>
            </form>
          </aside>
        )}
      </div>
    </main>
  );
}

export default SoftwareEngineeringWork;
