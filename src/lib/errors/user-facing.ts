const SIGN_IN_REQUIRED_MESSAGE = "Please sign in to continue.";
const TEMPORARY_UNAVAILABLE_MESSAGE =
  "BaseBuddy is temporarily unavailable. Please try again in a few minutes.";
const INVALID_REQUEST_MESSAGE =
  "Some information is missing or invalid. Please review and try again.";
const REQUEST_PROCESSING_MESSAGE = "We couldn't process that request. Please try again.";
const STORAGE_REQUEST_MESSAGE =
  "We couldn't complete the storage request. Check upload storage and try again.";
const STORAGE_UPLOAD_MESSAGE =
  "We couldn't upload this file. Check upload storage and try again.";

const SAFE_EXACT_MESSAGES = new Set([
  SIGN_IN_REQUIRED_MESSAGE,
  TEMPORARY_UNAVAILABLE_MESSAGE,
  INVALID_REQUEST_MESSAGE,
  REQUEST_PROCESSING_MESSAGE,
  STORAGE_REQUEST_MESSAGE,
  STORAGE_UPLOAD_MESSAGE,
]);

const SAFE_MESSAGE_PATTERNS = [
  /^Could not (?:load|save|update|delete|remove|create|open|refresh|restore|discard|publish|archive|move|upload|prepare|finish|manage|check|verify|connect)[^.]*\.$/i,
  /^Could not find [^.]+\.$/i,
  /^Enter [^.]+\.$/i,
  /^Choose [^.]+\.$/i,
  /^Select [^.]+\.$/i,
  /^Too many [^.]+\.$/i,
  /^Only [^.]+\.$/i,
  /^Not authorized to [^.]+\.?$/i,
  /^You do not have permission[^.]*\.$/i,
  /^That [^.]+\.$/i,
  /^This invitation has [^.]+\.$/i,
  /^Project invitation not found\.?$/i,
  /^Sign in with the invited email address[^.]*\.$/i,
  /^[A-Z][A-Za-z0-9 _-]{0,60} is required\.$/,
  /^[A-Z][A-Za-z0-9 _-]{0,60} is too long\.$/,
  /^[A-Z][A-Za-z0-9 _-]{0,60} must be [^.]+\.$/,
  /^A permission cannot be both allowed and denied\.$/i,
  /^This slug is (?:available|already taken)\.$/i,
  /^Finish [^.]+\.$/i,
  /^Map a supported [^.]+\.$/i,
  /^The (?:files|media) library is not configured[^.]*\.$/i,
  /^Finish content setup before [^.]+\.$/i,
  /^SVG uploads are not allowed\.$/i,
  /^Files must be one of: .+\.$/i,
  /^Image files belong in the media library\. Upload them from Media instead\.$/i,
  /^PDF uploads must have valid PDF file contents\.$/i,
  /^[A-Za-z0-9 _"().:-]+ is empty\.$/,
  /^[A-Za-z0-9 _"().:-]+ must be \d+ MB or smaller\.$/,
  /^[A-Za-z0-9 _"().:-]+ must use a supported image extension\.$/,
  /^[A-Za-z0-9 _"().:-]+ must be a PNG, JPEG, GIF, WebP, or AVIF image\.$/,
  /^Upload \d+ (?:files|images) or fewer at a time\.$/i,
  /^We couldn't [^.]+\.$/i,
];

const MESSAGE_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string | ((message: string) => string) }> = [
  {
    pattern: /Authentication required\./i,
    replacement: SIGN_IN_REQUIRED_MESSAGE,
  },
  {
    pattern:
      /BaseBuddy still needs a required setup update|Apply the latest Supabase migrations|still needs a required setup update/i,
    replacement: TEMPORARY_UNAVAILABLE_MESSAGE,
  },
  {
    pattern: /Missing required environment variable/i,
    replacement: "BaseBuddy needs a setup update. Check the app configuration and try again.",
  },
  {
    pattern: /Could not apply the BaseBuddy control(?:-| )plane schema|Could not install the control(?:-| )plane schema/i,
    replacement:
      "We couldn't finish preparing this workspace. Check the setup permissions and try again.",
  },
  {
    pattern: /Could not create the project media bucket/i,
    replacement:
      "We couldn't finish preparing media storage for this workspace. Check the setup permissions and try again.",
  },
  {
    pattern: /schema cache|PGRST\d+|RPC|function .* does not exist/i,
    replacement: "BaseBuddy needs a setup update. Open setup and run the latest checks.",
  },
  {
    pattern: /Session Pooler|Mapped\s+content requires/i,
    replacement: "This project needs a content connection before you can continue.",
  },
  {
    pattern: /MaxClientsInSessionMode|max clients reached/i,
    replacement: "BaseBuddy is busy right now. Try again in a few seconds.",
  },
  {
    pattern: /Circuit breaker open: Too many authentication errors/i,
    replacement: "The app connection is temporarily unavailable. Wait a moment and try again.",
  },
  {
    pattern: /password authentication failed|Tenant or user not found/i,
    replacement: "The app connection is no longer valid. Update setup and try again.",
  },
  {
    pattern:
      /relation .* does not exist|column .* does not exist|A mapped (?:table|column) does not exist in the (?:connected|installation) database/i,
    replacement: "This project's content setup is out of date. Review the setup and try again.",
  },
  {
    pattern: /adapter|storage shape|helper row/i,
    replacement: "This project's setup is out of date. Review the field setup and try again.",
  },
  {
    pattern: /Could not upload directly to the configured (?:file )?storage|CORS settings allow this site/i,
    replacement: STORAGE_UPLOAD_MESSAGE,
  },
  {
    pattern:
      /SignatureDoesNotMatch|AccessDenied|NoSuchBucket|InvalidAccessKeyId|Could not reach the configured (?:S3[- ]compatible )?storage|Could not load the S3[- ]compatible media bucket/i,
    replacement: STORAGE_REQUEST_MESSAGE,
  },
  {
    pattern: /Request body must be valid JSON|Invalid request payload/i,
    replacement: REQUEST_PROCESSING_MESSAGE,
  },
  {
    pattern: /Request body is too large/i,
    replacement: "This upload is too large. Reduce the file size and try again.",
  },
];

const SETUP_OWNER_MESSAGE_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string | ((message: string, match: RegExpExecArray) => string);
}> = [
  {
    pattern: /Missing required environment variable:?\s*([A-Z0-9_]+)/i,
    replacement: (_message, match) =>
      `Set ${match[1]} in .env, restart the app, and run setup checks again.`,
  },
  {
    pattern: /schema cache|PGRST\d+|RPC|function .* does not exist/i,
    replacement: "BaseBuddy tables are not up to date. Run the setup SQL, then run setup checks again.",
  },
  {
    pattern:
      /Could not apply the BaseBuddy control(?:-| )plane schema|Could not install the control(?:-| )plane schema/i,
    replacement: "BaseBuddy tables could not be installed. Check database permissions and run setup again.",
  },
  {
    pattern: /Session Pooler|Mapped\s+content requires/i,
    replacement: "Check the content connection settings, then run setup checks again.",
  },
  {
    pattern:
      /SignatureDoesNotMatch|AccessDenied|NoSuchBucket|InvalidAccessKeyId|Could not reach the configured (?:S3[- ]compatible )?storage/i,
    replacement: "Check upload storage credentials and permissions, then run setup checks again.",
  },
];

const GENERIC_VALIDATION_PATTERNS = [
  /^Required$/i,
  /^Invalid input$/i,
  /^Expected /i,
  /^Invalid literal value/i,
  /^String must contain/i,
  /^String must be/i,
  /^Number must be/i,
  /^Array must contain/i,
  /^Too small/i,
  /^Too big/i,
];

export const getRawErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (typeof error === "string") {
    return error.trim();
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message.trim();
  }

  return "";
};

export const isProductionReadyErrorMessage = (message: string) => {
  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    return false;
  }

  if (SAFE_EXACT_MESSAGES.has(normalizedMessage)) {
    return true;
  }

  return SAFE_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
};

const getReplacedProductionMessage = (message: string) => {
  for (const { pattern, replacement } of MESSAGE_REPLACEMENTS) {
    if (pattern.test(message)) {
      return typeof replacement === "function" ? replacement(message) : replacement;
    }
  }

  return null;
};

export const getProductionErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message = getRawErrorMessage(error);

  if (!message) {
    return fallbackMessage;
  }

  const replacedMessage = getReplacedProductionMessage(message);

  if (replacedMessage) {
    return replacedMessage;
  }

  if (isProductionReadyErrorMessage(message)) {
    return message;
  }

  return fallbackMessage;
};

export const getSetupOwnerErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message = getRawErrorMessage(error);

  if (!message) {
    return fallbackMessage;
  }

  for (const { pattern, replacement } of SETUP_OWNER_MESSAGE_REPLACEMENTS) {
    const match = pattern.exec(message);

    if (match) {
      return typeof replacement === "function" ? replacement(message, match) : replacement;
    }
  }

  const replacedMessage = getReplacedProductionMessage(message);

  if (replacedMessage) {
    return replacedMessage;
  }

  if (isProductionReadyErrorMessage(message)) {
    return message;
  }

  return fallbackMessage;
};

export const getProductionValidationMessage = (
  message: string | null | undefined,
  fallbackMessage = INVALID_REQUEST_MESSAGE,
) => {
  const normalizedMessage = message?.trim() ?? "";

  if (!normalizedMessage) {
    return fallbackMessage;
  }

  const replacedMessage = getReplacedProductionMessage(normalizedMessage);

  if (replacedMessage) {
    return replacedMessage;
  }

  if (GENERIC_VALIDATION_PATTERNS.some((pattern) => pattern.test(normalizedMessage))) {
    return fallbackMessage;
  }

  return isProductionReadyErrorMessage(normalizedMessage) ? normalizedMessage : fallbackMessage;
};

export const userFacingErrorMessages = {
  invalidRequest: INVALID_REQUEST_MESSAGE,
  requestProcessing: REQUEST_PROCESSING_MESSAGE,
  signInRequired: SIGN_IN_REQUIRED_MESSAGE,
  storageRequest: STORAGE_REQUEST_MESSAGE,
  storageUpload: STORAGE_UPLOAD_MESSAGE,
  temporaryUnavailable: TEMPORARY_UNAVAILABLE_MESSAGE,
  uploadTooLarge: "This upload is too large. Reduce the file size and try again.",
} as const;
