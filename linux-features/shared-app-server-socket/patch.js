"use strict";

const IDENT = "[A-Za-z_$][\\w$]*";

function findTransportSymbols(source) {
  const classMatch = source.match(
    new RegExp(
      `var (${IDENT})=class\\{options;kind=\\\`websocket\\\`;logger=${IDENT}\\.${IDENT}\\(\\\`AppServerTransportSshWebsocket\\\`\\)`,
    ),
  );
  const selectionLogIndex = source.indexOf("selected app-server transport");
  if (classMatch == null || selectionLogIndex < 0 || classMatch.index >= selectionLogIndex) return null;

  const sshClassSource = source.slice(classMatch.index, selectionLogIndex);
  const webSocketMatch = sshClassSource.match(
    new RegExp(`new (${IDENT})\\.(${IDENT})\\((${IDENT}),\\{perMessageDeflate:!1,createConnection:`),
  );
  if (webSocketMatch == null) return null;
  const [, namespace, webSocketClass, webSocketUrl] = webSocketMatch;
  const lifecycleMatch = sshClassSource.match(
    new RegExp(
      `return ${namespace}\\.(${IDENT})\\((${IDENT}),\\{onPongTimeout:[\\s\\S]{0,160}?\\}\\)[\\s\\S]{0,160}?,new ${namespace}\\.(${IDENT})\\(\\2\\)`,
    ),
  );
  if (lifecycleMatch == null) return null;

  return {
    namespace,
    webSocketClass,
    webSocketUrl,
    adapterClass: lifecycleMatch[3],
    keepAlive: lifecycleMatch[1],
  };
}

function sharedTransportClassSource(symbols) {
  return (
    "class CodexLinuxSharedAppServerSocketTransport{" +
    "kind=`websocket`;proxyStreams=new Set;daemonReady=null;disposed=!1;" +
    "constructor(e){this.socketPath=e}" +
    "supportsReconnect(){return!0}" +
    "dispose(){this.disposed=!0;for(let e of this.proxyStreams)e.destroy();this.proxyStreams.clear()}" +
    "ensureDaemon(){if(this.disposed)return Promise.reject(Error(`shared app-server socket transport is disposed`));if(this.daemonReady)return this.daemonReady;let e=this.startDaemon();return this.daemonReady=e,e.finally(()=>{this.daemonReady===e&&(this.daemonReady=null)})}" +
    "startDaemon(){let e=process.env.CODEX_CLI_PATH;if(!e)return Promise.reject(Error(`shared app-server socket requires CODEX_CLI_PATH`));return new Promise((t,n)=>{let r=require(`node:child_process`).spawn(e,[`app-server`,`daemon`,`start`],{env:process.env,stdio:[`ignore`,`ignore`,`pipe`]}),i=``;r.stderr?.on(`data`,e=>{i=`${i}${e.toString(`utf8`)}`.slice(-4000)}),r.once(`error`,n),r.once(`close`,e=>{e===0?t():n(Error(`app-server daemon start failed (${e??`unknown`}): ${i.trim()}`))})})}" +
    "createProxyStream(){let c=process.env.CODEX_CLI_PATH;if(!c)throw Error(`shared app-server socket requires CODEX_CLI_PATH`);let e=require(`node:child_process`).spawn(c,[`app-server`,`proxy`,`--sock`,this.socketPath],{env:process.env,stdio:[`pipe`,`pipe`,`pipe`]}),t=e.stdin,n=e.stdout,r=e.stderr;if(t==null||n==null||r==null)throw e.kill(),Error(`shared app-server proxy stdio was unavailable`);let i=``;r.on(`data`,e=>{i=`${i}${e.toString(`utf8`)}`.slice(-4000)});let a=new(require(`node:stream`).Duplex)({read(){n.resume()},write(e,n,r){t.write(e,n,r)},final(e){t.end(),e()},destroy(t,n){e.kill(),n(t)}});Object.assign(a,{setKeepAlive:()=>a,setNoDelay:()=>a,setTimeout:()=>a});let o=e=>a.destroy(e);t.on(`error`,o),n.on(`data`,e=>{a.push(e)||n.pause()}),n.on(`end`,()=>a.push(null)),e.on(`error`,o),e.on(`close`,(e,n)=>{t.removeListener(`error`,o),e===0?a.push(null):a.destroy(Error(`shared app-server proxy exited (${e??n??`unknown`}): ${i.trim()}`))}),this.proxyStreams.add(a),a.once(`close`,()=>this.proxyStreams.delete(a));return a}" +
    `async connect(){await this.ensureDaemon();let e={current:null},t=new ${symbols.namespace}.${symbols.webSocketClass}(${symbols.webSocketUrl},{perMessageDeflate:!1,createConnection:()=>(e.current=this.createProxyStream(),e.current)});t.once(\`close\`,()=>e.current?.destroy());try{await new Promise((n,r)=>{let i=setTimeout(()=>o(Error(\`shared app-server websocket open timed out\`)),3e4);i.unref();let a=()=>{clearTimeout(i),t.off(\`error\`,o),t.off(\`close\`,s)},o=e=>{a(),r(e)},s=()=>o(Error(\`shared app-server websocket closed before opening\`));t.once(\`open\`,()=>{a(),n()}),t.once(\`error\`,o),t.once(\`close\`,s)})}catch(n){e.current?.destroy(),t.terminate(),await new Promise(e=>setTimeout(e,0));throw n}${symbols.namespace}.${symbols.keepAlive}(t,{onPongTimeout:()=>t.terminate()});return new ${symbols.namespace}.${symbols.adapterClass}(t)}}`
  );
}

function applySharedAppServerSocketPatch(source) {
  if (source.includes("class CodexLinuxSharedAppServerSocketTransport")) return source;

  const symbols = findTransportSymbols(source);
  if (symbols == null) {
    console.warn("WARN: Could not find SSH WebSocket transport for shared app-server socket patch");
    return source;
  }

  const selectionLogIndex = source.indexOf("selected app-server transport");
  const factoryStart = source.lastIndexOf("function ", selectionLogIndex);
  const factoryEnd = source.indexOf("function ", selectionLogIndex + 1);
  if (selectionLogIndex < 0 || factoryStart < 0 || factoryEnd < 0) {
    console.warn("WARN: Could not find local transport factory for shared app-server socket patch");
    return source;
  }
  const factorySource = source.slice(factoryStart, factoryEnd);
  const localFallbackPattern = new RegExp(
    `(if\\(${symbols.namespace}\\.(${IDENT})\\(e\\.hostConfig\\)\\)return new (${IDENT})\\(\\{hostConfig:e\\.hostConfig,repoRoot:e\\.repoRoot,resourcesPath:e\\.resourcesPath,defaultOriginator:e\\.defaultOriginator\\}\\);)(?=let (${IDENT})=(${IDENT})\\(e\\.hostConfig\\);if\\(\\4\\)\\{)`,
  );
  if (!localFallbackPattern.test(factorySource)) {
    console.warn("WARN: Could not find local transport fallback for shared app-server socket patch");
    return source;
  }

  const patchedFactory = factorySource.replace(
    localFallbackPattern,
    (match) =>
      `${match}if(process.env.CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET&&e.hostConfig.kind===\`local\`)return new CodexLinuxSharedAppServerSocketTransport(process.env.CODEX_LINUX_APP_SERVER_BRIDGE_SOCKET);`,
  );
  return (
    source.slice(0, factoryStart) +
    sharedTransportClassSource(symbols) +
    patchedFactory +
    source.slice(factoryEnd)
  );
}

const descriptors = [
  {
    id: "main-process-shared-app-server-socket",
    phase: "main-bundle",
    order: 140,
    ciPolicy: "optional",
    apply: applySharedAppServerSocketPatch,
  },
];

module.exports = {
  applySharedAppServerSocketPatch,
  descriptors,
  findTransportSymbols,
  sharedTransportClassSource,
};
