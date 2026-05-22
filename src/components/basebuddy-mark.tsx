import React from "react";
import Image from "next/image";

type BaseBuddyMarkProps = {
  className?: string;
};

type BaseBuddyWordmarkProps = {
  className?: string;
};

export function BaseBuddyMark({ className = "h-6 w-6" }: BaseBuddyMarkProps) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={512}
      priority
      src="/basebuddy-icon.svg"
      width={512}
    />
  );
}

export function BaseBuddyWordmark({ className = "h-7 w-auto" }: BaseBuddyWordmarkProps) {
  return (
    <Image
      alt="BaseBuddy"
      className={className}
      height={434}
      priority
      src="/basebuddy-wordmark-script.png"
      width={1599}
    />
  );
}
