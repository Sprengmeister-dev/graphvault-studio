export const ADMIN_INDEX_STYLE = `
    .index-admin { display: grid; gap: 10px; padding: 12px; background: #fbfcfd; border-bottom: 1px solid var(--line); }
    .index-admin-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .index-admin textarea { min-height: 116px; font-family: "SFMono-Regular", "Cascadia Code", "Roboto Mono", ui-monospace, monospace; }
    .index-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .index-stat { padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
    .index-stat strong { display: block; font-size: 18px; font-weight: 600; color: #12343b; }
    .index-stat span { color: var(--muted); font-size: 12px; }
    @media (max-width: 980px) {
      .index-admin-grid, .index-stat-grid { grid-template-columns: 1fr; }
    }
`;

export const ADMIN_INDEX_SCRIPT = `
    async function showIndexes() {
      setView('indexes');
      listTitle.textContent = 'Persistent indexes';
      listHint.textContent = 'Status, top keys, and rebuild controls';
      const details = await requestJson('/api/indexes');
      renderIndexAdmin(details);
      renderIndexRows(details);
      return details;
    }
    function renderIndexAdmin(details) {
      viz.style.display = 'none';
      fields.replaceChildren();
      const panel = document.createElement('div');
      panel.className = 'index-admin';
      const stats = document.createElement('div');
      stats.className = 'index-stat-grid';
      [
        [details.status.source, 'Source'],
        [details.status.nodeCount, 'Nodes'],
        [details.status.propertyKeys, 'Property keys'],
        [details.status.edgeCount, 'Reference edges']
      ].forEach(([value, label]) => {
        const stat = document.createElement('div');
        stat.className = 'index-stat';
        const strong = document.createElement('strong');
        strong.textContent = String(value ?? '-');
        const span = document.createElement('span');
        span.textContent = label;
        stat.append(strong, span);
        stats.appendChild(stat);
      });
      const grid = document.createElement('div');
      grid.className = 'index-admin-grid';
      const mode = indexSelect('indexMode', ['auto', 'configured', 'off'], details.configured.mode);
      const consistency = indexSelect('indexConsistency', ['strict', 'committed'], details.configured.consistency);
      const rebuild = document.createElement('button');
      rebuild.className = 'primary';
      rebuild.textContent = 'Rebuild index';
      rebuild.onclick = runIndexRebuild;
      grid.append(indexField('Mode', mode), indexField('Consistency', consistency), indexField('Action', rebuild));
      const properties = document.createElement('textarea');
      properties.id = 'indexProperties';
      properties.placeholder = 'One property per line, e.g. status or Document.status';
      properties.value = (details.configured.properties || []).map(property => (property.type ? property.type + '.' : '') + property.path).join('\\n');
      panel.append(stats, grid, indexField('Configured properties', properties));
      fields.appendChild(panel);
    }
    function renderIndexRows(details) {
      const rows = [
        {
          columns: [details.status.source, details.status.mode, details.status.consistency, details.status.enabled ? 'enabled' : 'disabled'],
          onclick: () => show(details.status)
        },
        ...(details.record ? [{
          columns: ['tx ' + details.record.transactionId, details.record.mode, details.record.createdAt, details.record.indexedProperties.length + ' configured'],
          onclick: () => show(details.record)
        }] : []),
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
    function readIndexProperties() {
      return document.getElementById('indexProperties').value.split('\\n').map(line => line.trim()).filter(Boolean).map(line => {
        const match = line.match(/^([A-Za-z_$][\\w$]*)\\.([A-Za-z_$][\\w$]*)$/);
        return match ? { type: match[1], path: match[2] } : { path: line };
      });
    }
    async function runIndexRebuild() {
      const payload = {
        mode: document.getElementById('indexMode').value,
        consistency: document.getElementById('indexConsistency').value,
        properties: readIndexProperties()
      };
      const details = await postJson('/api/indexes/rebuild', payload);
      renderIndexAdmin(details);
      renderIndexRows(details);
      await refreshKpis();
    }
`;
