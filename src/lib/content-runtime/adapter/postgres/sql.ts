export const quotePostgresIdentifier = (value: string) => `"${value.replace(/"/g, "\"\"")}"`;

export const quotePostgresQualifiedIdentifier = (left: string, right: string) =>
  `${quotePostgresIdentifier(left)}.${quotePostgresIdentifier(right)}`;
