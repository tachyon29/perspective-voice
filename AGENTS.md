# Perspective — Codex Project Context

> This file is the persistent context for AI coding agents working on Perspective.
> Read this file before making changes to the repository.
> Do not assume that the current implementation represents the final architecture.
> Preserve existing decisions unless explicitly asked to change them.

---

# 1. PRODUCT

## Name

Perspective

## Core idea

Perspective is a career exploration and simulation platform.

Tagline:

> Experience a career before choosing it.

The fundamental problem:

Most people choose careers by reading:
- job descriptions
- salary reports
- Reddit posts
- career guides
- college brochures
- YouTube videos

This gives people information about careers, but not an actual understanding of what the work feels like.

Perspective lets users EXPERIENCE a career before committing to it.

Instead of:

Career description
→ read about work
→ imagine what it is like

Perspective should eventually provide:

Career
→ realistic environment
→ realistic tasks
→ realistic decisions
→ realistic collaboration
→ realistic feedback
→ experience

The goal is not to make a game.

The goal is to create a realistic career simulation.

---

# 2. INITIAL MVP

The first career being built is:

Software Engineering

Do NOT build multiple careers yet.

The initial goal is to prove that Perspective can create a convincing software engineering experience.

Future careers may include:

- Data Analyst
- Product Manager
- Consultant
- Financial Analyst
- Researcher
- Designer
- etc.

But these are future roadmap items.

Focus on Software Engineering until the core simulation works.

---

# 3. SOFTWARE ENGINEERING USER FLOW

Current route:

/careers/software-engineering

The user sees:

SOFTWARE ENGINEERING

"Experience the work."

Then chooses between two paths.

## Path 1

"I'm new to coding"

This sends the user to:

/careers/software-engineering/onboarding

This is the coding onboarding experience.

## Path 2

"I already know how to code"

This eventually sends the user to:

/careers/software-engineering/work

This will eventually be the full software engineering workplace simulation.

The workplace route is not yet fully implemented.

---

# 4. CODING ONBOARDING

The coding onboarding should NOT feel like a generic online Python course.

Bad:

Lesson
→ read paragraph
→ watch video
→ answer quiz
→ next lesson

Perspective should instead feel like:

Mission
→ understand objective
→ write code
→ run code
→ get feedback
→ solve
→ unlock next mission

The learner should learn programming by doing.

---

# 5. CODING ONBOARDING PRINCIPLES

## Principle 1 — Hands-on first

Explain only what is necessary.

The user should write code quickly.

## Principle 2 — Context over theory

Instead of:

"Variables are named references to objects in memory..."

Prefer:

"Your program needs to remember someone's name. Store it in a variable."

Then let the user write:

name = "Aman"

## Principle 3 — AI should teach, not cheat

The AI tutor should NOT immediately give the answer.

If a learner asks:

"How do I solve this?"

The tutor should preferably:

1. Ask what they have tried.
2. Identify where they are stuck.
3. Give a conceptual hint.
4. Give a smaller hint if necessary.
5. Only provide more direct guidance after repeated attempts.

The goal is learning, not answer generation.

## Principle 4 — Deterministic validation

For basic coding missions, use deterministic validation.

Do NOT ask an LLM:

"Did the student solve this coding problem correctly?"

Instead:

code
→ execute
→ tests
→ pass/fail

Use AI where deterministic logic is insufficient.

---

# 6. CURRENT CODING MISSIONS

Current onboarding missions:

## Mission 01 — Your First Code

Concept:

print()

Task:

Print:

Hello, world!

Example solution:

print("Hello, world!")

Validation:

stdout must equal:

Hello, world!

---

## Mission 02 — Variables

Concept:

Variables

Task:

Create a variable called `name` and print it.

Example:

name = "Aman"
print(name)

The actual name should not matter.

The system should verify that the user is actually using the variable.

---

## Mission 03 — Conditions

Concept:

if / else

Task:

Create a variable called `number`.

If it is positive:

print("Positive")

Otherwise:

print("Negative")

Example:

number = 10

if number > 0:
    print("Positive")
else:
    print("Negative")

---

## Mission 04 — Loops

Concept:

for loops

Task:

Print numbers 1 through 5, one per line.

Expected:

1
2
3
4
5

Example:

for i in range(1, 6):
    print(i)

---

# 7. PLANNED CODING MISSIONS

After Mission 04:

05 — Functions

06 — Lists / Dictionaries

07 — Debugging

08 — Terminal + Git

09 — APIs

10 — Mini Engineering Project

These are planned, not necessarily implemented.

Do not blindly implement all of them at once.

Build incrementally and test the user experience.

---

# 8. CURRENT FRONTEND

Frontend stack:

- React
- Vite
- TypeScript
- React Router
- Monaco Editor
- lucide-react

Current frontend structure:

frontend/

src/

components/

CodeEditor.tsx

pages/

Landing.tsx
SoftwareEngineering.tsx
CodingOnboarding.tsx

App.tsx
index.css
main.tsx

---

# 9. CURRENT ROUTES

Current React routes:

/

→ Landing

/careers/software-engineering

→ SoftwareEngineering

/careers/software-engineering/onboarding

→ CodingOnboarding

Future:

/careers/software-engineering/work

→ Workplace simulation

This route is not fully implemented yet.

---

# 10. CURRENT FRONTEND COMPONENTS

## CodeEditor.tsx

Uses:

@monaco-editor/react

The editor is configured for Python.

Important existing behavior:

- Monaco editor
- Python language
- dark editor theme
- minimap disabled
- automatic layout
- scroll handling
- controlled `value`
- `onChange`

Do not replace Monaco with a textarea unless explicitly requested.

---

# 11. CURRENT CODING ONBOARDING UI

The onboarding screen currently has three main areas.

## Left sidebar

Shows:

YOUR JOURNEY

Mission list.

Example:

01 Your First Code
02 Variables
03 Conditions
04 Loops
05 Functions

Current mission is visually highlighted.

## Center

Contains:

- mission number
- mission title
- mission description
- task card
- expected output
- Monaco code editor
- Run code button
- terminal/output area
- mission completion state
- Continue button

## Right

AI tutor panel.

Current concept:

Perspective Tutor

The tutor should eventually become a real contextual AI tutor.

---

# 12. UI / DESIGN LANGUAGE

Perspective should feel like serious professional software.

Reference aesthetic:

- Linear
- Stripe
- Slack
- GitHub
- modern developer tools

Avoid:

- excessive gradients
- glassmorphism
- giant glowing AI buttons
- excessive rounded cards
- "AI sparkle" everywhere
- flashy animations
- generic startup landing-page aesthetics
- "vibecoded" UI

Prefer:

- whitespace
- typography
- hierarchy
- subtle borders
- restrained colors
- small shadows
- clear spacing
- responsive layouts
- reusable components
- professional developer-tool aesthetics

The product should look credible enough that someone could imagine using it professionally.

---

# 13. IMPORTANT CSS RULE

Do NOT use broad global selectors for application UI.

For example, avoid:

section { ... }

div { ... }

button { ... }

especially selectors that can accidentally affect third-party components.

This previously caused a serious Monaco Editor UI bug because global `section` styling affected Monaco's internal DOM.

Prefer:

.landing-page section { ... }

.career-page { ... }

.onboarding { ... }

.coding-environment { ... }

etc.

Scope page-specific styles to page/component classes.

---

# 14. CURRENT BACKEND

Backend stack:

- Python
- FastAPI
- Uvicorn

Location:

backend/main.py

Supabase Auth and the `user_progress` table provide account and progress persistence. The frontend uses the Supabase anon/publishable key under row-level security. FastAPI validates Supabase access tokens before handling AI and execution requests. Do not restore local SQLAlchemy/PostgreSQL auth or progress storage.

There is a local Python execution endpoint:

POST /execute

Request:

{
  "code": "...",
  "mission": 1
}

Response:

{
  "stdout": "...",
  "stderr": "...",
  "exit_code": 0,
  "success": true
}

---

# 15. CURRENT CODE EXECUTION FLOW

Current flow:

Monaco Editor
→ user clicks Run code
→ React fetch()
→ FastAPI /execute
→ temporary .py file
→ Python subprocess
→ stdout/stderr
→ validation
→ JSON response
→ React
→ terminal output
→ success state

The current Python execution is LOCAL DEVELOPMENT ONLY.

IMPORTANT:

The current implementation uses subprocess execution.

DO NOT expose this publicly.

Before production deployment, code execution must be moved into a proper sandbox/container with:

- CPU limits
- memory limits
- execution timeout
- process limits
- filesystem isolation
- network restrictions
- restricted permissions
- cleanup

Never expose arbitrary host-level Python execution to untrusted users.

---

# 16. CURRENT BACKEND VALIDATION

The backend currently validates missions using mission IDs.

Current conceptual structure:

if mission == 1:
    validate Hello World

elif mission == 2:
    validate variables

elif mission == 3:
    validate conditions

elif mission == 4:
    validate loops

This is acceptable temporarily.

However, this should NOT grow indefinitely.

Before implementing many more missions, refactor this into a reusable simulation/mission system.

---

# 17. IMPORTANT ARCHITECTURAL PRINCIPLE

Perspective has two fundamentally different systems.

## Simulation Engine

The simulation engine owns reality.

It should eventually control:

- current mission
- mission definitions
- user progress
- task state
- validation
- tests
- events
- environment state
- deadlines
- tickets
- repository state
- Slack events
- incidents
- evaluation
- progression

The simulation engine should be deterministic wherever possible.

## AI Layer

The AI interprets reality.

AI should eventually control:

- tutor conversations
- teammate conversations
- contextual explanations
- hints
- code review feedback
- simulated coworker behavior
- workplace conversations
- meeting dialogue
- incident discussions
- natural-language interaction

The core principle:

> SIMULATION ENGINE OWNS REALITY.
>
> AI INTERPRETS REALITY.

Do not reverse these responsibilities.

---

# 18. FUTURE SIMULATION ARCHITECTURE

Eventually the project should look roughly like:

simulation/

engine/
    engine.py
    state.py
    events.py
    evaluator.py

missions/
    mission_01.py
    mission_02.py
    mission_03.py
    ...

workplace/
    company.py
    teams.py
    tickets.py
    incidents.py
    repository.py
    slack.py

But do not create all of this prematurely.

Only introduce abstractions when the current implementation justifies them.

---

# 19. FUTURE SOFTWARE ENGINEERING WORKPLACE

After onboarding, the user enters a simulated company.

Working fictional company example:

NovaPay

The user joins:

Payments Engineering

Role:

Software Engineer

The experience should simulate actual software engineering work.

The user should encounter:

- tickets
- repository
- IDE
- terminal
- tests
- pull requests
- code reviews
- Slack
- design documents
- bugs
- incidents
- deadlines
- technical discussions
- teammates
- engineering manager
- standups
- meetings

The user should not simply receive isolated coding questions.

They should experience work.

---

# 20. WORKPLACE SIMULATION EXAMPLE

User joins NovaPay.

Initial briefing:

"Welcome to NovaPay.

You're joining the Payments Engineering team.

Your team maintains the services responsible for processing customer payments.

Your first task is waiting in the engineering queue."

Then the user receives a realistic ticket.

Example:

PAY-142

"Add idempotency protection to the payment creation endpoint."

The user should investigate the repository, understand existing code, make changes, run tests, and submit the work.

---

# 21. SIMULATED COMPANY ENVIRONMENT

Potential UI:

------------------------------------------------
| NovaPay | Search | Notifications | Profile  |
------------------------------------------------
| Slack  | Jira | Repository | Terminal       |
------------------------------------------------
|                                              |
|                 Main Workspace               |
|                                              |
------------------------------------------------

The user should feel like they have entered a real engineering organization.

---

# 22. SIMULATED SLACK

Potential channels:

#general
#engineering
#backend
#incidents
#random

Messages should be contextual to the current simulation state.

Example:

Priya:
"Hey, I noticed PAY-142 is assigned to you. Let me know if you need any context on the payment service."

The AI should know:

- what ticket the user is working on
- what stage they are at
- what the repository contains
- what teammates know
- what events have occurred

Do not generate completely random Slack messages.

---

# 23. AI TEAMMATES

Potential personas:

Priya
Backend Engineer

Arjun
Senior Engineer

Maya
Engineering Manager

AI Code Reviewer

These are examples.

The AI should have role-specific behavior.

A junior engineer should not talk exactly like an engineering manager.

The AI should have access to simulation state.

---

# 24. AI TUTOR

The tutor is different from workplace teammates.

During onboarding:

Perspective Tutor

Purpose:

- explain concepts
- give hints
- diagnose confusion
- encourage experimentation
- avoid instantly giving solutions

Example:

User:

"I don't understand loops."

Tutor:

"Think about what would happen if you had to print 1 through 100 manually. What would you want the computer to repeat for you?"

The tutor should adapt to what the user has already tried.

---

# 25. CALLS / VOICE

Eventually users should be able to "call" simulated teammates.

Do not build complicated real-time voice infrastructure too early.

Initial implementation can be:

voice input
→ same contextual AI agent
→ voice/text response

The underlying agent should share the same simulation state.

Build real-time infrastructure only if the MVP actually needs it.

---

# 26. AI MUST NOT BECOME A CHEAT BUTTON

This is critical.

Bad:

User:
"How do I solve this?"

AI:
"Here is the exact solution."

Better:

AI:
"What have you tried so far?"

Then:

AI:
"Look at the part where you need to repeat the same operation. What Python construct lets you repeat something?"

Then more explicit help if needed.

The AI should simulate mentorship rather than an answer vending machine.

---

# 27. FUTURE WORKPLACE TASK TYPES

Not every task should be pure coding.

Possible tasks:

- implement feature
- fix bug
- debug failing test
- investigate production issue
- review PR
- read design document
- respond to teammate
- choose between implementation approaches
- estimate task
- write tests
- investigate logs
- diagnose incident
- participate in standup
- make a technical tradeoff

This is what differentiates Perspective from a coding platform.

---

# 28. CAREER SIMULATION PHILOSOPHY

The goal is not:

"Can you solve LeetCode?"

The goal is:

"Do you understand what doing this career actually feels like?"

For software engineering, that includes:

- ambiguous requirements
- debugging
- reading unfamiliar code
- communication
- collaboration
- prioritization
- code reviews
- technical decisions
- maintenance
- incidents
- shipping

---

# 29. MVP PHILOSOPHY

Build the smallest thing that proves the core idea.

Do NOT build:

- a massive social network
- dozens of careers
- complex analytics
- unnecessary microservices
- elaborate voice infrastructure
- complicated multiplayer systems
- huge AI orchestration frameworks

First prove:

1. User enters Perspective.
2. User chooses Software Engineering.
3. User chooses beginner/existing coder.
4. Beginner can learn enough Python through missions.
5. User experiences increasingly realistic work.
6. The experience feels different from reading a career guide.
7. User reaches the end with a better understanding of whether software engineering suits them.

---

# 30. DEVELOPMENT PHILOSOPHY

Always:

1. Inspect existing code.
2. Understand current architecture.
3. Make the smallest change.
4. Test.
5. Report what changed.
6. Avoid unrelated refactors.

When asked to implement something:

Do not just describe code.

Actually edit the repository when the environment allows it.

---

# 31. BEFORE EDITING

Before modifying a file:

- inspect the existing implementation
- search for relevant symbols
- understand imports
- understand state flow
- understand existing CSS
- check whether functionality already exists

Do not blindly replace entire files unless necessary.

---

# 32. AFTER EDITING

After changes:

- check TypeScript errors
- check Python syntax
- run relevant tests
- inspect git diff
- identify unintended changes

Do not silently modify unrelated files.

---

# 33. DEPENDENCY POLICY

Avoid adding dependencies unless they are genuinely needed.

Before installing a package:

1. Check whether an existing dependency can solve the problem.
2. Consider whether the functionality can be implemented cleanly without a dependency.
3. If a dependency is necessary, explain why.

---

# 34. FRONTEND STATE

Onboarding and workplace progress is stored in Supabase `public.user_progress`. The frontend reads and upserts the current user's row; row-level security must remain enabled and restrict access to `auth.uid() = user_id`.

---

# 35. AUTHENTICATION

Supabase Auth is the active authentication system. Do not add a parallel password/session store to FastAPI.

Possible user state:

User
→ career
→ simulation
→ progress
→ mission state
→ evaluation

---

# 36. DATABASE

Use Supabase only for the existing user accounts and saved progress table. Add database tables only when a product feature needs them.

---

# 37. CURRENT LOCAL DEVELOPMENT

Frontend:

cd frontend
npm run dev

Usually available at:

http://localhost:5173

Backend:

cd backend
source .venv/bin/activate
python -m uvicorn main:app --reload --port 8000

Backend:

http://127.0.0.1:8000

Supabase settings live in `frontend/.env.local` and `backend/.env`. No local PostgreSQL service or Alembic step is used.

Health:

GET /health

Execution:

POST /execute

---

# 38. CORS

The backend currently allows local frontend origins:

http://localhost:5173

http://127.0.0.1:5173

Do not remove CORS configuration unless intentionally changing the development architecture.

---

# 39. FILE RESPONSIBILITIES

Landing.tsx

Responsible for:
- landing page
- career discovery

SoftwareEngineering.tsx

Responsible for:
- software engineering career introduction
- choosing onboarding/workplace path

CodingOnboarding.tsx

Currently responsible for:
- onboarding UI
- mission display
- editor
- run action
- output
- progression

However, this file should eventually become thinner.

Do not allow it to become a giant monolithic component.

CodeEditor.tsx

Responsible for:
- Monaco editor only

backend/main.py

Currently responsible for:
- FastAPI application
- code execution
- temporary validation

This will eventually need to delegate simulation logic to the simulation package.

---

# 40. REFACTORING TRIGGER

When there are enough missions that `main.py` contains many:

if request.mission == 1
elif request.mission == 2
elif request.mission == 3
...

STOP.

Refactor.

Likewise, if CodingOnboarding.tsx contains huge nested conditionals for every mission:

currentMission === 1
currentMission === 2
currentMission === 3
...

STOP.

Move mission definitions into data/configuration.

Desired direction:

missions = [
    {
        id: 1,
        title: "...",
        description: "...",
        starterCode: "...",
        validator: ...
    },
    ...
]

Then render based on the current mission.

Do not over-engineer this abstraction.

---

# 41. SECURITY

Current arbitrary Python execution is for local development only.

Before any public deployment:

- sandbox execution
- isolate processes
- disable network access
- limit CPU
- limit memory
- limit execution time
- limit disk usage
- clean temporary files
- restrict system calls
- run as unprivileged user/container
- prevent host filesystem access

Never deploy the current subprocess implementation as-is.

---

# 42. FUTURE DEPLOYMENT

The MVP should be designed to work with free/low-cost infrastructure where possible.

Potential stack:

Frontend:
Vercel / Cloudflare / similar

Backend:
Render / Railway / Fly / similar

Database:
Supabase

But do not make deployment decisions prematurely.

The architecture should remain portable.

Do not assume GitHub Student Developer Pack benefits.

The MVP must not depend on them.

---

# 43. PRODUCT STRATEGY

Perspective is not primarily a coding education product.

Coding onboarding is a gateway.

The larger product is career simulation.

The important distinction:

Coding platform:
"Learn to code."

Perspective:
"Experience what this career is like."

The coding onboarding exists because some users need enough technical ability to participate in the simulation.

---

# 44. FUTURE EVALUATION

Eventually Perspective should produce useful reflections after a simulation.

Potential dimensions:

- enjoyment
- problem-solving preference
- ambiguity tolerance
- collaboration preference
- debugging tolerance
- communication
- technical interest
- work-style preference

Important:

Do not reduce a complex career fit to a simplistic score without careful product design.

The goal is reflection and evidence from experience.

---

# 45. PRODUCT LANGUAGE

Preferred language:

"Experience the work."

"Step into the role."

"Your first task."

"Join the team."

"Investigate the issue."

"Talk to your teammate."

"Submit your work."

Avoid generic AI marketing language such as:

"Unlock your potential with revolutionary AI."

Perspective should sound like a serious product.

---

# 46. CURRENT PRIORITY

The current priority is:

Finish the coding onboarding MVP.

Current state:

Mission 01 — implemented
Mission 02 — implemented
Mission 03 — implemented
Mission 04 — being implemented

After Mission 04:

DO NOT immediately build Missions 05–10.

First refactor the mission system into a reusable simulation structure.

Then continue with:

Mission 05 — Functions
Mission 06 — Lists / Dictionaries
Mission 07 — Debugging
Mission 08 — Terminal + Git
Mission 09 — APIs
Mission 10 — Mini Engineering Project

After onboarding is convincing:

Begin the workplace simulation.

---

# 47. WHEN MAKING ARCHITECTURAL DECISIONS

Prefer:

simple
→ explicit
→ testable
→ extensible

over:

clever
→ abstract
→ framework-heavy
→ difficult to understand

The project is an MVP.

Do not build enterprise architecture before the product is validated.

---

# 48. WHEN UNSURE

If a requested change conflicts with an existing architectural decision:

1. Inspect the repository.
2. Explain the conflict briefly.
3. Prefer the smallest compatible solution.
4. Ask before making a large architectural change.

Do not silently redesign Perspective.

---

# 49. IMPORTANT CONTEXT FOR ALL CODING AGENTS

Perspective is being built as a real startup/product, not merely as a demo coding exercise.

The current code may be rough because the product is being built iteratively.

Preserve momentum.

Do not optimize prematurely.

Do not rewrite working code merely because you would architect it differently from scratch.

The priority is:

PRODUCT EXPERIENCE
→ FUNCTIONALITY
→ CLEAN ARCHITECTURE
→ SCALE

in that order.

---

# 50. DEFAULT AGENT BEHAVIOR

Whenever asked to implement something:

1. Read this file.
2. Inspect relevant source files.
3. Summarize what you found in 2–5 bullets.
4. Make the requested change.
5. Run relevant checks.
6. Show the resulting diff or summarize changed files.
7. Mention any remaining issue.
8. Do not modify unrelated code.

Never fabricate that a test passed if it was not actually run.

Never claim a file was modified unless it was actually modified.

Never expose secrets or API keys.

Never commit changes unless explicitly asked.

---

# END OF AGENTS.md

