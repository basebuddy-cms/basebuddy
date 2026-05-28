const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const symbolPattern = /[^A-Za-z0-9]/;

export const isValidBaseBuddyAccountEmail = (email: string) =>
  emailPattern.test(email.trim());

export const getBaseBuddyPasswordIssues = (password: string) => {
  const issues: string[] = [];

  if (password.length < 8) {
    issues.push("Use at least 8 characters.");
  }

  if (!/[a-z]/.test(password)) {
    issues.push("Add a lowercase letter.");
  }

  if (!/[A-Z]/.test(password)) {
    issues.push("Add an uppercase letter.");
  }

  if (!/[0-9]/.test(password)) {
    issues.push("Add a number.");
  }

  if (!symbolPattern.test(password)) {
    issues.push("Add a symbol.");
  }

  return issues;
};

export const isStrongBaseBuddyPassword = (password: string) =>
  getBaseBuddyPasswordIssues(password).length === 0;
