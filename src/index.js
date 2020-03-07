const CDP = require("chrome-remote-interface");
const minimatch = require("minimatch");
const fs = require("fs");
const urlUtils = require("url");

let config;

const support = () => {
  beforeEach(() => {
    cy.task("clearEvents");
  });

  afterEach(function() {
    const { state } = this.currentTest;
    const title = this.currentTest.fullTitle();
    cy.task("failReport", { state, title });
  });
};

const install = (on, userConfig) => {
  let events = {};

  config = userConfig;

  const defaultConfig = {
    alwaysReport: false,
    onlyFailedRequests: true,
    debug: false,
    reportsDirectory: "./cypress/reports/",
    consoleLevels: ["warning", "error"],
    blacklistHosts: [],
  };

  for (const key in defaultConfig) {
    if (!(key in config)) {
      config[key] = defaultConfig[key];
    }
  }

  clearEvents(events);

  on("before:browser:launch", (browser, launchOptions) =>
    browserLaunchHandler(launchOptions, events),
  );

  on("task", {
    failReport: ({ state, title }) => {
      if (config.alwaysReport || state !== "passed") {
        const dir = config.reportsDirectory;
        const filename = `${dir}${title}.json`;

        const data = {
          test: {
            title,
          },
          events: events,
        };

        fs.mkdir(dir, { recursive: true }, (e) => {
          if (e) throw e;
        });

        fs.writeFileSync(filename, JSON.stringify(data));
      }

      return null;
    },
    clearEvents: () => {
      clearEvents(events);

      return null;
    },
  });
};

const clearEvents = (events) => {
  events.entry = {};
  events.console = {};
  events.network = {
    request: {},
    response: {},
  };
};

const isBlacklisted = (urlToCheck) => {
  return config.blacklistHosts.some((pattern) =>
    minimatch(stripUrl(urlToCheck), pattern),
  );
};

const stripUrl = (urlToCheck) => {
  const { host, hostname, port } = urlUtils.parse(urlToCheck);

  if (port === "80" || port === "443") {
    return hostname;
  }

  return host;
};

const logEntry = ({ entry }, events) => {
  const { source, level, text, timestamp, url } = entry;

  if (isBlacklisted(url)) return;

  if (!(source in events.entry)) events.entry[source] = [];

  events.entry[source].push({ source, level, text, timestamp, url });
};

const logConsole = ({ type, args, timestamp }, events) => {
  if (!config.consoleLevels.includes(type)) return;

  if (!(type in events.console)) events.console[type] = [];

  events.console[type].push({ args, timestamp });
};

const logRequest = ({ requestId, request, timestamp }, events) => {
  const { url, method, headers } = request;

  if (isBlacklisted(url)) return;

  events.network.request[requestId] = { url, method, headers, timestamp };
};

const logResponse = ({ requestId, response, timestamp }, events) => {
  const { url, status, headers, mimeType, timing } = response;

  const sendTime = timing ? timing.sendEnd - timing.sendStart : -1;

  if (isBlacklisted(url)) return;

  if (config.onlyFailedRequests) {
    if (
      status.toString().startsWith("2") ||
      status.toString().startsWith("3")
    ) {
      delete events.network.request[requestId];

      return;
    }
  }

  events.network.response[requestId] = {
    url,
    status,
    headers,
    mimeType,
    sendTime,
    timestamp,
  };
};

// credit to: https://github.com/flotwig/cypress-log-to-output/blob/master/src/log-to-output.js
const browserLaunchHandler = (launchOptions, events) => {
  const args = launchOptions.args || launchOptions;

  const rdp = ensureRdpPort(args);

  debugLog("Attempting to connect to Chrome Debugging Protocol");

  const tryConnect = () => {
    new CDP({
      port: rdp,
    })
      .then((cdp) => {
        debugLog("Connected to Chrome Debugging Protocol");

        cdp.Log.enable();
        cdp.Log.entryAdded((params) => logEntry(params, events));

        cdp.Runtime.enable();
        cdp.Runtime.consoleAPICalled((params) => logConsole(params, events));

        cdp.Network.enable();
        cdp.Network.requestWillBeSent((params) => logRequest(params, events));
        cdp.Network.responseReceived((params) => logResponse(params, events));

        cdp.on("disconnect", () => {
          debugLog("Chrome Debugging Protocol disconnected");
        });
      })
      .catch(() => {
        setTimeout(tryConnect, 100);
      });
  };

  tryConnect();

  return launchOptions;
};

// credit to: https://github.com/flotwig/cypress-log-to-output/blob/master/src/log-to-output.js
const ensureRdpPort = (args) => {
  const existing = args.find(
    (arg) => arg.slice(0, 23) === "--remote-debugging-port",
  );

  if (existing) {
    return Number(existing.split("=")[1]);
  }

  const port = 40000 + Math.round(Math.random() * 25000);

  args.push(`--remote-debugging-port=${port}`);

  return port;
};

const debugLog = (msg) => {
  if (config.debug) {
    console.log(`[cypress-fail-log] ${msg}`);
  }
};

module.exports = {
  support,
  install,
};
