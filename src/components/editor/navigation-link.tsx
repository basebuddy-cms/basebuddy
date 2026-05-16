"use client";

import Link, { type LinkProps } from "next/link";
import React, { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";

export const shouldHandlePlainLinkNavigation = (event: MouseEvent<HTMLElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.shiftKey;

type NavigationLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    onPlainNavigation?: () => void | Promise<void>;
  };

export const NavigationLink = forwardRef<HTMLAnchorElement, NavigationLinkProps>(
  ({ onClick, onPlainNavigation, prefetch, ...props }, ref) => (
    <Link
      ref={ref}
      prefetch={prefetch ?? false}
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (!onPlainNavigation || !shouldHandlePlainLinkNavigation(event)) {
          return;
        }

        event.preventDefault();
        void onPlainNavigation();
      }}
    />
  ),
);

NavigationLink.displayName = "NavigationLink";
