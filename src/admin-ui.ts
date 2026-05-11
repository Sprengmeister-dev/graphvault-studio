import { STUDIO_GVQL_EXAMPLES } from "./gvql-examples.js";

export const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GraphVault Studio</title>
  <link rel="icon" type="image/png" href="/assets/graphvault-logo.png" />
  <link rel="shortcut icon" type="image/png" href="/favicon.ico" />
  <style>
    :root {
      font-family: "Avenir Next", "Aptos", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", ui-sans-serif, system-ui, sans-serif;
      color: #142026;
      background: #edf2f4;
      --panel: #ffffff;
      --line: #d6dee2;
      --muted: #65757d;
      --ink: #142026;
      --nav: #101c24;
      --nav-soft: #1d303a;
      --accent: #0f8b8d;
      --accent-soft: #d9f1ef;
      --amber: #e4b955;
      --danger: #bf4342;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    strong, b, .status, .panel-title, .mutation summary, .object-id, .tag, .field-name { text-shadow: none; }
    button, input, select, textarea { font: inherit; }
    button { border: 1px solid var(--line); background: #fff; border-radius: 7px; cursor: pointer; }
    button:hover { border-color: #98aab3; background: #f6fafb; }
    input, select, textarea { width: 100%; padding: 10px 11px; border: 1px solid #b8c7ce; border-radius: 7px; background: #fff; }
    textarea { min-height: 170px; resize: vertical; font-family: "SFMono-Regular", "Cascadia Code", "Roboto Mono", ui-monospace, monospace; line-height: 1.45; }
    .shell { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; }
    nav { padding: 18px 14px; background: radial-gradient(circle at 0 0, #23444f 0, var(--nav) 42%); color: #eaf1f3; display: grid; grid-template-rows: auto auto auto 1fr; gap: 18px; }
    .brand { display: grid; grid-template-columns: 54px 1fr; gap: 12px; align-items: center; padding: 4px 8px 10px; }
    .brand img { width: 54px; height: 54px; border-radius: 14px; box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28); }
    .brand strong { display: block; font-family: "Avenir Next", "SF Pro Display", "Aptos Display", "Inter", ui-sans-serif, system-ui, sans-serif; font-size: 20px; line-height: 1.05; letter-spacing: 0; font-weight: 600; }
    .brand span, .status, .hint { color: var(--muted); font-size: 13px; }
    nav .brand span, nav .hint { color: #9fb1b9; }
    .status { justify-self: end; padding: 6px 10px; border-radius: 999px; background: #edf6f4; color: #146767; font-weight: 600; }
    .nav-group { display: grid; gap: 7px; }
    .nav-btn { color: #eaf1f3; border-color: transparent; background: transparent; padding: 10px 12px; text-align: left; }
    .nav-btn:hover, .nav-btn.active { background: var(--nav-soft); border-color: #36505c; }
    .sidebar-card { display: grid; align-content: start; gap: 8px; padding: 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.06); }
    nav .hint { align-self: end; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
    .row-split { grid-template-columns: minmax(0, 1fr) 82px; }
    .mini-labels { color: #9fb1b9; font-size: 12px; padding: 2px 2px 0; }
    .topbar { min-height: 74px; padding: 16px 24px; display: grid; grid-template-columns: 1fr auto auto; gap: 14px; align-items: center; background: linear-gradient(180deg, #ffffff 0%, #fbfdfd 100%); border-bottom: 1px solid var(--line); }
    .topbar h1 { margin: 0; font-family: "Avenir Next", "SF Pro Display", "Aptos Display", "Inter", ui-sans-serif, system-ui, sans-serif; font-size: 24px; letter-spacing: 0; font-weight: 600; }
    .auth { display: none; grid-template-columns: minmax(160px, 280px) auto; gap: 8px; }
    .workspace { padding: 18px; display: grid; gap: 14px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 10px 28px rgba(15, 35, 45, 0.05); }
    .workgrid { display: grid; grid-template-columns: minmax(330px, 500px) minmax(560px, 1fr); gap: 14px; min-height: 0; }
    .panel { min-width: 0; overflow: hidden; }
    .panel-head { padding: 13px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); background: #fbfdfd; }
    .panel-title { font-weight: 600; }
    .mutation { padding: 12px 14px; border-bottom: 1px solid var(--line); background: #f8fafb; }
    .mutation summary { cursor: pointer; font-weight: 600; }
    .mutation[open] { display: grid; gap: 8px; }
    .mutation-grid { display: grid; grid-template-columns: 90px 1fr 1fr 1fr; gap: 8px; }
    .audit-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .gvql-box { display: none; padding: 12px 14px; border-bottom: 1px solid var(--line); background: #f8fafb; gap: 8px; }
    .gvql-box.active { display: grid; }
    .gvql-examples { display: flex; flex-wrap: wrap; gap: 6px; }
    .gvql-example { padding: 7px 9px; font-size: 12px; color: #0d6264; background: #eef7f6; border-color: #bddeda; }
    .gvql-example:hover { background: #dff0ee; border-color: #8fc7c0; }
    .gvql-parameters { display: grid; gap: 7px; }
    .gvql-parameter-row { display: grid; grid-template-columns: minmax(96px, 150px) minmax(150px, 1fr) minmax(96px, 120px); gap: 8px; align-items: center; }
    .gvql-param-name { color: #0d6264; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gvql-param-empty { color: var(--muted); padding: 8px 0; }
    .gvql-actions { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; }
    .primary { color: #fff; background: var(--accent); border-color: var(--accent); }
    .primary:hover { color: #fff; background: #0b7375; }
    .danger { color: #fff; background: var(--danger); border-color: var(--danger); }
    .danger:hover { color: #fff; background: #9f3030; }
    .list { padding: 10px; overflow: auto; max-height: calc(100vh - 300px); }
    .item { width: 100%; display: grid; grid-template-columns: 78px minmax(90px, 130px) minmax(0, 1fr) 68px; gap: 10px; align-items: center; margin: 0 0 8px; padding: 10px; text-align: left; transition: border-color .15s ease, transform .15s ease, background .15s ease; }
    .item:hover { transform: translateY(-1px); }
    .item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .object-id { font-weight: 600; color: #12343b; padding-left: calc(var(--depth, 0) * 16px); }
    .tag { display: inline-flex; min-width: 0; width: max-content; max-width: 100%; padding: 4px 7px; border-radius: 999px; background: var(--accent-soft); color: #0d6264; font-size: 12px; font-weight: 600; }
    #viz { display: none; min-height: 320px; border-bottom: 1px solid var(--line); background: #f7fbfb; overflow: hidden; }
    #viz svg { width: 100%; height: 320px; display: block; }
    #viz text { font-size: 12px; fill: var(--ink); pointer-events: none; }
    .fields { display: grid; gap: 8px; padding: 12px; border-bottom: 1px solid var(--line); background: #fbfcfd; }
    .fields-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(160px, 240px); gap: 8px; align-items: center; }
    .field-row { display: grid; grid-template-columns: minmax(110px, 180px) minmax(240px, 1fr) minmax(70px, 90px) max-content; gap: 8px; align-items: center; }
    .field-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .field-row > input, .field-row > select, .field-ref { min-width: 0; }
    .field-ref { width: 100%; text-align: left; padding: 10px 11px; background: #eef7f6; color: #0d6264; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .field-readonly { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .field-kind { color: var(--muted); font-size: 12px; }
    .field-actions { display: flex; gap: 6px; justify-content: flex-end; min-width: max-content; }
    .pager { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 10px; border-top: 1px solid var(--line); }
    pre { margin: 0; min-height: 390px; max-height: calc(100vh - 250px); overflow: auto; padding: 15px; background: #1e272e; color: #edf4f8; line-height: 1.45; font-size: 13px; }
    @media (max-width: 1280px) {
      .workgrid { grid-template-columns: 1fr; }
      .list { max-height: 420px; }
    }
    @media (max-width: 720px) {
      .field-row {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          "name kind"
          "editor editor"
          "actions actions";
      }
      .field-name { grid-area: name; }
      .field-row > input, .field-row > select, .field-ref { grid-area: editor; }
      .field-kind { grid-area: kind; justify-self: end; }
      .field-actions { grid-area: actions; justify-content: flex-start; }
    }
    @media (max-width: 980px) {
      .shell, .mutation-grid, .audit-grid, .topbar, .fields-head { grid-template-columns: 1fr; }
      .gvql-actions, .gvql-parameter-row { grid-template-columns: 1fr; }
      nav { grid-template-rows: auto; gap: 10px; padding: 12px; }
      .brand { grid-template-columns: 42px 1fr; padding-bottom: 2px; }
      .brand img { width: 42px; height: 42px; border-radius: 11px; }
      .nav-group { grid-template-columns: repeat(4, minmax(110px, 1fr)); gap: 6px; }
      .nav-btn { padding: 8px 10px; }
      .sidebar-card { padding: 8px; }
      nav .hint { display: none; }
      .workspace { padding: 12px; }
      .status { justify-self: start; }
      .auth { grid-template-columns: 1fr; }
      .list { max-height: none; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <nav>
      <div class="brand"><img src="/assets/graphvault-logo.png" alt="" /><div><strong>GraphVault Studio</strong><span>Object Graph Admin</span></div></div>
      <div class="nav-group">
        <button class="nav-btn active" data-view="hierarchy" onclick="showHierarchy()">Hierarchy</button>
        <button class="nav-btn" data-view="overview" onclick="showOverview()">Overview</button>
        <button class="nav-btn" data-view="objects" onclick="showObjects()">Objects</button>
        <button class="nav-btn" data-view="graph" onclick="showGraph()">Graph</button>
        <button class="nav-btn" data-view="gvql" onclick="showGvql()">GVQL</button>
        <button class="nav-btn" data-view="operations" onclick="showOperations()">Operations</button>
        <button class="nav-btn" data-view="types" onclick="showTypes()">Type Dictionary</button>
        <button class="nav-btn" data-view="transactions" onclick="showTransactions()">Transactions</button>
        <button class="nav-btn" data-view="journal" onclick="showJournal()">Journal</button>
        <button class="nav-btn" data-view="verify" onclick="showVerify()">Verify</button>
      </div>
      <div class="sidebar-card">
        <div class="row"><input id="q" placeholder="Search paths, values, types, IDs" /><button onclick="showSearch()">Search</button></div>
        <div class="row row-split mini-labels"><span>Graph root ID</span><span>Depth</span></div>
        <div class="row row-split"><input id="graphRoot" placeholder="Graph root object ID" /><input id="graphDepth" type="number" min="0" max="12" value="2" /></div>
        <button onclick="showGraph()">Load Graph Slice</button>
        <div class="row"><input id="backupPath" placeholder="Backup destination" /><button onclick="runBackup()">Backup</button></div>
        <button onclick="runMaintenance()">Run Maintenance</button>
      </div>
      <div class="hint">Mutations only run when the server was started with mutation support.</div>
    </nav>
    <section>
      <header class="topbar">
        <div><h1 id="title">Object Hierarchy</h1><div class="hint" id="subtitle">Root-first graph view with references you can follow.</div></div>
        <div class="auth" id="authPanel"><input id="authToken" type="password" placeholder="Bearer token" /><button onclick="saveAuth()">Unlock</button></div>
        <span class="status" id="status">loading</span>
      </header>
      <main class="workspace">
        <div class="workgrid">
          <div class="panel">
            <div class="panel-head"><span class="panel-title" id="listTitle">Objects</span><span class="hint" id="listHint">Select a record</span></div>
            <details class="mutation" id="editPanel">
              <summary>Advanced direct edit</summary>
              <div class="mutation-grid">
                <input id="mid" placeholder="Selected object ID" />
                <input id="mpath" placeholder="Field path, e.g. status" />
                <input id="mvalue" placeholder='New JSON value, e.g. "active"' />
                <input id="confirmToken" placeholder="Confirm token" />
              </div>
              <div class="audit-grid">
                <input id="auditActor" placeholder="Actor, e.g. ops@example.com" />
                <input id="auditReason" placeholder="Reason for change" />
                <input id="auditTraceId" placeholder="Trace ID" />
              </div>
              <div class="actions"><button onclick="preview()">Preview</button><button class="danger" onclick="mutate()">Commit Change</button></div>
            </details>
            <div class="gvql-box" id="gvqlPanel">
              <textarea id="gvqlQuery" spellcheck="false">MATCH (node)
RETURN node.$id AS objectId, node.$type AS type, node.$kind AS kind
ORDER BY node.$id ASC
LIMIT 25
OFFSET 0</textarea>
              <div class="gvql-examples" id="gvqlExamples"></div>
              <div class="gvql-parameters" id="gvqlParameterEditor"></div>
              <input id="gvqlParams" type="hidden" />
              <div class="gvql-actions">
                <input id="gvqlConfirmToken" placeholder="Confirm token" />
                <input id="gvqlAuditActor" placeholder="Actor" />
                <input id="gvqlAuditReason" placeholder="Reason" />
                <button onclick="runGvql(true)">Run / Preview</button>
                <button class="danger" onclick="runGvql(false)">Commit GVQL</button>
              </div>
            </div>
            <div class="list" id="list"></div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="panel-title">Details</span><span class="hint" id="detailHint">JSON view</span></div>
            <div id="viz"></div>
            <div class="fields" id="fields"></div>
            <pre id="out"></pre>
          </div>
        </div>
      </main>
    </section>
  </div>
  <script>
    const out = document.getElementById('out');
    const viz = document.getElementById('viz');
    const fields = document.getElementById('fields');
    const list = document.getElementById('list');
    const status = document.getElementById('status');
    const title = document.getElementById('title');
    const subtitle = document.getElementById('subtitle');
    const listTitle = document.getElementById('listTitle');
    const listHint = document.getElementById('listHint');
    const gvqlExamples = ${JSON.stringify(STUDIO_GVQL_EXAMPLES)};
    const authRequired = __AUTH_REQUIRED__;
    const authTokenInput = document.getElementById('authToken');
    const objectPageSize = 100;
    let objectPageOffset = 0;
    let hierarchyRootId = '';
    let selectedHierarchyId = '';
    const hierarchyExpanded = new Set();
    const hierarchyRecords = new Map();
    const hierarchyChildren = new Map();
    let gvqlEditorWired = false;
    const viewText = {
      hierarchy: ['Object Hierarchy', 'Root-first graph view with references you can follow.'],
      overview: ['Storage Overview', 'Health, object count, latest transaction, and current snapshot.'],
      objects: ['Objects', 'Browse graph records with type, preview, and transaction metadata.'],
      graph: ['Object Graph', 'Depth-limited graph slice for large stores and API-style inspection.'],
      gvql: ['GVQL Query', 'Run graph pattern queries and preview batch updates.'],
      operations: ['Operations', 'Storage hardening, WAL state, and recovery readiness.'],
      types: ['Type Dictionary', 'Registered runtime types and schema metadata.'],
      transactions: ['Transactions', 'Newest commits first.'],
      journal: ['Journal', 'Append-only storage activity log.'],
      verify: ['Verification', 'Integrity checks across manifest, transactions, and object records.'],
      search: ['Search', 'Matches across object paths and encoded values.']
    };
    if (authRequired) {
      document.getElementById('authPanel').style.display = 'grid';
      authTokenInput.value = sessionStorage.getItem('graphvault-admin-token') || '';
    }
    function saveAuth() {
      sessionStorage.setItem('graphvault-admin-token', authTokenInput.value);
      showOverview().then(showObjects);
    }
    function setView(name) {
      document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.view === name));
      title.textContent = viewText[name][0];
      subtitle.textContent = viewText[name][1];
      const gvqlPanel = document.getElementById('gvqlPanel');
      if (gvqlPanel) gvqlPanel.classList.toggle('active', name === 'gvql');
    }
    const setStatus = text => status.textContent = text;
    const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const show = value => {
      viz.style.display = 'none';
      viz.replaceChildren();
      fields.replaceChildren();
      out.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    };
    const apiHeaders = extra => {
      const headers = Object.assign({}, extra || {});
      const token = authRequired ? authTokenInput.value : '';
      if (token) headers.authorization = 'Bearer ' + token;
      return headers;
    };
    const requestJson = async (url, options) => {
      const response = await fetch(url, Object.assign({}, options || {}, { headers: apiHeaders(options && options.headers) }));
      const value = await response.json();
      setStatus(response.ok ? 'ready' : response.status === 401 ? 'locked' : 'error');
      show(value);
      return value;
    };
    const requestText = async url => {
      const response = await fetch(url, { headers: apiHeaders() });
      const value = await response.text();
      setStatus(response.ok ? 'ready' : response.status === 401 ? 'locked' : 'error');
      show(value);
      return value;
    };
    const apiJson = async url => {
      const response = await fetch(url, { headers: apiHeaders() });
      const value = await response.json();
      setStatus(response.ok ? 'ready' : response.status === 401 ? 'locked' : 'error');
      return value;
    };
    const postJson = (url, body) => requestJson(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    function setRows(rows, emptyText) {
      if (!rows.length) {
        const empty = document.createElement('div');
        empty.className = 'hint';
        empty.style.padding = '16px';
        empty.textContent = emptyText || 'No records';
        list.replaceChildren(empty);
        return;
      }
      list.replaceChildren(...rows.map(row => {
        const button = document.createElement('button');
        button.className = 'item';
        button.style.setProperty('--depth', row.depth || 0);
        row.columns.forEach((column, index) => {
          const span = document.createElement('span');
          span.textContent = column;
          if (index === 0) span.className = 'object-id';
          if (index === 1) span.className = 'tag';
          button.appendChild(span);
        });
        button.onclick = row.onclick;
        return button;
      }));
    }
    async function refreshKpis() {
      return apiJson('/api/summary?verify=false');
    }
    async function showHierarchy() {
      setView('hierarchy');
      listTitle.textContent = 'Object hierarchy';
      listHint.textContent = 'Expandable lazy tree';
      await refreshKpis();
      const root = await apiJson('/api/root');
      if (!root.rootObjectId) {
        setRows([], 'Primitive root value');
        show(root);
        return;
      }
      hierarchyRootId = root.rootObjectId;
      selectedHierarchyId = selectedHierarchyId || hierarchyRootId;
      hierarchyExpanded.add(hierarchyRootId);
      await ensureHierarchyNode(hierarchyRootId);
      await renderHierarchyTree();
      await selectHierarchyObject(selectedHierarchyId, 'root');
    }
    async function ensureHierarchyNode(id) {
      if (!hierarchyRecords.has(id)) {
        hierarchyRecords.set(id, await apiJson('/api/objects/' + encodeURIComponent(id)));
      }
      if (!hierarchyChildren.has(id)) {
        hierarchyChildren.set(id, await apiJson('/api/objects/' + encodeURIComponent(id) + '/children'));
      }
      return {
        record: hierarchyRecords.get(id),
        children: hierarchyChildren.get(id) || []
      };
    }
    async function selectHierarchyObject(id, label) {
      document.getElementById('graphRoot').value = id;
      selectedHierarchyId = id;
      const data = await ensureHierarchyNode(id);
      const record = data.record;
      renderEditableFields(record);
      document.getElementById('mid').value = id;
      document.getElementById('detailHint').textContent = 'Object #' + id;
      out.textContent = JSON.stringify(record, null, 2);
    }
    async function toggleHierarchyObject(id, label) {
      const data = await ensureHierarchyNode(id);
      if (data.children.length) {
        if (hierarchyExpanded.has(id)) hierarchyExpanded.delete(id);
        else hierarchyExpanded.add(id);
      }
      await selectHierarchyObject(id, label);
      await renderHierarchyTree();
    }
    async function renderHierarchyTree() {
      if (!hierarchyRootId) return;
      const rows = [];
      await appendHierarchyRows(rows, hierarchyRootId, 'root', 0, []);
      setRows(rows, 'No children');
    }
    async function appendHierarchyRows(rows, id, label, depth, path) {
      const data = await ensureHierarchyNode(id);
      const record = data.record;
      const children = data.children;
      const isExpanded = hierarchyExpanded.has(id);
      const marker = children.length ? (isExpanded ? '[-] ' : '[+] ') : '    ';
      rows.push({
        depth,
        columns: [marker + '#' + record.objectId, record.node.type || record.node.kind, label + ' -> ' + summarizeRecord(record), id === selectedHierarchyId ? 'selected' : children.length + ' children'],
        onclick: () => toggleHierarchyObject(id, label)
      });
      if (!isExpanded) return;
      const nextPath = path.concat(id);
      for (const child of children) {
        if (nextPath.includes(child.to)) {
          rows.push({
            depth: depth + 1,
            columns: ['[ref] #' + child.to, child.type || child.kind, child.path + ' -> cycle/shared reference', 'linked'],
            onclick: () => selectHierarchyObject(child.to, child.path)
          });
        } else {
          await appendHierarchyRows(rows, child.to, child.path, depth + 1, nextPath);
        }
      }
    }
    async function showObjectInHierarchyPath(id) {
      document.getElementById('graphRoot').value = id;
      setView('hierarchy');
      listTitle.textContent = 'Object hierarchy';
      listHint.textContent = 'Search context';
      await refreshKpis();
      const path = await apiJson('/api/objects/' + encodeURIComponent(id) + '/path');
      const record = await apiJson('/api/objects/' + encodeURIComponent(id));
      renderEditableFields(record);
      document.getElementById('mid').value = id;
      document.getElementById('detailHint').textContent = 'Object #' + id;
      out.textContent = JSON.stringify(record, null, 2);
      if (!path.found) {
        setRows([{ depth: 0, columns: ['#' + id, record.node.type || record.node.kind, 'unreachable from root -> ' + summarizeRecord(record), 'current'], onclick: () => showObject(id) }], 'No path from root');
        return;
      }
      const children = await apiJson('/api/objects/' + encodeURIComponent(id) + '/children');
      const pathParentIds = new Set(path.items.slice(0, -1).map(item => item.objectId));
      const alternateParents = path.directParents.filter(parent => !pathParentIds.has(parent.objectId));
      const rows = path.items.map((item, index) => ({
        depth: index,
        columns: ['#' + item.objectId, item.type || item.kind, item.label + ' -> ' + item.preview, index === path.items.length - 1 ? 'current' : 'parent'],
        onclick: () => showObjectInHierarchyPath(item.objectId)
      })).concat(alternateParents.map(parent => ({
        depth: Math.max(0, path.items.length - 1),
        columns: ['#' + parent.objectId, parent.type || parent.kind, parent.path + ' -> alternate direct parent: ' + parent.preview, 'parent'],
        onclick: () => showObjectInHierarchyPath(parent.objectId)
      }))).concat(children.map(child => ({
        depth: path.items.length,
        columns: ['#' + child.to, child.type || child.kind, child.path + ' -> ' + child.preview, 'open'],
        onclick: () => showObjectInHierarchyPath(child.to)
      })));
      setRows(rows, 'No children');
    }
    function summarizeRecord(record) {
      if (record.node.kind === 'object') {
        return Object.entries(record.node.props).slice(0, 4).map(([key, value]) => key + ': ' + displayValue(value)).join(', ');
      }
      if (record.node.kind === 'array' || record.node.kind === 'set') return record.node.kind + '(' + record.node.items.length + ')';
      if (record.node.kind === 'map') return 'map(' + record.node.entries.length + ')';
      return record.node.kind;
    }
    function displayValue(value) {
      if (value && typeof value === 'object' && '$ref' in value) return '#' + value.$ref;
      if (value && typeof value === 'object' && '$type' in value) return value.value || value.$type;
      return String(value);
    }
    async function showOverview() {
      setView('overview');
      listTitle.textContent = 'Latest transaction';
      listHint.textContent = 'Overview';
      const summary = await refreshKpis();
      show(summary);
      const rows = [];
      if (summary.operations) {
        rows.push({ columns: [summary.operations.status, 'operations', summary.operations.pendingWalCommits + ' pending WAL commits', summary.operations.walCommitFiles + ' WAL commits'], onclick: () => show(summary.operations) });
      }
      if (summary.productionSafety) {
        rows.push({ columns: [summary.productionSafety.status, 'production safety', summary.productionSafety.score + ' score', summary.productionSafety.issues.length + ' issues'], onclick: () => show(summary.productionSafety) });
      }
      if (summary.library) {
        rows.push({ columns: [summary.library.installedVersion || '-', 'library', 'recommended ' + summary.library.recommendedVersion, summary.library.status], onclick: () => show(summary.library) });
      }
      if (summary.latestTransaction) {
        rows.push({ columns: ['#' + summary.latestTransaction.transactionId, summary.latestTransaction.mode, summary.latestTransaction.snapshotFile, summary.latestTransaction.objectIds.length + ' ids'], onclick: () => show(summary.latestTransaction) });
      }
      setRows(rows, 'No transactions yet');
    }
    async function showObjects() {
      setView('objects');
      listTitle.textContent = 'Persisted objects';
      listHint.textContent = 'Click to inspect';
      const page = await requestJson('/api/object-page?offset=' + objectPageOffset + '&limit=' + objectPageSize);
      setRows(page.items.map(o => ({ columns: ['#' + o.objectId, o.type || o.kind, o.preview || '-', 'tx ' + o.transactionId], onclick: () => showObject(o.objectId) })), 'No objects found');
      renderPager(page);
    }
    function renderPager(page) {
      const pager = document.createElement('div');
      pager.className = 'pager';
      const label = document.createElement('span');
      label.className = 'hint';
      label.textContent = 'Showing ' + (page.offset + 1) + '-' + Math.min(page.total, page.offset + page.items.length) + ' of ' + page.total;
      const controls = document.createElement('div');
      controls.className = 'actions';
      const prev = document.createElement('button');
      prev.textContent = 'Previous';
      prev.disabled = page.offset === 0;
      prev.onclick = () => { objectPageOffset = Math.max(0, objectPageOffset - objectPageSize); return showObjects(); };
      const next = document.createElement('button');
      next.textContent = 'Next';
      next.disabled = page.offset + page.items.length >= page.total;
      next.onclick = () => { objectPageOffset += objectPageSize; return showObjects(); };
      controls.append(prev, next);
      pager.append(label, controls);
      list.appendChild(pager);
    }
    async function showObject(id) {
      document.getElementById('graphRoot').value = id;
      document.getElementById('mid').value = id;
      document.getElementById('detailHint').textContent = 'Object #' + id;
      const record = await requestJson('/api/objects/' + encodeURIComponent(id));
      renderEditableFields(record);
      out.textContent = JSON.stringify(record, null, 2);
    }
    function renderEditableFields(record) {
      fields.replaceChildren();
      const rows = editableFieldRows(record);
      const head = document.createElement('div');
      head.className = 'fields-head';
      const title = document.createElement('div');
      title.className = 'hint';
      title.textContent = rows.length ? 'Editable fields' : 'No direct primitive fields on this record';
      head.appendChild(title);
      if (confirmRequired && rows.some(row => isEditableValue(row.value))) {
        const token = document.createElement('input');
        token.id = 'fieldConfirmToken';
        token.placeholder = 'Confirm token for saving';
        token.value = document.getElementById('confirmToken').value;
        token.oninput = () => (document.getElementById('confirmToken').value = token.value);
        head.appendChild(token);
      }
      fields.appendChild(head);
      rows.forEach(field => fields.appendChild(createFieldRow(record.objectId, field)));
    }
    function editableFieldRows(record) {
      const node = record.node;
      if (node.kind === 'object') {
        return Object.entries(node.props).map(([path, value]) => ({ path, value }));
      }
      if (node.kind === 'array' || node.kind === 'set') {
        return node.items.map((value, index) => ({ path: '[' + index + ']', value }));
      }
      if (node.kind === 'map') {
        return node.entries.flatMap((entry, index) => [
          { path: 'entries[' + index + '].key', value: entry[0] },
          { path: 'entries[' + index + '].value', value: entry[1] }
        ]);
      }
      return [];
    }
    function createFieldRow(objectId, field) {
      const row = document.createElement('div');
      row.className = 'field-row';
      const name = document.createElement('div');
      name.className = 'field-name';
      name.textContent = field.path;
      row.appendChild(name);
      const editor = createFieldEditor(field.value);
      if (!editor.editable && editor.ref) {
        editor.element.onclick = () => showObjectInHierarchyPath(editor.ref);
      }
      row.appendChild(editor.element);
      const kind = document.createElement('div');
      kind.className = 'field-kind';
      kind.textContent = editor.kind;
      row.appendChild(kind);
      const save = document.createElement('button');
      const actions = document.createElement('div');
      actions.className = 'field-actions';
      save.textContent = editor.editable ? 'Preview' : 'Open';
      save.onclick = () => {
        if (!editor.editable && editor.ref) return showObjectInHierarchyPath(editor.ref);
        fillMutation(objectId, field.path, editor.read());
        return preview();
      };
      actions.appendChild(save);
      if (editor.editable) {
        const commit = document.createElement('button');
        commit.className = 'primary';
        commit.textContent = 'Save';
        commit.onclick = () => {
          const token = document.getElementById('fieldConfirmToken');
          if (token) document.getElementById('confirmToken').value = token.value;
          fillMutation(objectId, field.path, editor.read());
          return mutate();
        };
        actions.appendChild(commit);
      }
      row.appendChild(actions);
      return row;
    }
    function isEditableValue(value) {
      return !(value && typeof value === 'object' && '$ref' in value);
    }
    function createFieldEditor(value) {
      if (value && typeof value === 'object' && '$ref' in value) {
        const button = document.createElement('button');
        button.className = 'field-ref';
        button.textContent = 'Open object #' + value.$ref;
        return { element: button, kind: 'reference', editable: false, ref: value.$ref };
      }
      if (value && typeof value === 'object' && '$type' in value) {
        const input = document.createElement('input');
        input.value = typedValueToInput(value);
        const editable = value.$type === 'date' || value.$type === 'bigint' || value.$type === 'undefined';
        if (!editable) input.disabled = true;
        return { element: input, kind: value.$type, editable, read: () => typedInputToJson(value.$type, input.value) };
      }
      if (typeof value === 'boolean') {
        const select = document.createElement('select');
        ['true', 'false'].forEach(optionValue => {
          const option = document.createElement('option');
          option.value = optionValue;
          option.textContent = optionValue;
          select.appendChild(option);
        });
        select.value = String(value);
        return { element: select, kind: 'boolean', editable: true, read: () => select.value === 'true' ? 'true' : 'false' };
      }
      const input = document.createElement('input');
      input.value = value === null ? 'null' : String(value);
      return { element: input, kind: value === null ? 'null' : typeof value, editable: true, read: () => primitiveInputToJson(value, input.value) };
    }
    function typedValueToInput(value) {
      if (value.$type === 'undefined') return 'undefined';
      return value.value || '';
    }
    function typedInputToJson(type, value) {
      if (type === 'undefined') return 'undefined';
      if (type === 'bigint') return value;
      return JSON.stringify(value);
    }
    function primitiveInputToJson(original, value) {
      if (original === null) return value === 'null' ? 'null' : JSON.stringify(value);
      if (typeof original === 'number') return String(Number(value));
      if (typeof original === 'boolean') return value === 'true' ? 'true' : 'false';
      return JSON.stringify(value);
    }
    function fillMutation(objectId, path, jsonValue) {
      document.getElementById('mid').value = objectId;
      document.getElementById('mpath').value = path;
      document.getElementById('mvalue').value = jsonValue;
      document.getElementById('editPanel').open = true;
    }
    async function showGraph() {
      setView('graph');
      listTitle.textContent = 'Graph slice';
      const depth = graphDepth();
      const rootObjectId = document.getElementById('graphRoot').value.trim();
      listHint.textContent = (rootObjectId ? 'Root #' + rootObjectId : 'Store root') + ', depth ' + depth;
      const graph = await requestJson(graphSubtreeUrl(rootObjectId, depth));
      renderGraph(graph);
      const rows = [
        {
          columns: [graph.complete ? 'complete' : 'partial', 'subtree', graph.objectIds.length + ' objects', graph.truncatedReferences.length + ' boundary refs'],
          onclick: () => show(graph)
        },
        ...graph.nodes.map(node => ({
          columns: ['#' + node.objectId, node.type || node.kind, node.objectId === graph.rootObjectId ? 'subtree root' : 'loaded node', 'node'],
          onclick: () => showObject(node.objectId)
        })),
        ...graph.edges.map(e => ({
          columns: [e.from + ' -> ' + e.to, 'edge', e.path, 'loaded'],
          onclick: () => showObject(e.to)
        })),
        ...(graph.truncatedReferences || []).map(ref => ({
          columns: [ref.fromObjectId + ' -> ' + ref.toObjectId, 'boundary', ref.path, 'depth ' + ref.depth],
          onclick: () => showObjectInHierarchyPath(ref.toObjectId)
        }))
      ];
      setRows(rows, 'No graph objects found');
    }
    function graphDepth() {
      const value = Number.parseInt(document.getElementById('graphDepth').value || '2', 10);
      return Number.isInteger(value) && value >= 0 ? Math.min(value, 12) : 2;
    }
    function graphSubtreeUrl(rootObjectId, depth) {
      const query = '?depth=' + encodeURIComponent(String(depth));
      return rootObjectId ? '/api/objects/' + encodeURIComponent(rootObjectId) + '/subtree' + query : '/api/subtree' + query;
    }
    function renderGraph(graph) {
      const width = 900;
      const height = 320;
      const radius = Math.max(80, Math.min(135, 40 + graph.nodes.length * 4));
      const cx = width / 2;
      const cy = height / 2;
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      const positions = new Map(graph.nodes.map((node, index) => {
        const angle = graph.nodes.length === 1 ? 0 : (Math.PI * 2 * index) / graph.nodes.length - Math.PI / 2;
        return [node.objectId, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }];
      }));
      graph.edges.forEach(edge => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('stroke', '#9bb3ba');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
      });
      graph.nodes.forEach(node => {
        const pos = positions.get(node.objectId);
        if (!pos) return;
        const group = document.createElementNS(ns, 'g');
        group.style.cursor = 'pointer';
        group.onclick = () => showObject(node.objectId);
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '26');
        circle.setAttribute('fill', node.objectId === graph.rootObjectId ? '#f3c969' : '#d9f1ef');
        circle.setAttribute('stroke', node.objectId === graph.rootObjectId ? '#ab7622' : '#0f8b8d');
        circle.setAttribute('stroke-width', '2');
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', pos.x);
        label.setAttribute('y', pos.y + 4);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-weight', '600');
        label.textContent = '#' + node.objectId;
        group.append(circle, label);
        svg.appendChild(group);
      });
      viz.replaceChildren(svg);
      viz.style.display = 'block';
    }
    const showTypes = async () => { setView('types'); listTitle.textContent = 'Types'; listHint.textContent = 'Dictionary'; const value = await requestJson('/api/types'); setRows((value && value.entries || []).map(e => ({ columns: [String(e.id || '-'), e.name || 'type', e.handler || e.name || '-', 'type'], onclick: () => show(e) })), 'No type dictionary found'); };
    const showTransactions = async () => { setView('transactions'); listTitle.textContent = 'Transactions'; listHint.textContent = 'Newest first'; const rows = await requestJson('/api/transactions'); setRows(rows.map(t => ({ columns: ['#' + t.transactionId, t.mode, t.snapshotFile, t.objectIds.length + ' ids'], onclick: () => show(t) })), 'No transactions found'); };
    const showOperations = async () => {
      setView('operations');
      listTitle.textContent = 'Storage operations';
      listHint.textContent = 'WAL, hardening, and production safety';
      const summary = await requestJson('/api/summary?verify=false');
      const ops = summary.operations || {};
      const safety = summary.productionSafety || {};
      setRows([
        { columns: [safety.status || '-', 'production safety', typeof safety.score === 'number' ? safety.score + ' score' : '-', (safety.issues || []).length + ' issues'], onclick: () => show(safety) },
        { columns: [ops.status, 'health', ops.pendingWalCommits + ' pending WAL commits', ops.latestWalTransactionId ? 'wal tx ' + ops.latestWalTransactionId : 'no wal'], onclick: () => show(ops) },
        { columns: [ops.transactionLog, 'wal', ops.walPrepareFiles + ' prepares', ops.walCommitFiles + ' commits'], onclick: () => show(ops) },
        { columns: [String(ops.checkedIntegrityHashes || 0), 'integrity hashes', 'transaction chain', ops.checkedIntegrityHashes ? 'present' : 'not recorded'], onclick: () => show(ops) },
        { columns: [ops.mutationsAllowed ? 'enabled' : 'disabled', 'mutations', 'lock timeout ' + ops.lockTimeoutMs + 'ms', ops.staleLockTimeoutMs ? 'stale ' + ops.staleLockTimeoutMs + 'ms' : 'no stale recovery'], onclick: () => show(ops) },
        { columns: ['#' + ops.publishedTransactionId, 'published', ops.latestJournalTransactionId ? 'journal tx ' + ops.latestJournalTransactionId : 'no journal', 'manifest'], onclick: () => show(ops) }
      ], 'No operations status');
      return ops;
    };
    const showJournal = async () => {
      setView('journal');
      listTitle.textContent = 'Journal';
      listHint.textContent = 'Raw log';
      setRows([], 'Journal entries are shown in the detail pane');
      return requestText('/api/journal');
    };
    const showVerify = async () => {
      setView('verify');
      listTitle.textContent = 'Verification';
      listHint.textContent = 'Integrity';
      const result = await requestJson('/api/verify');
      setRows([
        { columns: [result.ok ? 'OK' : 'FAIL', 'health', result.errors.length ? result.errors.join('; ') : 'No errors', result.checkedObjects + ' objects'], onclick: () => show(result) },
        { columns: [String(result.checkedIntegrityHashes || 0), 'integrity hashes', result.checkedWalRecords + ' WAL checks', result.pendingWalCommits + ' pending WAL'], onclick: () => show(result) }
      ], 'Verification has not run');
      return result;
    };
    const runMaintenance = () => postJson('/api/maintenance', { keepSnapshots: 2 });
    const runBackup = () => postJson('/api/backup', { storageDirectory: document.getElementById('backupPath').value });
    async function showGvql() {
      setView('gvql');
      listTitle.textContent = 'GVQL results';
      listHint.textContent = 'MATCH / WHERE / RETURN / GROUP BY / HAVING / SET';
      document.getElementById('gvqlPanel').classList.add('active');
      wireGvqlEditor();
      renderGvqlExamples();
      renderGvqlParameterEditor();
      setRows([], 'Run a GVQL query');
      show({
        examples: gvqlExamples.map(example => ({ name: example.name, query: example.query, parameters: example.parameters || {} }))
      });
    }
    function wireGvqlEditor() {
      if (gvqlEditorWired) return;
      document.getElementById('gvqlQuery').addEventListener('input', () => renderGvqlParameterEditor(readGvqlParametersFromHidden()));
      gvqlEditorWired = true;
    }
    function renderGvqlExamples() {
      const target = document.getElementById('gvqlExamples');
      if (target.dataset.rendered === 'true') return;
      target.replaceChildren(...gvqlExamples.map((example, index) => {
        const button = document.createElement('button');
        button.className = 'gvql-example';
        button.type = 'button';
        button.textContent = example.name;
        button.onclick = () => applyGvqlExample(index);
        return button;
      }));
      target.dataset.rendered = 'true';
    }
    function applyGvqlExample(index) {
      const example = gvqlExamples[index];
      document.getElementById('gvqlQuery').value = example.query;
      document.getElementById('gvqlParams').value = example.parameters ? JSON.stringify(example.parameters) : '';
      renderGvqlParameterEditor(example.parameters || {});
      setRows([], 'Run a GVQL query');
      show({ selectedExample: example.name, query: example.query, parameters: example.parameters || {} });
    }
    function renderGvqlParameterEditor(seed) {
      const target = document.getElementById('gvqlParameterEditor');
      const names = extractGvqlParameterNames(document.getElementById('gvqlQuery').value);
      const values = Object.assign({}, readGvqlParametersFromHidden(), seed || {});
      if (!names.length) {
        document.getElementById('gvqlParams').value = '{}';
        const empty = document.createElement('div');
        empty.className = 'gvql-param-empty';
        empty.textContent = 'No query parameters';
        target.replaceChildren(empty);
        return;
      }
      target.replaceChildren(...names.map(name => {
        const row = document.createElement('div');
        row.className = 'gvql-parameter-row';
        row.dataset.name = name;
        const label = document.createElement('span');
        label.className = 'gvql-param-name';
        label.textContent = '$' + name;
        const input = document.createElement('input');
        input.placeholder = 'Value';
        const type = document.createElement('select');
        ['string', 'number', 'boolean', 'null', 'json'].forEach(kind => {
          const option = document.createElement('option');
          option.value = kind;
          option.textContent = kind;
          type.appendChild(option);
        });
        type.value = inferGvqlParameterType(values[name]);
        input.value = formatGvqlParameterInput(values[name], type.value);
        input.disabled = type.value === 'null';
        input.oninput = syncGvqlParameters;
        type.onchange = () => {
          input.disabled = type.value === 'null';
          if (type.value === 'null') input.value = '';
          syncGvqlParameters();
        };
        row.append(label, input, type);
        return row;
      }));
      syncGvqlParameters();
    }
    function extractGvqlParameterNames(query) {
      const names = [];
      const seen = new Set();
      let quote = '';
      for (let index = 0; index < query.length; index += 1) {
        const char = query[index];
        if (quote) {
          if (char === '\\\\') index += 1;
          else if (char === quote) quote = '';
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char !== '$' || query[index - 1] === '.') continue;
        const match = query.slice(index + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);
        if (!match || seen.has(match[0])) continue;
        seen.add(match[0]);
        names.push(match[0]);
        index += match[0].length;
      }
      return names;
    }
    function readGvqlParametersFromHidden() {
      try {
        return JSON.parse(document.getElementById('gvqlParams').value || '{}');
      } catch (_error) {
        return {};
      }
    }
    function syncGvqlParameters() {
      try {
        document.getElementById('gvqlParams').value = JSON.stringify(readGvqlParametersFromEditor());
      } catch (_error) {
        return;
      }
    }
    function readGvqlParametersFromEditor() {
      const parameters = {};
      document.querySelectorAll('.gvql-parameter-row').forEach(row => {
        const name = row.dataset.name;
        const input = row.querySelector('input');
        const type = row.querySelector('select').value;
        parameters[name] = parseGvqlParameterInput(input.value, type, name);
      });
      return parameters;
    }
    function parseGvqlParameterInput(value, type, name) {
      if (type === 'string') return value;
      if (type === 'number') {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error('$' + name + ' must be a finite number');
        return number;
      }
      if (type === 'boolean') {
        if (value === 'true') return true;
        if (value === 'false') return false;
        throw new Error('$' + name + ' must be true or false');
      }
      if (type === 'null') return null;
      try {
        return JSON.parse(value);
      } catch (_error) {
        throw new Error('$' + name + ' must contain valid JSON');
      }
    }
    function inferGvqlParameterType(value) {
      if (value === null) return 'null';
      if (typeof value === 'number') return 'number';
      if (typeof value === 'boolean') return 'boolean';
      if (typeof value === 'object' && typeof value !== 'undefined') return 'json';
      return 'string';
    }
    function formatGvqlParameterInput(value, type) {
      if (typeof value === 'undefined' || value === null) return '';
      return type === 'json' ? JSON.stringify(value) : String(value);
    }
    async function runGvql(dryRun) {
      setView('gvql');
      document.getElementById('gvqlPanel').classList.add('active');
      let parameters;
      try {
        parameters = readGvqlParametersFromEditor();
        document.getElementById('gvqlParams').value = JSON.stringify(parameters);
      } catch (error) {
        setStatus('error');
        setRows([], error.message || 'Invalid GVQL parameters');
        show({ error: error.message || String(error) });
        return;
      }
      const payload = {
        query: document.getElementById('gvqlQuery').value,
        parameters,
        dryRun
      };
      if (!dryRun && confirmRequired) payload.confirmToken = document.getElementById('gvqlConfirmToken').value;
      if (!dryRun) payload.metadata = readAuditMetadata('gvql');
      const result = await postJson('/api/gvql', payload);
      const rows = [];
      if (result.plan) {
        rows.push({
          columns: ['plan', result.plan.candidateSource || 'scan', summarizeGvqlPlan(result.plan), result.plan.indexUsed ? 'indexed' : 'scan'],
          onclick: () => show({ plan: result.plan, statement: result.statement })
        });
      }
      rows.push(...(result.rows || []).map((row, index) => ({
        columns: [String(index + 1), result.kind || 'row', summarizeGvqlRow(row), result.dryRun ? 'preview' : 'result'],
        onclick: () => show(row)
      })));
      if (result.kind === 'update' && result.changes) {
        rows.push(...result.changes.slice(0, 200).map(change => ({
          columns: ['#' + change.objectId, change.operation || 'change', summarizeGvqlChange(change), result.dryRun ? 'preview' : 'changed'],
          onclick: () => show(change)
        })));
      }
      setRows(rows, 'No GVQL results');
      await refreshKpis();
    }
    function summarizeGvqlRow(row) {
      return Object.entries(row).map(([key, value]) => key + ': ' + (typeof value === 'object' ? JSON.stringify(value) : String(value))).join(', ').slice(0, 220);
    }
    function summarizeGvqlChange(change) {
      const path = change.path || '(object)';
      return (path + ': ' + summarizeGvqlValue(change.before) + ' -> ' + summarizeGvqlValue(change.after)).slice(0, 220);
    }
    function summarizeGvqlValue(value) {
      if (typeof value === 'undefined') return 'undefined';
      if (value === null) return 'null';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }
    function summarizeGvqlPlan(plan) {
      return [
        plan.startCandidates + ' candidates',
        plan.filteredBindings + ' matched',
        plan.returnedRows + ' rows',
        (plan.operations || []).join(' -> ')
      ].filter(Boolean).join(' | ').slice(0, 220);
    }
    async function showSearch() {
      setView('search');
      listTitle.textContent = 'Search results';
      listHint.textContent = 'Path and value matches';
      const rows = await requestJson('/api/search?q=' + encodeURIComponent(document.getElementById('q').value));
      setRows(rows.map(r => ({ columns: ['#' + r.objectId, 'match', r.path + ' = ' + r.preview, 'context'], onclick: () => showObjectInHierarchyPath(r.objectId) })), 'No matches');
    }
    const confirmRequired = __CONFIRM_REQUIRED__;
    if (!confirmRequired) document.getElementById('confirmToken').style.display = 'none';
    if (!confirmRequired) document.getElementById('gvqlConfirmToken').style.display = 'none';
    function readAuditMetadata(prefix) {
      const actor = document.getElementById(prefix === 'gvql' ? 'gvqlAuditActor' : 'auditActor')?.value.trim();
      const reason = document.getElementById(prefix === 'gvql' ? 'gvqlAuditReason' : 'auditReason')?.value.trim();
      const traceId = prefix === 'gvql' ? '' : document.getElementById('auditTraceId')?.value.trim();
      const metadata = { source: prefix === 'gvql' ? 'graphvault-studio:gvql' : 'graphvault-studio:direct-edit' };
      if (actor) metadata.actor = actor;
      if (reason) metadata.reason = reason;
      if (traceId) metadata.traceId = traceId;
      return metadata;
    }
    function mutationPayload(includeConfirm) {
      const payload = { objectId: document.getElementById('mid').value, path: document.getElementById('mpath').value, value: JSON.parse(document.getElementById('mvalue').value), metadata: readAuditMetadata('direct') };
      if (includeConfirm) payload.confirmToken = document.getElementById('confirmToken').value;
      return payload;
    }
    const preview = () => postJson('/api/preview-mutation', mutationPayload(false));
    const mutate = () => postJson('/api/mutate', mutationPayload(confirmRequired)).then(refreshKpis);
    showHierarchy();
  </script>
</body>
</html>`;
