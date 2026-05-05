import { toast } from "sonner";

/**
 * useNotification Hook
 * 
 * Custom hook for displaying toast notifications
 * Returns a function that displays notifications with different types
 */
export const useNotification = () => {
  const showNotification = (options) => {
    const { type, message } = options;

    switch (type) {
      case "success":
        toast.success(message);
        break;
      case "error":
        toast.error(message);
        break;
      case "info":
        toast.info(message);
        break;
      case "warning":
        toast.warning(message);
        break;
      default:
        toast(message);
    }
  };

  return showNotification;
};

export default useNotification;
