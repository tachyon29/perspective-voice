import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  FileSpreadsheet,
  Lightbulb,
  MessageSquareText,
  Presentation,
  Send,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import AccountStatus from "../components/AccountStatus";
import SarvamVoiceControl from "../components/SarvamVoiceControl";
import ChatMessageText from "../components/ChatMessageText";
import { requestSarvamChat } from "../lib/aiChat";
import {
  useProgress,
  type ConsultingCaseStage,
  type ConsultingDriver,
  type ConsultingProbabilities,
  type ManagementConsultingProgress,
} from "../progress/ProgressProvider";
import {
  createEmptyReflection,
  getReflectionMetrics,
  type CareerReflection,
  type ReflectionMetricKey,
} from "../utils/careerReflection";

type WorkView = ConsultingCaseStage | "team-chat";

const team = [
  {
    name: "Maya Chen",
    role: "Engagement Manager",
    initial: "M",
    accent: "maya",
    intro: "I’ll keep us focused on the client’s decision. Our job is to make the problem smaller, test what may be driving it, and give them a practical next step.",
  },
  {
    name: "Leena Shah",
    role: "Associate Consultant",
    initial: "L",
    accent: "leena",
    intro: "I’ve organized the store performance data. We can compare revenue, operating costs, and profit across three locations to see where the change is coming from.",
  },
  {
    name: "Dev Morgan",
    role: "Operations Specialist",
    initial: "D",
    accent: "dev",
    intro: "I’ve been speaking with store managers. The numbers can tell us where to look; the conversations help explain what might be happening on the ground.",
  },
];

const stores = [
  { id: "central", name: "Central Market", revenueBefore: 520, revenueNow: 480, costsBefore: 400, costsNow: 410 },
  { id: "riverside", name: "Riverside", revenueBefore: 400, revenueNow: 390, costsBefore: 290, costsNow: 300 },
  { id: "northside", name: "Northside", revenueBefore: 310, revenueNow: 370, costsBefore: 220, costsNow: 255 },
];

const recommendations = [
  { id: "pilot", title: "Pilot better staffing and waste controls at Central Market", detail: "Run a six-week pilot, then compare weekly labor, waste, and profit with the other stores.", tone: "recommended" },
  { id: "discount", title: "Lower prices across all three locations", detail: "A broad discount may increase sales, but it could make margins worse before we know why costs changed.", tone: "" },
  { id: "close", title: "Close the lowest-profit location", detail: "A closure is difficult to reverse and the current evidence does not show whether the issue can be fixed.", tone: "" },
];

const evidence = [
  { id: "chain", label: "Chain profit fell $45k while revenue rose $10k" },
  { id: "central", label: "Central Market profit fell $50k" },
  { id: "north", label: "Northside profit rose $25k" },
  { id: "field", label: "Central managers report more overtime and food waste" },
];

const probabilityDrivers: Array<{ id: ConsultingDriver; label: string; color: string }> = [
  { id: "sales", label: "Sales / customer demand", color: "sales" },
  { id: "costs", label: "Operating costs", color: "costs" },
  { id: "localOperations", label: "Local store operations", color: "operations" },
];

const teamProbabilityView: ConsultingProbabilities = { sales: 10, costs: 35, localOperations: 55 };

const stages: Array<{ id: ConsultingCaseStage; label: string; short: string }> = [
  { id: "kickoff", label: "Client brief", short: "Brief" },
  { id: "analysis", label: "Store economics", short: "Analysis" },
  { id: "team-checkin", label: "Case team check-in", short: "Team" },
  { id: "recommendation", label: "Recommendation", short: "Readout" },
  { id: "client-readout", label: "Client readout", short: "Client" },
  { id: "reflection", label: "Your reflection", short: "Reflection" },
];

const defaultCase: ManagementConsultingProgress = {
  stage: "team-intro",
  teamIntroStep: 0,
  kickoffAcknowledged: false,
  selectedStore: null,
  storeSelectionConfirmed: false,
  selectedHypothesis: null,
  profitFormulaDraft: "",
  formulaCompleted: false,
  probabilityAllocation: { sales: 34, costs: 33, localOperations: 33 },
  probabilitySubmitted: false,
  revisedProbabilityAllocation: { sales: 34, costs: 33, localOperations: 33 },
  probabilityRevised: false,
  selectedRecommendation: null,
  selectedEvidence: [],
  clientQuestionAnswered: false,
  clientAnswer: null,
  chatMessages: [
    { author: "Maya", text: "Welcome to the case team. The client has shared the first set of store economics; let’s work through the evidence together." },
  ],
};

function formatMoney(value: number) {
  return `$${value.toLocaleString()}k`;
}

function redistributeProbability(
  current: ConsultingProbabilities,
  changed: ConsultingDriver,
  requestedValue: number,
): ConsultingProbabilities {
  const value = Math.max(0, Math.min(100, requestedValue));
  const remaining = 100 - value;
  const others = probabilityDrivers.filter((driver) => driver.id !== changed);
  const previousTotal = others.reduce((total, driver) => total + current[driver.id], 0);
  const firstShare = previousTotal
    ? Math.round(remaining * current[others[0].id] / previousTotal)
    : Math.round(remaining / 2);
  return {
    ...current,
    [changed]: value,
    [others[0].id]: firstShare,
    [others[1].id]: remaining - firstShare,
  };
}

function ManagementConsultingWork() {
  const { progress, updateProgress, saveProgress } = useProgress();
  const [caseProgress, setCaseProgress] = useState<ManagementConsultingProgress>(
    () => {
      const saved = progress.managementConsulting;
      return saved
        ? {
            ...defaultCase,
            ...saved,
            probabilityAllocation: saved.probabilityAllocation ?? defaultCase.probabilityAllocation,
            revisedProbabilityAllocation: saved.revisedProbabilityAllocation ?? defaultCase.revisedProbabilityAllocation,
            selectedEvidence: saved.selectedEvidence ?? [],
            chatMessages: saved.chatMessages ?? defaultCase.chatMessages,
          }
        : defaultCase;
    },
  );
  const [view, setView] = useState<WorkView>(
    () => progress.managementConsulting?.stage ?? "team-intro",
  );
  const [chatDraft, setChatDraft] = useState("");
  const [isCaseTeamReplying, setIsCaseTeamReplying] = useState(false);
  const [formulaFeedback, setFormulaFeedback] = useState("");
  const [formulaHintLevel, setFormulaHintLevel] = useState(0);
  const [chartFeedback, setChartFeedback] = useState("");
  const [reflection, setReflection] = useState<CareerReflection>(
    () => progress.managementConsultingReflection ?? createEmptyReflection("Management Consulting"),
  );
  const [reflectionSaved, setReflectionSaved] = useState(
    () => progress.managementConsultingReflection !== null,
  );
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  const [reflectionSaveError, setReflectionSaveError] = useState("");
  const metrics = getReflectionMetrics("Management Consulting");

  const setProbability = (which: "initial" | "revised", driver: ConsultingDriver, value: number) => {
    setCaseProgress((previous) => which === "initial"
      ? {
          ...previous,
          probabilityAllocation: redistributeProbability(previous.probabilityAllocation, driver, value),
          probabilitySubmitted: false,
        }
      : {
          ...previous,
          revisedProbabilityAllocation: redistributeProbability(previous.revisedProbabilityAllocation, driver, value),
          probabilityRevised: false,
        });
  };

  const checkProfitFormula = () => {
    const normalized = caseProgress.profitFormulaDraft.replace(/\s/g, "").toUpperCase();
    const accepted = [
      "=(D2-F2)-(C2-E2)",
      "=D2-F2-C2+E2",
      "=D2-F2-(C2-E2)",
    ].includes(normalized);
    setFormulaFeedback(accepted
      ? "Correct — Central Market’s profit declined by $50k. The formula subtracts prior-period profit from current-period profit."
      : formulaHintLevel > 0
        ? "Not quite yet. Calculate each period’s profit (revenue minus costs), then subtract prior profit from current profit."
        : "That formula doesn’t calculate the change in profit yet. Try a hint or inspect the column letters.");
    setCaseProgress((previous) => ({ ...previous, formulaCompleted: accepted }));
  };

  const recordStoreFinding = () => {
    if (caseProgress.selectedStore === "central") {
      setChartFeedback("Good read. Central Market’s profit fell by $50k — the largest decline. Riverside fell $20k and Northside grew by $25k.");
      setCaseProgress((previous) => ({ ...previous, storeSelectionConfirmed: true, selectedHypothesis: "central" }));
      return;
    }
    const store = stores.find((item) => item.id === caseProgress.selectedStore) ?? stores[0];
    const change = store.revenueNow - store.costsNow - (store.revenueBefore - store.costsBefore);
    setChartFeedback(`${store.name} changed by ${formatMoney(change)}. Compare it with Central Market before recording the largest decline.`);
    setCaseProgress((previous) => ({ ...previous, storeSelectionConfirmed: false, selectedHypothesis: null }));
  };

  useEffect(() => {
    updateProgress((previous) => ({ ...previous, managementConsulting: caseProgress }));
  }, [caseProgress, updateProgress]);

  const activeStageIndex = Math.max(0, stages.findIndex((stage) => stage.id === caseProgress.stage));
  const selectedStore = stores.find((store) => store.id === caseProgress.selectedStore) ?? stores[0];
  const chosenRecommendation = recommendations.find(
    (item) => item.id === caseProgress.selectedRecommendation,
  );
  const completedSteps = caseProgress.stage === "team-intro"
    ? 0
    : caseProgress.stage === "kickoff"
      ? 1
      : Math.min(activeStageIndex + 1, stages.length);
  const probabilityRevisionChanged = probabilityDrivers.some(
    (driver) => caseProgress.probabilityAllocation[driver.id] !== caseProgress.revisedProbabilityAllocation[driver.id],
  );

  const moveTo = (stage: ConsultingCaseStage) => {
    setCaseProgress((previous) => ({ ...previous, stage }));
    setView(stage);
  };

  const acknowledgeIntro = () => {
    const nextStep = Math.min(caseProgress.teamIntroStep + 1, team.length);
    if (nextStep >= team.length) {
      setCaseProgress((previous) => ({ ...previous, teamIntroStep: nextStep, stage: "kickoff" }));
      setView("kickoff");
    } else {
      setCaseProgress((previous) => ({ ...previous, teamIntroStep: nextStep }));
    }
  };

  const acknowledgeKickoff = () => {
    setCaseProgress((previous) => ({ ...previous, kickoffAcknowledged: true, stage: "analysis" }));
    setView("analysis");
  };

  const shareFinding = () => {
    setCaseProgress((previous) => ({ ...previous, probabilitySubmitted: true, stage: "team-checkin" }));
    setView("team-checkin");
  };
  const shareRevisedProbability = () => {
    setCaseProgress((previous) => ({ ...previous, probabilityRevised: true }));
  };
  const beginRecommendation = () => moveTo("recommendation");
  const presentRecommendation = () => moveTo("client-readout");

  const answerClientQuestion = (answer: string) => {
    setCaseProgress((previous) => ({
      ...previous,
      clientQuestionAnswered: true,
      clientAnswer: answer,
    }));
  };

  const toggleEvidence = (id: string) => {
    setCaseProgress((previous) => ({
      ...previous,
      selectedEvidence: previous.selectedEvidence.includes(id)
        ? previous.selectedEvidence.filter((item) => item !== id)
        : previous.selectedEvidence.length < 2
          ? [...previous.selectedEvidence, id]
          : previous.selectedEvidence,
    }));
  };

  const caseChatContext = {
    case: "FreshMarket is a three-store grocery business. Leadership wants to understand why profit fell before approving expansion.",
    stage: view,
    selectedStore: caseProgress.selectedStore ?? "No store selected yet",
    hypothesis: caseProgress.selectedHypothesis ?? "No hypothesis recorded yet",
    formula: caseProgress.profitFormulaDraft || "No formula entered",
    initialProbabilities: JSON.stringify(caseProgress.probabilityAllocation),
    revisedProbabilities: JSON.stringify(caseProgress.revisedProbabilityAllocation),
    recommendation: caseProgress.selectedRecommendation ?? "No recommendation selected yet",
    selectedEvidence: caseProgress.selectedEvidence.join(", ") || "No evidence selected yet",
    clientQuestion: "Are we losing customers, spending more to run the stores, or is one location pulling the whole business down?",
  };

  const askTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = chatDraft.trim();
    if (!question || isCaseTeamReplying) return;
    const history = caseProgress.chatMessages.slice(-8).map((message) => ({
      role: message.author === "You" ? "user" as const : "assistant" as const,
      content: message.text,
    }));
    const messagesAfterUser = [...caseProgress.chatMessages, { author: "You" as const, text: question }];
    setCaseProgress((previous) => ({ ...previous, chatMessages: messagesAfterUser }));
    setChatDraft("");
    setIsCaseTeamReplying(true);
    try {
      const reply = await requestSarvamChat({
        mode: "consulting", message: question, history, context: caseChatContext,
        persona: "Maya", role: "Engagement Manager",
      });
      setCaseProgress((previous) => ({ ...previous, chatMessages: [...previous.chatMessages, { author: "Maya", text: reply }] }));
    } catch (error) {
      setCaseProgress((previous) => ({ ...previous, chatMessages: [...previous.chatMessages, { author: "Maya", text: error instanceof Error ? error.message : "Sarvam is temporarily unavailable. Please try again." }] }));
    } finally {
      setIsCaseTeamReplying(false);
    }
  };

  const appendVoiceCaseExchange = (transcript: string, reply: string) => {
    setCaseProgress((previous) => ({
      ...previous,
      chatMessages: [...previous.chatMessages, { author: "You", text: transcript }, { author: "Maya", text: reply }],
    }));
  };

  const updateMetric = (key: ReflectionMetricKey, value: number) => {
    setReflection((previous) => ({
      ...previous,
      metrics: { ...previous.metrics, [key]: value },
    }));
    setReflectionSaved(false);
  };

  const saveReflection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingReflection(true);
    setReflectionSaveError("");
    const savedReflection = { ...reflection, savedAt: new Date().toISOString() };
    try {
      await saveProgress({
        ...progress,
        managementConsulting: caseProgress,
        managementConsultingReflection: savedReflection,
      });
      setReflection(savedReflection);
      setReflectionSaved(true);
    } catch (saveError) {
      console.error("Could not save the management consulting reflection.", saveError);
      setReflectionSaveError("Your reflection could not sync. Check your connection and save again.");
    } finally {
      setIsSavingReflection(false);
    }
  };

  if (view === "team-intro") {
    const intro = team[Math.min(caseProgress.teamIntroStep, team.length - 1)];
    return (
      <main className="consulting-work-page consulting-intro-page">
        <ConsultingTopbar />
        <div className="consulting-intro-layout">
          <div className="consulting-intro-kicker"><span><BriefcaseBusiness size={15} /></span> NORTHSTAR ADVISORY <i /> CLIENT CASE · FM-208</div>
          <p className="eyebrow">BEFORE THE CLIENT KICKOFF</p>
          <h1>Meet your case team.</h1>
          <p className="consulting-intro-lede">You’re joining a small team at Northstar Advisory. They’ll introduce the client problem and help you find your first thread to pull.</p>
          <div className="consulting-intro-card">
            <div className="consulting-intro-people">
              {team.map((member, index) => (
                <div className={`consulting-person-mini${index === caseProgress.teamIntroStep ? " active" : index < caseProgress.teamIntroStep ? " met" : ""}`} key={member.name}>
                  <span className={`consulting-avatar ${member.accent}`}>{index < caseProgress.teamIntroStep ? <Check size={13} /> : member.initial}</span>
                  <span><strong>{member.name}</strong><small>{member.role}</small></span>
                </div>
              ))}
            </div>
            <div className="consulting-intro-message">
              <div className="consulting-message-author"><span className={`consulting-avatar ${intro.accent}`}>{intro.initial}</span><span><strong>{intro.name}</strong><small>{intro.role}</small></span><small className="consulting-live-label">CASE TEAM</small></div>
              <p>{intro.intro}</p>
              <button className="consulting-primary-button" onClick={acknowledgeIntro}>
                {caseProgress.teamIntroStep === team.length - 1 ? "Join the client kickoff" : "Good to meet you · Next teammate"}<ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className="consulting-intro-foot"><span><span className="consulting-status-dot" /> Team online</span><span>Introductions {Math.min(caseProgress.teamIntroStep + 1, team.length)} of {team.length}</span></div>
        </div>
      </main>
    );
  }

  return (
    <main className="consulting-work-page">
      <ConsultingTopbar />
      <div className="consulting-workspace">
        <aside className="consulting-rail">
          <div className="consulting-client-identity"><span className="consulting-client-mark">F</span><span><strong>FreshMarket</strong><small>CLIENT CASE · FM-208</small></span></div>
          <div className="consulting-rail-label">CASE WORK</div>
          <nav className="consulting-case-nav" aria-label="Case stages">
            {stages.map((item, index) => {
              const available = index <= activeStageIndex || item.id === "kickoff";
              const complete = index < activeStageIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!available}
                  className={`${view === item.id ? "active" : ""}${complete ? " complete" : ""}`}
                  onClick={() => available && setView(item.id)}
                >
                  <span className="consulting-stage-mark">{complete ? <Check size={12} /> : `0${index + 1}`}</span>{item.label}
                </button>
              );
            })}
            <button type="button" className={`consulting-chat-nav${view === "team-chat" ? " active" : ""}`} onClick={() => setView("team-chat")}>
              <span className="consulting-stage-mark"><MessageSquareText size={13} /></span>Team chat
            </button>
          </nav>
          <div className="consulting-rail-spacer" />
          <div className="consulting-team-presence"><span className="consulting-status-dot" /> Your case team is online</div>
        </aside>

        <section className="consulting-main">
          <header className="consulting-case-header">
            <div><p className="eyebrow">NORTHSTAR ADVISORY / FRESHMARKET</p><h1>{view === "team-chat" ? "Case team chat" : stages.find((stage) => stage.id === view)?.label ?? "Client brief"}</h1></div>
            <div className="consulting-progress-pill"><span>{completedSteps} / {stages.length}</span><span>case steps</span></div>
          </header>

          {view === "kickoff" && (
            <div className="consulting-content consulting-brief-view">
              <div className="consulting-case-file-label"><BriefcaseBusiness size={15} /> CLIENT BRIEF <span>·</span> 6 MIN READ</div>
              <h2>FreshMarket’s profits are falling.<br />The cause is still unclear.</h2>
              <p className="consulting-brief-lede">FreshMarket is a three-store regional grocery business. Its leadership team has noticed two quarters of declining profits and wants to know what to investigate before approving a regional expansion.</p>
              <div className="consulting-client-quote"><span>CLIENT QUESTION</span><p>“Are we losing customers, spending more to run the stores, or is one location pulling the whole business down?”</p><small>— Nina Patel · FreshMarket Chief Operating Officer</small></div>
              <div className="consulting-training-grid">
                <article><span>01 · STRUCTURE</span><strong>Make a broad problem testable</strong><p>Break “profits are down” into possible changes in revenue and cost. Then compare the locations.</p></article>
                <article><span>02 · EVIDENCE</span><strong>Facts first, assumptions second</strong><p>The spreadsheet gives us a signal. Store conversations may explain it, but they’re leads to test.</p></article>
                <article><span>03 · STORYLINE</span><strong>Answer, evidence, next step</strong><p>A useful recommendation says what to do, why the evidence supports it, and how to learn if it works.</p></article>
              </div>
              <div className="consulting-brief-footer"><div><Users size={16} /><span>Maya, Leena, Dev <small>Case team · 3 people</small></span></div><button className="consulting-primary-button" onClick={acknowledgeKickoff}>I understand · Open the case <ArrowRight size={15} /></button></div>
            </div>
          )}

          {view === "analysis" && (
            <div className="consulting-content consulting-analysis-view">
              <div className="consulting-toolbar"><div><span className="consulting-sheet-icon"><FileSpreadsheet size={16} /></span><span><strong>FreshMarket_store_economics</strong><small>WORKBOOK · TWO PERIOD COMPARISON</small></span></div><span className="consulting-readonly-tag">CLIENT DATA</span></div>
              <p className="consulting-sheet-instructions">Select a store row to inspect its economics. Values are in thousands of dollars (k).</p>
              <div className="consulting-formula-bar"><span>fx</span><code>{caseProgress.selectedStore ? `Selected: ${selectedStore.name}` : "Select a location in the chart or sheet"}</code><span className="consulting-formula-result">Profit change · {caseProgress.selectedStore ? formatMoney(selectedStore.revenueNow - selectedStore.costsNow - (selectedStore.revenueBefore - selectedStore.costsBefore)) : "—"}</span></div>
              <div className="consulting-sheet-scroll"><table className="consulting-sheet">
                <thead><tr><th></th><th>Location</th><th>Revenue<br /><small>prior</small></th><th>Revenue<br /><small>current</small></th><th>Costs<br /><small>prior</small></th><th>Costs<br /><small>current</small></th><th>Profit change</th></tr></thead>
                <tbody>
                  {stores.map((store, index) => {
                    const change = store.revenueNow - store.costsNow - (store.revenueBefore - store.costsBefore);
                    return <tr key={store.id} className={caseProgress.selectedStore === store.id ? "selected" : ""} onClick={() => setCaseProgress((previous) => ({ ...previous, selectedStore: store.id, storeSelectionConfirmed: false }))}>
                      <td className="consulting-row-number">{index + 2}</td><td><button type="button" className="consulting-cell-name" onClick={() => setCaseProgress((previous) => ({ ...previous, selectedStore: store.id, storeSelectionConfirmed: false }))}>{store.name}</button></td><td>{formatMoney(store.revenueBefore)}</td><td>{formatMoney(store.revenueNow)}</td><td>{formatMoney(store.costsBefore)}</td><td>{formatMoney(store.costsNow)}</td><td className={change < 0 ? "negative" : "positive"}>{change < 0 ? "−" : "+"}{formatMoney(Math.abs(change))}</td>
                    </tr>;
                  })}
                  <tr className="consulting-total-row"><td></td><td>Total</td><td>{formatMoney(1230)}</td><td>{formatMoney(1240)}</td><td>{formatMoney(910)}</td><td>{formatMoney(965)}</td><td className="negative">−{formatMoney(45)}</td></tr>
                </tbody>
              </table></div>
              <section className="consulting-exercise-card" aria-labelledby="profit-chart-title">
                <div className="consulting-exercise-heading"><span className="consulting-exercise-number">01</span><div><p className="eyebrow">READ THE CHART</p><h3 id="profit-chart-title">Which store has the largest profit drop?</h3><p>Compare profit before and after. Select a row in the chart, then record your observation.</p></div><span className="consulting-exercise-credit">SIGNAL FINDER</span></div>
                <div className="consulting-profit-chart"><div className="consulting-chart-legend"><span><i className="prior" /> Prior period</span><span><i className="current" /> Current period</span><span>Profit ($k)</span></div>
                  {stores.map((store) => {
                    const profitBefore = store.revenueBefore - store.costsBefore;
                    const profitNow = store.revenueNow - store.costsNow;
                    const change = profitNow - profitBefore;
                    return <button type="button" key={store.id} className={`consulting-chart-row${caseProgress.selectedStore === store.id ? " selected" : ""}`} aria-pressed={caseProgress.selectedStore === store.id} onClick={() => { setCaseProgress((previous) => ({ ...previous, selectedStore: store.id, storeSelectionConfirmed: false })); setChartFeedback(""); }}><span className="consulting-chart-store">{store.name}</span><span className="consulting-chart-bars"><i className="prior" style={{ width: `${(profitBefore / 120) * 100}%` }} /><i className="current" style={{ width: `${(profitNow / 120) * 100}%` }} /></span><span className={`consulting-chart-delta${change < 0 ? " down" : " up"}`}>{change > 0 ? "+" : "−"}${Math.abs(change)}k</span></button>;
                  })}
                </div>
                <div className="consulting-chart-action"><span>{caseProgress.selectedStore ? `Selected: ${selectedStore.name}` : "Select the location with the largest drop"}</span><button type="button" className="consulting-secondary-button" onClick={recordStoreFinding} disabled={!caseProgress.selectedStore || caseProgress.storeSelectionConfirmed}>Record chart finding</button></div>
                {chartFeedback && <p className={`consulting-exercise-feedback${caseProgress.storeSelectionConfirmed ? " success" : ""}`} role="status">{chartFeedback}</p>}
              </section>

              <section className="consulting-exercise-card consulting-formula-exercise" aria-labelledby="formula-task-title">
                <div className="consulting-exercise-heading"><span className="consulting-exercise-number">02</span><div><p className="eyebrow">WRITE A SPREADSHEET FORMULA</p><h3 id="formula-task-title">Calculate Central Market’s profit change.</h3><p>Enter a formula in G2: current-period profit minus prior-period profit. Revenue is in C and D; costs are in E and F.</p></div><span className={`consulting-exercise-credit${caseProgress.formulaCompleted ? " earned" : ""}`}>{caseProgress.formulaCompleted ? <><Check size={11} /> FORMULA CHECKED</> : "WORKBOOK SKILL"}</span></div>
                <form className="consulting-formula-entry" onSubmit={(event) => { event.preventDefault(); checkProfitFormula(); }}><label htmlFor="consulting-profit-formula">G2 <small>fx</small></label><input id="consulting-profit-formula" value={caseProgress.profitFormulaDraft} onChange={(event) => { setCaseProgress((previous) => ({ ...previous, profitFormulaDraft: event.target.value, formulaCompleted: false })); setFormulaFeedback(""); }} placeholder="Start your formula with =" autoComplete="off" spellCheck={false} /><button className="consulting-secondary-button" type="submit">Check formula</button></form>
                {formulaFeedback && <p className={`consulting-exercise-feedback${caseProgress.formulaCompleted ? " success" : ""}`} role="status">{formulaFeedback}</p>}
                <button type="button" className="consulting-hint-button" onClick={() => setFormulaHintLevel((level) => Math.min(level + 1, 2))}>{formulaHintLevel === 0 ? "Need a hint?" : formulaHintLevel === 1 ? "Show one more hint" : "Hide hints"}</button>
                {formulaHintLevel > 0 && <div className="consulting-formula-hint"><Lightbulb size={13} /><span>{formulaHintLevel === 1 ? "Calculate current-period profit first: current revenue minus current costs." : "Then subtract prior-period profit: (current revenue − current costs) − (prior revenue − prior costs)."}</span></div>}
              </section>

              <section className="consulting-exercise-card consulting-probability-exercise" aria-labelledby="probability-task-title">
                <div className="consulting-exercise-heading"><span className="consulting-exercise-number">03</span><div><p className="eyebrow">MAKE A CALL WITH INCOMPLETE EVIDENCE</p><h3 id="probability-task-title">Where do you think the profit drop is coming from?</h3><p>Before the team shares its field notes, distribute 100% across the possible drivers. You can revise your view after the huddle.</p></div><span className="consulting-probability-total">{probabilityDrivers.reduce((total, driver) => total + caseProgress.probabilityAllocation[driver.id], 0)}% allocated</span></div>
                <ProbabilityControls values={caseProgress.probabilityAllocation} onChange={(driver, value) => setProbability("initial", driver, value)} />
                <div className="consulting-probability-stack">{probabilityDrivers.map((driver) => <span key={driver.id} className={driver.color} style={{ width: `${caseProgress.probabilityAllocation[driver.id]}%` }} title={`${driver.label}: ${caseProgress.probabilityAllocation[driver.id]}%`} />)}</div>
                <div className="consulting-probability-key">{probabilityDrivers.map((driver) => <span key={driver.id}><i className={driver.color} />{driver.label} <strong>{caseProgress.probabilityAllocation[driver.id]}%</strong></span>)}</div>
                <div className="consulting-insight-footer"><span><Lightbulb size={14} /> This is your current view, not a test score. Good consultants update it when facts change.</span><button className="consulting-primary-button" disabled={!caseProgress.formulaCompleted || !caseProgress.storeSelectionConfirmed} onClick={shareFinding}>{caseProgress.probabilitySubmitted ? "Estimate shared" : "Lock estimate · Join team huddle"}<ArrowRight size={15} /></button></div>
                {(!caseProgress.formulaCompleted || !caseProgress.storeSelectionConfirmed) && <p className="consulting-exercise-requirements">To unlock the team’s field notes, record the chart finding and check your formula.</p>}
              </section>
            </div>
          )}

          {view === "team-checkin" && (
            <div className="consulting-content consulting-meeting-view">
              <div className="consulting-meeting-banner"><span className="consulting-meeting-live"><i /> CASE TEAM HUDDLE</span><span>Northstar · FreshMarket room</span></div>
              <h2>Quick check-in on the numbers.</h2>
              <p className="consulting-meeting-subtitle">Compare your initial probability estimate with what the case team learned from store managers, then decide whether to update your view.</p>
              <div className="consulting-huddle-messages">
                <ConsultantMessage person={team[1]} text="The chain made about $10k more in revenue, but operating costs increased by $55k. Profit dropped $45k overall. So I’d investigate costs before assuming we need more customers." />
                <ConsultantMessage person={team[2]} text="The Central Market manager told me overtime pay rose 14% and food waste rose 18% this quarter. It’s one manager’s report, so we should treat it as a lead—not proof that the same thing is happening at every store." />
              </div>
              <section className="consulting-estimate-review"><div className="consulting-estimate-column"><p className="eyebrow">YOUR STARTING ESTIMATE</p><ProbabilitySummary values={caseProgress.probabilityAllocation} /></div><div className="consulting-estimate-divider"><ArrowRight size={15} /></div><div className="consulting-estimate-column"><p className="eyebrow">TEAM VIEW AFTER FIELD NOTES</p><ProbabilitySummary values={teamProbabilityView} /></div></section>
              <section className="consulting-revise-estimate"><p className="eyebrow">UPDATE YOUR VIEW</p><h3>How likely is each driver now?</h3><p>You can keep your original estimate or shift it. Your three probabilities always add up to 100%.</p><ProbabilityControls values={caseProgress.revisedProbabilityAllocation} onChange={(driver, value) => setProbability("revised", driver, value)} />{caseProgress.probabilityRevised ? <div className="consulting-exercise-feedback success" role="status">View updated. You shifted the estimate based on the team’s evidence.</div> : <button type="button" className="consulting-secondary-button" disabled={!probabilityRevisionChanged} onClick={shareRevisedProbability}>Share my updated view</button>}</section>
              <div className="consulting-manager-prompt"><div className="consulting-message-author"><span className="consulting-avatar maya">M</span><span><strong>Maya Chen</strong><small>Engagement Manager</small></span></div><p>Whatever you think is most likely, keep the recommendation testable. We have a promising lead, not a proven root cause.</p><button className="consulting-primary-button" disabled={!caseProgress.probabilityRevised} onClick={beginRecommendation}>Build a recommendation <ArrowRight size={15} /></button></div>
            </div>
          )}

          {view === "recommendation" && (
            <div className="consulting-content consulting-recommendation-view">
              <div className="consulting-recommendation-heading"><div><p className="eyebrow">WORKING SLIDE · 01</p><h2>What should FreshMarket do next?</h2><p>Choose a next step and up to two pieces of evidence. Your slide preview updates as you make your case.</p></div><span className="consulting-slide-page">1 <i>/</i> 1</span></div>
              <div className="consulting-recommendation-options">{recommendations.map((option) => <button key={option.id} type="button" className={`${option.tone}${caseProgress.selectedRecommendation === option.id ? " selected" : ""}`} aria-pressed={caseProgress.selectedRecommendation === option.id} onClick={() => setCaseProgress((previous) => ({ ...previous, selectedRecommendation: option.id }))}><span className="consulting-choice-radio" /><span><strong>{option.title}</strong><small>{option.detail}</small></span>{option.tone === "recommended" && <em>TESTABLE PILOT</em>}</button>)}</div>
              <div className="consulting-evidence-picker"><div><p className="eyebrow">SUPPORTING EVIDENCE · CHOOSE UP TO 2</p><p>Which facts best support your next step?</p></div><div className="consulting-evidence-options">{evidence.map((item) => <button type="button" key={item.id} disabled={!caseProgress.selectedEvidence.includes(item.id) && caseProgress.selectedEvidence.length >= 2} aria-pressed={caseProgress.selectedEvidence.includes(item.id)} className={caseProgress.selectedEvidence.includes(item.id) ? "selected" : ""} onClick={() => toggleEvidence(item.id)}><span>{caseProgress.selectedEvidence.includes(item.id) ? <Check size={12} /> : "+"}</span>{item.label}</button>)}</div></div>
              <div className="consulting-slide-preview"><div className="consulting-slide-topline"><span>NORTHSTAR ADVISORY</span><span>FRESHMARKET · 01</span></div><span className="consulting-slide-eyebrow">RECOMMENDATION</span><h3>{chosenRecommendation?.title ?? "Select a recommendation to build your slide"}</h3><div className="consulting-slide-rule" /><p className="consulting-slide-evidence-label">WHAT WE’RE SEEING</p>{caseProgress.selectedEvidence.length ? caseProgress.selectedEvidence.map((id) => <p className="consulting-slide-evidence" key={id}><span>•</span>{evidence.find((item) => item.id === id)?.label}</p>) : <p className="consulting-slide-placeholder">Choose the evidence that makes your recommendation credible.</p>}<p className="consulting-slide-next">NEXT STEP · {chosenRecommendation?.detail ?? "A practical action the client can take now."}</p></div>
              <div className="consulting-submit-row"><span>Strong recommendations make a clear claim and show what supports it.</span><button className="consulting-primary-button" disabled={!chosenRecommendation || caseProgress.selectedEvidence.length === 0} onClick={presentRecommendation}>Present to the client <ArrowRight size={15} /></button></div>
            </div>
          )}

          {view === "client-readout" && (
            <div className="consulting-content consulting-readout-view">
              <div className="consulting-readout-top"><span><Presentation size={16} /> CLIENT READOUT</span><span>FreshMarket leadership · 12 minutes</span></div>
              <h2>Make the next step clear.</h2>
              <p className="consulting-readout-lede">You’ve presented the recommendation. Nina, FreshMarket’s COO, asks how the team will know whether the pilot is working.</p>
              <div className="consulting-presented-recommendation"><span>YOUR RECOMMENDATION</span><strong>{chosenRecommendation?.title ?? "No recommendation selected"}</strong><small>{caseProgress.selectedEvidence.map((id) => evidence.find((item) => item.id === id)?.label).filter(Boolean).join(" · ")}</small></div>
              {!caseProgress.clientQuestionAnswered ? <><div className="consulting-client-question"><span className="consulting-avatar client">N</span><div><strong>Nina Patel <small>Chief Operating Officer · FreshMarket</small></strong><p>“What should we track during the pilot so we can decide whether to expand it?”</p></div></div><div className="consulting-client-answers">{[
                "Review weekly labor hours, food waste, and store profit during the six-week pilot.",
                "Cut operating costs by five percent at every store immediately.",
                "Wait until the end of the year and compare total company profit.",
              ].map((answer) => <button type="button" key={answer} onClick={() => answerClientQuestion(answer)}><span>{answer}</span><ChevronRight size={15} /></button>)}</div></> : <div className="consulting-client-response"><span className="consulting-client-response-check"><Check size={15} /></span><div><strong>Nina’s response</strong><p>{chosenRecommendation?.id === "pilot" && /weekly|labor|waste|pilot/i.test(caseProgress.clientAnswer ?? "") ? "“That gives us a way to learn before we make a chain-wide change. Let’s run the pilot at Central Market and review the results with your team in six weeks.”" : "“That is a clear action. Before we commit broadly, I’d like to understand whether it addresses the store-level issue we saw in the numbers.”"}</p><button className="consulting-primary-button" onClick={() => moveTo("reflection")}>Close the case · Reflect on the work <ArrowRight size={15} /></button></div></div>}
            </div>
          )}

          {view === "reflection" && (
            <div className="consulting-content consulting-reflection-view">
              <div className="consulting-completion-mark"><Check size={18} /></div><p className="eyebrow">CASE COMPLETE · FRESHMARKET</p><h2>You took a client question from uncertainty to a next step.</h2><p className="consulting-reflection-intro">You worked with a case team, compared store economics, tested a spreadsheet formula, updated your view after new evidence, and presented a recommendation. Now capture what the experience felt like for you.</p>
              {reflectionSaved ? <div className="consulting-reflection-saved"><span><Check size={15} /></span><div><strong>Your reflection is saved</strong><p>Management Consulting · {reflection.careerLikelihood} / 10 likelihood to choose this career</p><button type="button" onClick={() => setReflectionSaved(false)}>Edit reflection</button><Link to="/dashboard">View your career dashboard →</Link></div></div> : <form className="consulting-reflection-form" onSubmit={saveReflection}>
                {metrics.map((metric) => <fieldset className="consulting-rating" key={metric.key}><legend>{metric.label}</legend><div>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} out of 5`} aria-pressed={reflection.metrics[metric.key] === value} className={`rating-level-${value}${reflection.metrics[metric.key] === value ? " selected" : ""}`} onClick={() => updateMetric(metric.key, value)}>{value}</button>)}</div><small>Not at all <span>A lot</span></small></fieldset>)}
                <label className="consulting-career-likelihood">How likely are you to consider management consulting as a career?<strong>{reflection.careerLikelihood} <small>/ 10</small></strong><input type="range" min="1" max="10" value={reflection.careerLikelihood} style={{ "--likelihood-progress": `${((reflection.careerLikelihood - 1) / 9) * 100}%` } as CSSProperties & { "--likelihood-progress": string }} onChange={(event) => { setReflection((previous) => ({ ...previous, careerLikelihood: Number(event.target.value) })); setReflectionSaved(false); }} /><small><span>Not likely</span><span>Very likely</span></small></label>
                <label className="consulting-reflection-note">A note for your future self <span>· optional</span><textarea rows={3} value={reflection.note} onChange={(event) => { setReflection((previous) => ({ ...previous, note: event.target.value })); setReflectionSaved(false); }} placeholder="What surprised you? Which parts of the work felt energizing or draining?" /></label>
                <button className="consulting-primary-button" type="submit" disabled={isSavingReflection || Object.values(reflection.metrics).some((value) => value === 0)}>{isSavingReflection ? "Saving reflection…" : "Save to my career dashboard"}<ArrowRight size={15} /></button>{reflectionSaveError && <p className="consulting-save-error" role="alert">{reflectionSaveError}</p>}
              </form>}
            </div>
          )}

          {view === "team-chat" && (
            <div className="consulting-content consulting-chat-view">
              <div className="consulting-chat-header"><span className="consulting-chat-hash">#</span><div><h2>freshmarket-case</h2><p>Case team discussion · Sarvam teammates aware of this case</p></div><span className="consulting-live-label">3 MEMBERS</span></div>
              <div className="consulting-chat-messages" aria-live="polite">{caseProgress.chatMessages.map((message, index) => <div className={`consulting-chat-message${message.author === "You" ? " you" : ""}`} key={`${message.author}-${index}`}><span className={`consulting-avatar ${message.author === "You" ? "you" : message.author.toLowerCase()}`}>{message.author === "You" ? "Y" : message.author[0]}</span><div><strong>{message.author === "You" ? "You" : message.author === "Maya" ? "Maya Chen" : message.author === "Leena" ? "Leena Shah" : "Dev Morgan"}</strong><ChatMessageText text={message.text} /></div></div>)}{isCaseTeamReplying && <p className="ai-reply-status">Maya is replying…</p>}</div>
              <form className="consulting-chat-compose" onSubmit={askTeam}><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Ask about the case, numbers, or recommendation…" aria-label="Message your case team" /><button type="submit" disabled={!chatDraft.trim() || isCaseTeamReplying} aria-label="Send message"><Send size={15} /></button></form>
              <SarvamVoiceControl mode="consulting" history={caseProgress.chatMessages.map((message) => ({ role: message.author === "You" ? "user" : "assistant", content: message.text }))} context={caseChatContext} persona="Maya" role="Engagement Manager" onExchange={appendVoiceCaseExchange} label="Ask the case team by voice" />
            </div>
          )}
        </section>

        <aside className="consulting-context">
          <div className="consulting-context-section"><p className="eyebrow">THE CLIENT</p><div className="consulting-client-card"><span className="consulting-client-mark large">F</span><div><strong>FreshMarket</strong><small>Regional grocery · 3 stores</small></div></div><p className="consulting-context-copy">Leadership wants to understand the profit decline before approving an expansion.</p></div>
          <div className="consulting-context-divider" />
          <div className="consulting-context-section"><p className="eyebrow">CASE PROGRESS</p><div className="consulting-progress-count"><strong>{completedSteps}</strong><span>of {stages.length} steps</span></div><div className="consulting-progress-track"><span style={{ width: `${(completedSteps / stages.length) * 100}%` }} /></div><div className="consulting-mini-steps">{stages.map((item, index) => <span key={item.id} className={index < completedSteps ? "done" : index === completedSteps ? "current" : ""}>{index < completedSteps ? <Check size={11} /> : index + 1}{item.short}</span>)}</div></div>
          <div className="consulting-context-divider" />
          <div className="consulting-context-section"><p className="eyebrow">CASE TEAM</p>{team.map((member) => <div className="consulting-context-person" key={member.name}><span className={`consulting-avatar ${member.accent}`}>{member.initial}</span><span><strong>{member.name}</strong><small>{member.role}</small></span><i /></div>)}</div>
          <div className="consulting-context-tip"><Lightbulb size={14} /><p><strong>Consulting habit</strong> Separate what the evidence shows from what you still need to test.</p></div>
        </aside>
      </div>
      {view !== "team-chat" && <footer className="consulting-work-footer"><Link to="/careers/management-consulting"><ArrowLeft size={13} /> Career overview</Link><span>Case decisions and progress save automatically</span><Link to="/dashboard">Career dashboard <ArrowRight size={13} /></Link></footer>}
    </main>
  );
}

function ProbabilityControls({
  values,
  onChange,
}: {
  values: ConsultingProbabilities;
  onChange: (driver: ConsultingDriver, value: number) => void;
}) {
  return (
    <div className="consulting-probability-controls">
      {probabilityDrivers.map((driver) => (
        <label className="consulting-probability-control" key={driver.id}>
          <span><i className={driver.color} />{driver.label}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={values[driver.id]}
            aria-label={`${driver.label} probability`}
            aria-valuetext={`${values[driver.id]} percent`}
            onChange={(event) => onChange(driver.id, Number(event.target.value))}
          />
          <strong>{values[driver.id]}%</strong>
        </label>
      ))}
    </div>
  );
}

function ProbabilitySummary({ values }: { values: ConsultingProbabilities }) {
  return (
    <div className="consulting-probability-summary">
      <div className="consulting-probability-stack">
        {probabilityDrivers.map((driver) => (
          <span key={driver.id} className={driver.color} style={{ width: `${values[driver.id]}%` }} />
        ))}
      </div>
      {probabilityDrivers.map((driver) => (
        <div className="consulting-probability-summary-row" key={driver.id}>
          <span><i className={driver.color} />{driver.label}</span>
          <strong>{values[driver.id]}%</strong>
        </div>
      ))}
    </div>
  );
}

function ConsultantMessage({ person, text }: { person: (typeof team)[number]; text: string }) {
  return <article className="consulting-huddle-message"><span className={`consulting-avatar ${person.accent}`}>{person.initial}</span><div><div className="consulting-message-author"><strong>{person.name}</strong><small>{person.role}</small></div><p>{text}</p></div></article>;
}

function ConsultingTopbar() {
  return <header className="consulting-topbar"><Link className="consulting-brand" to="/">perspective</Link><span className="consulting-top-divider" /><span className="consulting-org"><span className="consulting-org-mark">N</span> Northstar Advisory</span><span className="consulting-case-label">Management Consulting Simulation</span><Link to="/dashboard" className="consulting-dashboard-link">My dashboard</Link><AccountStatus /></header>;
}

export default ManagementConsultingWork;
