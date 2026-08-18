#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const vm = require("node:vm");

const {
  loadLinuxFeaturePatchDescriptors,
  stageEnabledLinuxFeatureInstall,
} = require("../../scripts/lib/linux-features.js");
const {
  applySharedAppServerSocketPatch,
  descriptors,
  sharedTransportClassSource,
} = require("./patch.js");

const socketEnvHook = path.join(__dirname, "socket-env.sh");

function withFeatureConfig(enabled, callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shared-app-server-socket-feature-"));
  const configPath = path.join(tempDir, "features.json");
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  try {
    fs.writeFileSync(configPath, `${JSON.stringify({ enabled })}\n`);
    process.env.CODEX_LINUX_FEATURES_CONFIG = configPath;
    return callback(path.resolve(__dirname, ".."));
  } finally {
    if (originalConfig == null) delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    else process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function syntheticBundle() {
  return [
    "var Ky=class{options;kind=`websocket`;logger=r.i(`AppServerTransportSshWebsocket`);supportsReconnect(){return!0}",
    "async connect(){let t={current:null},r=new n.zn(Fy,{perMessageDeflate:!1,createConnection:()=>t.current});return n.Ln(r,{onPongTimeout:()=>r.terminate()}),this.hasConnected=!0,new n.Rn(r)}};",
    "function n6(e){let t=Jy(e.hostConfig);if(t)return Z.info(`selected app-server transport`),new Ky(t);",
    "if(e.transportKind===`remote-control`)return new Remote(e);",
    "if(n.io(e.hostConfig))return new Wsl({hostConfig:e.hostConfig,repoRoot:e.repoRoot,resourcesPath:e.resourcesPath,defaultOriginator:e.defaultOriginator});",
    "let r=r6(e.hostConfig);if(r){return new n.Fn({hostConfig:e.hostConfig,websocketUrl:r})}",
    "return new n.Nn({hostConfig:e.hostConfig})}function afterFactory(){}",
  ].join("");
}

function fakeChild({ closeCode = null } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    queueMicrotask(() => child.emit("close", null, "SIGTERM"));
    return true;
  };
  if (closeCode != null) queueMicrotask(() => child.emit("close", closeCode, null));
  return child;
}

function loadInjectedTransport(spawnImpl) {
  class WebSocket extends EventEmitter {
    constructor(_url, options) {
      super();
      this.stream = options.createConnection();
      queueMicrotask(() => this.emit("open"));
    }
    terminate() { this.stream.destroy(); }
  }
  class Adapter { constructor(socket) { this.socket = socket; } }
  const namespace = { WS: WebSocket, keepAlive() {}, Adapter };
  const context = {
    n: namespace,
    url: "ws://localhost/rpc",
    process,
    console,
    setTimeout,
    clearTimeout,
    require(id) {
      if (id === "node:child_process") return { spawn: spawnImpl };
      return require(id);
    },
  };
  vm.runInNewContext(
    `${sharedTransportClassSource({ namespace: "n", webSocketClass: "WS", webSocketUrl: "url", keepAlive: "keepAlive", adapterClass: "Adapter" })};globalThis.Transport=CodexLinuxSharedAppServerSocketTransport`,
    context,
  );
  return context.Transport;
}

test("shared-app-server-socket stays disabled until explicitly enabled", () => {
  withFeatureConfig([], (featuresRoot) => {
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot }), []);
  });
  withFeatureConfig(["shared-app-server-socket"], (featuresRoot) => {
    assert.deepEqual(
      loadLinuxFeaturePatchDescriptors({ featuresRoot }).map((entry) => entry.id),
      ["feature:shared-app-server-socket:main-process-shared-app-server-socket"],
    );
  });
});

test("feature stages only the socket environment hook", () => {
  withFeatureConfig(["shared-app-server-socket"], (featuresRoot) => {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "shared-app-server-socket-app-"));
    try {
      const plan = stageEnabledLinuxFeatureInstall(appDir, { featuresRoot });
      assert.deepEqual(
        plan.runtimeHooks.map((hook) => [hook.key, path.basename(hook.target), hook.mode.toString(8)]),
        [["launcher", "shared-app-server-socket-socket-env.sh", "755"]],
      );
    } finally {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
  });
});

test("patch attaches local Desktop sessions to the managed daemon and is idempotent", () => {
  const source = syntheticBundle();
  const patched = applySharedAppServerSocketPatch(source);
  assert.notEqual(patched, source);
  assert.equal(applySharedAppServerSocketPatch(patched), patched);
  assert.match(patched, /hostConfig\.kind===`local`/);
  assert.match(patched, /`app-server`,`daemon`,`start`/);
  assert.match(patched, /`app-server`,`proxy`,`--sock`/);
  assert.doesNotMatch(patched, /`app-server`,`--listen`/);
  assert.doesNotMatch(patched, /lockPath|reclaimStaleLock|stopAuthority/);
});

test("transport starts the native daemon once for concurrent connections", async () => {
  const originalCli = process.env.CODEX_CLI_PATH;
  process.env.CODEX_CLI_PATH = "/usr/bin/codex";
  let daemonStarts = 0;
  let proxies = 0;
  const Transport = loadInjectedTransport((_command, args) => {
    if (args[1] === "daemon") {
      daemonStarts += 1;
      return fakeChild({ closeCode: 0 });
    }
    proxies += 1;
    return fakeChild();
  });
  try {
    const transport = new Transport("/tmp/app-server.sock");
    const [first, second] = await Promise.all([transport.connect(), transport.connect()]);
    assert.equal(daemonStarts, 1);
    assert.equal(proxies, 2);
    transport.dispose();
    assert.equal(first.socket.stream.destroyed, true);
    assert.equal(second.socket.stream.destroyed, true);
  } finally {
    if (originalCli == null) delete process.env.CODEX_CLI_PATH;
    else process.env.CODEX_CLI_PATH = originalCli;
  }
});

test("transport rejects a failed native daemon start before proxying", async () => {
  const originalCli = process.env.CODEX_CLI_PATH;
  process.env.CODEX_CLI_PATH = "/usr/bin/codex";
  const Transport = loadInjectedTransport(() => {
    const child = fakeChild();
    setImmediate(() => {
      child.stderr.write("daemon unavailable");
      child.emit("close", 1, null);
    });
    return child;
  });
  try {
    await assert.rejects(
      new Transport("/tmp/app-server.sock").connect(),
      /daemon start failed.*daemon unavailable/,
    );
  } finally {
    if (originalCli == null) delete process.env.CODEX_CLI_PATH;
    else process.env.CODEX_CLI_PATH = originalCli;
  }
});

test("unsupported bundle shapes fail soft", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    assert.equal(applySharedAppServerSocketPatch("unrelated bundle"), "unrelated bundle");
  } finally {
    console.warn = originalWarn;
  }
  assert.match(warnings.join("\n"), /shared app-server socket/i);
});

test("descriptor remains optional and the launcher hook is valid", () => {
  assert.deepEqual(
    descriptors.map(({ id, phase, ciPolicy }) => [id, phase, ciPolicy]),
    [["main-process-shared-app-server-socket", "main-bundle", "optional"]],
  );
  assert.equal(require("node:child_process").spawnSync("bash", ["-n", socketEnvHook]).status, 0);
});
