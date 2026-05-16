import type {
  ContentEntityMapping,
  ContentMappingConfig,
  ContentMappingEntityKey,
} from "./mapping";
import { buildContentIntrospectionCandidates } from "./introspection-support";

export type ContentIntrospectedColumn = {
  dataType: string;
  defaultValue: string | null;
  enumValues: string[] | null;
  isArray: boolean;
  isGenerated?: boolean;
  isJson: boolean;
  isNullable: boolean;
  name: string;
  udtName: string | null;
};

export type ContentIntrospectedForeignKey = {
  column: string;
  targetColumn: string;
  targetSchema: string;
  targetTable: string;
};

export type ContentIntrospectedTable = {
  columns: ContentIntrospectedColumn[];
  kind: "table" | "view";
  name: string;
  primaryKey: string | null;
  rowCountEstimate: number | null;
  sampleRows: Array<Record<string, unknown>>;
  schema: string;
  foreignKeys: ContentIntrospectedForeignKey[];
  triggerDefinitions?: string[];
};

export type ContentSchemaIntrospection = {
  tables: ContentIntrospectedTable[];
};

export type ContentAutoMappingCandidatePreview = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  values: Record<string, string[]>;
};

export type ContentAutoMappingCandidate = {
  confidence: number;
  entity: ContentMappingEntityKey;
  label: string;
  mapping: ContentEntityMapping;
  reasons: string[];
  samplePreview: ContentAutoMappingCandidatePreview;
};

export type ContentAutoMappingResult = {
  candidates: Record<ContentMappingEntityKey, ContentAutoMappingCandidate[]>;
  generatedAt: string;
  suggestedMappingConfig: ContentMappingConfig;
  tables: ContentIntrospectedTable[];
};

export const buildContentAutoMappingResult = (
  schema: ContentSchemaIntrospection,
): ContentAutoMappingResult => {
  const { candidates, suggestedMappingConfig } = buildContentIntrospectionCandidates(schema);

  return {
    candidates,
    generatedAt: new Date().toISOString(),
    suggestedMappingConfig,
    tables: schema.tables,
  };
};
