/* Dashboard — derives state from PlatformAdapter (genai_workshop store).
   ENGINEER: replace buildDashboardState() body with GET /api/me/dashboard
   and keep renderDashboard() shape-compatible. See ARCHITECTURE_NOTES.md §6 and §11.

   DEMO BUILD: Chen H. persona below is for workshop previews only.
   Delete DEMO_USER, DEMO_PROFILE, ensureDemoIdentity(), and applyDemoProfileToStore()
   before production — user identity must come from auth session / API. */
(function () {
  'use strict';

  function getPA() {
    return window.PlatformAdapter || null;
  }

  function readStoreSafe() {
    try { return JSON.parse(localStorage.getItem('genai_workshop') || '{}'); }
    catch (e) { return {}; }
  }

  function isAssessSubmitted(key) {
    const pa = getPA();
    if (pa && pa.isAssessmentSubmitted) return pa.isAssessmentSubmitted(key);
    const a = (readStoreSafe().assessments || {})[key];
    return !!(a && a.submitted_at);
  }

  function readAssessmentSafe(key) {
    const pa = getPA();
    if (pa && pa.readAssessment) return pa.readAssessment(key);
    return (readStoreSafe().assessments || {})[key] || null;
  }

  function readProgressSafe(moduleId) {
    const pa = getPA();
    if (pa && pa.readProgress) return pa.readProgress(moduleId);
    const s = readStoreSafe();
    return (s.progress && s.progress[moduleId]) || {};
  }

  function readProfileSafe() {
    const pa = getPA();
    if (pa && pa.readProfile) return pa.readProfile();
    return readStoreSafe().profile || null;
  }

  function readTimeInvestedSafe() {
    const pa = getPA();
    if (pa && pa.readTimeInvestedMin) return pa.readTimeInvestedMin();
    const s = readStoreSafe();
    return (s.dashboard && typeof s.dashboard.time_invested_min === 'number')
      ? s.dashboard.time_invested_min : 0;
  }

  const SELF_CHECK_KEYS = ['pre', 'gate_d1', 'gate_d2', 'gate_d3', 'gate_d4'];
  const MODULES_TOTAL = 7;

  const MODULE_SECTIONS = {
    0: ['section-0-1', 'section-0-2', 'section-0-3'],
    1: ['section-1-1', 'section-1-2', 'section-1-3'],
    2: ['section-2-1', 'section-2-2', 'section-2-3', 'section-2-4'],
    3: ['section-3-1', 'section-3-2', 'section-3-3'],
    4: ['section-4-1', 'section-4-2', 'section-4-3'],
    5: ['section-5-1', 'section-5-2', 'section-5-3'],
    6: ['section-6-1', 'section-6-2']
  };

  const MODULE_CATALOG = [
    { id: 0, title: 'Module 0 · Welcome & Orientation', durationMin: 15, sections: 3,
      sectionsList: ['0.1 Workshop overview', '0.2 Your assessment report', '0.3 Profile & pre-test'],
      takeaway: 'your profile saved, a completed pre-test, and confidence reading your competency report.',
      href: 'module_0_pic.html' },
    { id: 1, title: 'Introduction & Framework Overview', durationMin: 25, sections: 3,
      sectionsList: ['1.1 The Big Picture', '1.2 Your practice & goals', '1.3 Workshop know-how'],
      takeaway: 'a personal learning plan and a clear map of the 4×3×2 framework.',
      href: 'module_1_pic.html' },
    { id: 2, title: 'Dimension 1 · GenAI Literacy', durationMin: 35, sections: 4,
      sectionsList: ['2.1 What is GenAI Literacy?', '2.2 Teacher literacy levels', '2.3 Student empowerment', '2.4 Wrap-up'],
      takeaway: 'a sharper internal detector for AI outputs and five moves you can apply tomorrow.',
      href: 'module_2_pic.html' },
    { id: 3, title: 'Dimension 2 · Curriculum & Learning Design', durationMin: 30, sections: 3,
      sectionsList: ['3.1 Learning objectives', '3.2 Redesigning syllabi', '3.3 Stress-testing curriculum'],
      takeaway: 'a redesign checklist and a worked before/after unit example.',
      href: 'module_3_pic.html' },
    { id: 4, title: 'Dimension 3 · Teaching & Learning Practice', durationMin: 28, sections: 3,
      sectionsList: ['4.1 Scaffold, simulation & partner', '4.2 Activity patterns', '4.3 Classroom pitfalls'],
      takeaway: 'three concrete classroom activities for your next teaching week.',
      href: 'module_4_pic.html' },
    { id: 5, title: 'Dimension 4 · Assessment', durationMin: 32, sections: 3,
      sectionsList: ['5.1 Validity & AI-aware assessment', '5.2 Designing tasks', '5.3 Rubrics for reasoning'],
      takeaway: 'a redesigned rubric for one of your own assessments.',
      href: 'module_5_pic.html' },
    { id: 6, title: 'Synthesis & Next Steps', durationMin: 20, sections: 2,
      sectionsList: ['6.1 Tying dimensions together', '6.2 Your personal action map'],
      takeaway: 'your personal action map and a plan for next semester.',
      href: 'module_6_pic.html' }
  ];

  const CHECKPOINT_DEFS = [
    { key: 'pre', label: 'Pre-Assessment (baseline)', icon: '📋', durationMin: 10, afterModule: 0,
      href: 'assessment.html?kind=pre&after=module_0', selfCheck: true },
    { key: 'gate_d1', label: 'Self-Check · Dimension 1 — GenAI Literacy', icon: '📊', durationMin: 10, afterModule: 2,
      href: 'assessment.html?kind=gate&dimension=1&after=module_2', selfCheck: true },
    { key: 'gate_d2', label: 'Self-Check · Dimension 2 — Curriculum & Design', icon: '📊', durationMin: 10, afterModule: 3,
      href: 'assessment.html?kind=gate&dimension=2&after=module_3', selfCheck: true },
    { key: 'gate_d3', label: 'Self-Check · Dimension 3 — Teaching & Learning', icon: '📊', durationMin: 10, afterModule: 4,
      href: 'assessment.html?kind=gate&dimension=3&after=module_4', selfCheck: true },
    { key: 'gate_d4', label: 'Self-Check · Dimension 4 — Assessment', icon: '📊', durationMin: 10, afterModule: 5,
      href: 'assessment.html?kind=gate&dimension=4&after=module_5', selfCheck: true },
    { key: 'post', label: 'Post-Assessment', icon: '🎓', durationMin: 15, afterModule: 6,
      href: 'assessment.html?kind=post&after=module_6', selfCheck: false, certificate: true }
  ];

  const HERO_STEP_COORDS = [
    { x: 70, y: 290 }, { x: 120, y: 255 }, { x: 175, y: 220 }, { x: 230, y: 185 },
    { x: 285, y: 150 }, { x: 340, y: 115 }, { x: 395, y: 80 }
  ];

  /* DEMO PERSONA — remove before production (see ARCHITECTURE_NOTES.md §11.1) */
  const DEMO_USER = {
    firstName: 'Chen',
    fullName: 'Chen H.',
    title: 'EdTech Coordinator',
    org: 'The Education University of Hong Kong',
    role: 'Project Officer'
  };
  const DEMO_PROFILE = {
    display_name: 'Chen H.',
    discipline: 'EdTech Coordinator',
    institution: 'The Education University of Hong Kong',
    years_teaching: 'Project Officer',
    country: 'Hong Kong SAR'
  };

  function applyDemoProfileToStore(store) {
    store.profile = Object.assign({}, DEMO_PROFILE, {
      updated_at: new Date().toISOString(),
      version: 1
    });
    store.__user = Object.assign({}, store.__user || {}, {
      name: DEMO_USER.fullName,
      institution: DEMO_USER.org,
      discipline: DEMO_USER.title
    });
    return store;
  }

  /** ENGINEER: delete — production user from JWT / GET /api/me/profile */
  function ensureDemoIdentity() {
    const s = readStoreSafe();
    if (s.profile && s.profile.display_name && s.profile.institution) return;
    applyDemoProfileToStore(s);
    try { localStorage.setItem('genai_workshop', JSON.stringify(s)); } catch (e) {}
  }

  function demoUserWithBadges(badgesEarned) {
    return Object.assign({}, DEMO_USER, { badgesEarned: badgesEarned });
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function sectionComplete(id, sectionId) {
    try { return localStorage.getItem('m' + id + '.complete.' + sectionId) === '1'; }
    catch (e) { return false; }
  }

  function countSectionsComplete(id) {
    return (MODULE_SECTIONS[id] || []).filter(s => sectionComplete(id, s)).length;
  }

  function isModuleComplete(id) {
    const secs = MODULE_SECTIONS[id] || [];
    if (!secs.length) return false;
    return secs.every(s => sectionComplete(id, s));
  }

  function isModuleStarted(id) {
    return countSectionsComplete(id) > 0;
  }

  function moduleCompletedAt(id) {
    if (!isModuleComplete(id)) return '';
    const p = readProgressSafe('module_' + id);
    return p.completed_at ? fmtDate(p.completed_at) : '';
  }

  function allSelfChecksDone(done) {
    return SELF_CHECK_KEYS.every(k => done.checkpoint[k]);
  }

  function canAccessModule(id, done) {
    if (id === 0) return true;
    if (id === 1) return done.module[0] && done.checkpoint.pre;
    if (id === 2) return done.module[1];
    if (id === 3) return done.module[2] && done.checkpoint.gate_d1;
    if (id === 4) return done.module[3] && done.checkpoint.gate_d2;
    if (id === 5) return done.module[4] && done.checkpoint.gate_d3;
    if (id === 6) return done.module[5] && done.checkpoint.gate_d4;
    return false;
  }

  function canAccessCheckpoint(cp, done) {
    if (!done.module[cp.afterModule]) return false;
    if (cp.key === 'pre') return true;
    if (cp.key === 'gate_d1') return done.module[2];
    if (cp.key === 'gate_d2') return done.module[3];
    if (cp.key === 'gate_d3') return done.module[4];
    if (cp.key === 'gate_d4') return done.module[5];
    if (cp.key === 'post') return done.module[6] && allSelfChecksDone(done);
    return false;
  }

  function buildCompletionFlags() {
    const done = { module: {}, checkpoint: {} };
    for (let i = 0; i <= 6; i++) done.module[i] = isModuleComplete(i);
    CHECKPOINT_DEFS.forEach(cp => {
      done.checkpoint[cp.key] = isAssessSubmitted(cp.key);
    });
    return done;
  }

  function assignStatuses(done) {
    const path = [];

    for (let id = 0; id <= 6; id++) {
      const cat = MODULE_CATALOG[id];
      const accessible = canAccessModule(id, done);
      const sectionsDone = countSectionsComplete(id);
      const sectionsTotal = (MODULE_SECTIONS[id] || []).length;
      let status;

      if (done.module[id]) {
        status = 'complete';
      } else if (!accessible) {
        status = 'locked';
      } else if (sectionsDone > 0) {
        status = 'in-progress';
      } else {
        status = 'not-started';
      }

      path.push({
        type: 'module', ...cat,
        status,
        sectionsDone,
        sectionsTotal,
        completedAt: moduleCompletedAt(id)
      });

      CHECKPOINT_DEFS.filter(c => c.afterModule === id).forEach(cp => {
        let cpStatus;
        const submitted = done.checkpoint[cp.key];
        if (submitted) {
          cpStatus = 'complete';
        } else if (!canAccessCheckpoint(cp, done)) {
          cpStatus = 'locked';
        } else {
          cpStatus = 'available';
        }

        const assess = readAssessmentSafe(cp.key);
        path.push({
          type: 'checkpoint', ...cp,
          status: cpStatus,
          completedAt: assess && assess.submitted_at ? fmtDate(assess.submitted_at) : ''
        });
      });
    }
    return path;
  }

  function findContinueTarget(path) {
    const inProgress = path.find(p => p.type === 'module' && p.status === 'in-progress');
    if (inProgress) return inProgress;
    return path.find(p => p.status === 'not-started' || p.status === 'available');
  }

  function deriveUser() {
    const badgesEarned = Object.values(buildCompletionFlags().module).filter(Boolean).length;
    const profile = readProfileSafe() || {};
    const u = (getPA() && getPA().getUser ? getPA().getUser() : null) || readStoreSafe().__user || {};

    /* ENGINEER: production — map API fields only; remove demo fallbacks */
    const fullName = profile.display_name || u.name || DEMO_USER.fullName;
    const firstName = (fullName.split(/\s+/)[0]) || DEMO_USER.firstName;
    return {
      firstName,
      fullName,
      title: profile.discipline || u.discipline || DEMO_USER.title,
      org: profile.institution || u.institution || DEMO_USER.org,
      role: profile.years_teaching || DEMO_USER.role,
      badgesEarned
    };
  }

  function computeTimeInvested(done) {
    let min = readTimeInvestedSafe();
    if (min > 0) return min;
    MODULE_CATALOG.forEach(m => { if (done.module[m.id]) min += m.durationMin; });
    CHECKPOINT_DEFS.forEach(cp => {
      if (done.checkpoint[cp.key]) min += cp.durationMin;
    });
    return min;
  }

  function buildDashboardState() {
    const pa = getPA();
    if (pa && pa.pingSessionTime) {
      try { pa.pingSessionTime(); } catch (e) { /* localStorage may be blocked */ }
    }
    const done = buildCompletionFlags();
    const path = assignStatuses(done);
    const modulesCompleted = MODULE_CATALOG.filter(m => done.module[m.id]).length;
    const selfChecksDone = SELF_CHECK_KEYS.filter(k => done.checkpoint[k]).length;
    const timeInvestedMin = computeTimeInvested(done);

    const remainingModules = MODULE_CATALOG.filter(m => !done.module[m.id])
      .reduce((s, m) => s + m.durationMin, 0);
    const remainingChecks = CHECKPOINT_DEFS.filter(cp => !done.checkpoint[cp.key] && cp.selfCheck !== false)
      .reduce((s, cp) => s + cp.durationMin, 0);

    return {
      user: deriveUser(),
      path,
      modulesCompleted,
      modulesTotal: MODULES_TOTAL,
      selfChecksDone,
      selfChecksTotal: SELF_CHECK_KEYS.length,
      timeInvestedMin,
      estTimeRemainingMin: remainingModules + remainingChecks,
      postComplete: done.checkpoint.post,
      done
    };
  }

  function fmtTime(min) {
    if (!min) return '0m';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  function bindAll(scope) {
    document.querySelectorAll('[data-bind]').forEach(el => {
      const path = el.getAttribute('data-bind');
      const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
      el.textContent = (val === undefined || val === null) ? '–' : val;
    });
  }

  function renderHeroPath(path, modulesCompleted) {
    const stepsG = document.getElementById('heroPathSteps');
    const marker = document.getElementById('heroYouAreHere');
    const progressPath = document.getElementById('heroPathProgress');
    if (!stepsG) return;

    stepsG.innerHTML = '';
    const moduleItems = path.filter(p => p.type === 'module');
    const activeIdx = moduleItems.findIndex(m => m.status === 'in-progress' || m.status === 'not-started');
    const progressIdx = activeIdx >= 0 ? activeIdx : Math.max(0, modulesCompleted - 1);

    moduleItems.forEach((m, i) => {
      const c = HERO_STEP_COORDS[i] || HERO_STEP_COORDS[HERO_STEP_COORDS.length - 1];
      const fill = m.status === 'complete' ? '#22c55e' : (i === progressIdx ? 'url(#activeGrad)' : '#e2e8f0');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', c.x);
      circle.setAttribute('cy', c.y);
      circle.setAttribute('r', i === progressIdx ? 12 : 9);
      circle.setAttribute('fill', fill);
      stepsG.appendChild(circle);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', c.x);
      label.setAttribute('y', c.y + 28);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '9');
      label.setAttribute('font-weight', '700');
      label.setAttribute('fill', '#64748b');
      label.textContent = 'M' + m.id;
      stepsG.appendChild(label);
    });

    if (marker && HERO_STEP_COORDS[progressIdx]) {
      marker.setAttribute('transform', `translate(${HERO_STEP_COORDS[progressIdx].x},${HERO_STEP_COORDS[progressIdx].y - 42})`);
      marker.style.display = '';
    }

    if (progressPath) {
      const pct = modulesCompleted / MODULES_TOTAL;
      const len = 500;
      progressPath.setAttribute('stroke-dashoffset', String(len * (1 - pct)));
    }
  }

  function renderPathList(path) {
    const list = document.getElementById('pathList');
    if (!list) return;
    list.innerHTML = '';

    path.forEach(item => {
      if (item.type === 'module') {
        const card = document.createElement('div');
        card.className = 'module-card ' + item.status;

        let statusText = '🔒 Locked';
        let metaExtra = '🔒 Complete previous steps to unlock';
        if (item.status === 'complete') {
          statusText = '✓ Complete';
          metaExtra = '✓ All sections marked' + (item.completedAt ? ' · ' + item.completedAt : '');
        } else if (item.status === 'not-started') {
          statusText = '○ Not started yet';
          metaExtra = 'Ready when you are';
        } else if (item.status === 'in-progress') {
          statusText = '⏳ In progress';
          metaExtra = item.sectionsDone + ' of ' + item.sectionsTotal + ' sections marked';
        }

        let actions = '';
        if (item.status === 'complete') {
          actions = `<a href="${item.href}" class="module-btn primary">↻ Revisit</a>`;
        } else if (item.status === 'not-started' || item.status === 'in-progress') {
          actions = `<a href="${item.href}" class="module-btn primary">▶ ${item.status === 'in-progress' ? 'Resume' : 'Start'}</a>`;
        } else {
          actions = '<span class="module-btn disabled">🔒 Locked</span>';
        }

        const sectionsHTML = item.sectionsList.map(s => '<li>' + s + '</li>').join('');
        const expand = item.status === 'locked'
          ? '<p>Complete the previous module and any required self-check to unlock.</p>'
          : '<h5>📋 What you\'ll get</h5><ul>' + sectionsHTML + '</ul><p><strong>You\'ll leave with:</strong> ' + item.takeaway + '</p>';

        card.innerHTML = `
          <div class="module-num">${item.id}</div>
          <div class="module-content">
            <h4>${item.title}</h4>
            <div class="module-meta">
              <span>⏱ ${item.durationMin} min</span>
              <span>${item.sections} sections</span>
              <span>${metaExtra}</span>
            </div>
            <div class="module-status">${statusText}</div>
          </div>
          <div class="module-actions">${actions}</div>
          <div class="module-expand"><div class="module-expand-inner">${expand}</div></div>`;

        card.addEventListener('click', e => {
          if (e.target.closest('a') || e.target.closest('.module-btn')) return;
          if (item.status === 'locked') return;
          card.classList.toggle('open');
        });
        list.appendChild(card);
        return;
      }

      const card = document.createElement('div');
      const postClass = item.certificate ? ' checkpoint-card--post' : '';
      card.className = 'checkpoint-card ' + item.status + postClass;

      let statusText, metaExtra, actions;
      if (item.status === 'complete') {
        statusText = '✓ Complete';
        metaExtra = item.completedAt ? 'Completed ' + item.completedAt : 'Submitted';
        actions = `<button type="button" class="btn-report" disabled title="Report service connecting soon">📈 See my report 🔒</button>`;
      } else if (item.status === 'available') {
        statusText = item.certificate ? '🎓 Ready' : '📍 Required';
        metaExtra = item.certificate
          ? 'Unlocks your digital certificate'
          : 'Required before the next module';
        actions = `<a href="${item.href}" class="module-btn primary">▶ ${item.certificate ? 'Take post-test' : 'Take assessment'}</a>`;
      } else {
        statusText = '🔒 Locked';
        if (item.certificate) {
          metaExtra = !item.afterModule || item.key === 'post'
            ? 'Complete Module 6 and all self-checks first'
            : 'Complete prior steps first';
        } else {
          metaExtra = 'Complete Module ' + item.afterModule + ' first';
        }
        actions = '<span class="module-btn disabled">🔒 Locked</span>';
      }

      let certHTML = '';
      if (item.certificate && item.status === 'available') {
        certHTML = '<div class="checkpoint-cert">🎓 Finish to receive your <strong>digital certificate</strong></div>';
      } else if (item.certificate && item.status === 'complete') {
        certHTML = '<div class="checkpoint-cert">🎓 Certificate ready when cert service connects</div>';
      }

      card.innerHTML = `
        <div class="checkpoint-icon">${item.icon}</div>
        <div class="checkpoint-body">
          <h4>${item.label}</h4>
          <div class="module-meta">
            <span>⏱ ~${item.durationMin} min</span>
            <span>${metaExtra}</span>
          </div>
          <div class="module-status">${statusText}</div>
          ${certHTML}
        </div>
        <div class="checkpoint-actions">${actions}</div>`;
      list.appendChild(card);
    });
  }

  function renderDashboard(state) {
    const overallPct = Math.round(state.modulesCompleted / state.modulesTotal * 100);
    const scope = {
      user: state.user,
      modulesCompleted: state.modulesCompleted,
      modulesTotal: state.modulesTotal,
      overallPct,
      overallPctLabel: overallPct + '%',
      timeInvestedMin: state.timeInvestedMin,
      timeInvestedLabel: fmtTime(state.timeInvestedMin),
      selfChecksDone: state.selfChecksDone,
      selfChecksTotal: state.selfChecksTotal,
      estTimeRemainingMin: state.estTimeRemainingMin
    };
    bindAll(scope);

    const nextItem = findContinueTarget(state.path);
    const btn = document.getElementById('continueBtn');
    if (btn) {
      if (nextItem) {
        btn.href = nextItem.href;
        let label;
        if (nextItem.type === 'checkpoint') {
          label = nextItem.certificate ? 'Take post-test' : 'Take assessment';
        } else if (nextItem.status === 'in-progress') {
          label = 'Resume Module ' + nextItem.id;
        } else {
          label = 'Start Module ' + nextItem.id;
        }
        btn.innerHTML = '▶ ' + label;
        btn.classList.remove('disabled');
      } else if (state.postComplete) {
        btn.href = '#';
        btn.innerHTML = '🎓 Workshop complete!';
        btn.classList.add('disabled');
      } else {
        btn.href = '#';
        btn.innerHTML = '▶ Continue';
        btn.classList.add('disabled');
      }
    }

    const fill = document.getElementById('overallProgressFill');
    if (fill) fill.style.width = overallPct + '%';

    const donut = document.getElementById('donutFill');
    if (donut) {
      const C = 2 * Math.PI * 74;
      donut.setAttribute('stroke-dashoffset', String(C));
      requestAnimationFrame(() => setTimeout(() => {
        donut.setAttribute('stroke-dashoffset', String(C * (1 - overallPct / 100)));
      }, 50));
    }

    renderPathList(state.path);
    renderHeroPath(state.path, state.modulesCompleted);
  }

  function markModSections(id) {
    (MODULE_SECTIONS[id] || []).forEach(s => {
      try { localStorage.setItem('m' + id + '.complete.' + s, '1'); } catch (e) {}
    });
  }

  function clearAllSectionTicks() {
    for (let id = 0; id <= 6; id++) {
      (MODULE_SECTIONS[id] || []).forEach(s => {
        try { localStorage.removeItem('m' + id + '.complete.' + s); } catch (e) {}
      });
    }
  }

  function seedScenario(level) {
    const pa = getPA();
    const store = (pa && pa.readStore) ? pa.readStore() : readStoreSafe();
    store.progress = store.progress || {};
    store.assessments = store.assessments || {};
    store.dashboard = store.dashboard || {};

    function markMod(id) {
      markModSections(id);
      store.progress['module_' + id] = {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      };
    }
    function markAssess(key) {
      store.assessments[key] = { kind: key, submitted_at: new Date().toISOString(), version: 1 };
    }

    clearAllSectionTicks();

    if (level === 'fresh') {
      store.progress = {};
      store.assessments = {};
      store.dashboard = { time_invested_min: 0 };
      applyDemoProfileToStore(store);
    } else if (level === 'halfway') {
      markMod(0); markAssess('pre'); markMod(1); markMod(2); markAssess('gate_d1');
      store.dashboard.time_invested_min = 102;
      applyDemoProfileToStore(store);
    } else if (level === 'finishing') {
      for (let i = 0; i <= 5; i++) markMod(i);
      markAssess('pre'); markAssess('gate_d1'); markAssess('gate_d2'); markAssess('gate_d3'); markAssess('gate_d4');
      store.dashboard.time_invested_min = 280;
      applyDemoProfileToStore(store);
    } else if (level === 'complete') {
      for (let i = 0; i <= 6; i++) markMod(i);
      SELF_CHECK_KEYS.forEach(markAssess);
      markAssess('post');
      store.dashboard.time_invested_min = 340;
      applyDemoProfileToStore(store);
    }

    try { localStorage.setItem('genai_workshop', JSON.stringify(store)); } catch (e) {}
  }

  function refresh() {
    try {
      renderDashboard(buildDashboardState());
    } catch (err) {
      console.error('[Dashboard] render failed:', err);
      try {
        renderDashboard(buildFreshUserState());
      } catch (err2) {
        console.error('[Dashboard] fallback render failed:', err2);
      }
    }
  }

  function buildFreshUserState() {
    const done = { module: {}, checkpoint: {} };
    for (let i = 0; i <= 6; i++) done.module[i] = false;
    CHECKPOINT_DEFS.forEach(cp => { done.checkpoint[cp.key] = false; });
    const path = assignStatuses(done);
    return {
      user: demoUserWithBadges(0),
      path,
      modulesCompleted: 0,
      modulesTotal: MODULES_TOTAL,
      selfChecksDone: 0,
      selfChecksTotal: SELF_CHECK_KEYS.length,
      timeInvestedMin: 0,
      estTimeRemainingMin: MODULE_CATALOG.reduce((s, m) => s + m.durationMin, 0)
        + CHECKPOINT_DEFS.filter(cp => cp.selfCheck !== false).reduce((s, cp) => s + cp.durationMin, 0),
      postComplete: false,
      done
    };
  }

  function init() {
    ensureDemoIdentity();
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', refresh);
  window.addEventListener('platform:ready', refresh);
  window.addEventListener('storage', e => { if (e.key === 'genai_workshop') refresh(); });
  window.addEventListener('focus', refresh);

  const fab = document.getElementById('demo-fab');
  const panel = document.getElementById('demo-panel');
  if (fab && panel) {
    fab.addEventListener('click', () => panel.classList.toggle('open'));
    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && !fab.contains(e.target)) panel.classList.remove('open');
    });
    document.querySelectorAll('[data-scenario]').forEach(btn => {
      btn.addEventListener('click', () => {
        seedScenario(btn.getAttribute('data-scenario'));
        refresh();
      });
    });
    const advanceBtn = document.getElementById('advance-btn');
    if (advanceBtn) {
      advanceBtn.addEventListener('click', () => {
        const pa = getPA();
        const s = buildDashboardState();
        const next = findContinueTarget(s.path);
        if (!next) return;
        if (next.type === 'module') {
          markModSections(next.id);
          if (pa && pa.saveProgress) {
            pa.saveProgress('module_' + next.id, {
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            });
          }
          if (pa && pa.addTimeInvestedMin) pa.addTimeInvestedMin(next.durationMin);
        } else if (pa && pa.saveAssessment) {
          pa.saveAssessment(next.key, { kind: next.key, item_count: 10 });
          if (pa.addTimeInvestedMin) pa.addTimeInvestedMin(next.durationMin);
        }
        refresh();
      });
    }
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        seedScenario('halfway');
        refresh();
      });
    }
  }

  window.DashboardApp = { buildDashboardState, renderDashboard, refresh };
})();
