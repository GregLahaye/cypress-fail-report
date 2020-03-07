const CDP = require("chrome-remote-interface");
const fs = require("fs");

const support = () => {
  beforeEach(() => {
    cy.task("clearEvents");
  });

  afterEach(function() {
    if (this.currentTest.state !== "passed") {
      const title = this.currentTest.fullTitle();
      cy.task("failReport", title);
    }
  });
};

const install = (on) => {
  let events = {
    entry: [],
    console: [],
    network: {
      request: {},
      response: {},
    },
  };

  on("before:browser:launch", (browser, launchOptions) =>
    browserLaunchHandler(launchOptions, events),
  );

  on("task", {
    failReport: (title) => {
      const dir = "./cypress/reports/";
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

      return null;
    },
    clearEvents: () => {
      events.entry = [];
      events.console = [];
      events.network = {
        request: {},
        response: {},
      };

      return null;
    },
  });
};

const logEntry = (params, events) => {
  console.log(`[entry]  ${params.text}`);
  events.entry.push(params);
};

const logConsole = (params, events) => {
  console.log(`[console]  ${params.args}`);
  events.console.push(params);
};

const logRequest = (params, events) => {
  console.log(`[request] ${params.requestId}`);
  events.network.request[params.requestId] = params;
};

const logResponse = (params, events) => {
  console.log(`[response] ${params.requestId}`);
  events.network.response[params.requestId] = params;
};

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
  console.log(`[cypress-fail-log] ${msg}`);
};

module.exports = {
  support,
  install,
};
