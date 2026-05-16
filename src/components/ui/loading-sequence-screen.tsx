"use client";

import React, { useEffect, useState } from "react";

export type LoadingSequenceMessage = {
  detail: string;
  title: string;
};

const LOADING_SEQUENCE_INTERVAL_MS = 5_000;

export function LoadingSequenceScreen({
  messages,
}: {
  messages: LoadingSequenceMessage[];
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const activeMessage = messages[Math.min(messageIndex, messages.length - 1)] ?? null;

  useEffect(() => {
    if (messages.length <= 1) {
      setMessageIndex(0);
      return;
    }

    setMessageIndex(0);

    const interval = window.setInterval(() => {
      setMessageIndex((currentIndex) => Math.min(currentIndex + 1, messages.length - 1));
    }, LOADING_SEQUENCE_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [messages]);

  if (!activeMessage) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-2xl items-center justify-center">
        <div
          aria-atomic="true"
          aria-live="polite"
          key={`${messageIndex}:${activeMessage.title}`}
          role="status"
          className="max-w-lg text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500"
        >
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {activeMessage.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeMessage.detail}</p>
        </div>
      </div>
    </div>
  );
}
