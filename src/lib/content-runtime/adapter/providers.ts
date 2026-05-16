import { postgresContentRuntimeAdapterProvider } from "./postgres/providers";

export const contentRuntimeAdapterProviders = [
  postgresContentRuntimeAdapterProvider,
] as const;

export type ContentRuntimeAdapterProvider =
  (typeof contentRuntimeAdapterProviders)[number];

export type ContentRuntimeAdapterProviderId =
  ContentRuntimeAdapterProvider["id"];

export const defaultContentRuntimeAdapterProvider =
  postgresContentRuntimeAdapterProvider;

export const getContentRuntimeAdapterProvider = (
  providerId: string,
): ContentRuntimeAdapterProvider | null =>
  contentRuntimeAdapterProviders.find((provider) => provider.id === providerId) ?? null;
