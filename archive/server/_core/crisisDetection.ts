/**
 * Crisis Detection Helper
 * Detects self-harm, suicidal ideation, and harm-to-others language
 * Returns crisis resources and flags for emergency contact notification
 */

export interface CrisisDetectionResult {
  isCrisis: boolean;
  severity: "low" | "medium" | "high" | null;
  type: "self_harm" | "suicidal" | "harm_to_others" | null;
  resources: CrisisResource[];
}

export interface CrisisResource {
  name: string;
  number: string;
  description: string;
  url?: string;
}

const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: "988 Suicide & Crisis Lifeline",
    number: "988",
    description: "Call or text 988 (US)",
    url: "https://988lifeline.org",
  },
  {
    name: "Crisis Text Line",
    number: "741741",
    description: "Text HOME to 741741",
    url: "https://www.crisistextline.org",
  },
  {
    name: "Emergency Services",
    number: "911",
    description: "Call 911 for immediate emergency",
  },
  {
    name: "International Association for Suicide Prevention",
    number: "varies",
    description: "Find local resources at iasp.info/resources/Crisis_Centres",
    url: "https://www.iasp.info/resources/Crisis_Centres",
  },
];

// Keywords and phrases that signal self-harm or suicidal ideation
const SELF_HARM_KEYWORDS = [
  "cut", "cutting", "self harm", "self-harm", "hurt myself", "wound",
  "blade", "knife", "razor", "burn", "burning myself", "hit myself",
];

const SUICIDAL_KEYWORDS = [
  "kill myself", "suicide", "suicidal", "end it", "don't want to live",
  "want to die", "better off dead", "no point living", "can't go on",
  "take my life", "hang myself", "overdose", "jump", "rope",
];

const HARM_TO_OTHERS_KEYWORDS = [
  "hurt someone", "kill someone", "harm them", "violence", "violent",
  "attack", "murder", "stab", "shoot", "punch", "hit them",
];

/**
 * Detect crisis signals in text
 */
export function detectCrisis(text: string): CrisisDetectionResult {
  const lowerText = text.toLowerCase();

  // Check for self-harm indicators
  const hasSelfHarm = SELF_HARM_KEYWORDS.some(kw => lowerText.includes(kw));

  // Check for suicidal indicators
  const hasSuicidal = SUICIDAL_KEYWORDS.some(kw => lowerText.includes(kw));

  // Check for harm-to-others indicators
  const hasHarmToOthers = HARM_TO_OTHERS_KEYWORDS.some(kw => lowerText.includes(kw));

  if (!hasSelfHarm && !hasSuicidal && !hasHarmToOthers) {
    return {
      isCrisis: false,
      severity: null,
      type: null,
      resources: [],
    };
  }

  // Determine severity and type
  let severity: "low" | "medium" | "high" = "medium";
  let type: "self_harm" | "suicidal" | "harm_to_others" | null = null;

  if (hasSuicidal) {
    severity = "high";
    type = "suicidal";
  } else if (hasHarmToOthers) {
    severity = "high";
    type = "harm_to_others";
  } else if (hasSelfHarm) {
    severity = "medium";
    type = "self_harm";
  }

  return {
    isCrisis: true,
    severity,
    type,
    resources: CRISIS_RESOURCES,
  };
}

/**
 * Format crisis resources for display in UI
 */
export function formatCrisisResources(): string {
  return CRISIS_RESOURCES.map(r => `${r.name}: ${r.number} - ${r.description}`).join("\n");
}
