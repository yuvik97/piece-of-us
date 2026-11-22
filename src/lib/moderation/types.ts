export const CATEGORIES = [
  "hate",                // hate speech, racism, antisemitism, Islamophobia, xenophobia, identity-based discrimination
  "extremism",           // terrorist / extremist propaganda, hate symbols used to promote hatred
  "violence_incitement", // calls for violence, genocide, persecution, threats
  "harassment",          // bullying, targeted humiliation
  "sexual",              // nudity, pornography, sexually explicit content
  "minors",              // any sexualisation of minors
  "graphic_violence",    // gore, blood, disturbing imagery
  "self_harm",           // promotes or encourages suicide / self-harm
  "political",           // campaigns, party ads, political propaganda
  "commercial_spam",     // ads, promotion, QR codes, links, spam
  "privacy",             // someone's private personal information
  "impersonation_fraud", // impersonation, scams, fraud
  "copyright",           // identifiable third-party artwork / logos / stills
  "illegal",             // other illegal content
  "evasion",             // attempts to bypass moderation (obfuscation, hidden text)
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Decision = "approved" | "pending_review" | "rejected";

export interface Signal {
  source: string;       // "local" | "claude" | "openai" | "qr"
  category: Category;
  confidence: number;   // 0..1
  evidence?: string;
}

export interface ProviderOutput {
  provider: string;
  signals: Signal[];
  suggested?: Decision;      // the provider's own verdict, if it gives one
  extractedText?: string | null;
  summary?: string;
  protectedExpression?: string[]; // e.g. "religious symbol", "national flag" — never a reason to reject
}

export interface ModerationResult {
  decision: Decision;
  categories: Category[];
  scores: Partial<Record<Category, number>>;
  provider: string;
  extractedText: string | null;
  publicReason: string | null;
  detail: {
    signals: Signal[];
    summaries: Record<string, string>;
    protectedExpression: string[];
    errors: string[];
    aiAvailable: boolean;
    reasons: string[];
  };
}

export interface ModerationInput {
  image: Buffer;          // processed, metadata-free 1024px WebP
  rgba512: { data: Uint8ClampedArray; width: number; height: number };
  displayName: string | null;
  title: string | null;
  description: string | null;
  country: string | null;
}
