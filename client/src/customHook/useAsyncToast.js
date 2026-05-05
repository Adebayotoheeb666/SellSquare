import { toast } from "sonner";

/**
 * Custom hook for handling async operations with toast notifications
 * Allows background execution while user navigates to other pages
 * 
 * @param {Promise} asyncFunction - The async function to execute
 * @param {Object} messages - Custom messages for loading, success, and error states
 * @returns {Function} - A function that executes the async operation with toast notifications
 */
export const useAsyncToast = () => {
  const executeWithToast = async (asyncFunction, messages = {}) => {
    const defaultMessages = {
      loading: messages.loading || "Processing...",
      success: messages.success || "Operation completed successfully!",
      error: messages.error || "Operation failed. Please try again.",
    };

    return toast.promise(
      asyncFunction,
      {
        loading: defaultMessages.loading,
        success: (data) => {
          // Allow custom success message to be a function that receives the result
          return typeof defaultMessages.success === "function"
            ? defaultMessages.success(data)
            : defaultMessages.success;
        },
        error: (err) => {
          // Allow custom error message to be a function that receives the error
          return typeof defaultMessages.error === "function"
            ? defaultMessages.error(err)
            : defaultMessages.error;
        },
      }
    );
  };

  return { executeWithToast };
};

/**
 * Wrapper function for async operations that run in the background
 * even when the user navigates away
 * 
 * @param {Promise} asyncOperation - The async operation to execute
 * @param {Object} toastMessages - Messages for toast notifications
 */
export const executeInBackground = async (asyncOperation, toastMessages = {}) => {
  // Execute the operation without blocking user navigation
  const defaultMessages = {
    loading: toastMessages.loading || "Processing in background...",
    success: toastMessages.success || "Operation completed!",
    error: toastMessages.error || "Operation failed.",
  };

  // Use toast.promise which handles the promise lifecycle
  toast.promise(
    asyncOperation,
    {
      loading: defaultMessages.loading,
      success: defaultMessages.success,
      error: defaultMessages.error,
    }
  );

  // Return immediately, allowing user to navigate
  return asyncOperation;
};

export default useAsyncToast;
