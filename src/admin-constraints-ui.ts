export const ADMIN_CONSTRAINT_STYLE = `
    .constraint-workbench { display: grid; gap: 12px; padding: 12px; background: #f6f9fa; border-bottom: 1px solid var(--line); }
    .constraint-hero { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 16px; border: 1px solid #c7d8dc; border-radius: 10px; background: linear-gradient(135deg, #10232b 0%, #1f4149 58%, #875f1e 100%); color: #f4fbfb; }
    .constraint-hero h2 { margin: 0 0 5px; font-size: 20px; font-weight: 600; letter-spacing: 0; }
    .constraint-hero p { margin: 0; max-width: 780px; color: #c9d8db; line-height: 1.45; }
    .constraint-pill { display: inline-flex; align-items: center; gap: 7px; width: max-content; padding: 7px 10px; border-radius: 999px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); color: #e8fbfb; font-size: 12px; font-weight: 600; }
    .constraint-pulse { width: 8px; height: 8px; border-radius: 999px; background: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,.18); }
    .constraint-pulse.warn { background: #f5c451; box-shadow: 0 0 0 4px rgba(245,196,81,.18); }
    .constraint-pulse.off { background: #a8b5ba; box-shadow: none; }
    .constraint-stat-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
    .constraint-stat { padding: 11px; border: 1px solid var(--line); border-radius: 9px; background: #fff; box-shadow: 0 8px 18px rgba(15,35,45,.04); }
    .constraint-stat strong { display: block; font-size: 18px; font-weight: 600; color: #102f38; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .constraint-stat span { color: var(--muted); font-size: 12px; }
    .constraint-grid { display: grid; grid-template-columns: minmax(260px, 360px) minmax(0, 1fr); gap: 12px; }
    .constraint-panel { display: grid; gap: 8px; align-content: start; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: #fff; }
    .constraint-panel h3 { margin: 0; font-size: 14px; font-weight: 600; color: #102f38; }
    .constraint-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .constraint-chip { padding: 6px 8px; border-radius: 999px; color: #0d6264; background: #eef7f6; border: 1px solid #c1dfdb; font-size: 12px; }
    .constraint-violation { color: #8f2c2b; background: #fff5f5; border-color: #f0c2c1; }
    @media (max-width: 980px) {
      .constraint-hero, .constraint-stat-grid, .constraint-grid { grid-template-columns: 1fr; }
    }
`;

export const ADMIN_CONSTRAINT_SCRIPT = `
    async function showConstraints() {
      setView('constraints');
      listTitle.textContent = 'Constraint workbench';
      listHint.textContent = 'Persisted field invariants from the current store';
      const details = await requestJson('/api/constraints');
      renderConstraintAdmin(details);
      renderConstraintRows(details);
      return details;
    }
    function renderConstraintAdmin(details) {
      viz.style.display = 'none';
      fields.replaceChildren();
      const panel = document.createElement('div');
      panel.className = 'constraint-workbench';
      panel.append(renderConstraintHero(details), renderConstraintStats(details), renderConstraintPanels(details));
      fields.appendChild(panel);
    }
    function renderConstraintHero(details) {
      const hero = document.createElement('div');
      hero.className = 'constraint-hero';
      const copy = document.createElement('div');
      const title = document.createElement('h2');
      title.textContent = constraintHeroTitle(details);
      const text = document.createElement('p');
      text.textContent = 'Inspect the storage-wide contract enforced before writes: required fields, types, enums, bounds, uniqueness, and reference-existence checks.';
      copy.append(title, text);
      const pill = document.createElement('div');
      pill.className = 'constraint-pill';
      const pulse = document.createElement('span');
      pulse.className = 'constraint-pulse ' + (details.source === 'storage' && details.violationCount === 0 ? '' : details.source === 'missing' || details.source === 'disabled' ? 'off' : 'warn');
      const label = document.createElement('span');
      label.textContent = details.source + ' / ' + details.mode;
      pill.append(pulse, label);
      hero.append(copy, pill);
      return hero;
    }
    function renderConstraintStats(details) {
      const stats = document.createElement('div');
      stats.className = 'constraint-stat-grid';
      [
        [details.definitionCount, 'Definitions'],
        [details.violationCount, 'Violations'],
        [details.checkedObjects, 'Checked objects'],
        [details.checkedConstraints, 'Checked constraints'],
        [details.transactionId || '-', 'Transaction']
      ].forEach(([value, label]) => stats.appendChild(constraintStat(value, label)));
      return stats;
    }
    function renderConstraintPanels(details) {
      const wrap = document.createElement('div');
      wrap.className = 'constraint-grid';
      const definitions = constraintPanel('Definitions', 'The active contract persisted by GraphVault Library.');
      const definitionChips = document.createElement('div');
      definitionChips.className = 'constraint-chip-row';
      (details.record?.definitions || []).forEach(definition => {
        const chip = document.createElement('span');
        chip.className = 'constraint-chip';
        chip.textContent = constraintDefinitionLabel(definition);
        definitionChips.appendChild(chip);
      });
      if (!definitionChips.children.length) {
        definitionChips.appendChild(constraintEmpty('No constraints are persisted for this store.'));
      }
      definitions.appendChild(definitionChips);
      const violations = constraintPanel('Latest validation', 'The validation result recorded with the latest committed store state.');
      const violationChips = document.createElement('div');
      violationChips.className = 'constraint-chip-row';
      (details.record?.validation?.violations || []).forEach(violation => {
        const chip = document.createElement('button');
        chip.className = 'constraint-chip constraint-violation';
        chip.textContent = '#' + violation.objectId + ' ' + violation.kind + ' ' + violation.path;
        chip.onclick = () => showObjectInHierarchyPath(violation.objectId);
        violationChips.appendChild(chip);
      });
      if (!violationChips.children.length) {
        violationChips.appendChild(constraintEmpty(details.source === 'storage' ? 'Latest validation is clean.' : 'No validation record available.'));
      }
      violations.appendChild(violationChips);
      wrap.append(definitions, violations);
      return wrap;
    }
    function renderConstraintRows(details) {
      const rows = [
        { columns: [details.source, 'status', details.mode, details.violationCount + ' violations'], onclick: () => show(details) },
        ...(details.record?.definitions || []).map(definition => ({
          columns: [definition.name || definition.path, 'definition', definition.type || '*', constraintKinds(definition).join(', ') || 'constraint'],
          onclick: () => show(definition)
        })),
        ...(details.record?.validation?.violations || []).map(violation => ({
          columns: ['#' + violation.objectId, violation.kind, violation.path, violation.message],
          onclick: () => showObjectInHierarchyPath(violation.objectId)
        }))
      ];
      setRows(rows, 'No constraints found');
    }
    function constraintHeroTitle(details) {
      if (details.source === 'missing') return 'No persisted constraints yet';
      if (details.source === 'disabled') return 'Constraint enforcement is disabled';
      return details.violationCount ? 'Constraint violations recorded' : 'Constraints are active and clean';
    }
    function constraintStat(value, label) {
      const stat = document.createElement('div');
      stat.className = 'constraint-stat';
      const strong = document.createElement('strong');
      strong.textContent = String(value ?? '-');
      const span = document.createElement('span');
      span.textContent = label;
      stat.append(strong, span);
      return stat;
    }
    function constraintPanel(titleText, hintText) {
      const panel = document.createElement('div');
      panel.className = 'constraint-panel';
      const title = document.createElement('h3');
      title.textContent = titleText;
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = hintText;
      panel.append(title, hint);
      return panel;
    }
    function constraintEmpty(text) {
      const empty = document.createElement('div');
      empty.className = 'hint';
      empty.textContent = text;
      return empty;
    }
    function constraintDefinitionLabel(definition) {
      return (definition.type || '*') + '.' + definition.path + ' / ' + (constraintKinds(definition).join('+') || 'custom');
    }
    function constraintKinds(definition) {
      return ['required', 'valueType', 'enum', 'min', 'max', 'unique', 'referenceExists'].filter(key => typeof definition[key] !== 'undefined' && definition[key] !== false);
    }
`;
