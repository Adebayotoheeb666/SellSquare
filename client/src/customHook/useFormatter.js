import { useSelector } from "react-redux";
import { selectUser } from "../redux/features/auth/authSlice";

const useFormatter = () => {
  const currentUser = useSelector(selectUser);
  //   console.log(currentUser.country);

  const formatter = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  return {
    formatter,
  };
};

export default useFormatter;
