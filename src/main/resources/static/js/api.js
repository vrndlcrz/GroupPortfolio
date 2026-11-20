/**
 * api.js - REST API Client for AET Group Portfolio
 * Connects frontend to Spring Boot backend endpoints for members, notes, and visit counter.
 */

const classroomDefaults = {

  "board": {
    "title": "Sean Dyogi Truthers",
    "subtitle": "Group 1",
    "names": [
      "Riam Jaye Santiago",
      "John Vernie Dela Cruz",
      "Charella Magalpoc",
      "Nicole Leigh G. De Guzman"
    ]
  },
  "mission": {
    "title": "MISSION",
    "text": "Chocolate chocolate chocolate choco"
  },
  "vision": {
    "title": "VISION",
    "text": "De canela, de canela, de canela"
  },
  "whiteboardLines": [
    "AET Group Portfolio",
    "07:30   Filipino",
    "08:30   Mathematics",
    "10:00   Application and Emerging Technologies",
    "Attendance: present, even if the Wi-Fi is absent.",
    "Homework: save before you celebrate."
  ],
  "tvSlides": [
    "AET Group Portfolio",
    "Application and Emerging Technologies",
    "Click the laptop"
  ],
  "teacherLines": [
    "Okay class, settle down.",
    "Sinong hindi pa nakakapag-submit?",
    "Open your notebooks."
  ]
};

function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
}

const API = {
  getClassroom() {
    return this.classroomRequest ??= this.loadClassroom();
  },
  async loadClassroom() {
    try {
      const response = await fetchWithTimeout(this.baseUrl + '/api/site/classroom');
      if (!response.ok) throw new Error('Classroom unavailable');
      const data = await response.json();
      for (const key of ['whiteboardLines', 'tvSlides', 'teacherLines']) {
        if (!Array.isArray(data[key]) || !data[key].length ||
          !data[key].every(line => typeof line === 'string' && line.trim())) return classroomDefaults;
      }
      const text = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback;
      const result = { ...classroomDefaults, ...data };
      for (const key of ['board', 'mission', 'vision']) {
        result[key] = { ...classroomDefaults[key] };
        for (const [field, fallback] of Object.entries(result[key])) {
          const value = data[key]?.[field];
          result[key][field] = Array.isArray(fallback)
            ? (Array.isArray(value) && value.length && value.every(v => text(v, '')) ? value : fallback)
            : text(value, fallback);
        }
      }
      return result;
    } catch {
      return classroomDefaults;
    }
  },

  baseUrl: '',

  /**
   * Fetches all 4 members
   * @returns {Promise<Array>}
   */
  async getMembers() {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/members`);
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error in getMembers:', error);
      throw new Error('Could not load member records. The server might be taking a coffee nap.');
    }
  },

  /**
   * Fetches single member's complete portfolio
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async getMember(id) {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/members/${id}`);
      if (!response.ok) {
        throw new Error(`Member #${id} not found (HTTP ${response.status})`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error in getMember(${id}):`, error);
      throw error;
    }
  },

  /**
   * Fetches guestbook notes for a member
   * @param {number|string} memberId
   * @returns {Promise<Array>}
   */
  async getMemberNotes(memberId) {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/members/${memberId}/notes`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error in getMemberNotes(${memberId}):`, error);
      return [];
    }
  },

  /**
   * Fetches all guestbook notes across all members (for 3D desk sticky notes)
   * @returns {Promise<Array>}
   */
  async getAllNotes() {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/notes`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('API Error in getAllNotes:', error);
      return [];
    }
  },

  /**
   * Posts a new guestbook note
   * @param {number|string} memberId
   * @param {string} text
   * @param {string} author
   * @returns {Promise<Object>}
   */
  async postNote(memberId, text, author) {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/members/${memberId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          author: author || 'Anonymous'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error('API Error in postNote:', error);
      throw error;
    }
  },

  /**
   * Records a site visit and receives visitor joke
   * @returns {Promise<Object>}
   */
  async recordVisit() {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/visit`, {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('API Error in recordVisit:', error);
      return { count: 42, message: 'You are visitor #42. Please go touch grass.' };
    }
  }
};

window.API = API;
