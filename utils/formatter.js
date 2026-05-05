const useFormatter = (country) => {
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

module.exports = useFormatter

