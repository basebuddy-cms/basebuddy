type RequestUnsavedChangesConfirmation = (
  action: () => void | Promise<void>,
  proceedLabel?: string,
  onCancel?: () => void,
) => void;

export const requestProjectsNavigation = ({
  navigate,
  requestUnsavedChangesConfirmation,
  setExternalPageLoading,
}: {
  navigate: () => void;
  requestUnsavedChangesConfirmation: RequestUnsavedChangesConfirmation;
  setExternalPageLoading: (loading: boolean) => void;
}) => {
  setExternalPageLoading(true);
  requestUnsavedChangesConfirmation(
    () => {
      navigate();
    },
    "Discard and Leave",
    () => {
      setExternalPageLoading(false);
    },
  );
};
