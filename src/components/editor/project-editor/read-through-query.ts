export const loadProjectEditorReadThroughQuery = async <TPayload>({
  applyPayload,
  fetchFreshPayload,
  force = false,
  getCachedPayload,
  getErrorMessage,
  getQueryPayload,
  latestRequestRef,
  setErrorMessage,
  setLoading,
  setRefreshing,
}: {
  applyPayload: (payload: TPayload, options?: { persist?: boolean }) => void;
  fetchFreshPayload: () => Promise<TPayload>;
  force?: boolean;
  getCachedPayload: () => TPayload | null;
  getErrorMessage: (error: unknown) => string;
  getQueryPayload: () => TPayload | undefined;
  latestRequestRef: { current: number };
  setErrorMessage: (value: string | null) => void;
  setLoading: (value: boolean) => void;
  setRefreshing: (value: boolean) => void;
}) => {
  const requestId = latestRequestRef.current + 1;
  let usedCachedPayload = false;

  latestRequestRef.current = requestId;

  if (force) {
    setLoading(true);
    setRefreshing(false);
  } else {
    const queryPayload = getQueryPayload();
    const cachedPayload = queryPayload ? null : getCachedPayload();

    if (queryPayload) {
      applyPayload(queryPayload, { persist: false });
      usedCachedPayload = true;
      setLoading(false);
      setRefreshing(true);
    } else if (cachedPayload) {
      applyPayload(cachedPayload, { persist: false });
      usedCachedPayload = true;
      setLoading(false);
      setRefreshing(true);
    } else {
      setLoading(true);
      setRefreshing(false);
    }
  }

  setErrorMessage(null);

  try {
    const payload = await fetchFreshPayload();

    if (requestId !== latestRequestRef.current) {
      return;
    }

    applyPayload(payload);
  } catch (error) {
    if (requestId !== latestRequestRef.current) {
      return;
    }

    if (!usedCachedPayload) {
      setErrorMessage(getErrorMessage(error));
    }
  } finally {
    if (requestId === latestRequestRef.current) {
      setLoading(false);
      setRefreshing(false);
    }
  }
};
