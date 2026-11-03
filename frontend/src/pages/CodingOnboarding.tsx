import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ArrowLeft, ArrowUp, Orbit } from "lucide-react";
import { Link } from "react-router-dom";
import AccountStatus from "../components/AccountStatus";
import ChatMessageText from "../components/ChatMessageText";
import CodeEditor from "../components/CodeEditor";
import SarvamVoiceControl from "../components/SarvamVoiceControl";
import { backendFetch } from "../lib/api";
import { useProgress, type OnboardingProgress } from "../progress/ProgressProvider";
import { requestAIReply, type AIChatMessage } from "../lib/aiChat";

interface Mission {
  id: number;
  title: string;
  description: string;
  taskTitle: string;
  taskDescription: string;
  expectedOutput: string[];
  starterCode: string;
  editorLanguage?: string;
  editorLabel?: string;
  runLabel?: string;
  expectedOutputLabel?: string;
}

const missions: Mission[] = [
  {
    id: 1,
    title: "Your first line of code.",
    description:
      "You don't need to know anything yet. Your first task is simply to make the computer say hello.",
    taskTitle: 'Print "Hello, world!"',
    taskDescription: "Write a Python program that prints the following message:",
    expectedOutput: ["Hello, world!"],
    starterCode: '# Write your Python code here\n\nprint("Hello, world!")',
  },
  {
    id: 2,
    title: "Meet variables.",
    description:
      "Variables let your programs remember information. Store a name, then print it.",
    taskTitle: "Store and print a name",
    taskDescription:
      "Create a variable called name, store your name in it, then print the variable.",
    expectedOutput: ["Your name"],
    starterCode: "# Write your Python code here",
  },
  {
    id: 3,
    title: "Make a decision.",
    description:
      "Programs can make decisions using conditions. Check whether a number is positive or negative.",
    taskTitle: "Check a number",
    taskDescription:
      "Create a variable called number. If it is positive, print Positive. Otherwise, print Negative.",
    expectedOutput: ["Positive"],
    starterCode: "# Try writing a condition\n\nnumber = 10\n\n# Your code here",
  },
  {
    id: 4,
    title: "Let the computer repeat.",
    description:
      "Loops let you repeat an action without writing it over and over. Use a for loop to print the numbers from 1 through 5.",
    taskTitle: "Print the numbers 1 through 5",
    taskDescription: "Write a loop that prints each number on its own line.",
    expectedOutput: ["1", "2", "3", "4", "5"],
    starterCode:
      "# Use a for loop to print 1 through 5\n\nfor number in range(1, 6):\n    # Print the current number",
  },
  {
    id: 5,
    title: "Give your code a name.",
    description:
      "Functions give a useful piece of code a name so you can reuse it. Write a function that doubles a number.",
    taskTitle: "Write a doubling function",
    taskDescription:
      "Create a function called double that returns its number multiplied by 2. Call it with 5 and print the result.",
    expectedOutput: ["10"],
    starterCode:
      "def double(number):\n    # Return the number multiplied by 2\n    pass\n\nprint(double(5))",
  },
  {
    id: 6,
    title: "Organize information.",
    description:
      "Lists keep related items together, and dictionaries label details. Use both to keep a teammate's profile organized.",
    taskTitle: "Build a teammate profile",
    taskDescription:
      "Create a profile dictionary with the name Maya and a skills list containing Python and debugging. Print the name and the first skill, each on its own line.",
    expectedOutput: ["Maya", "Python"],
    starterCode:
      'profile = {"name": "Maya"}\nskills = ["Python", "debugging"]\n\n# Print the name and first skill',
  },
  {
    id: 7,
    title: "Find and fix the bug.",
    description:
      "A teammate's total function runs, but it gives the wrong answer. Trace what happens in the loop and fix the calculation.",
    taskTitle: "Fix the total",
    taskDescription:
      "The function should add every price in the list. Fix the bug so the total for [4, 3, 2] is 9.",
    expectedOutput: ["9"],
    starterCode:
      "def calculate_total(prices):\n    total = 0\n    for price in prices:\n        total = price  # Check this line\n    return total\n\nprint(calculate_total([4, 3, 2]))",
  },
  {
    id: 8,
    title: "Make your first commit.",
    description:
      "Engineers use Git to track changes and share work. Follow the workflow to inspect, stage, and commit a documentation change.",
    taskTitle: "Stage and commit the change",
    taskDescription:
      "README.md has been updated. Check the working tree, stage that file, then commit it with the message shown below.",
    expectedOutput: [
      "git status",
      "git add README.md",
      'git commit -m "Update project docs"',
    ],
    starterCode:
      'git status\ngit add README.md\ngit commit -m "Update project docs"',
    editorLanguage: "shell",
    editorLabel: "terminal",
    runLabel: "Run commands",
    expectedOutputLabel: "COMMAND SEQUENCE",
  },
  {
    id: 9,
    title: "Read a service response.",
    description:
      "Services exchange structured data through APIs. Parse a simulated payment response and pull out the details your team needs.",
    taskTitle: "Inspect the payment response",
    taskDescription:
      "Use json.loads to parse the response, then print the payment ID, status, and amount, each on its own line.",
    expectedOutput: ["PAY-1042", "succeeded", "1250"],
    starterCode:
      'import json\n\nresponse = \'{"payment_id": "PAY-1042", "status": "succeeded", "amount": 1250}\'\npayment = json.loads(response)\n\n# Print the payment ID, status, and amount',
  },
  {
    id: 10,
    title: "Ship a small payment report.",
    description:
      "Bring together the skills you've practiced. A teammate needs a quick total of successful payments, excluding failed attempts.",
    taskTitle: "Calculate the successful payment total",
    taskDescription:
      "Complete the function so it adds the amounts for successful payments only. The report should display the total with two decimal places.",
    expectedOutput: ["Successful payments: $18.50"],
    starterCode:
      'payments = [\n    {"status": "succeeded", "amount": 12.50},\n    {"status": "failed", "amount": 8.00},\n    {"status": "succeeded", "amount": 6.00},\n]\n\ndef successful_total(payments):\n    total = 0\n    for payment in payments:\n        # Only include successful payments\n        pass\n    return total\n\nprint(f"Successful payments: ${successful_total(payments):.2f}")',
  },
];

function getMissionDraft(onboarding: OnboardingProgress | null | undefined, missionId: number) {
  const draft = onboarding?.missionDrafts?.[missionId];
  return draft?.missionId === missionId ? draft : undefined;
}

function CodingOnboarding() {
  const { progress, loading, updateProgress, saveProgress, saveProgressUpdate } = useProgress();
  const savedOnboarding = progress.onboarding;
  const initialMission = Math.min(
    Math.max(savedOnboarding?.currentMission ?? 1, 1),
    missions.length,
  );
  const [code, setCode] = useState(
    getMissionDraft(savedOnboarding, initialMission)?.code ??
      missions[initialMission - 1].starterCode,
  );
  const [output, setOutput] = useState(
    getMissionDraft(savedOnboarding, initialMission)?.output ?? "",
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentMission, setCurrentMission] = useState(initialMission);
  const [tutorMessages, setTutorMessages] = useState<AIChatMessage[]>(() =>
    savedOnboarding?.tutorMessages ?? [
      { role: "assistant", content: "Hey! Welcome to Perspective. I’ll help you work through each mission with hints and questions. What are you wondering about?" },
    ],
  );
  const [tutorDraft, setTutorDraft] = useState("");
  const [chatProvider, setChatProvider] = useState<"gemini" | "sarvam">("gemini");
  const [isTutorReplying, setIsTutorReplying] = useState(false);
  const initialized = useRef(false);
  const completedMissions = savedOnboarding?.completedMissions ?? [];
  const nextIncompleteMission = missions.find(
    (item) => !completedMissions.includes(item.id),
  );
  const activeMissionId = nextIncompleteMission?.id ?? missions.length;
  const mission = missions[currentMission - 1];
  const isCompletedMission = completedMissions.includes(currentMission);
  const completionSnapshot = savedOnboarding?.completedMissionSnapshots?.[currentMission];
  const missionDraft = getMissionDraft(savedOnboarding, currentMission);
  const activeMissionCode = missionDraft?.code ?? mission.starterCode;
  const reviewCode = completionSnapshot?.code ?? mission.starterCode;
  const reviewOutput =
    completionSnapshot?.output ??
    missionDraft?.output ??
    "Mission complete.";

  useEffect(() => {
    if (loading || initialized.current) return;
    initialized.current = true;
    if (savedOnboarding) {
      setCurrentMission(initialMission);
      setCode(
        getMissionDraft(savedOnboarding, initialMission)?.code ??
          missions[initialMission - 1].starterCode,
      );
      setOutput(getMissionDraft(savedOnboarding, initialMission)?.output ?? "");
      return;
    }
    updateProgress((previous) => ({
      ...previous,
      journeyStage: "onboarding",
      onboarding: {
        currentMission,
        completedMissions: [],
        code,
        success: false,
        output,
      },
    }));
  }, [code, currentMission, initialMission, loading, output, savedOnboarding, updateProgress]);

  const updateSavedOnboarding = (
    patch: Partial<NonNullable<typeof progress.onboarding>>,
  ) => {
    updateProgress((previous) => {
      const targetMissionId =
        patch.currentMission ?? previous.onboarding?.currentMission ?? currentMission;
      const targetMission = missions[targetMissionId - 1];
      const existingDraft = getMissionDraft(previous.onboarding, targetMissionId);
      const nextCode =
        patch.code ?? existingDraft?.code ??
        (targetMissionId === currentMission
          ? activeMissionCode
          : targetMission?.starterCode ?? "");
      const nextOutput =
        patch.output ?? existingDraft?.output ??
        (targetMissionId === currentMission ? output : "");

      return {
        ...previous,
        journeyStage: "onboarding",
        onboarding: {
          currentMission: targetMissionId,
          completedMissions: previous.onboarding?.completedMissions ?? [],
          completedMissionSnapshots:
            previous.onboarding?.completedMissionSnapshots ?? {},
          missionDrafts: {
            ...previous.onboarding?.missionDrafts,
            [targetMissionId]: {
              missionId: targetMissionId,
              code: nextCode,
              output: nextOutput,
            },
          },
          code: nextCode,
          success: previous.onboarding?.success ?? false,
          output: nextOutput,
          ...patch,
        },
      };
    });
  };

  const selectMission = (missionId: number) => {
    setCurrentMission(missionId);
    if (completedMissions.includes(missionId)) return;

    const selected = missions[missionId - 1];
    if (!selected) return;
    const savedDraft = getMissionDraft(progress.onboarding, missionId);
    const selectedCode = savedDraft?.code ?? selected.starterCode;
    const selectedOutput = savedDraft?.output ?? "";
    setCode(selectedCode);
    setOutput(selectedOutput);
    updateSavedOnboarding({
      currentMission: missionId,
      code: selectedCode,
      success: false,
      output: selectedOutput,
    });
  };

  const runCode = async () => {
    if (isCompletedMission || currentMission !== activeMissionId) return;
    setIsRunning(true);
    setOutput("Running...");

    try {
      const response = await backendFetch("/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeMissionCode, mission: currentMission }),
      });

      const result = await response.json();

      if (result.success) {
        setOutput(result.stdout);
        const completedIds = Array.from(new Set([...completedMissions, currentMission]));
        const completedProgress = {
          ...progress,
          journeyStage: "onboarding" as const,
          onboarding: {
            currentMission,
            code: activeMissionCode,
            success: false,
            output: result.stdout,
            completedMissions: completedIds,
            missionDrafts: {
              ...progress.onboarding?.missionDrafts,
              [currentMission]: { missionId: currentMission, code: activeMissionCode, output: result.stdout },
            },
            completedMissionSnapshots: {
              ...progress.onboarding?.completedMissionSnapshots,
              [currentMission]: { code: activeMissionCode, output: result.stdout },
            },
          },
        };
        void saveProgress(completedProgress).catch((saveError: unknown) => {
          console.error("Could not save the completed mission.", saveError);
        });
      } else if (result.stderr) {
        setOutput(result.stderr);
        updateSavedOnboarding({ code: activeMissionCode, success: false, output: result.stderr });
      } else {
        const nextOutput = result.stdout || "Incorrect output.";
        setOutput(nextOutput);
        updateSavedOnboarding({ code: activeMissionCode, success: false, output: nextOutput });
      }
    } catch {
      const nextOutput = "Could not connect to the Perspective backend.";
      setOutput(nextOutput);
      updateSavedOnboarding({ code: activeMissionCode, success: false, output: nextOutput });
    } finally {
      setIsRunning(false);
    }
  };

  const continueMission = () => {
    const nextMission = missions[activeMissionId - 1];
    if (!nextMission) return;
    selectMission(nextMission.id);
  };

  const persistTutorMessages = (messages: AIChatMessage[]) =>
    saveProgressUpdate((previous) => ({
      ...previous,
      journeyStage: "onboarding",
      onboarding: {
        ...(previous.onboarding ?? {
          currentMission,
          completedMissions: [],
          code: activeMissionCode,
          success: false,
          output,
        }),
        tutorMessages: messages,
      },
    }));

  const askTutor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = tutorDraft.trim();
    if (!question || isTutorReplying) return;
    const history = tutorMessages.slice(-8);
    const messagesAfterUser = [...tutorMessages, { role: "user" as const, content: question }];
    setTutorMessages(messagesAfterUser);
    void persistTutorMessages(messagesAfterUser)
      .catch((saveError: unknown) => console.error("Could not save your tutor message.", saveError));
    setTutorDraft("");
    setIsTutorReplying(true);
    try {
      const reply = await requestAIReply({
        mode: "tutor",
        provider: chatProvider,
        message: question,
        history,
        context: {
          mission: `Mission ${mission.id}: ${mission.title}`,
          task: `${mission.taskTitle}. ${mission.taskDescription}`,
          code: activeMissionCode,
          output: output || "No code has been run yet.",
        },
      });
      const nextMessages = [...messagesAfterUser, { role: "assistant" as const, content: reply }];
      setTutorMessages(nextMessages);
      void persistTutorMessages(nextMessages)
        .catch((saveError: unknown) => console.error("Could not save the tutor reply.", saveError));
    } catch (error) {
      const nextMessages = [...messagesAfterUser, {
        role: "assistant" as const,
        content: error instanceof Error ? error.message : "I couldn't reply just now. Please try again.",
      }];
      setTutorMessages(nextMessages);
      void persistTutorMessages(nextMessages)
        .catch((saveError: unknown) => console.error("Could not save the tutor error message.", saveError));
    } finally {
      setIsTutorReplying(false);
    }
  };

  const appendVoiceTutorExchange = (transcript: string, reply: string) => {
    const exchange: AIChatMessage[] = [
      { role: "user", content: transcript },
      { role: "assistant", content: reply },
    ];
    const next = [...tutorMessages, ...exchange];
    setTutorMessages(next);
    void persistTutorMessages(next).catch((saveError: unknown) => console.error("Could not save the voice tutor exchange.", saveError));
  };

  return (
    <main className="onboarding">
      <header className="onboarding-header">
        <div className="onboarding-header-start">
          <Link className="onboarding-back-home" to="/"><ArrowLeft size={15} /> Back to home</Link>
          <div className="brand">perspective</div>
        </div>
        <div className="progress">
          <span>CODING ONBOARDING</span>
          <strong>{currentMission} / {missions.length}</strong>
        </div>
        <AccountStatus />
      </header>

      <div className="onboarding-layout">
        <aside className="lesson-sidebar">
          <p className="sidebar-label">YOUR JOURNEY</p>
          {missions.map((item) => (
            <button
              type="button"
              className={`lesson${item.id === currentMission ? " active" : ""}${completedMissions.includes(item.id) ? " is-completed" : ""}`}
              key={item.id}
              disabled={isRunning || (!completedMissions.includes(item.id) && item.id !== activeMissionId)}
              onClick={() => selectMission(item.id)}
              aria-label={`${item.id === currentMission ? "Selected, " : ""}${[
                "Your First Code", "Variables", "Conditions", "Loops", "Functions",
                "Lists / Dictionaries", "Debugging", "Terminal + Git", "APIs", "Mini Project",
              ][item.id - 1]}${completedMissions.includes(item.id) ? ", completed, review only" : item.id === activeMissionId ? ", current mission" : ", not yet available"}`}
            >
              <span className="lesson-number">
                {completedMissions.includes(item.id)
                  ? <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  : String(item.id).padStart(2, "0")}
              </span>
              <div>
                <strong>
                  {[
                    "Your First Code",
                    "Variables",
                    "Conditions",
                    "Loops",
                    "Functions",
                    "Lists / Dictionaries",
                    "Debugging",
                    "Terminal + Git",
                    "APIs",
                    "Mini Project",
                  ][item.id - 1]}
                </strong>
                <small>
                  {completedMissions.includes(item.id)
                    ? "Completed · review only"
                    : item.id === activeMissionId
                      ? "Current mission"
                      : "Coming next"}
                </small>
              </div>
            </button>
          ))}
        </aside>

        <section className="lesson-content">
          <p className="eyebrow">MISSION {String(mission.id).padStart(2, "0")}</p>
          <h1>{mission.title}</h1>
          <p className="lesson-description">{mission.description}</p>

          <div className="task-card">
            <p className="task-label">YOUR TASK</p>
            <h2>{mission.taskTitle}</h2>
            <p>{mission.taskDescription}</p>
            {mission.expectedOutput.length > 0 && (
              <>
                {mission.expectedOutputLabel && (
                  <p className="task-label mission-output-label">
                    {mission.expectedOutputLabel}
                  </p>
                )}
                <div className="expected-output">
                  {mission.expectedOutput.map((line, index) => (
                    <span key={`${line}-${index}`}>
                      {line}
                      {index < mission.expectedOutput.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="coding-environment">
            <div className="editor-header">
              <span>{isCompletedMission ? "COMPLETED · READ-ONLY REVIEW" : mission.editorLabel ?? "main.py"}</span>
              {!isCompletedMission && (
                <button className="run-button" onClick={runCode} disabled={isRunning || currentMission !== activeMissionId}>
                  {isRunning ? "Running..." : mission.runLabel ?? "Run code"}
                </button>
              )}
            </div>

            <CodeEditor
              key={`${currentMission}-${isCompletedMission ? "review" : "active"}`}
              value={isCompletedMission ? reviewCode : activeMissionCode}
              readOnly={isCompletedMission}
              onChange={(nextCode) => {
                if (isCompletedMission) return;
                setCode(nextCode);
                updateSavedOnboarding({ code: nextCode });
              }}
              language={mission.editorLanguage}
            />

            <div className="terminal-output">
              <div className="terminal-label">OUTPUT</div>
              <div className="terminal-placeholder">
                {isCompletedMission ? reviewOutput : output || "Run your code to see the output here."}
              </div>
            </div>
            {isCompletedMission && (
              <div className="mission-success">
                <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                {currentMission === missions.length ? "Coding onboarding complete · review only" : "Mission complete · review only"}
                {currentMission === missions.length && (
                  <p className="onboarding-complete-note">
                    You have the foundations. Next, step into a software engineering team's work.
                  </p>
                )}
                {!completionSnapshot && (
                  <p className="onboarding-complete-note">
                    This mission was completed before review history was saved. Its original code is unavailable.
                  </p>
                )}
              </div>
            )}
            {isCompletedMission && currentMission === missions.length && (
              <Link className="enter-workplace-button" to="/careers/software-engineering/work">
                Enter the NovaPay workplace <span aria-hidden="true">→</span>
              </Link>
            )}
            {isCompletedMission && nextIncompleteMission && (
              <button className="continue-button" onClick={continueMission}>
                Continue to Mission {String(activeMissionId).padStart(2, "0")} →
              </button>
            )}
          </div>
        </section>

        <aside className="tutor-panel">
          <div className="tutor-header">
            <div className="tutor-avatar"><Orbit size={18} strokeWidth={1.7} aria-hidden="true" /></div>
            <div>
              <strong>ORBIT</strong>
              <small>Your guide through the unknown</small>
            </div>
            <label className="tutor-model-select">
              <span>Model</span>
              <select value={chatProvider} onChange={(event) => setChatProvider(event.target.value as "gemini" | "sarvam")} aria-label="Choose chat model">
                <option value="gemini">Gemini</option>
                <option value="sarvam">Sarvam</option>
              </select>
            </label>
          </div>
          <div className="tutor-message" aria-live="polite">
            <div className="orbit-field-note"><span>FIELD NOTE</span><p>“Every bug leaves a trail.”</p></div>
            {tutorMessages.map((message, index) => (
              <div className={`tutor-chat-message ${message.role}`} key={`${index}-${message.role}`}>
                <ChatMessageText text={message.content} />
              </div>
            ))}
            {isTutorReplying && <p className="tutor-chat-status">Thinking…</p>}
          </div>
          <form className="tutor-input" onSubmit={askTutor}>
            <input
              value={tutorDraft}
              onChange={(event) => setTutorDraft(event.target.value)}
              placeholder="Ask for a hint..."
              aria-label="Ask ORBIT"
              maxLength={4000}
            />
            <button type="submit" disabled={!tutorDraft.trim() || isTutorReplying} aria-label="Send question">
              <ArrowUp size={16} />
            </button>
          </form>
          <SarvamVoiceControl
            mode="tutor"
            history={tutorMessages}
            context={{
              mission: `Mission ${mission.id}: ${mission.title}`,
              task: `${mission.taskTitle}. ${mission.taskDescription}`,
              code: activeMissionCode,
              output: output || "No code has been run yet.",
            }}
            onExchange={appendVoiceTutorExchange}
            label="Ask ORBIT by voice"
          />
        </aside>
      </div>
    </main>
  );
}

export default CodingOnboarding;
