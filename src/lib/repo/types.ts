import type { TileState } from "../grid";
import type { ModerationResult } from "../moderation/types";

export type SubmissionStatus =
  | "awaiting_payment"
  | "in_review"
  | "appealed"
  | "rejected"
  | "published"
  | "removed"
  | "refunded"
  | "expired";

export interface SubmissionMeta {
  displayName: string | null;
  country: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  /** Optional public contact details, shown on the published piece. */
  contactInstagram: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface Submission extends SubmissionMeta {
  id: string;
  tile: number;
  status: SubmissionStatus;
  imagePath: string;
  thumbPath: string;
  avgColor: string;
  accessTokenHash: string;
  rightsConfirmed: boolean;
  ipHash: string | null;
  holdUntil: string | null;
  moderationDecision: "approved" | "pending_review" | "rejected" | null;
  moderationCategories: string[];
  moderationScores: Record<string, number>;
  moderationDetail: Record<string, unknown>;
  moderationProvider: string | null;
  extractedText: string | null;
  moderatedAt: string | null;
  publicReason: string | null;
  appealMessage: string | null;
  appealedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  paymentProvider: string | null;
  paymentOrderId: string | null;
  paymentCaptureId: string | null;
  amountCents: number | null;
  currency: string | null;
  paidAt: string | null;
  publishedAt: string | null;
  refundId: string | null;
  refundedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

export interface OverviewRecord {
  tile: number;
  state: TileState;
  color: number; // 0xRRGGBB
  extra: number; // founding: kind<<24 | seed<<8 | palette; published: 1
}

export interface PublicPiece {
  tile: number;
  founding: boolean;
  title: string | null;
  displayName: string | null;
  country: string | null;
  description: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  avgColor: string;
  contact?: { instagram: string | null; email: string | null; phone: string | null };
  discipline?: string;
  kind?: number;
  seed?: number;
  palette?: number;
}

export interface PublicStats {
  founding: number;
  contributions: number;
  held: number;
  available: number;
  updatedAt: string;
}

export interface AdminStats extends PublicStats {
  revenueCents: number;
  refundedCents: number;
  paid: number;
  published: number;
  awaitingPayment: number;
  inReview: number;
  rejected: number;
  openReports: number;
}

export interface FoundingRow {
  tile: number;
  kind: number;
  seed: number;
  palette: number;
  hidden: boolean;
}

export type ReportReason = "hate" | "violence" | "sexual" | "political" | "copyright" | "privacy" | "spam" | "other";

export interface Report {
  id: number;
  tile: number;
  submissionId: string | null;
  founding: boolean;
  reason: ReportReason;
  details: string | null;
  status: "open" | "dismissed" | "actioned";
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ModerationEvent {
  id: number;
  submissionId: string | null;
  reportId: number | null;
  tile: number | null;
  actor: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

export type ConfirmResult =
  | { result: "confirmed" | "already" | "conflict" | "amount_mismatch" | "not_payable"; submission: Submission }
  | { result: "unknown" };

export interface SubmissionQuery {
  status?: SubmissionStatus | "all" | "needs_review";
  category?: string;
  search?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface Repo {
  overview(): Promise<OverviewRecord[]>;
  stats(): Promise<PublicStats>;
  adminStats(): Promise<AdminStats>;
  publicPiece(tile: number): Promise<PublicPiece | null>;

  reserveTile(tile: number, tokenHash: string, minutes: number): Promise<{ ok: true; expiresAt: string } | { ok: false }>;
  releaseReservation(tile: number, tokenHash: string): Promise<void>;
  createSubmission(input: {
    id: string;
    tile: number;
    reservationTokenHash: string;
    accessTokenHash: string;
    meta: SubmissionMeta;
    imagePath: string;
    thumbPath: string;
    avgColor: string;
    ipHash: string | null;
    moderation: ModerationResult;
    holdMinutes: number;
  }): Promise<Submission | null>;
  getSubmission(id: string): Promise<Submission | null>;
  attachCheckout(id: string, provider: string, orderId: string): Promise<void>;
  confirmPayment(input: { provider: string; orderId: string; captureId: string; amountCents: number; currency: string }): Promise<ConfirmResult>;
  markRefunded(id: string, refundId: string, actor: string): Promise<void>;
  markNotified(id: string): Promise<void>;
  moderate(id: string, action: "approve" | "reject" | "remove" | "note", actor: string, opts: { reason?: string | null; note?: string | null; holdMinutes?: number }): Promise<Submission | null>;
  appeal(id: string, message: string, holdMinutes: number): Promise<"ok" | "not_found" | "not_appealable">;
  expireHolds(): Promise<number>;
  listSubmissions(q: SubmissionQuery): Promise<{ rows: Submission[]; total: number }>;
  events(submissionId?: string, limit?: number): Promise<ModerationEvent[]>;
  logEvent(e: Omit<ModerationEvent, "id" | "createdAt">): Promise<void>;

  createReport(r: { tile: number; submissionId: string | null; founding: boolean; reason: ReportReason; details: string | null; reporterHash: string }): Promise<"ok" | "duplicate">;
  listReports(q: { status?: Report["status"] | "all"; limit: number; offset: number }): Promise<{ rows: Report[]; total: number }>;
  resolveReport(id: number, status: "dismissed" | "actioned", actor: string, note: string | null): Promise<Report | null>;

  listFounding(q: { limit: number; offset: number; hidden?: boolean }): Promise<{ rows: FoundingRow[]; total: number }>;
  setFoundingHidden(tile: number, hidden: boolean): Promise<{ ok: boolean; reason?: string }>;
  rateLimit(key: string, windowSec: number, max: number): Promise<boolean>;
  /** Returns false if this webhook event was already processed. */
  recordPaymentEvent(provider: string, eventId: string, type: string, payload: unknown): Promise<boolean>;
  retention(): Promise<string[]>;

  putObject(bucket: "submissions" | "pieces", path: string, data: Buffer, contentType: string): Promise<void>;
  getObject(bucket: "submissions" | "pieces", path: string): Promise<Buffer | null>;
  copyObject(fromPath: string, toPath: string): Promise<void>; // submissions → pieces
  removeObject(bucket: "submissions" | "pieces", path: string): Promise<void>;
  privateUrl(path: string): Promise<string>;
  publicUrl(path: string): string;
}
