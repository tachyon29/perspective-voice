export const CAREER_REFLECTION_STORAGE_KEY = "perspective-career-reflection";
export const CAREER_REFLECTION_IMPORT_OWNER_KEY =
  "perspective-career-reflection-import-owner";

export type ReflectionMetricKey =
  | "enjoyment"
  | "problemSolving"
  | "collaboration"
  | "ambiguity";

export interface CareerReflection {
  careerName: "Software Engineering" | "Management Consulting";
  metrics: Record<ReflectionMetricKey, number>;
  careerLikelihood: number;
  note: string;
  savedAt: string;
}

export const REFLECTION_METRICS: Array<{
  key: ReflectionMetricKey;
  label: string;
}> = [
  { key: "enjoyment", label: "How much did you enjoy the work?" },
  {
    key: "problemSolving",
    label: "How satisfying was solving the technical problem?",
  },
  {
    key: "collaboration",
    label: "How helpful did teammate and review interactions feel?",
  },
  {
    key: "ambiguity",
    label: "How comfortable were you working from the ticket requirements?",
  },
];

export function getReflectionMetrics(careerName: CareerReflection["careerName"]) {
  if (careerName === "Management Consulting") {
    return [
      { key: "enjoyment" as const, label: "How much did you enjoy the case work?" },
      { key: "problemSolving" as const, label: "How engaging was analyzing the evidence?" },
      { key: "collaboration" as const, label: "How useful did team discussions feel?" },
      { key: "ambiguity" as const, label: "How comfortable were you with an unclear problem?" },
    ];
  }
  return REFLECTION_METRICS;
}

export function createEmptyReflection(
  careerName: CareerReflection["careerName"] = "Software Engineering",
): CareerReflection {
  return {
    careerName,
    metrics: {
      enjoyment: 0,
      problemSolving: 0,
      collaboration: 0,
      ambiguity: 0,
    },
    careerLikelihood: 5,
    note: "",
    savedAt: "",
  };
}

export function loadCareerReflection(): CareerReflection | null {
  try {
    const stored = localStorage.getItem(CAREER_REFLECTION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CareerReflection) : null;
  } catch {
    return null;
  }
}

export function saveCareerReflection(reflection: CareerReflection) {
  localStorage.setItem(
    CAREER_REFLECTION_STORAGE_KEY,
    JSON.stringify(reflection),
  );
}
