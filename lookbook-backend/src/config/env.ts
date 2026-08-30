import dotenv from "dotenv";

dotenv.config();

const required = ["MONGO_URI", "JWT_SECRET"] as const;

for (const key of required) {
  if (!process.env[key]) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Warning: ${key} is not set. Check your .env file.`);
  }
}

const port = Number(process.env.PORT ?? 5000);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  backendUrl: process.env.BACKEND_URL ?? `http://localhost:${port}`,
  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/lookbook",

  jwtSecret: process.env.JWT_SECRET ?? "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? "15m",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret_change_me",
  refreshTokenExpiresInDays: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? 30),
  refreshTokenRememberMeExpiresInDays: Number(
    process.env.REFRESH_TOKEN_REMEMBER_ME_EXPIRES_IN_DAYS ?? 30
  ),
  refreshTokenSessionExpiresInDays: Number(process.env.REFRESH_TOKEN_SESSION_EXPIRES_IN_DAYS ?? 1),

  cookieName: process.env.COOKIE_NAME ?? "lookbook_token",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? "lookbook_refresh",
  oauthStateCookieName: "lookbook_oauth_state",
  csrfCookieName: "lookbook_csrf",

  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),

  isProd: (process.env.NODE_ENV ?? "development") === "production",

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${port}/api/auth/google/callback`,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    redirectUri: process.env.GITHUB_REDIRECT_URI ?? `http://localhost:${port}/api/auth/github/callback`,
  },

  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@lookbook.dev",
  },

  // Defensively extracted — .env values sometimes get pasted with a leading
  // shell command (e.g. "redis-cli -u redis://...") instead of the bare URL.
  redisUrl: process.env.REDIS_URL?.match(/rediss?:\/\/\S+/)?.[0] ?? "",

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    textModel: process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash",
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
    embeddingDimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 768),
  },

  // future.md §0 designates Groq for transcription (Whisper) and fast text
  // tasks. The configured key historically returned 401 — that's a credential
  // issue only the user can fix. When unset/blank, the app falls back to
  // Gemini's inline audio understanding for transcription so voice search
  // still works today.
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    whisperModel: process.env.GROQ_WHISPER_MODEL ?? "whisper-large-v3",
    textModel: process.env.GROQ_TEXT_MODEL ?? "",
    visionModel: process.env.GROQ_VISION_MODEL ?? "",
  },

  // VAPID keys for web push notifications (Phase 10.2). Generate with
  // `npm run push:keys` (see scripts/generateVapidKeys.ts). Without them the
  // app still stores subscriptions and sends in-app notifications, but skips
  // the browser-push fan-out.
  webPush: {
    subject: process.env.VAPID_SUBJECT ?? "mailto:admin@lookbook.dev",
    publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },

  rental: {
    defaultDurationDays: Number(process.env.RENTAL_DEFAULT_DURATION_DAYS ?? 15),
    extensionDays: Number(process.env.RENTAL_EXTENSION_DAYS ?? 7),
    lateFeePerDay: Number(process.env.RENTAL_LATE_FEE_PER_DAY ?? 10),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
};
