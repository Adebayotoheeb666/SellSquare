const writeLine = (message) => {
  const safeMessage = message ?? "";
  process.stdout.write(`${safeMessage}\n`);
};

const logRoute = (message) => {
  writeLine(message);
};

const logChangeStream = (message) => {
  writeLine(message);
};

const suppressConsoleLogs = () => {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
};

module.exports = {
  logRoute,
  logChangeStream,
  suppressConsoleLogs,
};
