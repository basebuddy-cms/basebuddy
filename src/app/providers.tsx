"use client";

import React, { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

type ProvidersProps = {
  children: ReactNode;
};

export const createAppQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: false,
      },
    },
  });

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
