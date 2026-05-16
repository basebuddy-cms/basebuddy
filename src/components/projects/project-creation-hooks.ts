"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { SlugState } from "@/components/projects/project-creation-shared";
import { normalizeProjectSlug } from "@/lib/control-plane/utils";
import { getProductionErrorMessage } from "@/lib/errors/user-facing";

type UseProjectCreationSlugStateArgs = {
  projectName: string;
  projectSlug: string;
  setProjectSlug: Dispatch<SetStateAction<string>>;
  slugTouched: boolean;
};

export const useProjectCreationSlugState = ({
  projectName,
  projectSlug,
  setProjectSlug,
  slugTouched,
}: UseProjectCreationSlugStateArgs) => {
  const [slugState, setSlugState] = useState<SlugState>({
    detail: "Your project address will use this text.",
    normalizedSlug: "",
    status: "idle",
  });

  useEffect(() => {
    if (slugTouched) {
      return;
    }

    setProjectSlug(normalizeProjectSlug(projectName));
  }, [projectName, setProjectSlug, slugTouched]);

  useEffect(() => {
    const normalizedSlug = normalizeProjectSlug(projectSlug);

    if (!normalizedSlug) {
      setSlugState({
        detail: "Your project address will use this text.",
        normalizedSlug: "",
        status: "idle",
      });
      return;
    }

    setProjectSlug((currentSlug) => (currentSlug === normalizedSlug ? currentSlug : normalizedSlug));
    setSlugState((current) => ({
      detail: current.status === "available" ? current.detail : "Checking whether this address is available.",
      normalizedSlug,
      status: "checking",
    }));

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/projects/slug-availability?slug=${encodeURIComponent(normalizedSlug)}`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          available?: boolean;
          error?: string;
          normalizedSlug?: string;
          reason?: string;
        };

        if (!response.ok && response.status !== 400) {
          throw new Error(payload.error ?? "Could not check project address availability right now.");
        }

        if (!response.ok) {
          setSlugState({
            detail: payload.reason ?? "Enter a valid project address.",
            normalizedSlug,
            status: "invalid",
          });
          return;
        }

        setSlugState({
          detail: payload.available ? "This project address is available." : "This project address is already taken.",
          normalizedSlug: payload.normalizedSlug ?? normalizedSlug,
          status: payload.available ? "available" : "taken",
        });
      } catch (error) {
        setSlugState({
          detail: getProductionErrorMessage(
            error,
            "Could not check project address availability right now.",
          ),
          normalizedSlug,
          status: "invalid",
        });
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [projectSlug, setProjectSlug]);

  return slugState;
};
