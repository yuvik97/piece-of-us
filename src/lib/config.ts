export const config = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  paymentProvider: (process.env.PAYMENT_PROVIDER || "mock") as "mock" | "paypal",
  paymentTestMode: process.env.PAYMENT_TEST_MODE !== "false",
  mockWebhookSecret: process.env.MOCK_WEBHOOK_SECRET || "dev-mock-secret",
  paypal: {
    env: (process.env.PAYPAL_ENV || "sandbox") as "sandbox" | "live",
    clientId: process.env.PAYPAL_CLIENT_ID || "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
    webhookId: process.env.PAYPAL_WEBHOOK_ID || "",
  },
  moderation: {
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    anthropicModel: process.env.MODERATION_MODEL || "claude-sonnet-5-5",
    openaiKey: process.env.OPENAI_API_KEY || "",
    timeoutMs: Number(process.env.MODERATION_TIMEOUT_MS || 25000),
    allowLocalOnlyInDemo: process.env.MODERATION_DEMO_LOCAL_ONLY !== "false",
  },
  notify: {
    resendKey: process.env.RESEND_API_KEY || "",
    from: process.env.NOTIFY_FROM || "PIECE OF US <hello@pieceofus.art>",
  },
  /** "username:role:scrypt$salt$hash" entries separated by commas. role = admin | moderator */
  adminAccounts: process.env.ADMIN_ACCOUNTS || "",
  /** Single-owner fallback: username "owner", role admin. */
  adminPassword: process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin" : ""),
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || "dev-admin-secret",
  cronSecret: process.env.CRON_SECRET || "",
  ipHashSalt: process.env.IP_HASH_SALT || "dev-salt",
  reservationMinutes: 15,       // selecting + uploading
  paymentHoldMinutes: 30,       // approved automatically → time to pay
  reviewHoldMinutes: 72 * 60,   // waiting for a human decision
  approvedHoldMinutes: 48 * 60, // approved by a human → time to come back and pay
  maxUploadBytes: 12 * 1024 * 1024,
};

export const isDemoMode = () => !config.supabaseUrl || !config.supabaseServiceKey;
