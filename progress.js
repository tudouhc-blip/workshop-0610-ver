// progress.js - tracks workshop progress in browser storage
const ProgressTracker = {
  STORAGE_KEY: 'genai_workshop_progress',
  
  _getStorage() {
    try {
      localStorage.setItem('__test__', '1');
      localStorage.removeItem('__test__');
      return localStorage;
    } catch (e) {
      console.warn('Storage unavailable. Progress will not persist.');
      return null;
    }
  },
  
  _defaultData() {
    return {
      userName: '',
      modules: {
        module_0: { started: false, completed: false, lastVisited: null },
        module_1: { started: false, completed: false, lastVisited: null },
        module_2: { started: false, completed: false, lastVisited: null }
      },
      startedAt: null
    };
  },
  
  load() {
    const storage = this._getStorage();
    if (!storage) return this._defaultData();
    try {
      const saved = storage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : this._defaultData();
    } catch (e) {
      return this._defaultData();
    }
  },
  
  save(data) {
    const storage = this._getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save progress:', e);
    }
  },
  
  markStarted(moduleId) {
    const data = this.load();
    if (!data.startedAt) data.startedAt = new Date().toISOString();
    if (data.modules[moduleId]) {
      data.modules[moduleId].started = true;
      data.modules[moduleId].lastVisited = new Date().toISOString();
    }
    this.save(data);
  },
  
  markCompleted(moduleId) {
    const data = this.load();
    if (data.modules[moduleId]) {
      data.modules[moduleId].completed = true;
      data.modules[moduleId].started = true;
      data.modules[moduleId].lastVisited = new Date().toISOString();
    }
    this.save(data);
  },
  
  setUserName(name) {
    const data = this.load();
    data.userName = name;
    this.save(data);
  },
  
  getCompletionPercent() {
    const data = this.load();
    const modules = Object.values(data.modules);
    const completed = modules.filter(m => m.completed).length;
    return Math.round((completed / modules.length) * 100);
  },
  
  reset() {
    const storage = this._getStorage();
    if (storage) storage.removeItem(this.STORAGE_KEY);
  }
};