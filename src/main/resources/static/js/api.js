/**
 * api.js - REST API Client for AET Group Portfolio
 * Connects frontend to Spring Boot backend endpoints for members, notes, and visit counter.
 */

const API = {
  baseUrl: '',

  /**
   * Fetches all 5 members
   * @returns {Promise<Array>}
   */
  async getMembers() {
    try {
      const response = await fetch(`${this.baseUrl}/api/members`);
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
      const response = await fetch(`${this.baseUrl}/api/members/${id}`);
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
      const response = await fetch(`${this.baseUrl}/api/members/${memberId}/notes`);
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
      const response = await fetch(`${this.baseUrl}/api/notes`);
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
      const response = await fetch(`${this.baseUrl}/api/members/${memberId}/notes`, {
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
      const response = await fetch(`${this.baseUrl}/api/visit`, {
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
