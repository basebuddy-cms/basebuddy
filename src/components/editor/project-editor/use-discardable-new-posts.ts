"use client";

import { useCallback, useRef } from "react";

import { projectEditorLocalCacheKeys } from "@/components/editor/project-editor/queries";

export const useDiscardableNewPosts = (projectId: string) => {
  const discardableNewPostIdsRef = useRef(new Set<string>());

  const getDiscardableNewPostsCacheKey = useCallback(
    () => projectEditorLocalCacheKeys.discardableNewPosts(projectId),
    [projectId],
  );

  const readDiscardableNewPostIds = useCallback(() => {
    try {
      const rawValue = window.sessionStorage.getItem(getDiscardableNewPostsCacheKey());
      const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];
      const nextIds = Array.isArray(parsedValue)
        ? parsedValue.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];

      discardableNewPostIdsRef.current = new Set(nextIds);
    } catch {
      discardableNewPostIdsRef.current = new Set();
    }

    return discardableNewPostIdsRef.current;
  }, [getDiscardableNewPostsCacheKey]);

  const writeDiscardableNewPostIds = useCallback(
    (postIds: Set<string>) => {
      try {
        if (!postIds.size) {
          window.sessionStorage.removeItem(getDiscardableNewPostsCacheKey());
          return;
        }

        window.sessionStorage.setItem(getDiscardableNewPostsCacheKey(), JSON.stringify(Array.from(postIds)));
      } catch {
        return;
      }
    },
    [getDiscardableNewPostsCacheKey],
  );

  const rememberDiscardableNewPostId = useCallback(
    (postId: string) => {
      const nextPostIds = readDiscardableNewPostIds();
      nextPostIds.add(postId);
      writeDiscardableNewPostIds(nextPostIds);
    },
    [readDiscardableNewPostIds, writeDiscardableNewPostIds],
  );

  const forgetDiscardableNewPostId = useCallback(
    (postId: string) => {
      const nextPostIds = readDiscardableNewPostIds();
      nextPostIds.delete(postId);
      writeDiscardableNewPostIds(nextPostIds);
    },
    [readDiscardableNewPostIds, writeDiscardableNewPostIds],
  );

  const hasDiscardableNewPostId = useCallback(
    (postId: string) => readDiscardableNewPostIds().has(postId),
    [readDiscardableNewPostIds],
  );

  return {
    forgetDiscardableNewPostId,
    hasDiscardableNewPostId,
    readDiscardableNewPostIds,
    rememberDiscardableNewPostId,
  };
};
