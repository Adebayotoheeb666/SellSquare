const Activities = require("../models/Activities");
const BusinessRegistration = require("../models/businessRegistration");

const logActivity = (activityDescription) => {
  return async (req, res, next) => {
    try {
      const { business, loggedInUser } = req;
      const user = JSON.parse(loggedInUser);
      if (!user) {
        throw new Error("User not found for activity logging");
      }

      // Only log for Standard and Professional plans
      if (
        user.subscription.plan !== "Standard" &&
        user.subscription.plan !== "Professional"
      ) {
        return;
      }

      // Auto-enable activities for eligible plans
      if (user.subscription.businessActivities === false) {
        await BusinessRegistration.findByIdAndUpdate(
          business._id,
          { "subscription.businessActivities": true },
          { new: true }
        );
      }

      const activity = new Activities({
        business: business._id,
        activity: `${user.name} ${activityDescription}`,
      });

      await activity.save();
    } catch (error) {
      console.error(`Error logging activity: ${error.message}`);
      // next(error);
    }
  };
};

module.exports = logActivity;
