/* =========================================================================
   GenAI-Responsive Competencies Workshop — Platform Adapter & Progress
   -------------------------------------------------------------------------
   Provides:
     - window.PlatformAdapter   read user, save/load progress + reflections,
                                queue + sync to external auth/profile API
     - window.ProgressTracker   thin compat shim used by module pages
   -------------------------------------------------------------------------
   Storage strategy:
     1. Always write through to localStorage (offline-first, no data loss)
     2. If a `platformUser` is present (set by parent shell or postMessage),
        also POST to API_BASE endpoints
     3. Failures queue locally and re-flush on next sync()
   ========================================================================= */
(function () {
  'use strict';

  // ----- Configuration ---------------------------------------------------
  const DEFAULT_CONFIG = {
    apiBase: null,        // e.g. 'https://platform.example.com/api'
    authHeader: null,     // e.g. 'Bearer abc123'  — set by host shell
    storageKey: 'genai_workshop',
    queueKey:   'genai_workshop_queue'
  };
  let config = Object.assign({}, DEFAULT_CONFIG);

  // ----- Local storage helpers ------------------------------------------
  function readStore() {
    try { return JSON.parse(localStorage.getItem(config.storageKey) || '{}'); }
    catch { return {}; }
  }
  function writeStore(data) {
    try { localStorage.setItem(config.storageKey, JSON.stringify(data)); }
    catch (e) { console.warn('[PlatformAdapter] storage write failed', e); }
  }
  function readQueue() {
    try { return JSON.parse(localStorage.getItem(config.queueKey) || '[]'); }
    catch { return []; }
  }
  function writeQueue(queue) {
    try { localStorage.setItem(config.queueKey, JSON.stringify(queue)); }
    catch (e) { console.warn('[PlatformAdapter] queue write failed', e); }
  }

  // ----- User identity ---------------------------------------------------
  // Resolution order:
  //   1. window.platformUser  (set by parent shell)
  //   2. postMessage handshake (deferred — see init())
  //   3. anonymous local user
  function getUser() {
    if (window.platformUser && window.platformUser.id) return window.platformUser;
    const store = readStore();
    if (!store.__user) {
      store.__user = {
        id: 'anon-' + Math.random().toString(36).slice(2, 10),
        name: null,
        discipline: null,
        institution: null,
        anonymous: true
      };
      writeStore(store);
    }
    return store.__user;
  }

  // ----- Network sync ----------------------------------------------------
  async function postToAPI(path, payload) {
    if (!config.apiBase) return { skipped: true };
    const headers = { 'Content-Type': 'application/json' };
    if (config.authHeader) headers['Authorization'] = config.authHeader;
    const res = await fetch(config.apiBase + path, {
      method: 'POST', headers, body: JSON.stringify(payload), credentials: 'include'
    });
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json().catch(() => ({}));
  }

  function enqueue(path, payload) {
    const q = readQueue();
    q.push({ path, payload, ts: Date.now() });
    writeQueue(q);
  }

  async function flushQueue() {
    if (!config.apiBase) return;
    let q = readQueue();
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
      try { await postToAPI(item.path, item.payload); }
      catch (e) { remaining.push(item); }
    }
    writeQueue(remaining);
  }

  // ----- Progress API ----------------------------------------------------
  function readProgress(moduleId) {
    const s = readStore();
    return (s.progress && s.progress[moduleId]) || {};
  }
  function writeProgress(moduleId, partial) {
    const s = readStore();
    s.progress = s.progress || {};
    s.progress[moduleId] = Object.assign({}, s.progress[moduleId] || {}, partial);
    writeStore(s);
    return s.progress[moduleId];
  }
  async function saveProgress(moduleId, partial) {
    const merged = writeProgress(moduleId, partial);
    const payload = { user_id: getUser().id, module_id: moduleId, progress: merged };
    if (config.apiBase) {
      try { await postToAPI('/progress', payload); }
      catch { enqueue('/progress', payload); }
    }
    return merged;
  }

  // ----- Activity completion --------------------------------------------
  function markActivity(moduleId, activityId, doneState) {
    const p = readProgress(moduleId);
    p.activities_done = p.activities_done || [];
    if (doneState !== false && !p.activities_done.includes(activityId)) {
      p.activities_done.push(activityId);
    } else if (doneState === false) {
      p.activities_done = p.activities_done.filter(a => a !== activityId);
    }
    return saveProgress(moduleId, { activities_done: p.activities_done });
  }
  function isActivityDone(moduleId, activityId) {
    const p = readProgress(moduleId);
    return (p.activities_done || []).includes(activityId);
  }

  // ----- Section completion ---------------------------------------------
  function markSection(moduleId, sectionId, doneState) {
    const p = readProgress(moduleId);
    p.completed_sections = p.completed_sections || [];
    if (doneState !== false && !p.completed_sections.includes(sectionId)) {
      p.completed_sections.push(sectionId);
    } else if (doneState === false) {
      p.completed_sections = p.completed_sections.filter(s => s !== sectionId);
    }
    return saveProgress(moduleId, { completed_sections: p.completed_sections });
  }

  // ----- Profile (Module 0 — section 0.3.1) ------------------------------
  // Stored under store.profile; syncs to POST /profile (see ARCHITECTURE_NOTES.md)
  function readProfile() {
    return readStore().profile || null;
  }
  function isProfileSaved() {
    const p = readProfile();
    return !!(p && p.updated_at);
  }
  async function saveProfile(profileData) {
    const s = readStore();
    const enriched = Object.assign({}, s.profile || {}, profileData || {}, {
      updated_at: new Date().toISOString(),
      version: 1
    });
    s.profile = enriched;
    // Mirror key display fields onto __user for dashboard / host shell
    s.__user = s.__user || getUser();
    if (enriched.institution) s.__user.institution = enriched.institution;
    if (enriched.discipline)  s.__user.discipline  = enriched.discipline;
    if (enriched.country)     s.__user.country     = enriched.country;
    writeStore(s);
    const apiPayload = { user_id: getUser().id, profile: enriched };
    if (config.apiBase) {
      try { await postToAPI('/profile', apiPayload); }
      catch { enqueue('/profile', apiPayload); }
    }
    return enriched;
  }

  // ----- Self-assessments ------------------------------------------------
  // Keys: 'pre' | 'post' | 'gate_d1' … 'gate_d4'
  // Item bank & subset rules: assessment-items.js + ARCHITECTURE_NOTES.md
  function readAssessment(assessKey) {
    const s = readStore();
    return ((s.assessments || {})[assessKey]) || null;
  }
  function readAllAssessments() {
    return readStore().assessments || {};
  }
  function isAssessmentSubmitted(assessKey) {
    const a = readAssessment(assessKey);
    return !!(a && a.submitted_at);
  }
  async function saveAssessment(assessKey, payload) {
    const s = readStore();
    s.assessments = s.assessments || {};
    const enriched = Object.assign({ version: 1 }, payload, {
      submitted_at: new Date().toISOString()
    });
    s.assessments[assessKey] = enriched;
    writeStore(s);
    const apiPayload = { user_id: getUser().id, assessment_key: assessKey, assessment: enriched };
    if (config.apiBase) {
      try { await postToAPI('/assessments', apiPayload); }
      catch { enqueue('/assessments', apiPayload); }
    }
    return enriched;
  }

  // ----- Reflections ----------------------------------------------------
  function readReflections(moduleId) {
    const s = readStore();
    return ((s.reflections || {})[moduleId]) || [];
  }
  async function saveReflection(moduleId, reflection) {
    const s = readStore();
    s.reflections = s.reflections || {};
    s.reflections[moduleId] = s.reflections[moduleId] || [];
    const existing = s.reflections[moduleId].findIndex(r => r.id === reflection.id);
    const enriched = Object.assign({
      created_at: new Date().toISOString()
    }, reflection, {
      updated_at: new Date().toISOString()
    });
    if (existing >= 0) s.reflections[moduleId][existing] = enriched;
    else s.reflections[moduleId].push(enriched);
    writeStore(s);
    const payload = { user_id: getUser().id, module_id: moduleId, reflection: enriched };
    if (config.apiBase) {
      try { await postToAPI('/reflections', payload); }
      catch { enqueue('/reflections', payload); }
    }
    return enriched;
  }

  // ----- Public API ------------------------------------------------------
  const PlatformAdapter = {
    configure(opts) { config = Object.assign({}, config, opts || {}); },
    getUser,
    saveProgress, readProgress,
    markActivity, isActivityDone,
    markSection,
    saveReflection, readReflections,
    saveProfile, readProfile, isProfileSaved,
    saveAssessment, readAssessment, readAllAssessments, isAssessmentSubmitted,
    sync: flushQueue
  };

  // Compat shim — module pages already call ProgressTracker.markStarted/Completed
  const ProgressTracker = {
    markStarted(moduleId)   { return saveProgress(moduleId, { started_at:   new Date().toISOString() }); },
    markCompleted(moduleId) { return saveProgress(moduleId, { completed_at: new Date().toISOString() }); }
  };

  // ----- postMessage handshake (host shell can inject user/auth) --------
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'platform.handshake') return;
    if (e.data.user)       window.platformUser = e.data.user;
    if (e.data.apiBase)    config.apiBase = e.data.apiBase;
    if (e.data.authHeader) config.authHeader = e.data.authHeader;
    flushQueue();
    document.dispatchEvent(new CustomEvent('platform:ready', { detail: getUser() }));
  });

  // Periodically retry the queue
  setInterval(flushQueue, 30000);
  window.addEventListener('online', flushQueue);

  window.PlatformAdapter = PlatformAdapter;
  window.ProgressTracker = ProgressTracker;
})();
