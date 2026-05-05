const { useState, useEffect } = require("react");

const usePaymentUpdate = ({ currentUser }) => {
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);
  const [isInGracePeriod, setIsInGracePeriod] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [currentUser]);

  const checkSubscriptionStatus = () => {
    const currentDate = new Date();
    const nextDueDate = new Date(currentUser?.subscription?.nextDueDate);
    const gracePeriodEndDate = new Date(
      nextDueDate.getTime() + 2 * 24 * 60 * 60 * 1000
    ); // 2 day grace period

    if (currentUser?.subscription?.subscriptionType === "permanent") {
      setIsSubscriptionExpired(false);
      setIsInGracePeriod(false);
    } else {
      if (currentDate > gracePeriodEndDate) {
        setIsSubscriptionExpired(true);
        setIsInGracePeriod(false);
      } else if (currentDate > nextDueDate) {
        setIsInGracePeriod(true);
        setIsSubscriptionExpired(false);
      } else {
        setIsSubscriptionExpired(false);
        setIsInGracePeriod(false);
      }
    }
  };

  return {
    isSubscriptionExpired,
    isInGracePeriod,
  };
};

export default usePaymentUpdate;
