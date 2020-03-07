module.exports = (on) => {
  require("../../src/index").install(on, {
    debug: true,
    reportsDirectory: "./cypress/reports/",
    consoleLevels: ["log", "info", "warning", "error"],
    blacklistHosts: ["*.googleapis.com", "*.curtin.edu.au"],
  });
};
