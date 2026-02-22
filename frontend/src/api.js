// ============================================================================
// LEARNING: This is a utility module - a reusable collection of functions
// that handle communication with the backend API. Modules like this keep
// our code organized and maintainable by separating concerns.
// ============================================================================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class APIClient {
  /**
   * =========================================================================
   * LEARNING: Static methods belong to the class itself, not instances
   * This means we can call APIClient.analyzeText() without creating a new
   * instance. It's a common pattern for utility functions.
   * =========================================================================
   */

  /**
   * Analyze text with AI-powered SQL generation
   * @param {string} userMessage - The user's question about their data
   * @returns {Promise<Object>} - {success, summary, questions, results, error}
   */
  static async analyzeText(userMessage) {
    try {
      const response = await fetch(`${API_BASE_URL}/text/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          summary: data.summary,
          questions: data.questions || [],
          results: data.results || [],
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: data.error || 'Unknown error occurred',
        };
      }
    } catch (error) {
      console.error('Text analysis error:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to API',
      };
    }
  }

  /**
   * Generate graphs/visualizations based on user description
   * @param {string} userMessage - Description of the visualization to create
   * @returns {Promise<Object>} - {success, charts, questions, error}
   */
  static async generateGraphs(userMessage) {
    try {
      const response = await fetch(`${API_BASE_URL}/graphs/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return {
          success: true,
          charts: data.charts || [],
          questions: data.questions || '',
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: data.error || 'Unknown error occurred',
        };
      }
    } catch (error) {
      console.error('Graph generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to API',
      };
    }
  }

  /**
   * Check if the backend API is healthy and responding
   * @returns {Promise<boolean>} - true if API is healthy, false otherwise
   */
  static async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export default APIClient;