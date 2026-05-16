import {
  areContentColumnsTypeCompatible,
  buildContentArrayPredicate,
  getContentTypedArrayCastSuffix,
  normalizeContentComparableType,
  type ContentColumnTypeMetadata,
} from "./adapter/native-types";

export type MappedContentColumnTypeMetadata = ContentColumnTypeMetadata;

export const normalizeMappedContentComparableType = normalizeContentComparableType;

export const getMappedContentTypedArrayCastSuffix = getContentTypedArrayCastSuffix;

export const buildMappedContentArrayPredicate = buildContentArrayPredicate;

export const areMappedContentColumnsTypeCompatible = areContentColumnsTypeCompatible;
