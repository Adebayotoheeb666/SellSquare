import { useState, useCallback } from "react";

/**
 * Custom hook for managing async button states
 * @returns {Object} Contains loading state, execute function, and reset function
 *
 * Usage:
 * const { isLoading, execute } = useAsyncButton();
 *
 * <button onClick={() => execute(myAsyncFunction)} disabled={isLoading}>
 *   {isLoading && <ButtonSpinner />}
 *   Submit
 * </button>
 */
export const useAsyncButton = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);

  const execute = useCallback(
    async (asyncFunction, ...args) => {
      if (isLoading) return; // Prevent double execution

      setIsLoading(true);
      try {
        const result = await asyncFunction(...args);
        return result;
      } catch (error) {
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
  }, []);

  return { isLoading, execute, reset };
};

/**
 * Custom hook for managing multiple async button states
 * Useful when you have multiple buttons on the same page
 *
 * Usage:
 * const { isLoading, execute } = useAsyncButtons();
 *
 * <button onClick={() => execute('save', saveFunction)} disabled={isLoading('save')}>
 *   {isLoading('save') && <ButtonSpinner />}
 *   Save
 * </button>
 * <button onClick={() => execute('delete', deleteFunction)} disabled={isLoading('delete')}>
 *   {isLoading('delete') && <ButtonSpinner />}
 *   Delete
 * </button>
 */
export const useAsyncButtons = () => {
  const [loadingStates, setLoadingStates] = useState({});

  const isLoading = useCallback(
    (key) => {
      return loadingStates[key] || false;
    },
    [loadingStates]
  );

  const execute = useCallback(
    async (key, asyncFunction, ...args) => {
      if (loadingStates[key]) return; // Prevent double execution

      setLoadingStates((prev) => ({ ...prev, [key]: true }));
      try {
        const result = await asyncFunction(...args);
        return result;
      } catch (error) {
        throw error;
      } finally {
        setLoadingStates((prev) => ({ ...prev, [key]: false }));
      }
    },
    [loadingStates]
  );

  const reset = useCallback((key) => {
    if (key) {
      setLoadingStates((prev) => ({ ...prev, [key]: false }));
    } else {
      setLoadingStates({});
    }
  }, []);

  return { isLoading, execute, reset };
};

export default useAsyncButton;
