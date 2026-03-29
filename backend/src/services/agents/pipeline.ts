import type { User, UserPreference } from "@prisma/client";

import { env } from "../../config/env.js";
import { clamp } from "../../lib/http.js";
import { aiProvider } from "../ai/provider.js";
import { loadDirectAgentPrompt } from "../ai/synod-prompt-library.js";
import type { AgentKey, AgentPanel, AgentRun, CandidateOption, MemorySnippet } from "./types.js";

interface CouncilInput {
  prompt: string;
  user: User;
  preferences: UserPreference[];
  memories: MemorySnippet[];
  conversation?: Array<{
    role: "user" | "assistant";
    content: string;
    target_agent?: string;
  }>;
}

interface PlannerOutput {
  domain: string;
  executionGraph: string[];
  evaluationCriteria: Array<{
    name: string;
    weight: number;
    reason: string;
  }>;
  followUpQuestions: string[];
  notes: string;
  confidence: number;
}

interface MarketOutput {
  summary: string;
  targetAudience: string;
  demandSignals: string[];
  competitors: string[];
  gaps: string[];
  positioning: string;
  goToMarketRoadmap: string[];
  topOptions: string[];
  missingInformation: string[];
  confidence: number;
}

interface VentureCapitalistOutput {
  investable: "Yes" | "No" | "Too Early";
  why: string;
  scalability: string;
  businessModel: string;
  moat: string;
  majorRisks: string[];
  requiredMilestones: string[];
  missingInformation: string[];
  confidence: number;
}

interface LegalOutput {
  legalRisks: string[];
  privacyIssues: string[];
  ipIssues: string[];
  complianceRequirements: string[];
  lawyerReview: string;
  missingInformation: string[];
  confidence: number;
}

interface EngineerOutput {
  techStack: string[];
  architecture: string;
  keyComponents: string[];
  technicalRisks: string[];
  mvpRoadmap: string[];
  scalingRoadmap: string[];
  missingInformation: string[];
  confidence: number;
}

interface DesignerOutput {
  userExperienceGoal: string;
  keyScreens: string[];
  userFlow: string;
  visualStyle: string;
  uniqueExperience: string;
  designRoadmap: string[];
  missingInformation: string[];
  confidence: number;
}

interface SynthesizerOutput {
  summary: string;
  verdict: string;
  confidence: number;
  selectedOptionTitle: string;
  pros: string[];
  cons: string[];
  risks: string[];
  disagreements: string[];
  alternatives: string[];
  whySelected: string[];
  followUpQuestions: string[];
  learningMessage: string;
}

interface CouncilResult {
  planner: AgentRun<PlannerOutput>;
  market: AgentRun<MarketOutput>;
  venture_capitalist: AgentRun<VentureCapitalistOutput>;
  legal: AgentRun<LegalOutput>;
  engineer: AgentRun<EngineerOutput>;
  designer: AgentRun<DesignerOutput>;
  synthesizer: AgentRun<SynthesizerOutput>;
  options: CandidateOption[];
}

type CouncilAgentKey = keyof Omit<CouncilResult, "options">;
type CouncilAgentRun = CouncilResult[CouncilAgentKey];

const agentDefinitions: Record<
  CouncilAgentKey,
  { name: string; role: string; mission: string; groqModel: string }
> = {
  planner: {
    name: "Planner Agent",
    role: "Task decomposition and execution graph",
    mission: "Break the request into a precise execution plan without giving the recommendation.",
    groqModel: "llama-3.3-70b-versatile",
  },
  market: {
    name: "Market Agent",
    role: "Audience and demand strategist",
    mission: "Analyze demand, audience, competitors, and positioning for the request.",
    groqModel: "llama-3.3-70b-versatile",
  },
  venture_capitalist: {
    name: "Venture Capitalist Agent",
    role: "Investor and scaling lens",
    mission: "Evaluate whether the idea is investable, scalable, and fundable.",
    groqModel: "llama-3.3-70b-versatile",
  },
  legal: {
    name: "Legal Agent",
    role: "Compliance and risk lens",
    mission: "Identify legal, privacy, IP, and regulatory issues before execution.",
    groqModel: "llama-3.3-70b-versatile",
  },
  engineer: {
    name: "Engineer Agent",
    role: "Technical architecture lens",
    mission: "Design the technical stack, MVP path, risks, and implementation strategy.",
    groqModel: "llama-3.3-70b-versatile",
  },
  designer: {
    name: "Designer Agent",
    role: "Product experience lens",
    mission: "Shape the UX, flows, interface structure, and product feel.",
    groqModel: "llama-3.1-8b-instant",
  },
  synthesizer: {
    name: "Synthesizer Agent",
    role: "Final recommendation synthesis",
    mission: "Combine the council outputs into one final answer with risks and alternatives.",
    groqModel: "llama-3.3-70b-versatile",
  },
};

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "what",
  "which",
  "your",
  "best",
  "should",
  "would",
  "about",
  "under",
  "into",
  "from",
  "have",
  "when",
  "where",
  "than",
  "while",
  "them",
  "they",
  "much",
  "very",
  "want",
  "need",
  "please",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token));
}

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function inferDomain(prompt: string): string {
  const normalized = normalizePrompt(prompt);

  if (/\b(college|university|degree|campus|major)\b/.test(normalized)) {
    return "college";
  }

  if (/\b(career|job|profession|role|switch)\b/.test(normalized)) {
    return "career";
  }

  if (/\b(laptop|phone|buy|purchase|headphones|camera)\b/.test(normalized)) {
    return "purchase";
  }

  if (/\b(startup|business|saas|idea|build|product)\b/.test(normalized)) {
    return "startup";
  }

  if (/\b(travel|trip|vacation|holiday|visit)\b/.test(normalized)) {
    return "travel";
  }

  if (/\b(watch|movie|show|series|anime|tonight)\b/.test(normalized)) {
    return "entertainment";
  }

  return "general";
}

function extractBudget(prompt: string): number | null {
  const currencyMatch = prompt.match(/[₹$€]\s?([\d,]+)/);
  if (currencyMatch?.[1]) {
    return Number(currencyMatch[1].replace(/,/g, ""));
  }

  const numericMatch = prompt.match(/\b(?:under|below|less than)\s+([\d,]+)/i);
  if (numericMatch?.[1]) {
    return Number(numericMatch[1].replace(/,/g, ""));
  }

  return null;
}

function makeOption(
  title: string,
  description: string,
  baseScore: number,
  pros: string[],
  cons: string[],
  risks: string[],
  tags: string[],
  evidence: string[],
  reasoning: string,
): CandidateOption {
  return {
    title,
    description,
    baseScore,
    score: baseScore,
    pros,
    cons,
    risks,
    tags,
    evidence,
    reasoning,
  };
}

function buildOptions(domain: string, budget: number | null): CandidateOption[] {
  const budgetNote =
    budget !== null ? `with a target budget near ${budget.toLocaleString()}` : "within a sensible budget band";

  const presets: Record<string, CandidateOption[]> = {
    college: [
      makeOption(
        "Affordable public STEM university",
        `A lower-cost degree path that prioritizes employability, internships, and practical outcomes ${budgetNote}.`,
        79,
        ["Strong ROI potential", "Better internship pipeline", "Lower financial pressure"],
        ["Less prestige than elite institutions", "Campus life may feel more utilitarian"],
        ["Program quality varies by department"],
        ["affordable", "career", "practical", "internships", "stem"],
        ["Public-university ROI tends to remain resilient when cost discipline matters"],
        "Best when outcomes and affordability matter more than brand signaling.",
      ),
      makeOption(
        "Specialized private college",
        `A focused academic niche that can be excellent if the specialization already matches the user's goals ${budgetNote}.`,
        66,
        ["Deep fit if the niche matches", "Potentially stronger mentoring"],
        ["Usually pricier", "Narrower fallback options if interests change"],
        ["Poor fit if the user is still exploring"],
        ["specialized", "expensive", "fit", "mentorship"],
        ["Private specialist programs work best when the student already has clarity"],
        "High upside for clarity, weaker for uncertain users.",
      ),
      makeOption(
        "Flexible regional university plus portfolio learning",
        `A lower-pressure path that blends formal study with projects, certifications, and internships ${budgetNote}.`,
        73,
        ["Flexible path", "Can reduce debt and increase experimentation"],
        ["Requires self-direction", "Brand signal is weaker"],
        ["Execution risk is higher without discipline"],
        ["flexible", "affordable", "portfolio", "self-directed"],
        ["Portfolio-first outcomes are strongest when the learner is proactive"],
        "Good if independence and experimentation are strengths.",
      ),
      makeOption(
        "Prestige-first flagship university",
        `A brand-heavy path that favors signaling, alumni network effects, and optionality ${budgetNote}.`,
        64,
        ["Brand and network advantages", "Broad optionality"],
        ["High cost", "Harder to justify without clear upside"],
        ["Debt burden can limit future decisions"],
        ["prestige", "network", "expensive", "optionality"],
        ["Prestige benefits are real but often diluted by cost"],
        "Useful if network access matters enough to offset higher spend.",
      ),
    ],
    career: [
      makeOption(
        "Product software engineering",
        "A technical path with strong upside, portability, and leverage across startups and established firms.",
        79,
        ["High leverage skill set", "Good compensation ceiling", "Strong optionality"],
        ["Requires steady technical practice", "Can be mentally demanding"],
        ["Poor fit if the user dislikes deep technical work"],
        ["technical", "growth", "upside", "portable"],
        ["Technical-product roles remain resilient because they create direct value"],
        "Strong fit when the user wants compounding, durable leverage.",
      ),
      makeOption(
        "Applied AI or data analysis",
        "A practical analytics route with faster entry than pure research and strong proximity to AI adoption.",
        76,
        ["Good current demand", "Bridges business and technical work"],
        ["Tooling changes fast", "Needs communication skill as well as analysis"],
        ["Can stall without domain expertise"],
        ["ai", "analytics", "hybrid", "practical"],
        ["Applied AI work compounds fastest when tied to business workflows"],
        "Useful when the user wants strong relevance without going fully research-heavy.",
      ),
      makeOption(
        "Product and design hybrid",
        "A cross-functional path that blends user understanding, product taste, and execution leverage.",
        72,
        ["Strong product intuition", "Works well in smaller teams"],
        ["Can be harder to define early", "Needs taste and shipping discipline"],
        ["Can drift without a clear specialty"],
        ["product", "design", "user", "hybrid"],
        ["Hybrid product roles fit when communication and taste are both strong"],
        "Good for users who care about product outcomes and user empathy.",
      ),
      makeOption(
        "Domain specialist or operations path",
        "A more grounded path that compounds in one vertical and can be paired with automation over time.",
        69,
        ["Can be easier to enter", "Domain knowledge compounds"],
        ["Less upside than core technical paths", "Growth ceiling can be lower"],
        ["Can stagnate without a growth strategy"],
        ["domain", "operations", "specialist", "practical"],
        ["Specialization becomes powerful when paired with an execution edge"],
        "Best if the user values stability and direct relevance over maximal upside.",
      ),
    ],
    purchase: [
      makeOption(
        "Value-balanced option",
        `A well-rounded purchase that balances performance, battery life, and long-term regret control ${budgetNote}.`,
        80,
        ["Balanced risk", "Usually the safest default", "Less likely to disappoint"],
        ["Not the most exciting option", "May not excel at one niche"],
        ["Could feel too conservative for power users"],
        ["value", "balanced", "practical", "safe"],
        ["Balanced options usually dominate when the user wants low regret"],
        "Best when the user wants the fewest surprises after purchase.",
      ),
      makeOption(
        "Performance-first option",
        `A faster, more capable choice that prioritizes raw speed and headroom ${budgetNote}.`,
        75,
        ["Excellent performance", "Better for heavy use", "Longer useful life"],
        ["Often pricier", "Can be heavier or louder"],
        ["May waste money if the user never uses the extra capacity"],
        ["performance", "power", "speed", "headroom"],
        ["Performance picks win when workloads are demanding or future needs are uncertain"],
        "Best when the user values capability over price efficiency.",
      ),
      makeOption(
        "Portability-first option",
        `A lightweight, battery-efficient option that makes travel and daily carrying easier ${budgetNote}.`,
        72,
        ["Easier to carry", "Better battery feel", "Lower friction day to day"],
        ["May trade away raw performance", "Can cost more than it seems"],
        ["Not ideal for heavy workloads"],
        ["portable", "battery", "lightweight", "mobile"],
        ["Portability matters when the device travels everywhere with the user"],
        "Best when the device is part of a mobile lifestyle.",
      ),
      makeOption(
        "Ecosystem premium option",
        `A more polished premium pick that emphasizes integration, support, and refinement ${budgetNote}.`,
        67,
        ["Strong polish", "Good ecosystem integration", "High perceived quality"],
        ["Higher price", "Can lock the user into one ecosystem"],
        ["Value can be weak if ecosystem fit is poor"],
        ["premium", "ecosystem", "polished", "integration"],
        ["Premium ecosystems are strongest when the user already lives inside them"],
        "Best if ecosystem coherence matters more than raw value.",
      ),
    ],
    startup: [
      makeOption(
        "Lean B2B SaaS wedge",
        `A narrow workflow product that solves one painful business problem cleanly ${budgetNote}.`,
        80,
        ["Clear monetization path", "Faster validation", "Less consumer churn risk"],
        ["Can be boring", "Needs a focused sales motion"],
        ["Can stall if the pain is not acute enough"],
        ["b2b", "saas", "workflow", "narrow", "subscription"],
        ["Narrow B2B wedges often validate fastest because the pain is easy to describe"],
        "Best when the user wants something fundable and tractable.",
      ),
      makeOption(
        "Automation tool for a painful workflow",
        `A product that automates repetitive work and becomes sticky through time savings ${budgetNote}.`,
        76,
        ["Easy to explain", "Strong value prop", "Can spread through teams"],
        ["May face copycat risk", "Needs strong UX to stick"],
        ["The space can get crowded quickly"],
        ["automation", "workflow", "productivity", "efficiency"],
        ["Automation products win when the time savings are obvious"],
        "Good if the pain point is repetitive and frequent.",
      ),
      makeOption(
        "Consumer habit product",
        `A user-facing product that builds retention through habit, delight, and repeated use ${budgetNote}.`,
        68,
        ["Potential for strong retention", "Can grow fast with the right loop"],
        ["Harder to predict demand", "Usually harder to monetize early"],
        ["Crowded and fragile without a sharp wedge"],
        ["consumer", "habit", "retention", "delight"],
        ["Consumer habit products need a very sharp loop to survive"],
        "Good only if the user has a strong consumer insight.",
      ),
      makeOption(
        "Services-to-software wedge",
        `A pragmatic service-led entry that funds learning before the product fully scales ${budgetNote}.`,
        72,
        ["Fast learning", "Can generate early revenue", "Reduces product risk"],
        ["Harder to scale than pure software", "Can blur product focus"],
        ["May remain a service too long"],
        ["services", "hybrid", "learning", "revenue"],
        ["Services can buy time when the product thesis still needs evidence"],
        "Best when the user needs revenue and learning before scaling.",
      ),
    ],
    travel: [
      makeOption(
        "Restorative low-friction trip",
        `A calmer itinerary that reduces planning fatigue and maximizes ease ${budgetNote}.`,
        79,
        ["Low stress", "Simple to execute", "Good for recovery"],
        ["Less adventurous", "May feel too safe"],
        ["Could feel underwhelming for novelty-seekers"],
        ["restful", "easy", "calm", "low-friction"],
        ["Easy trips win when the user wants the fewest moving parts"],
        "Best when relaxation matters more than novelty.",
      ),
      makeOption(
        "City immersion trip",
        `A food, culture, and neighborhood-heavy itinerary ${budgetNote}.`,
        74,
        ["Rich experience", "Flexible to personalize", "Good discovery potential"],
        ["Can become tiring", "Requires more planning"],
        ["Can be overwhelming if the user wants a break"],
        ["city", "culture", "food", "explore"],
        ["City trips work well when the user wants variety and energy"],
        "Best for users who enjoy movement and discovery.",
      ),
      makeOption(
        "Adventure-heavy trip",
        `A more active itinerary built around novelty, hiking, or high-energy experiences ${budgetNote}.`,
        70,
        ["Memorable", "High novelty", "Strong story value"],
        ["More risk", "Often more planning"],
        ["Can be too intense if the user wants comfort"],
        ["adventure", "active", "novelty", "energy"],
        ["Adventure trips are best when the user explicitly wants intensity"],
        "Best if excitement is the priority.",
      ),
      makeOption(
        "Budget local escape",
        `A short, cost-conscious reset that keeps logistics light ${budgetNote}.`,
        66,
        ["Cheap", "Easy to arrange", "Good fallback"],
        ["Less special", "May not feel like a real trip"],
        ["Can be too modest for users wanting a bigger experience"],
        ["budget", "local", "simple", "short"],
        ["Local escapes are strong when time and money are tight"],
        "Best when the user needs a reset without much spend.",
      ),
    ],
    entertainment: [
      makeOption(
        "Comfort pick",
        `A reliable and easy-to-enjoy option that minimizes decision regret ${budgetNote}.`,
        78,
        ["Low risk", "Easy to start", "Usually satisfying"],
        ["May be predictable", "Less novel"],
        ["Can feel too safe for adventurous viewers"],
        ["comfort", "easy", "safe", "reliable"],
        ["Comfort picks are strong when the user mainly wants a good time"],
        "Best when the goal is to relax rather than explore.",
      ),
      makeOption(
        "Critically acclaimed pick",
        `A higher-quality, more talked-about choice ${budgetNote}.`,
        74,
        ["Often richer", "More memorable", "Good conversation value"],
        ["Can be heavier or slower", "Taste-sensitive"],
        ["Could miss if the user's mood is light"],
        ["acclaimed", "quality", "prestige", "talked-about"],
        ["High-quality picks reward patience and attention"],
        "Best when the user wants something worth remembering.",
      ),
      makeOption(
        "Exploratory niche pick",
        `A more unusual choice that may be surprisingly rewarding ${budgetNote}.`,
        69,
        ["Novel", "Distinctive", "Can feel fresh"],
        ["Higher regret risk", "Less universal"],
        ["Might miss if the user wants a simple win"],
        ["niche", "experimental", "fresh", "distinctive"],
        ["Niche picks win when the user wants novelty"],
        "Best for curiosity-driven viewing.",
      ),
      makeOption(
        "Light rewatch or familiar pick",
        `An easy, low-friction choice that suits a tired or indecisive user ${budgetNote}.`,
        71,
        ["Very easy to commit to", "Low cognitive load"],
        ["Less memorable", "Can feel repetitive"],
        ["May not satisfy a desire for something new"],
        ["rewatch", "familiar", "light", "easy"],
        ["Familiar choices reduce friction when energy is low"],
        "Best when the user just wants to settle in quickly.",
      ),
    ],
    general: [
      makeOption(
        "Balanced option",
        `A well-rounded recommendation that tries to minimize regret ${budgetNote}.`,
        78,
        ["Good balance", "Low regret", "Usually safe"],
        ["Not the most specialized", "Can feel generic"],
        ["May under-deliver if the user wants a strong edge"],
        ["balanced", "safe", "practical", "general"],
        ["Balanced options dominate when the prompt is still broad"],
        "Best when the user's priorities are still fuzzy.",
      ),
      makeOption(
        "Conservative option",
        `A lower-risk choice that protects downside ${budgetNote}.`,
        72,
        ["Safer", "Easier to justify", "Usually cheaper"],
        ["Lower upside", "Can be too cautious"],
        ["May leave too much opportunity on the table"],
        ["conservative", "safe", "downside", "cheap"],
        ["Conservative choices fit when regret avoidance matters"],
        "Best for users with low risk tolerance.",
      ),
      makeOption(
        "Ambitious option",
        `A higher-upside choice that demands stronger execution ${budgetNote}.`,
        67,
        ["Higher upside", "Can unlock more leverage", "More interesting"],
        ["More fragile", "Harder to execute", "Often costlier"],
        ["Can fail if the user is not ready for the extra complexity"],
        ["ambitious", "upside", "leverage", "bold"],
        ["Ambitious paths reward users who can tolerate more risk"],
        "Best when the user wants upside and is comfortable with complexity.",
      ),
      makeOption(
        "Exploratory option",
        `A discovery-oriented path for when the user's real goal is still unclear ${budgetNote}.`,
        70,
        ["Helps learning", "Encourages exploration", "Flexible"],
        ["Less decisive", "Can delay commitment"],
        ["Can drift if the user needed a firm answer"],
        ["exploratory", "learn", "discover", "flexible"],
        ["Exploration is useful when the true preference landscape is still unclear"],
        "Best if the user is still figuring out what matters.",
      ),
    ],
  };

  return presets[domain] ?? presets.general;
}

function collectPreferenceSignals(
  user: User,
  preferences: UserPreference[],
  prompt: string,
  memories: MemorySnippet[],
) {
  const positiveTerms = new Set<string>();
  const negativeTerms = new Set<string>();

  const addTerms = (value: string | null | undefined, target: Set<string>) => {
    if (!value) {
      return;
    }

    for (const term of tokenize(value)) {
      if (term.length > 2) {
        target.add(term);
      }
    }
  };

  for (const interest of user.interests) {
    addTerms(interest, positiveTerms);
  }

  for (const goal of user.goals) {
    addTerms(goal, positiveTerms);
  }

  for (const constraint of user.constraints) {
    addTerms(constraint, negativeTerms);
  }

  for (const preference of preferences) {
    if (preference.polarity === "negative") {
      addTerms(preference.label, negativeTerms);
    } else {
      addTerms(preference.label, positiveTerms);
    }
  }

  addTerms(prompt, positiveTerms);

  for (const memory of memories) {
    addTerms(memory.content, positiveTerms);
    if (memory.feedbackResult === "didnt_work") {
      addTerms(memory.content, negativeTerms);
    }
  }

  return {
    positiveTerms: [...positiveTerms],
    negativeTerms: [...negativeTerms],
  };
}

function applyPreferenceAdjustments(
  options: CandidateOption[],
  positiveTerms: string[],
  negativeTerms: string[],
  budget: number | null,
) {
  return options.map((option) => {
    const searchable = normalizePrompt(
      `${option.title} ${option.description} ${option.tags.join(" ")} ${option.reasoning}`,
    );
    let score = option.score;
    const reasons: string[] = [];

    for (const term of positiveTerms) {
      if (searchable.includes(term)) {
        score += 3;
        reasons.push(`Matches ${term}`);
      }
    }

    for (const term of negativeTerms) {
      if (searchable.includes(term)) {
        score -= 4;
        reasons.push(`Conflicts with ${term}`);
      }
    }

    if (budget !== null) {
      if (/(premium|expensive|prestige|high-end)/.test(searchable) && budget < 100000) {
        score -= 6;
        reasons.push("Budget pressure makes this option less attractive");
      }

      if (/(affordable|budget|value|lean)/.test(searchable) && budget < 100000) {
        score += 2;
        reasons.push("Budget fit improves the score");
      }
    }

    return {
      ...option,
      score: clamp(Math.round(score), 0, 100),
      reasoning:
        reasons.length > 0 ? `${option.reasoning} Preference signal: ${reasons.join("; ")}.` : option.reasoning,
    };
  });
}

function rankOptionsByScore(options: CandidateOption[]) {
  return [...options].sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

function domainCompetitors(domain: string): string[] {
  const competitors: Record<string, string[]> = {
    college: [
      "other public universities with similar programs",
      "private niche colleges in the same major",
      "direct-to-work alternatives like certificates and apprenticeships",
    ],
    career: [
      "other junior roles in the same function",
      "adjacent paths that overlap on skill-building",
      "self-directed learning plus freelancing",
    ],
    purchase: [
      "other models at the same price point",
      "last year's flagship devices",
      "cheaper alternatives that solve the same core job",
    ],
    startup: [
      "manual workflows and spreadsheets",
      "generic AI wrappers",
      "existing vertical SaaS tools",
    ],
    travel: [
      "similar destinations in the same budget band",
      "staycation or local alternatives",
      "package trips with less planning effort",
    ],
    entertainment: [
      "the user's watchlist backlog",
      "popular mainstream alternatives",
      "rewatches or familiar comfort choices",
    ],
    general: [
      "manual decision-making",
      "generic advice from a single model",
      "doing nothing and waiting",
    ],
  };

  return competitors[domain] ?? competitors.general;
}

function buildPlanner(
  prompt: string,
  domain: string,
  options: CandidateOption[],
  user: User,
  preferences: UserPreference[],
  memories: MemorySnippet[],
): PlannerOutput {
  const prioritySignals = preferences
    .filter((item) => item.weight >= 0.55)
    .slice(0, 3)
    .map((item) => item.label);
  const followUpQuestions: string[] = [];

  if (!/\b(budget|price|cost|timeline|deadline|must have|avoid)\b/i.test(prompt)) {
    followUpQuestions.push("Which constraint matters most: budget, speed, risk, or quality?");
  }

  if (prioritySignals.length === 0 && memories.length === 0) {
    followUpQuestions.push("What should Synod optimize for if your priorities are still broad?");
  }

  const topOption = rankOptionsByScore(options)[0];
  const executionGraph = [
    "Clarify the real goal and hard constraints.",
    `Split the problem into a ${domain}-specific evaluation path.`,
    "Assign each specialist lens to a distinct question.",
    "Synthesize the winning path and the backup path.",
  ];

  const evaluationCriteria = [
    {
      name: "Goal fit",
      weight: 0.3,
      reason: "How directly the option solves the user's actual intent.",
    },
    {
      name: "Constraint fit",
      weight: 0.25,
      reason: user.budgetAmount ? "Must stay aligned with the user's budget reality." : "Must stay aligned with the user's stated limits.",
    },
    {
      name: "Downside control",
      weight: 0.25,
      reason: "Avoid options that create avoidable regret or failure modes.",
    },
    {
      name: "Execution speed",
      weight: 0.2,
      reason: "Prefer paths the user can actually act on quickly.",
    },
  ];

  return {
    domain,
    executionGraph,
    evaluationCriteria,
    followUpQuestions,
    notes: `Planner framed the request as a ${domain} decision and used ${options.length} candidate paths to keep the council grounded. Best provisional fit: ${topOption?.title ?? "none"}.`,
    confidence: clamp(
      66 + Math.min(8, memories.length * 2) - followUpQuestions.length * 7 + (domain === "general" ? -2 : 3),
      45,
      93,
    ),
  };
}

function scoreForMarket(option: CandidateOption, domain: string) {
  const text = normalizePrompt(`${option.title} ${option.description} ${option.tags.join(" ")}`);
  let score = 0;

  if (/(market|growth|audience|users|demand|adoption)/.test(text)) {
    score += 5;
  }

  if (/(crowded|generic|weak)/.test(text)) {
    score -= 3;
  }

  if (domain === "startup" && /(b2b|saas|workflow|automation)/.test(text)) {
    score += 4;
  }

  if (domain === "purchase" && /(value|balanced|practical)/.test(text)) {
    score += 3;
  }

  return score;
}

function scoreForVentureCapital(option: CandidateOption, domain: string) {
  const text = normalizePrompt(`${option.title} ${option.description} ${option.tags.join(" ")}`);
  let score = 0;

  if (/(scale|subscription|platform|repeatable|moat)/.test(text)) {
    score += 5;
  }

  if (/(services|manual|local|short)/.test(text)) {
    score -= 3;
  }

  if (domain === "startup" && /(b2b|automation|workflow)/.test(text)) {
    score += 4;
  }

  return score;
}

function scoreLegalRisk(option: CandidateOption, domain: string) {
  const text = normalizePrompt(`${option.title} ${option.description} ${option.tags.join(" ")}`);
  let risk = 0;

  if (/(privacy|data|copyright|regulated|compliance|legal)/.test(text)) {
    risk += 4;
  }

  if (domain === "startup" && /(consumer|habit)/.test(text)) {
    risk += 1;
  }

  return risk;
}

function scoreForEngineering(option: CandidateOption, domain: string) {
  const text = normalizePrompt(`${option.title} ${option.description} ${option.tags.join(" ")}`);
  let score = 0;

  if (/(simple|mvp|lean|practical|portable)/.test(text)) {
    score += 4;
  }

  if (/(complex|crowded|expensive|prestige)/.test(text)) {
    score -= 2;
  }

  if (domain === "startup" && /(workflow|automation|saas)/.test(text)) {
    score += 3;
  }

  return score;
}

function scoreForDesign(option: CandidateOption, domain: string) {
  const text = normalizePrompt(`${option.title} ${option.description} ${option.tags.join(" ")}`);
  let score = 0;

  if (/(user|workflow|habit|delight|clear|simple)/.test(text)) {
    score += 4;
  }

  if (/(enterprise|hard|fragile)/.test(text)) {
    score -= 1;
  }

  if (domain === "entertainment" || domain === "travel") {
    score += 2;
  }

  return score;
}

function rankForLens(
  options: CandidateOption[],
  scorer: (option: CandidateOption) => number,
) {
  return [...options]
    .map((option) => ({
      ...option,
      score: clamp(Math.round(option.score + scorer(option)), 0, 100),
    }))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

function buildMarket(
  prompt: string,
  domain: string,
  options: CandidateOption[],
  memories: MemorySnippet[],
): MarketOutput {
  const ranked = rankForLens(options, (option) => scoreForMarket(option, domain));
  const topOptions = ranked.slice(0, 3).map((option) => option.title);
  const missingInformation: string[] = [];

  if (!/\b(audience|users|customer|buyer|who)\b/i.test(prompt)) {
    missingInformation.push("Which specific audience should this option serve first?");
  }

  if (!/\b(competitor|alternative|compare|market)\b/i.test(prompt)) {
    missingInformation.push("Which competitors or substitutes matter most in this decision?");
  }

  return {
    summary: `Market lens says ${topOptions[0] ?? "the strongest option"} has the clearest demand signal and positioning story.`,
    targetAudience:
      domain === "startup"
        ? "The first paying segment that feels the pain most sharply."
        : "The user segment most affected by the problem the prompt describes.",
    demandSignals: [
      "Repeated pain",
      "Clear willingness to pay or act",
      "A repeated workflow or decision point",
      memories.length > 0 ? "Prior memory cues reinforce recurring interest" : "No strong memory cues yet",
    ],
    competitors: domainCompetitors(domain),
    gaps: [
      "The market is strongest where the user pain is frequent and costly.",
      "Differentiation gets sharper when the product wedges into one narrow use case first.",
    ],
    positioning:
      domain === "startup"
        ? "Win with a narrow wedge and a very specific promise before broadening the product."
        : "Compare the current option to the closest substitute and win on one clear axis.",
    goToMarketRoadmap: [
      "Interview the first five likely users or buyers.",
      "Test one crisp value proposition and one price anchor.",
      "Measure whether the pain is recurring enough to justify action.",
    ],
    topOptions,
    missingInformation,
    confidence: clamp(64 + Math.min(8, topOptions.length * 2) - missingInformation.length * 6, 48, 92),
  };
}

function buildVentureCapitalist(
  prompt: string,
  domain: string,
  options: CandidateOption[],
): VentureCapitalistOutput {
  const ranked = rankForLens(options, (option) => scoreForVentureCapital(option, domain));
  const top = ranked[0];
  const missingInformation: string[] = [];

  if (!/\b(revenue|pay|pricing|monet|business model|fund|invest)\b/i.test(prompt)) {
    missingInformation.push("Who pays, and why will they keep paying?");
  }

  if (!/\b(scale|growth|moat|distribution|retention)\b/i.test(prompt)) {
    missingInformation.push("What makes this scale instead of staying a small service?");
  }

  const investable =
    domain === "startup" && top?.score >= 78
      ? "Yes"
      : domain === "startup" && top && top.score >= 70
        ? "Too Early"
        : "No";

  return {
    investable,
    why:
      investable === "Yes"
        ? `The opportunity looks investable because ${top?.title ?? "the leading option"} has a credible wedge and a repeatable path.`
        : "The investor lens says the opportunity needs sharper demand proof, monetization clarity, or a more defensible wedge before it reads as fundable.",
    scalability:
      domain === "startup"
        ? "Scale comes from repeatable acquisition, strong retention, and a business model that improves as usage grows."
        : "Scalability is mostly about whether the underlying work can be repeated without linear effort.",
    businessModel:
      domain === "startup"
        ? "The cleanest model is usually subscription, usage-based pricing, or a services-to-software bridge."
        : "This is not primarily a funding question, so the lens focuses on leverage and repeatability.",
    moat:
      top?.tags.includes("moat") || top?.tags.includes("platform")
        ? "A stronger moat appears when the product compounds on data, workflow lock-in, or distribution."
        : "The moat is still weak until the user can explain why the chosen path will stay differentiated.",
    majorRisks: [
      "Demand may not be strong enough",
      "Distribution may be harder than expected",
      "The product may not be differentiated enough",
    ],
    requiredMilestones: [
      "Validate a narrow wedge with real users",
      "Prove willingness to pay or repeated use",
      "Show a repeatable acquisition path",
    ],
    missingInformation,
    confidence: clamp(62 + Math.min(10, top?.score ?? 0) / 2 - missingInformation.length * 5, 45, 92),
  };
}

function buildLegal(prompt: string, domain: string, options: CandidateOption[]): LegalOutput {
  const ranked = rankForLens(options, (option) => -scoreLegalRisk(option, domain));
  const top = ranked[0];
  const missingInformation: string[] = [];

  if (!/\b(data|privacy|personal|user|collection|storage)\b/i.test(prompt)) {
    missingInformation.push("Will the system store or process personal data?");
  }

  if (!/\b(license|ip|copyright|terms|regulation|compliance)\b/i.test(prompt)) {
    missingInformation.push("Does the idea touch licensing, copyright, or regulated activity?");
  }

  return {
    legalRisks: [
      "Privacy obligations may increase if personal data is collected.",
      "Terms of service and licensing need to be checked if third-party content is involved.",
      "Regulated domains can add jurisdiction-specific risk.",
    ],
    privacyIssues: [
      "Minimize data collection",
      "Define retention and deletion behavior",
      "Avoid training on user data without consent",
    ],
    ipIssues: [
      "Check ownership of generated output",
      "Verify any scraped content or third-party assets",
      "Review trademark and licensing exposure",
    ],
    complianceRequirements: [
      domain === "startup" ? "Security and data-handling policies" : "Basic consumer protection and disclosure checks",
      "Document what data is collected and why",
      "Make the product policy understandable to a normal user",
    ],
    lawyerReview:
      top?.score && top.score >= 78
        ? "The legal surface looks manageable, but it still deserves a quick review if the product collects personal data or ships in a regulated vertical."
        : "The legal lens recommends a careful review before launch if the request touches data, IP, or regulated activity.",
    missingInformation,
    confidence: clamp(63 + Math.min(8, top?.score ?? 0) / 2 - missingInformation.length * 5, 45, 92),
  };
}

function buildEngineer(
  prompt: string,
  domain: string,
  options: CandidateOption[],
  user: User,
): EngineerOutput {
  const ranked = rankForLens(options, (option) => scoreForEngineering(option, domain));
  const top = ranked[0];
  const missingInformation: string[] = [];

  if (!/\b(stack|architecture|tech|system|backend|frontend|database|api)\b/i.test(prompt)) {
    missingInformation.push("What technical constraints or existing stack should the architecture respect?");
  }

  if (!/\b(mvp|prototype|launch|ship|build)\b/i.test(prompt)) {
    missingInformation.push("What is the minimum version that needs to ship first?");
  }

  const prefersFastMvp = user.constraints.some((item) => /fast|simple|quick|lean/i.test(item));

  return {
    techStack:
      domain === "startup" || domain === "general"
        ? ["Next.js or similar frontend", "Node.js backend", "PostgreSQL", "Prisma", "Groq or OpenAI-compatible API"]
        : ["Keep the stack minimal", "Use the simplest platform that meets the use case"],
    architecture:
      domain === "startup" || domain === "general"
        ? "Split the app into input capture, orchestration, persistence, and presentation so each concern can evolve independently."
        : "If this is not a product build, the architecture question is mostly about keeping the workflow simple and repeatable.",
    keyComponents: [
      "Frontend experience",
      "API layer",
      "Database and memory",
      "AI orchestration",
      "Observability and deployment",
    ],
    technicalRisks: [
      "Model latency",
      "Vendor coupling",
      "Weak data contracts",
      "Over-engineering too early",
    ],
    mvpRoadmap: prefersFastMvp
      ? [
          "Build the smallest possible workflow first",
          "Keep persistence and orchestration simple",
          "Ship before adding optional complexity",
        ]
      : [
          "Define the core workflow",
          "Lock the data model",
          "Implement the agent pipeline and persistence",
        ],
    scalingRoadmap: [
      "Add queueing and caching only when traffic proves the need",
      "Improve retrieval once memory quality starts to matter",
      "Instrument usage and failure points before optimizing infrastructure",
    ],
    missingInformation,
    confidence: clamp(68 + Math.min(8, top?.score ?? 0) / 2 - missingInformation.length * 5, 50, 95),
  };
}

function buildDesigner(
  prompt: string,
  domain: string,
  options: CandidateOption[],
): DesignerOutput {
  const ranked = rankForLens(options, (option) => scoreForDesign(option, domain));
  const top = ranked[0];
  const missingInformation: string[] = [];

  if (!/\b(ui|ux|screen|flow|layout|design|experience|interface)\b/i.test(prompt)) {
    missingInformation.push("What kind of user experience should the product or decision flow create?");
  }

  if (!/\b(visual|look|feel|brand|style|motion)\b/i.test(prompt)) {
    missingInformation.push("What visual tone should the product lean toward?");
  }

  return {
    userExperienceGoal:
      domain === "travel" || domain === "entertainment"
        ? "Make the interaction feel calm, quick, and confidence-building."
        : "Move the user from confusion to clarity with minimal friction.",
    keyScreens: [
      "Entry screen",
      "Reasoning or comparison screen",
      "Outcome screen",
    ],
    userFlow:
      "Reduce friction between asking, seeing reasoning, and acting on the answer.",
    visualStyle:
      domain === "startup" || domain === "general"
        ? "Use a clean, high-contrast layout with one clear action hierarchy."
        : "Use a simple, readable style that matches the user's urgency and attention level.",
    uniqueExperience:
      top?.score && top.score >= 75
        ? "The experience should feel intentional and decisive rather than generic."
        : "The experience should prioritize clarity over flourish until the workflow is proven.",
    designRoadmap: [
      "Design the core flow first",
      "Polish the information hierarchy",
      "Add motion only where it helps understanding",
    ],
    missingInformation,
    confidence: clamp(67 + Math.min(8, top?.score ?? 0) / 2 - missingInformation.length * 5, 50, 95),
  };
}

function buildSynthesizer(
  prompt: string,
  domain: string,
  options: CandidateOption[],
  planner: PlannerOutput,
  market: MarketOutput,
  ventureCapitalist: VentureCapitalistOutput,
  legal: LegalOutput,
  engineer: EngineerOutput,
  designer: DesignerOutput,
): SynthesizerOutput {
  const ranked = rankOptionsByScore(
    options.map((option) => ({
      ...option,
      score: clamp(
        Math.round(
          option.score +
            scoreForMarket(option, domain) +
            scoreForVentureCapital(option, domain) +
            scoreForEngineering(option, domain) +
            scoreForDesign(option, domain) -
            scoreLegalRisk(option, domain),
        ),
        0,
        100,
      ),
    })),
  );
  const top = ranked[0];
  const second = ranked[1];
  const gap = second ? Math.max(0, top.score - second.score) : 8;
  const uncertaintyPenalty =
    planner.followUpQuestions.length * 4 +
    market.missingInformation.length * 2 +
    ventureCapitalist.missingInformation.length * 2 +
    legal.missingInformation.length * 2 +
    engineer.missingInformation.length * 2 +
    designer.missingInformation.length * 2;

  const confidence = clamp(Math.round(top.score + Math.min(8, gap / 2) - uncertaintyPenalty), 35, 96);
  const followUpQuestions = [
    ...planner.followUpQuestions,
    ...(confidence < 70 ? ["If this misses, should Synod optimize next for speed, safety, or upside?"] : []),
  ].slice(0, 4);

  return {
    summary: `Synod recommends ${top.title} because it best fits the current constraints, the specialist lenses, and the user's risk posture.`,
    verdict: `${top.title}: ${top.description}`,
    confidence,
    selectedOptionTitle: top.title,
    pros: top.pros,
    cons: top.cons,
    risks: [...top.risks, ...legal.legalRisks.slice(0, 2), ...ventureCapitalist.majorRisks.slice(0, 2)].slice(0, 5),
    disagreements: [
      market.positioning,
      ventureCapitalist.moat,
      legal.lawyerReview,
    ].slice(0, 3),
    alternatives: ranked.slice(1, 4).map((option) => option.title),
    whySelected: [
      `Highest combined council score at ${Math.round(top.score)}/100 after specialist weighting.`,
      `Strongest reasoning line: ${top.reasoning}`,
      market.summary,
      engineer.architecture,
    ],
    followUpQuestions,
    learningMessage:
      confidence < 70
        ? "Synod should learn from the missing constraints before hardening the next recommendation."
        : "Synod can reinforce this pattern because the council reached a confident answer with limited friction.",
  };
}

function formatBulletList(items: string[], fallback = "None identified.") {
  if (items.length === 0) {
    return fallback;
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function formatNumberedList(items: string[], fallback = "1. No concrete items available yet.") {
  if (items.length === 0) {
    return fallback;
  }

  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatOptionSnapshot(options: CandidateOption[], limit = 3) {
  if (options.length === 0) {
    return "No ranked options available yet.";
  }

  return options
    .slice(0, limit)
    .map(
      (option, index) =>
        `${index + 1}. ${option.title} (${Math.round(option.score)}/100)\n` +
        `Strengths: ${option.pros.join(", ") || "No strengths listed"}\n` +
        `Weaknesses: ${option.cons.join(", ") || "No weaknesses listed"}\n` +
        `Best for: ${option.tags.join(", ") || "general fit"}\n` +
        `Risks: ${option.risks.join(", ") || "No major risks listed"}`,
    )
    .join("\n\n");
}

function formatWeightBreakdown(
  weights: Array<{ criterion: string; weight: number }>,
  fallback = "No weight breakdown available.",
) {
  if (weights.length === 0) {
    return fallback;
  }

  return weights
    .map((item) => `- ${item.criterion}: ${Math.round(item.weight * 100)}%`)
    .join("\n");
}

function buildFallbackPanel<T>({
  key,
  role,
  mission,
  confidence,
  content,
  defaultSummary,
  defaultKeyPoints,
  extraMissingInformation = [],
}: {
  key: CouncilAgentKey;
  role: string;
  mission: string;
  confidence: number;
  content: T;
  defaultSummary: string;
  defaultKeyPoints: string[];
  extraMissingInformation?: string[];
}): Omit<AgentPanel, "model_used"> {
  switch (key) {
    case "planner": {
      const planner = content as PlannerOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: `The user wants Synod to solve a ${planner.domain} decision and needs a clean path from vague intent to a justified recommendation.`,
        missing_information: planner.followUpQuestions,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[EXECUTION PLAN]",
          formatNumberedList(planner.executionGraph),
          "",
          "[AGENT ASSIGNMENTS]",
          "- Market Agent: assess demand, users, and positioning.",
          "- Venture Capitalist Agent: test scale, monetization, and moat.",
          "- Legal Agent: map privacy, IP, and compliance exposure.",
          "- Engineer Agent: define the technical MVP path.",
          "- Designer Agent: shape the product experience and flow.",
          "",
          "[ROADMAP]",
          planner.notes,
          "",
          "Primary criteria:",
          planner.evaluationCriteria
            .map(
              (criterion) =>
                `- ${criterion.name} (${Math.round(criterion.weight * 100)}%): ${criterion.reason}`,
            )
            .join("\n"),
        ].join("\n"),
        confidence,
      };
    }
    case "market": {
      const market = content as MarketOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: "The user needs a market lens that clarifies who this serves and why it should win.",
        missing_information: market.missingInformation,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[TARGET AUDIENCE]",
          market.targetAudience,
          "",
          "[MARKET DEMAND]",
          formatBulletList(market.demandSignals),
          "",
          "[COMPETITORS]",
          formatBulletList(market.competitors),
          "",
          "[GAPS IN THE MARKET]",
          formatBulletList(market.gaps),
          "",
          "[POSITIONING]",
          market.positioning,
          "",
          "[GO TO MARKET ROADMAP]",
          formatNumberedList(market.goToMarketRoadmap),
        ].join("\n"),
        confidence,
      };
    }
    case "venture_capitalist": {
      const vc = content as VentureCapitalistOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: "The user needs an investor-style lens to judge scale, defensibility, and funding potential.",
        missing_information: vc.missingInformation,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[IS THIS INVESTABLE]",
          vc.investable,
          "",
          "[WHY]",
          vc.why,
          "",
          "[SCALABILITY]",
          vc.scalability,
          "",
          "[BUSINESS MODEL]",
          vc.businessModel,
          "",
          "[MOAT / DEFENSIBILITY]",
          vc.moat,
          "",
          "[MAJOR RISKS]",
          formatBulletList(vc.majorRisks),
          "",
          "[WHAT MUST HAPPEN BEFORE FUNDING]",
          formatNumberedList(vc.requiredMilestones),
        ].join("\n"),
        confidence,
      };
    }
    case "legal": {
      const legal = content as LegalOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: "The user needs the legal and compliance surface mapped before moving forward.",
        missing_information: legal.missingInformation,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[LEGAL RISKS]",
          formatBulletList(legal.legalRisks),
          "",
          "[PRIVACY / DATA ISSUES]",
          formatBulletList(legal.privacyIssues),
          "",
          "[IP / COPYRIGHT ISSUES]",
          formatBulletList(legal.ipIssues),
          "",
          "[COMPLIANCE REQUIREMENTS]",
          formatBulletList(legal.complianceRequirements),
          "",
          "[WHAT SHOULD BE REVIEWED BY A LAWYER]",
          legal.lawyerReview,
        ].join("\n"),
        confidence,
      };
    }
    case "engineer": {
      const engineer = content as EngineerOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: "The user needs a practical technical architecture and MVP path.",
        missing_information: engineer.missingInformation,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[TECH STACK]",
          formatBulletList(engineer.techStack),
          "",
          "[SYSTEM ARCHITECTURE]",
          engineer.architecture,
          "",
          "[KEY COMPONENTS]",
          formatBulletList(engineer.keyComponents),
          "",
          "[TECHNICAL RISKS]",
          formatBulletList(engineer.technicalRisks),
          "",
          "[MVP ROADMAP]",
          formatNumberedList(engineer.mvpRoadmap),
          "",
          "[SCALING ROADMAP]",
          formatNumberedList(engineer.scalingRoadmap),
        ].join("\n"),
        confidence,
      };
    }
    case "designer": {
      const designer = content as DesignerOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: "The user needs the product experience shaped intentionally so the flow feels clear and trustworthy.",
        missing_information: designer.missingInformation,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[USER EXPERIENCE GOAL]",
          designer.userExperienceGoal,
          "",
          "[KEY SCREENS]",
          formatBulletList(designer.keyScreens),
          "",
          "[USER FLOW]",
          designer.userFlow,
          "",
          "[VISUAL STYLE]",
          designer.visualStyle,
          "",
          "[UNIQUE EXPERIENCE]",
          designer.uniqueExperience,
          "",
          "[DESIGN ROADMAP]",
          formatNumberedList(designer.designRoadmap),
        ].join("\n"),
        confidence,
      };
    }
    case "synthesizer": {
      const synthesizer = content as SynthesizerOutput;
      return {
        key,
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        understanding: "The council is merging the specialist lenses into one final answer the user can act on.",
        missing_information: extraMissingInformation,
        internal_reasoning_summary: defaultSummary,
        final_output: [
          "[FINAL RECOMMENDATION]",
          synthesizer.verdict,
          "",
          "[WHY THIS FITS THE USER]",
          formatBulletList(synthesizer.whySelected),
          "",
          "[TOP 3 ALTERNATIVES]",
          formatNumberedList(synthesizer.alternatives, "1. No strong alternatives were surfaced."),
          "",
          "[TRADEOFFS]",
          formatBulletList(synthesizer.cons),
          "",
          "[RISKS]",
          formatBulletList(synthesizer.risks),
          "",
          "[ROADMAP]",
          `Short-term: ${synthesizer.summary}`,
          "Long-term: Monitor the chosen path as feedback arrives and the user's constraints evolve.",
          "",
          "[IF MORE INFORMATION IS NEEDED]",
          extraMissingInformation.length > 0
            ? formatBulletList(extraMissingInformation)
            : "No further clarification is required for this pass.",
        ].join("\n"),
        confidence,
      };
    }
  }
}

async function finalizeAgentRun<T>({
  key,
  role,
  mission,
  confidence,
  content,
  defaultSummary,
  defaultKeyPoints,
  extraMissingInformation = [],
}: {
  key: CouncilAgentKey;
  role: string;
  mission: string;
  confidence: number;
  content: T;
  defaultSummary: string;
  defaultKeyPoints: string[];
  extraMissingInformation?: string[];
}): Promise<AgentRun<T>> {
  const fallbackPanel = buildFallbackPanel({
    key,
    role,
    mission,
    confidence,
    content,
    defaultSummary,
    defaultKeyPoints,
    extraMissingInformation,
  });

  const { data, modelUsed } = await aiProvider.maybeRefine<{
    understanding: string;
    missing_information: string[];
    internal_reasoning_summary: string;
    final_output: string;
    confidence: number;
  }>({
    systemPrompt: `${loadDirectAgentPrompt(key as AgentKey)}

Return valid JSON only with these exact keys:
{
  "understanding": string,
  "missing_information": string[],
  "internal_reasoning_summary": string,
  "final_output": string,
  "confidence": number
}`,
    userPrompt: JSON.stringify(
      {
        agent_name: agentDefinitions[key].name,
        mission,
        role,
        structured_output: content,
        fallback_panel: fallbackPanel,
      },
      null,
      2,
    ),
    fallback: {
      understanding: fallbackPanel.understanding,
      missing_information: fallbackPanel.missing_information,
      internal_reasoning_summary: fallbackPanel.internal_reasoning_summary,
      final_output: fallbackPanel.final_output,
      confidence,
    },
    modelOverride: env.AI_PROVIDER === "groq" ? agentDefinitions[key].groqModel : undefined,
  });

  const panel: AgentPanel = {
    ...fallbackPanel,
    understanding: data.understanding || fallbackPanel.understanding,
    missing_information:
      data.missing_information?.filter(Boolean).length > 0
        ? data.missing_information.filter(Boolean)
        : fallbackPanel.missing_information,
    internal_reasoning_summary:
      data.internal_reasoning_summary || fallbackPanel.internal_reasoning_summary,
    final_output: data.final_output || fallbackPanel.final_output,
    confidence: clamp(Number(data.confidence ?? confidence), 0, 100),
    model_used: modelUsed,
  };

  return {
    key,
    role,
    mission,
    modelUsed,
    confidence: panel.confidence,
    summary: panel.internal_reasoning_summary,
    keyPoints: defaultKeyPoints,
    content,
    panel,
  };
}

export async function runCouncil(
  input: CouncilInput,
  options: {
    onAgentComplete?: (agentRun: CouncilAgentRun) => Promise<void> | void;
  } = {},
): Promise<CouncilResult> {
  const conversationContext = input.conversation?.length
    ? input.conversation
        .map((message) => {
          const agentSuffix = message.target_agent ? ` (${message.target_agent})` : "";
          return `${message.role.toUpperCase()}${agentSuffix}: ${message.content}`;
        })
        .join("\n")
    : "";
  const effectivePrompt = conversationContext
    ? `${input.prompt}\n\nConversation context:\n${conversationContext}`
    : input.prompt;

  const emitAgent = async (agentRun: CouncilAgentRun) => {
    await options.onAgentComplete?.(agentRun);
  };

  const budget = extractBudget(effectivePrompt) ?? input.user.budgetAmount;
  const domain = inferDomain(effectivePrompt);
  const baseOptions = buildOptions(domain, budget);
  const { positiveTerms, negativeTerms } = collectPreferenceSignals(
    input.user,
    input.preferences,
    effectivePrompt,
    input.memories,
  );
  const adjustedOptions = applyPreferenceAdjustments(baseOptions, positiveTerms, negativeTerms, budget);

  const plannerContent = buildPlanner(
    effectivePrompt,
    domain,
    adjustedOptions,
    input.user,
    input.preferences,
    input.memories,
  );
  const planner = await finalizeAgentRun({
    key: "planner",
    role: agentDefinitions.planner.role,
    mission: agentDefinitions.planner.mission,
    confidence: plannerContent.confidence,
    content: plannerContent,
    defaultSummary: plannerContent.notes,
    defaultKeyPoints: [
      `Detected domain: ${domain}`,
      `Execution graph has ${plannerContent.executionGraph.length} steps`,
      plannerContent.followUpQuestions[0] ?? "Prompt specificity is adequate for a first pass",
    ],
  });
  await emitAgent(planner);

  const marketContent = buildMarket(effectivePrompt, domain, adjustedOptions, input.memories);
  const market = await finalizeAgentRun({
    key: "market",
    role: agentDefinitions.market.role,
    mission: agentDefinitions.market.mission,
    confidence: marketContent.confidence,
    content: marketContent,
    defaultSummary: marketContent.summary,
    defaultKeyPoints: [
      marketContent.topOptions[0] ?? "No single market winner yet",
      marketContent.demandSignals[0],
      marketContent.positioning,
    ],
    extraMissingInformation: marketContent.missingInformation,
  });
  await emitAgent(market);

  const ventureCapitalistContent = buildVentureCapitalist(effectivePrompt, domain, adjustedOptions);
  const ventureCapitalist = await finalizeAgentRun({
    key: "venture_capitalist",
    role: agentDefinitions.venture_capitalist.role,
    mission: agentDefinitions.venture_capitalist.mission,
    confidence: ventureCapitalistContent.confidence,
    content: ventureCapitalistContent,
    defaultSummary: ventureCapitalistContent.why,
    defaultKeyPoints: [
      ventureCapitalistContent.investable,
      ventureCapitalistContent.moat,
      ventureCapitalistContent.requiredMilestones[0] ?? "No funding milestone yet",
    ],
    extraMissingInformation: ventureCapitalistContent.missingInformation,
  });
  await emitAgent(ventureCapitalist);

  const legalContent = buildLegal(effectivePrompt, domain, adjustedOptions);
  const legal = await finalizeAgentRun({
    key: "legal",
    role: agentDefinitions.legal.role,
    mission: agentDefinitions.legal.mission,
    confidence: legalContent.confidence,
    content: legalContent,
    defaultSummary: legalContent.lawyerReview,
    defaultKeyPoints: [
      legalContent.legalRisks[0] ?? "No dominant legal risk surfaced",
      legalContent.privacyIssues[0] ?? "Privacy obligations look manageable",
      legalContent.complianceRequirements[0] ?? "Compliance review is straightforward",
    ],
    extraMissingInformation: legalContent.missingInformation,
  });
  await emitAgent(legal);

  const engineerContent = buildEngineer(effectivePrompt, domain, adjustedOptions, input.user);
  const engineer = await finalizeAgentRun({
    key: "engineer",
    role: agentDefinitions.engineer.role,
    mission: agentDefinitions.engineer.mission,
    confidence: engineerContent.confidence,
    content: engineerContent,
    defaultSummary: engineerContent.architecture,
    defaultKeyPoints: [
      engineerContent.techStack[0] ?? "No stack selected yet",
      engineerContent.technicalRisks[0] ?? "Technical risk surface is manageable",
      engineerContent.mvpRoadmap[0] ?? "MVP path is not yet locked in",
    ],
    extraMissingInformation: engineerContent.missingInformation,
  });
  await emitAgent(engineer);

  const designerContent = buildDesigner(effectivePrompt, domain, adjustedOptions);
  const designer = await finalizeAgentRun({
    key: "designer",
    role: agentDefinitions.designer.role,
    mission: agentDefinitions.designer.mission,
    confidence: designerContent.confidence,
    content: designerContent,
    defaultSummary: designerContent.uniqueExperience,
    defaultKeyPoints: [
      designerContent.userExperienceGoal,
      designerContent.keyScreens[0] ?? "No primary screen defined",
      designerContent.visualStyle,
    ],
    extraMissingInformation: designerContent.missingInformation,
  });
  await emitAgent(designer);

  const synthesizerContent = buildSynthesizer(
    effectivePrompt,
    domain,
    adjustedOptions,
    plannerContent,
    marketContent,
    ventureCapitalistContent,
    legalContent,
    engineerContent,
    designerContent,
  );
  const synthesizer = await finalizeAgentRun({
    key: "synthesizer",
    role: agentDefinitions.synthesizer.role,
    mission: agentDefinitions.synthesizer.mission,
    confidence: synthesizerContent.confidence,
    content: synthesizerContent,
    defaultSummary: synthesizerContent.summary,
    defaultKeyPoints: [
      `Selected option: ${synthesizerContent.selectedOptionTitle}`,
      `Confidence: ${synthesizerContent.confidence}%`,
      synthesizerContent.whySelected[0] ?? "No dominant reason captured",
    ],
    extraMissingInformation: synthesizerContent.followUpQuestions,
  });
  await emitAgent(synthesizer);

  return {
    planner,
    market,
    venture_capitalist: ventureCapitalist,
    legal,
    engineer,
    designer,
    synthesizer,
    options: rankOptionsByScore(
      adjustedOptions.map((option) => ({
        ...option,
        score: clamp(
          Math.round(
            option.score +
              scoreForMarket(option, domain) +
              scoreForVentureCapital(option, domain) +
              scoreForEngineering(option, domain) +
              scoreForDesign(option, domain) -
              scoreLegalRisk(option, domain),
          ),
          0,
          100,
        ),
      })),
    ),
  };
}
