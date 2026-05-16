import "server-only";

import crypto from "node:crypto";

import type { ContentStorageObjectRecord } from "@/lib/content-runtime/media-library";
import { normalizeContentMediaPath } from "@/lib/content-runtime/media-library";

const S3_SERVICE_NAME = "s3";

export type S3CompatibleMediaStorageConfig = {
  accessKeyId: string;
  bucketName: string;
  endpoint: string | null;
  publicUrlBase: string | null;
  region: string | null;
  secretAccessKey: string;
};

type SignedS3CompatibleRequestInput = {
  body?: string | Uint8Array;
  config: S3CompatibleMediaStorageConfig;
  headers?: Record<string, string>;
  method: "DELETE" | "GET" | "PUT";
  objectPath?: string | null;
  query?: Array<[string, string]>;
};

const EMPTY_PAYLOAD_SHA256 = crypto.createHash("sha256").update("").digest("hex");

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const normalizeOptionalUrl = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue ? trimmedValue.replace(/\/+$/g, "") : null;
};

const normalizeS3CompatibleRegion = (config: S3CompatibleMediaStorageConfig) => {
  const normalizedRegion = config.region?.trim();

  if (normalizedRegion) {
    return normalizedRegion;
  }

  return config.endpoint?.trim() ? "auto" : "us-east-1";
};

const getS3CompatibleEndpointUrl = (config: S3CompatibleMediaStorageConfig) => {
  const normalizedEndpoint = normalizeOptionalUrl(config.endpoint);

  if (normalizedEndpoint) {
    return new URL(normalizedEndpoint);
  }

  const region = normalizeS3CompatibleRegion(config);
  return new URL(
    region === "us-east-1" ? "https://s3.amazonaws.com" : `https://s3.${region}.amazonaws.com`,
  );
};

const getCanonicalPathSegments = ({
  bucketName,
  endpointUrl,
  objectPath,
}: {
  bucketName: string;
  endpointUrl: URL;
  objectPath?: string | null;
}) => {
  const pathSegments = endpointUrl.pathname.split("/").filter(Boolean);
  const objectSegments = (objectPath ?? "").trim().split("/").filter(Boolean);

  return [...pathSegments, bucketName.trim(), ...objectSegments];
};

const getCanonicalUri = ({
  bucketName,
  endpointUrl,
  objectPath,
}: {
  bucketName: string;
  endpointUrl: URL;
  objectPath?: string | null;
}) => {
  const segments = getCanonicalPathSegments({
    bucketName,
    endpointUrl,
    objectPath,
  });

  return segments.length ? `/${segments.map(encodeRfc3986).join("/")}` : "/";
};

const buildS3CompatibleUrl = ({
  bucketName,
  endpointUrl,
  objectPath,
  query,
}: {
  bucketName: string;
  endpointUrl: URL;
  objectPath?: string | null;
  query?: Array<[string, string]>;
}) => {
  const url = new URL(endpointUrl.toString());
  url.pathname = getCanonicalUri({ bucketName, endpointUrl, objectPath });
  url.search = "";

  (query ?? []).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  return url;
};

const buildCanonicalQueryString = (entries: Array<[string, string]>) =>
  [...entries]
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }

      return leftKey.localeCompare(rightKey);
    })
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");

const normalizeHeaderValue = (value: string) => value.trim().replace(/\s+/g, " ");

const buildCanonicalHeaders = (headers: Record<string, string>) => {
  const normalizedEntries = Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), normalizeHeaderValue(value)] as const)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return {
    canonicalHeaders: normalizedEntries.map(([key, value]) => `${key}:${value}\n`).join(""),
    signedHeaders: normalizedEntries.map(([key]) => key).join(";"),
  };
};

const toAmzDate = (date: Date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const toDateStamp = (amzDate: string) => amzDate.slice(0, 8);

const sha256Hex = (value: Uint8Array | string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const hmacSha256 = (key: Buffer | string, value: string) =>
  crypto.createHmac("sha256", key).update(value).digest();

const getSignatureKey = ({
  dateStamp,
  region,
  secretAccessKey,
}: {
  dateStamp: string;
  region: string;
  secretAccessKey: string;
}) => {
  const dateKey = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmacSha256(dateKey, region);
  const serviceKey = hmacSha256(regionKey, S3_SERVICE_NAME);
  return hmacSha256(serviceKey, "aws4_request");
};

const extractXmlValue = (input: string, tagName: string) => {
  const match = input.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return match?.[1]?.trim() ?? null;
};

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const getS3CompatibleErrorMessage = async (response: Response, fallback: string) => {
  const rawBody = await response.text().catch(() => "");

  if (!rawBody.trim()) {
    return fallback;
  }

  const parsedMessage = extractXmlValue(rawBody, "Message");
  return parsedMessage ? decodeXmlEntities(parsedMessage) : fallback;
};

const signedFetchS3Compatible = async ({
  body,
  config,
  headers,
  method,
  objectPath,
  query,
}: SignedS3CompatibleRequestInput) => {
  const endpointUrl = getS3CompatibleEndpointUrl(config);
  const requestUrl = buildS3CompatibleUrl({
    bucketName: config.bucketName,
    endpointUrl,
    objectPath,
    query,
  });
  const requestDate = new Date();
  const amzDate = toAmzDate(requestDate);
  const dateStamp = toDateStamp(amzDate);
  const payloadBytes =
    typeof body === "string"
      ? Buffer.from(body, "utf8")
      : body
        ? Buffer.from(body)
        : null;
  const payloadHash = payloadBytes ? sha256Hex(payloadBytes) : EMPTY_PAYLOAD_SHA256;
  const region = normalizeS3CompatibleRegion(config);
  const headerMap: Record<string, string> = {
    host: requestUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  Object.entries(headers ?? {}).forEach(([key, value]) => {
    headerMap[key.toLowerCase()] = value;
  });

  const { canonicalHeaders, signedHeaders } = buildCanonicalHeaders(headerMap);
  const canonicalRequest = [
    method,
    getCanonicalUri({
      bucketName: config.bucketName,
      endpointUrl,
      objectPath,
    }),
    buildCanonicalQueryString(query ?? []),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${S3_SERVICE_NAME}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = crypto
    .createHmac("sha256", getSignatureKey({
      dateStamp,
      region,
      secretAccessKey: config.secretAccessKey,
    }))
    .update(stringToSign)
    .digest("hex");
  const requestHeaders = new Headers(headers ?? {});

  requestHeaders.set(
    "Authorization",
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );
  requestHeaders.set("x-amz-content-sha256", payloadHash);
  requestHeaders.set("x-amz-date", amzDate);

  const response = await fetch(requestUrl, {
    body: payloadBytes ?? undefined,
    headers: requestHeaders,
    method,
  });

  return response;
};

const buildPresignedS3CompatibleUrl = ({
  config,
  method,
  objectPath,
  ttlSeconds,
}: {
  config: S3CompatibleMediaStorageConfig;
  method: "GET" | "PUT";
  objectPath: string;
  ttlSeconds: number;
}) => {
  const endpointUrl = getS3CompatibleEndpointUrl(config);
  const requestDate = new Date();
  const amzDate = toAmzDate(requestDate);
  const dateStamp = toDateStamp(amzDate);
  const region = normalizeS3CompatibleRegion(config);
  const credentialScope = `${dateStamp}/${region}/${S3_SERVICE_NAME}/aws4_request`;
  const query: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(ttlSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const requestUrl = buildS3CompatibleUrl({
    bucketName: config.bucketName,
    endpointUrl,
    objectPath,
    query,
  });
  const canonicalRequest = [
    method,
    getCanonicalUri({
      bucketName: config.bucketName,
      endpointUrl,
      objectPath,
    }),
    buildCanonicalQueryString(query),
    `host:${requestUrl.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = crypto
    .createHmac("sha256", getSignatureKey({
      dateStamp,
      region,
      secretAccessKey: config.secretAccessKey,
    }))
    .update(stringToSign)
    .digest("hex");

  requestUrl.searchParams.set("X-Amz-Signature", signature);
  return requestUrl.toString();
};

const buildPresignedS3CompatibleGetUrl = ({
  config,
  objectPath,
  ttlSeconds,
}: {
  config: S3CompatibleMediaStorageConfig;
  objectPath: string;
  ttlSeconds: number;
}) =>
  buildPresignedS3CompatibleUrl({
    config,
    method: "GET",
    objectPath,
    ttlSeconds,
  });

export const createPresignedS3CompatibleUploadUrl = ({
  config,
  objectPath,
  ttlSeconds,
}: {
  config: S3CompatibleMediaStorageConfig;
  objectPath: string;
  ttlSeconds: number;
}) =>
  buildPresignedS3CompatibleUrl({
    config,
    method: "PUT",
    objectPath,
    ttlSeconds,
  });

const buildPublicUrlForObjectPath = ({
  objectPath,
  publicUrlBase,
}: {
  objectPath: string;
  publicUrlBase: string | null;
}) => {
  const normalizedPublicUrlBase = normalizeOptionalUrl(publicUrlBase);

  if (!normalizedPublicUrlBase) {
    return null;
  }

  const url = new URL(normalizedPublicUrlBase);
  const basePathSegments = url.pathname.split("/").filter(Boolean);
  const objectSegments = objectPath.trim().split("/").filter(Boolean);

  url.pathname = `/${[...basePathSegments, ...objectSegments].map(encodeRfc3986).join("/")}`;
  return url.toString();
};

export const parseS3CompatibleListObjectsV2Response = (xml: string): {
  nextContinuationToken: string | null;
  records: ContentStorageObjectRecord[];
} => {
  const records = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([_, block], index) => {
    const objectPath = extractXmlValue(block, "Key");
    const updatedAt = extractXmlValue(block, "LastModified");
    const size = extractXmlValue(block, "Size");

    return {
      createdAt: updatedAt ?? new Date(0).toISOString(),
      id:
        decodeXmlEntities(extractXmlValue(block, "ETag") ?? "").replace(/^"+|"+$/g, "") ||
        `${decodeXmlEntities(objectPath ?? "")}:${index}`,
      metadata:
        size && Number.isFinite(Number.parseInt(size, 10))
          ? { size: Number.parseInt(size, 10) }
          : null,
      objectPath: decodeURIComponent(decodeXmlEntities(objectPath ?? "")),
      updatedAt,
    } satisfies ContentStorageObjectRecord;
  });

  return {
    nextContinuationToken: extractXmlValue(xml, "NextContinuationToken"),
    records,
  };
};

export const parseS3CompatibleCommonPrefixes = (xml: string): string[] =>
  [...xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)]
    .map(([_, block]) => decodeURIComponent(decodeXmlEntities(extractXmlValue(block, "Prefix") ?? "")))
    .map((prefix) => normalizeContentMediaPath(prefix))
    .filter(Boolean);

export const listS3CompatibleMediaObjects = async (
  config: S3CompatibleMediaStorageConfig,
  options: {
    currentPath?: string | null;
    cursor?: string | null;
    limit?: number;
    search?: string | null;
  } = {},
): Promise<ContentStorageObjectRecord[]> => {
  const records: ContentStorageObjectRecord[] = [];
  let continuationToken: string | null = null;
  const normalizedPath = normalizeContentMediaPath(options.currentPath);
  const normalizedCursor = options.cursor?.trim() ?? "";
  const normalizedSearch = options.search?.trim().toLowerCase() ?? "";
  const normalizedLimit =
    Number.isFinite(options.limit) && options.limit
      ? Math.max(1, Math.min(250, Math.floor(options.limit)))
      : 250;

  do {
    const response = await signedFetchS3Compatible({
      config,
      method: "GET",
      query: [
        ["encoding-type", "url"],
        ["list-type", "2"],
        ["max-keys", String(normalizedLimit)],
        ...(normalizedPath ? [["prefix", `${normalizedPath}/`] as [string, string]] : []),
        ...(normalizedCursor ? [["start-after", normalizedCursor] as [string, string]] : []),
        ...(continuationToken ? [["continuation-token", continuationToken] as [string, string]] : []),
      ],
    });

    if (!response.ok) {
      throw new Error(await getS3CompatibleErrorMessage(response, "Could not load media storage."));
    }

    const parsedResponse = parseS3CompatibleListObjectsV2Response(await response.text());
    records.push(
      ...parsedResponse.records.filter((record) =>
        normalizedSearch ? record.objectPath.toLowerCase().includes(normalizedSearch) : true,
      ),
    );
    continuationToken = parsedResponse.nextContinuationToken;
  } while (continuationToken && records.length < normalizedLimit);

  return records.slice(0, normalizedLimit);
};

export const listS3CompatibleMediaFolderPaths = async (
  config: S3CompatibleMediaStorageConfig,
  options: {
    currentPath?: string | null;
    limit?: number;
  } = {},
): Promise<string[]> => {
  const normalizedPath = normalizeContentMediaPath(options.currentPath);
  const normalizedLimit =
    Number.isFinite(options.limit) && options.limit
      ? Math.max(1, Math.min(200, Math.floor(options.limit)))
      : 200;
  const response = await signedFetchS3Compatible({
    config,
    method: "GET",
    query: [
      ["delimiter", "/"],
      ["encoding-type", "url"],
      ["list-type", "2"],
      ["max-keys", String(normalizedLimit)],
      ...(normalizedPath ? [["prefix", `${normalizedPath}/`] as [string, string]] : []),
    ],
  });

  if (!response.ok) {
    throw new Error(await getS3CompatibleErrorMessage(response, "Could not load media folders."));
  }

  return parseS3CompatibleCommonPrefixes(await response.text()).slice(0, normalizedLimit);
};

export const getS3CompatibleMediaUrls = async ({
  config,
  objectPaths,
  ttlSeconds,
}: {
  config: S3CompatibleMediaStorageConfig;
  objectPaths: string[];
  ttlSeconds: number;
}) => {
  const urlByPath = new Map<string, string>();

  objectPaths.forEach((objectPath) => {
    const publicUrl = buildPublicUrlForObjectPath({
      objectPath,
      publicUrlBase: config.publicUrlBase,
    });

    urlByPath.set(
      objectPath,
      publicUrl ??
        buildPresignedS3CompatibleGetUrl({
          config,
          objectPath,
          ttlSeconds,
        }),
    );
  });

  return urlByPath;
};

export const uploadS3CompatibleMediaObject = async ({
  body,
  config,
  contentType,
  objectPath,
}: {
  body: Uint8Array;
  config: S3CompatibleMediaStorageConfig;
  contentType: string;
  objectPath: string;
}) => {
  const response = await signedFetchS3Compatible({
    body,
    config,
    headers: {
      "content-type": contentType,
    },
    method: "PUT",
    objectPath,
  });

  if (!response.ok) {
    throw new Error(await getS3CompatibleErrorMessage(response, "Could not upload that file right now."));
  }
};

export const moveS3CompatibleMediaObject = async ({
  config,
  destinationObjectPath,
  sourceObjectPath,
}: {
  config: S3CompatibleMediaStorageConfig;
  destinationObjectPath: string;
  sourceObjectPath: string;
}) => {
  const encodedCopySource = `/${[config.bucketName.trim(), ...sourceObjectPath.split("/").filter(Boolean)]
    .map(encodeRfc3986)
    .join("/")}`;
  const copyResponse = await signedFetchS3Compatible({
    config,
    headers: {
      "x-amz-copy-source": encodedCopySource,
      "x-amz-metadata-directive": "COPY",
    },
    method: "PUT",
    objectPath: destinationObjectPath,
  });

  if (!copyResponse.ok) {
    throw new Error(await getS3CompatibleErrorMessage(copyResponse, "Could not move that file right now."));
  }

  const deleteResponse = await signedFetchS3Compatible({
    config,
    method: "DELETE",
    objectPath: sourceObjectPath,
  });

  if (!deleteResponse.ok) {
    throw new Error(await getS3CompatibleErrorMessage(deleteResponse, "Could not remove the old file right now."));
  }
};

export const deleteS3CompatibleMediaObjects = async ({
  config,
  objectPaths,
}: {
  config: S3CompatibleMediaStorageConfig;
  objectPaths: string[];
}) => {
  for (const objectPath of objectPaths) {
    const response = await signedFetchS3Compatible({
      config,
      method: "DELETE",
      objectPath,
    });

    if (!response.ok) {
      throw new Error(await getS3CompatibleErrorMessage(response, "Could not delete that file right now."));
    }
  }
};

export const getS3CompatibleSignedUrlExpiresAt = (ttlSeconds: number) =>
  new Date(Date.now() + ttlSeconds * 1000).toISOString();

export const isS3CompatibleMediaStorageConfigUsable = (input: {
  bucketName: string | null | undefined;
  endpoint: string | null | undefined;
  region?: string | null | undefined;
}) =>
  Boolean(input.bucketName?.trim() && (input.endpoint?.trim() || input.region?.trim()));

export const getS3CompatiblePublicUrlForObjectPath = ({
  config,
  objectPath,
}: {
  config: S3CompatibleMediaStorageConfig;
  objectPath: string;
}) =>
  buildPublicUrlForObjectPath({
    objectPath,
    publicUrlBase: config.publicUrlBase,
  });
