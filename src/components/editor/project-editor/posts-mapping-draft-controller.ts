import type { Dispatch, SetStateAction } from "react";

import { POSTS_MAPPING_NONE_VALUE, POSTS_MAPPING_NOT_IN_TABLE_VALUE } from "@/components/editor/project-editor/constants";
import type {
  PostsMappingBooleanStatusMode,
  PostsMappingDraftState,
  PostsMappingFieldOptionDraft,
  PostsMappingFieldOptionKey,
  PostsMappingRelationDraft,
  PostsRelationEntityKey,
  PostsRelationFieldKey,
} from "@/components/editor/project-editor/types";
import type {
  ContentIntrospectedColumn,
  ContentIntrospectedTable,
} from "@/lib/content-runtime/introspection";

type StatusValueLists = {
  archivedValues: string[];
  draftValues: string[];
  publishedValues: string[];
};

type ProjectEditorPostsMappingDraftControllerArgs = {
  applyRelationFieldMapDefaults: (
    key: PostsRelationFieldKey,
    targetTableRef: string,
    fieldMap?: Record<string, string>,
  ) => Record<string, string>;
  classifyPostsStatusValues: (
    table: ContentIntrospectedTable | null,
    columnName: string,
  ) => StatusValueLists;
  createEmptyPostsFieldOptionDraft: () => PostsMappingFieldOptionDraft;
  createPostsMappingDraftFromTable: (tableRef: string) => PostsMappingDraftState | null;
  detectContentKindForColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => PostsMappingDraftState["contentKind"];
  findJoinTableBetween: (
    sourceTable: ContentIntrospectedTable,
    targetTableRef: string,
  ) => ContentIntrospectedTable | null;
  getBooleanStatusValueLists: (mode: PostsMappingBooleanStatusMode) => StatusValueLists;
  getColumnForeignKey: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["foreignKeys"][number] | null;
  getColumnSelectValue: (value: string | null | undefined) => string;
  getCustomFieldsForTable: (
    table: ContentIntrospectedTable | null,
    draft: PostsMappingDraftState,
  ) => PostsMappingDraftState["customFields"];
  getJoinRelationSelectionDefaults: (
    key: PostsRelationFieldKey,
    sourceTable: ContentIntrospectedTable,
    joinTableRef: string,
    currentTargetTableRef?: string,
  ) => {
    joinSourceColumn: string;
    joinTargetColumn: string;
    targetColumn: string;
    targetTableRef: string;
  };
  getLikelyTargetColumn: (targetTableRef: string, sourceColumnName?: string | null) => string;
  getPrimarySelectedColumn: (values: string[]) => string;
  getRelatedColumnsDraft: (targetColumn: string | null | undefined) => string[];
  getStoredTableRef: (tableNameOrRef: string | null | undefined) => string;
  getTableByRef: (tableRef: string) => ContentIntrospectedTable | null;
  getTableColumn: (
    table: ContentIntrospectedTable | null,
    columnName: string | null | undefined,
  ) => ContentIntrospectedTable["columns"][number] | null;
  getTopEntityTableRef: (entity: PostsRelationEntityKey) => string;
  isBooleanLikeColumn: (column: ContentIntrospectedColumn) => boolean;
  isLikelyIdentifierArrayColumn: (column: ContentIntrospectedColumn | null) => boolean;
  parsePostsMappingValues: (value: string) => string[];
  postsMappingDraft: PostsMappingDraftState | null;
  postsTable: ContentIntrospectedTable | null;
  relationEntityByKey: Record<PostsRelationFieldKey, PostsRelationEntityKey>;
  setPostsMappingDraft: Dispatch<SetStateAction<PostsMappingDraftState | null>>;
};

export function createProjectEditorPostsMappingDraftController({
  applyRelationFieldMapDefaults,
  classifyPostsStatusValues,
  createEmptyPostsFieldOptionDraft,
  createPostsMappingDraftFromTable,
  detectContentKindForColumn,
  findJoinTableBetween,
  getBooleanStatusValueLists,
  getColumnForeignKey,
  getColumnSelectValue,
  getCustomFieldsForTable,
  getJoinRelationSelectionDefaults,
  getLikelyTargetColumn,
  getPrimarySelectedColumn,
  getRelatedColumnsDraft,
  getStoredTableRef,
  getTableByRef,
  getTableColumn,
  getTopEntityTableRef,
  isBooleanLikeColumn,
  isLikelyIdentifierArrayColumn,
  parsePostsMappingValues,
  postsMappingDraft,
  postsTable,
  relationEntityByKey,
  setPostsMappingDraft,
}: ProjectEditorPostsMappingDraftControllerArgs) {
  const getFieldOptionDraftForColumn = (
    value: string,
    currentOptions?: PostsMappingFieldOptionDraft,
  ): PostsMappingFieldOptionDraft => {
    const baseDraft = currentOptions
      ? {
          ...currentOptions,
          relatedColumns:
            currentOptions.relatedColumns.length > 0
              ? [...currentOptions.relatedColumns]
              : [POSTS_MAPPING_NONE_VALUE],
        }
      : createEmptyPostsFieldOptionDraft();

    if (!postsTable || value === POSTS_MAPPING_NONE_VALUE || value === POSTS_MAPPING_NOT_IN_TABLE_VALUE) {
      return createEmptyPostsFieldOptionDraft();
    }

    const foreignKey = getColumnForeignKey(postsTable, value);

    if (foreignKey) {
      return {
        ...baseDraft,
        relatedColumns: getRelatedColumnsDraft(foreignKey.targetColumn),
        relatedTableRef: `${foreignKey.targetSchema}.${foreignKey.targetTable}`,
      };
    }

    return {
      ...baseDraft,
      relatedColumns: [POSTS_MAPPING_NONE_VALUE],
      relatedTableRef: POSTS_MAPPING_NONE_VALUE,
    };
  };

  const getPrimaryContentColumn = (values: string[]) =>
    values.find((value) => value !== POSTS_MAPPING_NONE_VALUE && value !== POSTS_MAPPING_NOT_IN_TABLE_VALUE) ??
    POSTS_MAPPING_NONE_VALUE;

  const getPrimaryContentFieldOption = (options: PostsMappingFieldOptionDraft[]) =>
    options[0] ?? createEmptyPostsFieldOptionDraft();

  const getDetectedContentKind = (
    currentKind: PostsMappingDraftState["contentKind"],
    primaryContentColumn: string,
  ) =>
    primaryContentColumn !== POSTS_MAPPING_NONE_VALUE && primaryContentColumn !== POSTS_MAPPING_NOT_IN_TABLE_VALUE
      ? detectContentKindForColumn(postsTable, primaryContentColumn)
      : currentKind;

  const getDetectedContentKinds = (columns: string[], currentKinds: PostsMappingDraftState["contentColumnKinds"]) =>
    columns.map((column, index) =>
      column !== POSTS_MAPPING_NONE_VALUE && column !== POSTS_MAPPING_NOT_IN_TABLE_VALUE
        ? detectContentKindForColumn(postsTable, column)
        : currentKinds[index] ?? currentKinds[0] ?? "html",
    );

  const updatePostsDraftField = <K extends keyof PostsMappingDraftState>(
    key: K,
    value: PostsMappingDraftState[K],
  ) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            [key]: value,
          }
        : currentDraft,
    );
  };

  const updatePostsMediaStorageDraft = (nextMediaStorage: Partial<PostsMappingDraftState["mediaStorage"]>) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            mediaStorage: {
              ...currentDraft.mediaStorage,
              ...nextMediaStorage,
            },
          }
        : currentDraft,
    );
  };

  const updatePostsFilesStorageDraft = (nextFilesStorage: Partial<PostsMappingDraftState["filesStorage"]>) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            filesStorage: {
              ...currentDraft.filesStorage,
              ...nextFilesStorage,
            },
          }
        : currentDraft,
    );
  };

  const togglePostsCustomField = (column: string, enabled: boolean) => {
    setPostsMappingDraft((current) => {
      if (!current) {
        return current;
      }

      const nextCustomFields = getCustomFieldsForTable(postsTable, current).map((field) =>
        field.column === column ? { ...field, enabled } : field,
      );

      return { ...current, customFields: nextCustomFields };
    });
  };

  const updatePostsCustomField = (
    column: string,
    nextField: Partial<PostsMappingDraftState["customFields"][number]>,
  ) => {
    setPostsMappingDraft((current) => {
      if (!current) {
        return current;
      }

      const nextCustomFields = getCustomFieldsForTable(postsTable, current).map((field) =>
        field.column === column
          ? {
              ...field,
              ...nextField,
            }
          : field,
      );

      return {
        ...current,
        customFields: nextCustomFields,
      };
    });
  };

  const updatePostsValueList = (
    key: "archivedValues" | "draftValues" | "publishedValues",
    value: string,
  ) => {
    updatePostsDraftField(key, parsePostsMappingValues(value));
  };

  const updatePostsFieldOptions = (
    key: PostsMappingFieldOptionKey,
    nextOptions: Partial<PostsMappingFieldOptionDraft>,
  ) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            fieldOptions: {
              ...currentDraft.fieldOptions,
              [key]: {
                ...currentDraft.fieldOptions[key],
                ...nextOptions,
              },
            },
          }
        : currentDraft,
    );
  };

  const updatePostsContentFieldOptions = (
    index: number,
    nextOptions: Partial<PostsMappingFieldOptionDraft>,
  ) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextContentFieldOptions = [...currentDraft.contentFieldOptions];
      nextContentFieldOptions[index] = {
        ...(nextContentFieldOptions[index] ?? createEmptyPostsFieldOptionDraft()),
        ...nextOptions,
      };

      return {
        ...currentDraft,
        contentFieldOptions: nextContentFieldOptions,
        fieldOptions: {
          ...currentDraft.fieldOptions,
          contentColumn: getPrimaryContentFieldOption(nextContentFieldOptions),
        },
      };
    });
  };

  const updatePostsFieldRelatedColumns = (
    key: PostsMappingFieldOptionKey,
    index: number,
    value: string,
  ) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextRelatedColumns = [...currentDraft.fieldOptions[key].relatedColumns];
      nextRelatedColumns[index] = value;

      return {
        ...currentDraft,
        fieldOptions: {
          ...currentDraft.fieldOptions,
          [key]: {
            ...currentDraft.fieldOptions[key],
            relatedColumns: nextRelatedColumns,
          },
        },
      };
    });
  };

  const addPostsFieldRelatedColumn = (key: PostsMappingFieldOptionKey) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        fieldOptions: {
          ...currentDraft.fieldOptions,
          [key]: {
            ...currentDraft.fieldOptions[key],
            relatedColumns: [...currentDraft.fieldOptions[key].relatedColumns, POSTS_MAPPING_NONE_VALUE],
          },
        },
      };
    });
  };

  const removePostsFieldRelatedColumn = (key: PostsMappingFieldOptionKey, index: number) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextRelatedColumns = currentDraft.fieldOptions[key].relatedColumns.filter(
        (_, itemIndex) => itemIndex !== index,
      );

      return {
        ...currentDraft,
        fieldOptions: {
          ...currentDraft.fieldOptions,
          [key]: {
            ...currentDraft.fieldOptions[key],
            relatedColumns: nextRelatedColumns.length ? nextRelatedColumns : [POSTS_MAPPING_NONE_VALUE],
          },
        },
      };
    });
  };

  const updatePostsRelationDraft = (
    key: PostsRelationFieldKey,
    nextRelation: Partial<PostsMappingRelationDraft>,
  ) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            [key]: {
              ...currentDraft[key],
              ...nextRelation,
            },
          }
        : currentDraft,
    );
  };

  const updatePostsRelationDisplayColumns = (
    key: PostsRelationFieldKey,
    index: number,
    value: string,
  ) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextDisplayColumns = [...currentDraft[key].displayColumns];
      nextDisplayColumns[index] = value;

      return {
        ...currentDraft,
        [key]: {
          ...currentDraft[key],
          displayColumns: nextDisplayColumns,
          targetColumn: getPrimarySelectedColumn(nextDisplayColumns),
        },
      };
    });
  };

  const addPostsRelationDisplayColumn = (key: PostsRelationFieldKey) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            [key]: {
              ...currentDraft[key],
              displayColumns: [...currentDraft[key].displayColumns, POSTS_MAPPING_NONE_VALUE],
            },
          }
        : currentDraft,
    );
  };

  const removePostsRelationDisplayColumn = (
    key: PostsRelationFieldKey,
    index: number,
  ) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextDisplayColumns = currentDraft[key].displayColumns.filter((_, itemIndex) => itemIndex !== index);

      return {
        ...currentDraft,
        [key]: {
          ...currentDraft[key],
          displayColumns: nextDisplayColumns.length ? nextDisplayColumns : [POSTS_MAPPING_NONE_VALUE],
          targetColumn: getPrimarySelectedColumn(nextDisplayColumns),
        },
      };
    });
  };

  const updatePostsRelationFieldMap = (
    key: PostsRelationFieldKey,
    fieldKey: string,
    value: string,
  ) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextFieldMap = { ...currentDraft[key].fieldMap };

      if (value === POSTS_MAPPING_NONE_VALUE) {
        delete nextFieldMap[fieldKey];
      } else {
        nextFieldMap[fieldKey] = value;
      }

      return {
        ...currentDraft,
        [key]: {
          ...currentDraft[key],
          fieldMap: nextFieldMap,
        },
      };
    });
  };

  const getRelationTargetTableRef = (
    key: PostsRelationFieldKey,
    relation: PostsMappingRelationDraft,
  ) => {
    const explicitTargetTableRef = getStoredTableRef(relation.targetTableRef);

    if (explicitTargetTableRef !== POSTS_MAPPING_NONE_VALUE) {
      return explicitTargetTableRef;
    }

    if (!postsTable) {
      return getTopEntityTableRef(relationEntityByKey[key]);
    }

    if (
      relation.column !== POSTS_MAPPING_NONE_VALUE &&
      relation.column !== POSTS_MAPPING_NOT_IN_TABLE_VALUE
    ) {
      const directForeignKey = getColumnForeignKey(postsTable, relation.column);

      if (directForeignKey) {
        return `${directForeignKey.targetSchema}.${directForeignKey.targetTable}`;
      }
    }

    if (relation.joinTableRef !== POSTS_MAPPING_NONE_VALUE) {
      const joinTable = getTableByRef(relation.joinTableRef);
      const joinForeignKey =
        joinTable && relation.joinTargetColumn !== POSTS_MAPPING_NONE_VALUE
          ? getColumnForeignKey(joinTable, relation.joinTargetColumn)
          : null;

      if (joinForeignKey) {
        return `${joinForeignKey.targetSchema}.${joinForeignKey.targetTable}`;
      }

      if (relation.strategy === "join_table") {
        const detectedTargetTableRef = getJoinRelationSelectionDefaults(
          key,
          postsTable,
          relation.joinTableRef,
        ).targetTableRef;

        if (detectedTargetTableRef !== POSTS_MAPPING_NONE_VALUE) {
          return detectedTargetTableRef;
        }
      }
    }

    return getTopEntityTableRef(relationEntityByKey[key]);
  };

  const getDetectedJoinTableRef = (targetTableRef: string) => {
    if (!postsTable || targetTableRef === POSTS_MAPPING_NONE_VALUE) {
      return POSTS_MAPPING_NONE_VALUE;
    }

    const joinTable = findJoinTableBetween(postsTable, targetTableRef);
    return joinTable ? `${joinTable.schema}.${joinTable.name}` : POSTS_MAPPING_NONE_VALUE;
  };

  const handlePostsTableChange = (tableRef: string) => {
    const nextDraft = createPostsMappingDraftFromTable(tableRef);

    if (nextDraft) {
      setPostsMappingDraft(nextDraft);
    }
  };

  const addPostsContentColumn = (index: number) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextContentColumns =
        currentDraft.contentColumns.length === 1 && currentDraft.contentColumns[0] === POSTS_MAPPING_NONE_VALUE
          ? [POSTS_MAPPING_NONE_VALUE, POSTS_MAPPING_NONE_VALUE]
          : [
              ...currentDraft.contentColumns.slice(0, index + 1),
              POSTS_MAPPING_NONE_VALUE,
              ...currentDraft.contentColumns.slice(index + 1),
            ];
      const nextContentColumnKinds =
        currentDraft.contentColumns.length === 1 && currentDraft.contentColumns[0] === POSTS_MAPPING_NONE_VALUE
          ? [currentDraft.contentColumnKinds[0] ?? currentDraft.contentKind, currentDraft.contentColumnKinds[0] ?? currentDraft.contentKind]
          : [
              ...currentDraft.contentColumnKinds.slice(0, index + 1),
              currentDraft.contentColumnKinds[index] ?? currentDraft.contentKind,
              ...currentDraft.contentColumnKinds.slice(index + 1),
            ];
      const nextContentFieldOptions =
        currentDraft.contentColumns.length === 1 && currentDraft.contentColumns[0] === POSTS_MAPPING_NONE_VALUE
          ? [createEmptyPostsFieldOptionDraft(), createEmptyPostsFieldOptionDraft()]
          : [
              ...currentDraft.contentFieldOptions.slice(0, index + 1),
              createEmptyPostsFieldOptionDraft(),
              ...currentDraft.contentFieldOptions.slice(index + 1),
            ];

      return {
        ...currentDraft,
        contentColumns: nextContentColumns,
        contentFieldOptions: nextContentFieldOptions,
        contentColumnKinds: nextContentColumnKinds,
        fieldOptions: {
          ...currentDraft.fieldOptions,
          contentColumn: getPrimaryContentFieldOption(nextContentFieldOptions),
        },
      };
    });
  };

  const handleFieldColumnChange = (
    key: Exclude<PostsMappingFieldOptionKey, "contentColumn">,
    value: string,
  ) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            [key]: value,
            fieldOptions: {
              ...currentDraft.fieldOptions,
              [key]: getFieldOptionDraftForColumn(value, currentDraft.fieldOptions[key]),
            },
          }
        : currentDraft,
    );
  };

  const handleContentColumnChange = (index: number, value: string) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextContentColumns = [...currentDraft.contentColumns];
      nextContentColumns[index] = value;
      const primaryContentColumn = getPrimaryContentColumn(nextContentColumns);
      const nextContentColumnKinds = [...currentDraft.contentColumnKinds];
      const nextContentFieldOptions = [...currentDraft.contentFieldOptions];
      const selectedColumn = getTableColumn(postsTable, value);
      nextContentColumnKinds[index] =
        value !== POSTS_MAPPING_NONE_VALUE && value !== POSTS_MAPPING_NOT_IN_TABLE_VALUE
          ? detectContentKindForColumn(postsTable, value)
          : nextContentColumnKinds[index] ?? currentDraft.contentKind;
      nextContentFieldOptions[index] = {
        ...(nextContentFieldOptions[index] ?? createEmptyPostsFieldOptionDraft()),
        arrayItemIndex:
          selectedColumn?.isArray
            ? nextContentFieldOptions[index]?.arrayItemIndex?.replace(/[^0-9]/g, "") || "1"
            : "1",
        jsonPath: selectedColumn?.isJson ? nextContentFieldOptions[index]?.jsonPath?.trim() ?? "" : "",
      };

      return {
        ...currentDraft,
        contentColumns: nextContentColumns,
        contentFieldOptions: nextContentFieldOptions,
        contentColumnKinds: nextContentColumnKinds,
        contentKind: nextContentColumnKinds[0] ?? getDetectedContentKind(currentDraft.contentKind, primaryContentColumn),
        fieldOptions: {
          ...currentDraft.fieldOptions,
          contentColumn: getPrimaryContentFieldOption(nextContentFieldOptions),
        },
      };
    });
  };

  const handleContentColumnKindChange = (
    index: number,
    kind: PostsMappingDraftState["contentKind"],
  ) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextContentColumnKinds = [...currentDraft.contentColumnKinds];
      nextContentColumnKinds[index] = kind;

      return {
        ...currentDraft,
        contentColumnKinds: nextContentColumnKinds,
        contentKind: nextContentColumnKinds[0] ?? currentDraft.contentKind,
      };
    });
  };

  const movePostsContentColumn = (index: number, direction: "down" | "up") => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= currentDraft.contentColumns.length) {
        return currentDraft;
      }

      const nextContentColumns = [...currentDraft.contentColumns];
      const [movedColumn] = nextContentColumns.splice(index, 1);
      nextContentColumns.splice(targetIndex, 0, movedColumn);
      const nextContentColumnKinds = [...currentDraft.contentColumnKinds];
      const [movedKind] = nextContentColumnKinds.splice(index, 1);
      nextContentColumnKinds.splice(targetIndex, 0, movedKind ?? currentDraft.contentKind);
      const nextContentFieldOptions = [...currentDraft.contentFieldOptions];
      const [movedFieldOption] = nextContentFieldOptions.splice(index, 1);
      nextContentFieldOptions.splice(targetIndex, 0, movedFieldOption ?? createEmptyPostsFieldOptionDraft());
      const primaryContentColumn = getPrimaryContentColumn(nextContentColumns);

      return {
        ...currentDraft,
        contentColumns: nextContentColumns,
        contentFieldOptions: nextContentFieldOptions,
        contentColumnKinds: nextContentColumnKinds,
        contentKind: nextContentColumnKinds[0] ?? getDetectedContentKind(currentDraft.contentKind, primaryContentColumn),
        fieldOptions: {
          ...currentDraft.fieldOptions,
          contentColumn: getPrimaryContentFieldOption(nextContentFieldOptions),
        },
      };
    });
  };

  const removePostsContentColumn = (index: number) => {
    setPostsMappingDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft;
      }

      const nextContentColumns = currentDraft.contentColumns.filter((_, currentIndex) => currentIndex !== index);
      const nextContentColumnKinds = currentDraft.contentColumnKinds.filter((_, currentIndex) => currentIndex !== index);
      const nextContentFieldOptions = currentDraft.contentFieldOptions.filter(
        (_, currentIndex) => currentIndex !== index,
      );
      const normalizedContentColumns = nextContentColumns.length > 0 ? nextContentColumns : [POSTS_MAPPING_NONE_VALUE];
      const normalizedContentColumnKinds =
        nextContentColumnKinds.length > 0
          ? nextContentColumnKinds
          : getDetectedContentKinds(normalizedContentColumns, currentDraft.contentColumnKinds);
      const normalizedContentFieldOptions =
        nextContentFieldOptions.length > 0 ? nextContentFieldOptions : [createEmptyPostsFieldOptionDraft()];
      const primaryContentColumn = getPrimaryContentColumn(normalizedContentColumns);

      return {
        ...currentDraft,
        contentColumns: normalizedContentColumns,
        contentFieldOptions: normalizedContentFieldOptions,
        contentColumnKinds: normalizedContentColumnKinds,
        contentKind: normalizedContentColumnKinds[0] ?? getDetectedContentKind(currentDraft.contentKind, primaryContentColumn),
        fieldOptions: {
          ...currentDraft.fieldOptions,
          contentColumn: getPrimaryContentFieldOption(normalizedContentFieldOptions),
        },
      };
    });
  };

  const handleStatusBooleanModeChange = (mode: PostsMappingBooleanStatusMode) => {
    const statusValues = getBooleanStatusValueLists(mode);

    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            archivedValues: statusValues.archivedValues,
            draftValues: statusValues.draftValues,
            publishedValues: statusValues.publishedValues,
            statusBooleanMode: mode,
          }
        : currentDraft,
    );
  };

  const handleStatusColumnChange = (value: string) => {
    setPostsMappingDraft((currentDraft) =>
      currentDraft
        ? (() => {
            const nextFieldOptions = getFieldOptionDraftForColumn(value, currentDraft.fieldOptions.statusColumn);
            const selectedColumn = getTableColumn(postsTable, value);
            const statusValues =
              value === POSTS_MAPPING_NONE_VALUE || value === POSTS_MAPPING_NOT_IN_TABLE_VALUE
                ? { archivedValues: [], draftValues: [], publishedValues: [] }
                : selectedColumn && isBooleanLikeColumn(selectedColumn)
                  ? getBooleanStatusValueLists(currentDraft.statusBooleanMode)
                  : classifyPostsStatusValues(postsTable, value);

            return {
              ...currentDraft,
              archivedValues: statusValues.archivedValues,
              draftValues: statusValues.draftValues,
              fieldOptions: {
                ...currentDraft.fieldOptions,
                statusColumn: nextFieldOptions,
              },
              publishedValues: statusValues.publishedValues,
              statusColumn: value,
            };
          })()
        : currentDraft,
    );
  };

  const handleRelationColumnChange = (
    key: PostsRelationFieldKey,
    value: string,
  ) => {
    const relation = postsMappingDraft?.[key];

    if (!postsTable || !relation) {
      return;
    }

    const targetTableRef = getRelationTargetTableRef(key, relation);
    const detectedJoinTableRef =
      relation.joinTableRef !== POSTS_MAPPING_NONE_VALUE
        ? relation.joinTableRef
        : getDetectedJoinTableRef(targetTableRef);

    if (value === POSTS_MAPPING_NONE_VALUE) {
      updatePostsRelationDraft(key, {
        column: POSTS_MAPPING_NONE_VALUE,
        displayColumns: [POSTS_MAPPING_NONE_VALUE],
        fieldMap: {},
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "missing",
        targetColumn: POSTS_MAPPING_NONE_VALUE,
        targetTableRef,
        valueColumn: POSTS_MAPPING_NONE_VALUE,
      });
      return;
    }

    if (value === POSTS_MAPPING_NOT_IN_TABLE_VALUE) {
      const detectedJoinSelectionDefaults =
        detectedJoinTableRef !== POSTS_MAPPING_NONE_VALUE
          ? getJoinRelationSelectionDefaults(key, postsTable, detectedJoinTableRef, targetTableRef)
          : {
              joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
              joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
              targetColumn: POSTS_MAPPING_NONE_VALUE,
              targetTableRef: POSTS_MAPPING_NONE_VALUE,
            };

      updatePostsRelationDraft(key, {
        column: POSTS_MAPPING_NOT_IN_TABLE_VALUE,
        displayColumns: getRelatedColumnsDraft(detectedJoinSelectionDefaults.targetColumn),
        fieldMap:
          detectedJoinSelectionDefaults.targetTableRef !== POSTS_MAPPING_NONE_VALUE
            ? applyRelationFieldMapDefaults(key, detectedJoinSelectionDefaults.targetTableRef)
            : {},
        joinSourceColumn: detectedJoinSelectionDefaults.joinSourceColumn,
        joinTableRef: detectedJoinTableRef,
        joinTargetColumn: detectedJoinSelectionDefaults.joinTargetColumn,
        strategy: "join_table",
        targetColumn: detectedJoinSelectionDefaults.targetColumn,
        targetTableRef: detectedJoinSelectionDefaults.targetTableRef,
        valueColumn: POSTS_MAPPING_NONE_VALUE,
      });
      return;
    }

    const selectedColumn = getTableColumn(postsTable, value);
    const foreignKey = getColumnForeignKey(postsTable, value);

    if (foreignKey) {
      const relatedTableRef = `${foreignKey.targetSchema}.${foreignKey.targetTable}`;

      updatePostsRelationDraft(key, {
        column: value,
        displayColumns: getRelatedColumnsDraft(foreignKey.targetColumn),
        fieldMap: applyRelationFieldMapDefaults(key, relatedTableRef),
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "foreign_key",
        targetColumn: getColumnSelectValue(foreignKey.targetColumn),
        targetTableRef: relatedTableRef,
        valueColumn: POSTS_MAPPING_NONE_VALUE,
      });
      return;
    }

    if (selectedColumn?.isArray) {
      const nextTargetColumn = isLikelyIdentifierArrayColumn(selectedColumn)
        ? getLikelyTargetColumn(targetTableRef, value)
        : POSTS_MAPPING_NONE_VALUE;

      updatePostsRelationDraft(key, {
        column: value,
        displayColumns: getRelatedColumnsDraft(nextTargetColumn),
        fieldMap:
          nextTargetColumn !== POSTS_MAPPING_NONE_VALUE && targetTableRef !== POSTS_MAPPING_NONE_VALUE
            ? applyRelationFieldMapDefaults(key, targetTableRef)
            : {},
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "array",
        targetColumn: nextTargetColumn,
        targetTableRef: nextTargetColumn === POSTS_MAPPING_NONE_VALUE ? POSTS_MAPPING_NONE_VALUE : targetTableRef,
        valueColumn: value,
      });
      return;
    }

    if (selectedColumn?.isJson) {
      const nextTargetColumn = getLikelyTargetColumn(targetTableRef, value);

      updatePostsRelationDraft(key, {
        column: value,
        displayColumns: getRelatedColumnsDraft(nextTargetColumn),
        fieldMap:
          targetTableRef !== POSTS_MAPPING_NONE_VALUE
            ? applyRelationFieldMapDefaults(key, targetTableRef)
            : {},
        joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
        joinTableRef: POSTS_MAPPING_NONE_VALUE,
        joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
        strategy: "json_array",
        targetColumn: nextTargetColumn,
        targetTableRef,
        valueColumn: value,
      });
      return;
    }

    updatePostsRelationDraft(key, {
      column: value,
      displayColumns: [POSTS_MAPPING_NONE_VALUE],
      fieldMap:
        targetTableRef !== POSTS_MAPPING_NONE_VALUE
          ? applyRelationFieldMapDefaults(key, targetTableRef)
          : {},
      joinSourceColumn: POSTS_MAPPING_NONE_VALUE,
      joinTableRef: POSTS_MAPPING_NONE_VALUE,
      joinTargetColumn: POSTS_MAPPING_NONE_VALUE,
      strategy: "derived_distinct",
      targetColumn: getLikelyTargetColumn(targetTableRef, value),
      targetTableRef,
      valueColumn: value,
    });
  };

  return {
    addPostsContentColumn,
    addPostsFieldRelatedColumn,
    addPostsRelationDisplayColumn,
    getRelationTargetTableRef,
    handleContentColumnChange,
    handleContentColumnKindChange,
    handleFieldColumnChange,
    handlePostsTableChange,
    handleRelationColumnChange,
    handleStatusBooleanModeChange,
    handleStatusColumnChange,
    movePostsContentColumn,
    removePostsContentColumn,
    removePostsFieldRelatedColumn,
    removePostsRelationDisplayColumn,
    togglePostsCustomField,
    updatePostsCustomField,
    updatePostsContentFieldOptions,
    updatePostsDraftField,
    updatePostsFieldOptions,
    updatePostsFieldRelatedColumns,
    updatePostsFilesStorageDraft,
    updatePostsMediaStorageDraft,
    updatePostsRelationDisplayColumns,
    updatePostsRelationDraft,
    updatePostsRelationFieldMap,
    updatePostsValueList,
  };
}
