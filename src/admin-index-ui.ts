export const ADMIN_INDEX_STYLE = `
    .index-workbench { display: grid; gap: 12px; padding: 12px; background: #f6f9fa; border-bottom: 1px solid var(--line); }
    .index-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 16px; border: 1px solid #c7d8dc; border-radius: 10px; background: linear-gradient(135deg, #10232b 0%, #173943 56%, #0f6768 100%); color: #f4fbfb; }
    .index-hero h2 { margin: 0 0 5px; font-size: 20px; font-weight: 600; letter-spacing: 0; }
    .index-hero p { margin: 0; max-width: 780px; color: #b9d3d7; line-height: 1.45; }
    .index-pill { display: inline-flex; align-items: center; gap: 7px; width: max-content; padding: 7px 10px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); color: #e8fbfb; font-size: 12px; font-weight: 600; }
    .index-pulse { width: 8px; height: 8px; border-radius: 999px; background: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,.18); }
    .index-pulse.warn { background: #f5c451; box-shadow: 0 0 0 4px rgba(245,196,81,.18); }
    .index-pulse.off { background: #a8b5ba; box-shadow: none; }
    .index-stat-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
    .index-stat { padding: 11px; border: 1px solid var(--line); border-radius: 9px; background: #fff; box-shadow: 0 8px 18px rgba(15,35,45,.04); }
    .index-stat strong { display: block; font-size: 18px; font-weight: 600; color: #102f38; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .index-stat span { color: var(--muted); font-size: 12px; }
    .index-config { display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 12px; }
    .index-control-panel, .index-family-grid, .index-candidates { border: 1px solid var(--line); border-radius: 10px; background: #fff; }
    .index-control-panel { display: grid; gap: 10px; align-content: start; padding: 12px; }
    .index-control-panel h3, .index-family h3, .index-candidates h3 { margin: 0; font-size: 14px; font-weight: 600; color: #102f38; }
    .index-family-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; overflow: hidden; }
    .index-family { display: grid; gap: 8px; padding: 12px; min-width: 0; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .index-family:nth-child(2n) { border-right: 0; }
    .index-family textarea { min-height: 88px; font-family: "SFMono-Regular", "Cascadia Code", "Roboto Mono", ui-monospace, monospace; font-size: 12px; line-height: 1.42; }
    .index-family .hint { line-height: 1.35; }
    .index-candidates { display: grid; gap: 8px; padding: 12px; }
    .index-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .index-chip { padding: 6px 8px; color: #0d6264; background: #eef7f6; border-color: #c1dfdb; font-size: 12px; }
    .index-actions { display: grid; gap: 8px; }
    .index-actions .danger { background: #bf4342; border-color: #bf4342; color: #fff; }
    .index-actions .ghost { background: #f8fbfb; }
    .index-definition { display: grid; grid-template-columns: minmax(80px, 130px) minmax(80px, 130px) minmax(0, 1fr) minmax(70px, 100px); gap: 10px; }
    @media (max-width: 1180px) {
      .index-stat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .index-config { grid-template-columns: 1fr; }
    }
    @media (max-width: 760px) {
      .index-hero, .index-family-grid, .index-stat-grid { grid-template-columns: 1fr; }
      .index-family { border-right: 0; }
    }
`;

export const ADMIN_INDEX_SCRIPT = `
    async function showIndexes() {
      setView('indexes');
      listTitle.textContent = 'Index workbench';
      listHint.textContent = 'Persistent graph, property, and advanced indexes';
      const details = await requestJson('/api/indexes');
      renderIndexAdmin(details);
      renderIndexRows(details);
      return details;
    }
    function renderIndexAdmin(details) {
      viz.style.display = 'none';
      fields.replaceChildren();
      const panel = document.createElement('div');
      panel.className = 'index-workbench';
      panel.append(renderIndexHero(details), renderIndexStats(details), renderIndexConfig(details), renderIndexCandidates(details));
      fields.appendChild(panel);
    }
    function renderIndexHero(details) {
      const hero = document.createElement('div');
      hero.className = 'index-hero';
      const copy = document.createElement('div');
      const title = document.createElement('h2');
      title.textContent = indexHeroTitle(details.status.source);
      const text = document.createElement('p');
      text.textContent = 'Manage the persistent index sidecar used by GVQL and Studio: graph edges, property lookups, composites, range indexes, substring search, full-text terms, unique constraints, and expression indexes.';
      copy.append(title, text);
      const pill = document.createElement('div');
      pill.className = 'index-pill';
      const pulse = document.createElement('span');
      pulse.className = 'index-pulse ' + (details.status.source === 'storage' ? '' : details.status.source === 'disabled' ? 'off' : 'warn');
      const label = document.createElement('span');
      label.textContent = details.status.source + ' / tx ' + (details.status.transactionId || '-');
      pill.append(pulse, label);
      hero.append(copy, pill);
      return hero;
    }
    function renderIndexStats(details) {
      const stats = document.createElement('div');
      stats.className = 'index-stat-grid';
      [
        [details.status.nodeCount, 'Indexed nodes'],
        [details.status.propertyKeys, 'Property keys'],
        [details.status.edgeCount, 'Reference edges'],
        [details.status.advancedIndexes || 0, 'Advanced indexes'],
        [details.status.textTerms || 0, 'Substring terms'],
        [details.status.uniqueKeys || 0, 'Unique keys']
      ].forEach(([value, label]) => stats.appendChild(indexStat(value, label)));
      return stats;
    }
    function renderIndexConfig(details) {
      const wrap = document.createElement('div');
      wrap.className = 'index-config';
      const controls = document.createElement('div');
      controls.className = 'index-control-panel';
      const title = document.createElement('h3');
      title.textContent = 'Index policy';
      const mode = indexField('Mode', indexSelect('indexMode', ['auto', 'configured', 'off'], details.configured.mode));
      const consistency = indexField('Consistency', indexSelect('indexConsistency', ['strict', 'committed'], details.configured.consistency));
      const actions = document.createElement('div');
      actions.className = 'index-actions';
      const rebuild = document.createElement('button');
      rebuild.className = 'primary';
      rebuild.textContent = 'Rebuild persistent index';
      rebuild.onclick = runIndexRebuild;
      const disable = document.createElement('button');
      disable.className = 'danger';
      disable.textContent = 'Disable indexes';
      disable.onclick = runIndexDisable;
      const refresh = document.createElement('button');
      refresh.className = 'ghost';
      refresh.textContent = 'Refresh status';
      refresh.onclick = showIndexes;
      actions.append(rebuild, disable, refresh);
      controls.append(title, mode, consistency, actions);
      const families = document.createElement('div');
      families.className = 'index-family-grid';
      families.append(
        indexFamily('Properties', 'Fast equality and IN lookups. One path per line, optionally Type.path.', 'indexProperties', formatPathList(details.configured.properties)),
        indexFamily('Composite', 'Multi-field lookups. Example: Case.status + priority', 'indexComposites', formatCompositeList(details.configured.advanced.composites)),
        indexFamily('Range', 'Numeric/date sorting and comparisons. One path per line.', 'indexRanges', formatPathList(details.configured.advanced.ranges)),
        indexFamily('Substring text', 'n-gram search for CONTAINS. Example: Document.title min=2 max=4', 'indexText', formatTextList(details.configured.advanced.text)),
        indexFamily('Full-text', 'Token-based word search. One text path per line.', 'indexFullText', formatPathList(details.configured.advanced.fullText)),
        indexFamily('Unique', 'Uniqueness checks. Use one path or path + path for composite unique keys.', 'indexUnique', formatUniqueList(details.configured.advanced.unique)),
        indexFamily('Expression', 'Derived keys. Example: lower(Customer.email)', 'indexExpressions', formatExpressionList(details.configured.advanced.expressions))
      );
      wrap.append(controls, families);
      return wrap;
    }
    function renderIndexCandidates(details) {
      const candidates = document.createElement('div');
      candidates.className = 'index-candidates';
      const title = document.createElement('h3');
      title.textContent = 'Useful candidates from current data';
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = 'Click a discovered property to add it to the property index list, then rebuild.';
      const chips = document.createElement('div');
      chips.className = 'index-chip-row';
      details.topProperties.slice(0, 18).forEach(property => {
        const chip = document.createElement('button');
        chip.className = 'index-chip';
        const target = property.type && property.type !== '*' ? property.type + '.' + property.path : property.path;
        chip.textContent = target + ' (' + property.count + ')';
        chip.onclick = () => addIndexLine('indexProperties', target);
        chips.appendChild(chip);
      });
      if (!chips.children.length) {
        const empty = document.createElement('div');
        empty.className = 'hint';
        empty.textContent = 'No property candidates yet. Rebuild in auto mode to discover data shape.';
        chips.appendChild(empty);
      }
      candidates.append(title, hint, chips);
      return candidates;
    }
    function renderIndexRows(details) {
      const rows = [
        {
          columns: [details.status.source, details.status.mode, details.status.consistency, details.status.enabled ? 'enabled' : 'disabled'],
          onclick: () => show(details.status)
        },
        ...(details.record ? [{
          columns: ['tx ' + details.record.transactionId, details.record.mode, details.record.createdAt, details.record.advancedDefinitions + ' advanced'],
          onclick: () => show(details.record)
        }] : []),
        ...details.advancedDefinitions.map(definition => ({
          columns: [definition.name, definition.kind, definition.target, definition.keys + ' keys'],
          onclick: () => show(definition)
        })),
        ...details.advancedStatistics.map(stat => ({
          columns: [stat.name, 'statistics', stat.entries + ' entries', 'selectivity ' + stat.selectivity.toFixed(3)],
          onclick: () => show(stat)
        })),
        ...details.topTypes.map(type => ({
          columns: [type.type, 'type-index', type.count + ' objects', 'type'],
          onclick: () => show(type)
        })),
        ...details.topProperties.map(property => ({
          columns: [property.path, property.type, property.count + ' objects', property.value],
          onclick: () => show(property)
        })),
        ...details.topOutgoing.map(edge => ({
          columns: ['#' + edge.objectId, 'outgoing', edge.edgeCount + ' refs', 'edges'],
          onclick: () => show(edge)
        }))
      ];
      setRows(rows, 'No persistent index found yet');
    }
    function indexHeroTitle(source) {
      if (source === 'storage') return 'Index is fresh and query-ready';
      if (source === 'stale') return 'Index exists but is stale';
      if (source === 'missing') return 'Index sidecar is missing';
      if (source === 'disabled') return 'Indexing is disabled';
      return 'Index status';
    }
    function indexStat(value, label) {
      const stat = document.createElement('div');
      stat.className = 'index-stat';
      const strong = document.createElement('strong');
      strong.textContent = String(value ?? '-');
      const span = document.createElement('span');
      span.textContent = label;
      stat.append(strong, span);
      return stat;
    }
    function indexFamily(titleText, hintText, id, value) {
      const card = document.createElement('label');
      card.className = 'index-family';
      const title = document.createElement('h3');
      title.textContent = titleText;
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = hintText;
      const textarea = document.createElement('textarea');
      textarea.id = id;
      textarea.spellcheck = false;
      textarea.value = value;
      card.append(title, hint, textarea);
      return card;
    }
    function indexField(label, element) {
      const wrapper = document.createElement('label');
      wrapper.className = 'gvql-parameters';
      const caption = document.createElement('span');
      caption.className = 'hint';
      caption.textContent = label;
      wrapper.append(caption, element);
      return wrapper;
    }
    function indexSelect(id, values, selected) {
      const select = document.createElement('select');
      select.id = id;
      values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
      select.value = selected;
      return select;
    }
    function addIndexLine(id, line) {
      const input = document.getElementById(id);
      const lines = input.value.split('\\n').map(value => value.trim()).filter(Boolean);
      if (!lines.includes(line)) lines.push(line);
      input.value = lines.join('\\n');
    }
    function formatPathList(items) {
      return (items || []).map(item => formatPathDefinition(typeof item === 'string' ? { path: item } : item)).join('\\n');
    }
    function formatPathDefinition(item) {
      return (item.type ? item.type + '.' : '') + item.path;
    }
    function formatCompositeList(items) {
      return (items || []).map(item => (item.name ? item.name + ': ' : '') + (item.type ? item.type + '.' : '') + item.paths.join(' + ')).join('\\n');
    }
    function formatTextList(items) {
      return (items || []).map(item => formatPathDefinition(item) + (item.minGram ? ' min=' + item.minGram : '') + (item.maxGram ? ' max=' + item.maxGram : '') + (item.caseSensitive ? ' caseSensitive=true' : '')).join('\\n');
    }
    function formatUniqueList(items) {
      return (items || []).map(item => (item.name ? item.name + ': ' : '') + (item.type ? item.type + '.' : '') + (item.paths || (item.path ? [item.path] : [])).join(' + ')).join('\\n');
    }
    function formatExpressionList(items) {
      return (items || []).map(item => (item.name ? item.name + ': ' : '') + item.expression.fn + '(' + (item.type ? item.type + '.' : '') + item.expression.path + ')' + (item.unique ? ' unique=true' : '')).join('\\n');
    }
    function readIndexConfig() {
      return {
        mode: document.getElementById('indexMode').value,
        consistency: document.getElementById('indexConsistency').value,
        properties: readPathDefinitions('indexProperties'),
        composites: readCompositeDefinitions('indexComposites'),
        ranges: readPathDefinitions('indexRanges'),
        text: readTextDefinitions('indexText'),
        fullText: readPathDefinitions('indexFullText'),
        unique: readUniqueDefinitions('indexUnique'),
        expressions: readExpressionDefinitions('indexExpressions')
      };
    }
    function readLines(id) {
      return document.getElementById(id).value.split('\\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    }
    function readPathDefinitions(id) {
      return readLines(id).map(line => parseTypedPath(stripOptions(line).main));
    }
    function readTextDefinitions(id) {
      return readLines(id).map(line => {
        const parsed = stripOptions(line);
        return Object.assign(parseTypedPath(parsed.main), parsed.options);
      });
    }
    function readCompositeDefinitions(id) {
      return readLines(id).map(line => {
        const named = splitNamed(line);
        const parts = named.body.split(/[,+]/).map(part => part.trim()).filter(Boolean).map(parseTypedPath);
        const type = sharedType(parts);
        const definition = { paths: parts.map(part => part.path) };
        if (named.name) definition.name = named.name;
        if (type) definition.type = type;
        return definition;
      }).filter(item => item.paths.length > 1);
    }
    function readUniqueDefinitions(id) {
      return readLines(id).map(line => {
        const named = splitNamed(line);
        const parts = named.body.split(/[,+]/).map(part => part.trim()).filter(Boolean).map(parseTypedPath);
        const type = sharedType(parts);
        const definition = parts.length === 1 ? { path: parts[0].path } : { paths: parts.map(part => part.path) };
        if (named.name) definition.name = named.name;
        if (type) definition.type = type;
        return definition;
      }).filter(item => item.path || item.paths);
    }
    function readExpressionDefinitions(id) {
      return readLines(id).map(line => {
        const named = splitNamed(line);
        const parsed = stripOptions(named.body);
        const match = parsed.main.match(/^(lower|upper|trim|length)\\((.+)\\)$/);
        if (!match) return undefined;
        const path = parseTypedPath(match[2].trim());
        const definition = { expression: { fn: match[1], path: path.path } };
        if (named.name) definition.name = named.name;
        if (path.type) definition.type = path.type;
        if (parsed.options.unique === true) definition.unique = true;
        return definition;
      }).filter(Boolean);
    }
    function splitNamed(line) {
      const index = line.indexOf(':');
      if (index <= 0) return { body: line };
      return { name: line.slice(0, index).trim(), body: line.slice(index + 1).trim() };
    }
    function stripOptions(line) {
      const words = line.split(/\\s+/).filter(Boolean);
      const main = [];
      const options = {};
      words.forEach(word => {
        const match = word.match(/^([A-Za-z][\\w-]*)=(.+)$/);
        if (!match) {
          main.push(word);
          return;
        }
        const raw = match[2];
        options[match[1]] = raw === 'true' ? true : raw === 'false' ? false : /^\\d+$/.test(raw) ? Number(raw) : raw;
      });
      return { main: main.join(' '), options };
    }
    function parseTypedPath(value) {
      const trimmed = value.trim();
      const match = trimmed.match(/^([A-Z][A-Za-z0-9_$]*)\\.([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)$/);
      return match ? { type: match[1], path: match[2] } : { path: trimmed };
    }
    function sharedType(parts) {
      const types = [...new Set(parts.map(part => part.type).filter(Boolean))];
      return types.length === 1 ? types[0] : undefined;
    }
    async function runIndexRebuild() {
      const details = await postJson('/api/indexes/rebuild', readIndexConfig());
      renderIndexAdmin(details);
      renderIndexRows(details);
      await refreshKpis();
    }
    async function runIndexDisable() {
      const details = await postJson('/api/indexes/rebuild', { mode: 'off', consistency: 'strict' });
      renderIndexAdmin(details);
      renderIndexRows(details);
      await refreshKpis();
    }
`;
