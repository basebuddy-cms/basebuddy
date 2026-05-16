type SecurityHeader = {
  key: string;
  value: string;
};

export type SecurityHeadersOptions = {
  includeContentSecurityPolicy?: boolean;
  isProduction: boolean;
  searchIndexingEnabled?: boolean;
  scriptNonce?: string | null;
  supabaseUrl?: string | null;
};

const toOrigin = (value?: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const toWebSocketOrigin = (value?: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return null;
  }
};

const uniqueSources = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];

const toNonceSource = (nonce?: string | null) => {
  const trimmedNonce = nonce?.trim();
  return trimmedNonce ? `'nonce-${trimmedNonce}'` : null;
};

export const buildContentSecurityPolicy = ({ isProduction, scriptNonce, supabaseUrl }: SecurityHeadersOptions) => {
  const supabaseOrigin = toOrigin(supabaseUrl);
  const supabaseWebSocketOrigin = toWebSocketOrigin(supabaseUrl);

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["manifest-src", ["'self'"]],
    ["script-src", uniqueSources([
      "'self'",
      isProduction ? toNonceSource(scriptNonce) : "'unsafe-inline'",
      !isProduction ? "'unsafe-eval'" : null,
    ])],
    // UI libraries and React chart styles still need inline style attributes/style tags.
    ["style-src", uniqueSources(["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"])],
    ["font-src", uniqueSources(["'self'", "data:", "https://fonts.gstatic.com"])],
    ["img-src", uniqueSources([
      "'self'",
      "data:",
      "blob:",
      "https:",
      !isProduction ? "http://localhost:*" : null,
      !isProduction ? "http://127.0.0.1:*" : null,
    ])],
    ["media-src", uniqueSources([
      "'self'",
      "data:",
      "blob:",
      "https:",
      !isProduction ? "http://localhost:*" : null,
      !isProduction ? "http://127.0.0.1:*" : null,
    ])],
    ["connect-src", uniqueSources([
      "'self'",
      supabaseOrigin,
      supabaseWebSocketOrigin,
      "https://api.supabase.com",
      "https://*.supabase.co",
      "https://*.supabase.com",
      "wss://*.supabase.co",
      "wss://*.supabase.com",
      !isProduction ? "http://localhost:*" : null,
      !isProduction ? "http://127.0.0.1:*" : null,
      !isProduction ? "ws://localhost:*" : null,
      !isProduction ? "ws://127.0.0.1:*" : null,
    ])],
    ["worker-src", uniqueSources(["'self'", "blob:"])],
    ["child-src", uniqueSources(["'self'", "blob:"])],
  ];

  if (isProduction) {
    directives.push(["upgrade-insecure-requests", []]);
  }

  return directives.map(([directive, sources]) => [directive, ...sources].join(" ")).join("; ");
};

export const getSecurityHeaders = (options: SecurityHeadersOptions): SecurityHeader[] => {
  const headers: SecurityHeader[] = [];

  if (options.includeContentSecurityPolicy !== false) {
    headers.push({
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    });
  }

  headers.push(
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()",
        "autoplay=()",
        "camera=()",
        "display-capture=()",
        "geolocation=()",
        "gyroscope=()",
        "magnetometer=()",
        "microphone=()",
        "payment=()",
        "publickey-credentials-get=()",
        "usb=()",
      ].join(", "),
    },
  );

  if (!options.searchIndexingEnabled) {
    headers.push({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
    });
  }

  if (options.isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
};
