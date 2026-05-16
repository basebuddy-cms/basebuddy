import "server-only";

type ProjectScopedContext = {
  projectId: string;
};

type ProjectContextDependencies<TContext extends ProjectScopedContext> = {
  getProjectContext: (projectId: string) => Promise<TContext | null>;
};

export const bindContentProjectContext = <
  TContext extends ProjectScopedContext,
  TDependencies extends ProjectContextDependencies<TContext>,
>(
  dependencies: TDependencies,
  context: TContext,
): TDependencies => ({
  ...dependencies,
  getProjectContext: async (projectId: string) =>
    projectId === context.projectId ? context : dependencies.getProjectContext(projectId),
});
