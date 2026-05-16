"use client";

import { useEffect, useRef, useState } from "react";

export const MIN_AUTOSAVE_STATUS_VISIBLE_MS = 1200;

export const useProjectEditorAutosaveStatus = (isPersistingLocalAutosave: boolean) => {
  const [showTopBarAutosaveStatus, setShowTopBarAutosaveStatus] = useState(false);
  const topBarAutosaveShownAtRef = useRef<number | null>(null);
  const topBarAutosaveHideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPersistingLocalAutosave) {
      if (topBarAutosaveHideTimeoutRef.current !== null) {
        window.clearTimeout(topBarAutosaveHideTimeoutRef.current);
        topBarAutosaveHideTimeoutRef.current = null;
      }

      if (topBarAutosaveShownAtRef.current === null) {
        topBarAutosaveShownAtRef.current = Date.now();
      }

      setShowTopBarAutosaveStatus(true);
      return;
    }

    if (!showTopBarAutosaveStatus) {
      topBarAutosaveShownAtRef.current = null;
      return;
    }

    const visibleForMs =
      topBarAutosaveShownAtRef.current === null ? 0 : Date.now() - topBarAutosaveShownAtRef.current;
    const remainingMs = Math.max(MIN_AUTOSAVE_STATUS_VISIBLE_MS - visibleForMs, 0);

    topBarAutosaveHideTimeoutRef.current = window.setTimeout(() => {
      setShowTopBarAutosaveStatus(false);
      topBarAutosaveShownAtRef.current = null;
      topBarAutosaveHideTimeoutRef.current = null;
    }, remainingMs);

    return () => {
      if (topBarAutosaveHideTimeoutRef.current !== null) {
        window.clearTimeout(topBarAutosaveHideTimeoutRef.current);
        topBarAutosaveHideTimeoutRef.current = null;
      }
    };
  }, [isPersistingLocalAutosave, showTopBarAutosaveStatus]);

  return showTopBarAutosaveStatus;
};
