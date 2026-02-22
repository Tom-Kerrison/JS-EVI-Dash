import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart } from 'recharts';
import { Menu, X, ChevronDown, Send, Bot, User } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ============================================================================
// API CLIENT
// ============================================================================
class APIClient {
  static async fetchDashboardData(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.regions && filters.regions.length > 0) params.append('regions', filters.regions.join(','));
      if (filters.categories && filters.categories.length > 0) params.append('categories', filters.categories.join(','));
      if (filters.customerTenure && filters.customerTenure.length > 0) params.append('customerTenure', filters.customerTenure.join(','));
      if (filters.customerRecency && filters.customerRecency.length > 0) params.append('customerRecency', filters.customerRecency.join(','));
      if (filters.totalTransactionsMin !== undefined && filters.totalTransactionsMin > 0) params.append('totalTransactionsMin', filters.totalTransactionsMin);
      if (filters.totalTransactionsMax !== undefined && filters.totalTransactionsMax > 0) params.append('totalTransactionsMax', filters.totalTransactionsMax);
      if (filters.discountMin !== undefined && filters.discountMin > 0) params.append('discountMin', filters.discountMin);
      if (filters.discountMax !== undefined && filters.discountMax > 0) params.append('discountMax', filters.discountMax);
      if (filters.timeFilter && filters.timeFilter !== 'all') params.append('timeFilter', filters.timeFilter);
      
      const url = `${API_BASE_URL}/data${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
      const rawData = await response.json();
      if (!Array.isArray(rawData) || rawData.length === 0) return null;
      return rawData[0];
    } catch (error) {
      console.error('❌ Dashboard data fetch error:', error.message);
      return null;
    }
  }

  static async analyzeText(userMessage) {
    try {
      const response = await fetch(`${API_BASE_URL}/text/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_message: userMessage }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        return { success: true, summary: data.summary, timestamp: data.timestamp };
      } else {
        return { success: false, error: data.error || 'Unknown error occurred' };
      }
    } catch (error) {
      return { success: false, error: error.message || 'Failed to connect to API' };
    }
  }

  static async fetchChatHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/history?limit=20`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.success ? (data.history || []) : [];
    } catch {
      return [];
    }
  }

  static async generateGraphs(userMessage) {
    try {
      const response = await fetch(`${API_BASE_URL}/graphs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_message: userMessage }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        return { success: true, charts: data.charts || [], questions: data.questions || '', timestamp: data.timestamp };
      } else {
        return { success: false, error: data.error || 'Unknown error occurred' };
      }
    } catch (error) {
      return { success: false, error: error.message || 'Failed to connect to API' };
    }
  }
}

const formatCurrency = (value) => {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
};

const formatCurrencyWithCommas = (value) => {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const EnhancedTooltip = ({ active, payload, isCurrency = false, showAllData = false }) => {
  if (active && payload && payload.length) {
    if (showAllData && payload.length > 1) {
      return (
        <div style={{ backgroundColor: '#1e293b', border: '2px solid #3b82f6', borderRadius: '8px', color: '#e2e8f0', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          {payload.map((entry, idx) => {
            const value = entry.value;
            let formattedValue;
            if (isCurrency) formattedValue = formatCurrencyWithCommas(value);
            else if (typeof value === 'number') formattedValue = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            else formattedValue = value;
            return (
              <p key={idx} style={{ margin: '4px 0', color: entry.color || '#e2e8f0' }}>
                <strong>{entry.name}:</strong> {formattedValue}
              </p>
            );
          })}
        </div>
      );
    }
    const value = payload[0].value;
    let formattedValue;
    if (isCurrency) formattedValue = formatCurrencyWithCommas(value);
    else if (typeof value === 'number') formattedValue = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    else formattedValue = value;
    return (
      <div style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', color: '#e2e8f0', padding: '8px' }}>
        <p style={{ margin: 0 }}>{`${payload[0].name}: ${formattedValue}`}</p>
      </div>
    );
  }
  return null;
};

const styles = {
  container: { minHeight: '100vh', background: 'linear-gradient(to bottom right, #0f172a, #1e293b)' },
  header: { background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #475569', position: 'sticky', top: 0, zIndex: 50 },
  headerContent: { maxWidth: '100%', margin: '0 auto', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: '1.875rem', fontWeight: 'bold', background: 'linear-gradient(to right, #60a5fa, #22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 },
  nav: { display: 'flex', gap: '1rem' },
  navButton: (isActive) => ({ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: '500', border: 'none', cursor: 'pointer', backgroundColor: isActive ? '#2563eb' : 'transparent', color: isActive ? 'white' : '#cbd5e1' }),
  mainContainer: { display: 'grid', gridTemplateColumns: '300px 1fr' },
  mainContainerCollapsed: { display: 'grid', gridTemplateColumns: '1fr' },
  sidebar: { background: '#1e293b', borderRight: '1px solid #475569', padding: '24px', overflowY: 'auto', position: 'sticky', top: '80px', height: 'calc(100vh - 80px)', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' },
  sidebarSection: { marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #475569' },
  sidebarLabel: { fontWeight: '600', color: '#e2e8f0', marginBottom: '8px', display: 'block', fontSize: '12px' },
  sidebarSelect: { width: '100%', padding: '8px 12px', border: '1px solid #475569', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', backgroundColor: '#0f172a', color: '#e2e8f0', cursor: 'pointer' },
  sidebarInput: { width: '100%', padding: '8px 12px', border: '1px solid #475569', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', backgroundColor: '#0f172a', color: '#e2e8f0' },
  content: { padding: '32px', overflowY: 'auto', height: 'calc(100vh - 80px)' },
  kpiContainer: { background: '#1e293b', borderRadius: '12px', padding: '28px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', marginBottom: '32px', border: '1px solid #475569' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '16px' },
  kpiCard: (color) => ({ background: color, borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }),
  kpiLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: '10px' },
  kpiValue: { fontSize: '24px', fontWeight: '700', color: '#FFFFFF', margin: 0 },
  chartsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' },
  graphCard: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', paddingBottom: 0, minHeight: '400px', display: 'flex', flexDirection: 'column', border: '1px solid #475569' },
  graphCardFull: { gridColumn: 'span 2' },
  graphCardTitle: { fontSize: '16px', fontWeight: '700', color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.4', textAlign: 'center' },
  filterButtonRow: { display: 'flex', gap: '8px', marginTop: '8px' },
  filterButton: { flex: 1, padding: '6px 12px', fontSize: '11px', backgroundColor: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' },
};

// ============================================================================
// CHAT COMPONENTS
// ============================================================================

const formatTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const TypingIndicator = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', maxWidth: '80%' }}>
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Bot size={16} color="white" />
    </div>
    <div style={{
      backgroundColor: '#1e293b', border: '1px solid #334155',
      borderRadius: '18px 18px 18px 4px', padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: '6px'
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: '7px', height: '7px', borderRadius: '50%',
          backgroundColor: '#60a5fa',
          animation: 'bounce 1.2s infinite',
          animationDelay: `${i * 0.2}s`,
          display: 'inline-block'
        }} />
      ))}
    </div>
  </div>
);

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: '10px',
      marginBottom: '20px',
      maxWidth: '80%',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      marginLeft: isUser ? 'auto' : '0',
      marginRight: isUser ? '0' : 'auto',
    }}>
      {/* Avatar */}
      <div style={{
        width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
          : 'linear-gradient(135deg, #3b82f6, #06b6d4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isUser ? '0 0 12px rgba(168,85,247,0.3)' : '0 0 12px rgba(59,130,246,0.3)',
      }}>
        {isUser ? <User size={16} color="white" /> : <Bot size={16} color="white" />}
      </div>

      {/* Bubble */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '100%' }}>
        <div style={{
          backgroundColor: isUser ? '#2563eb' : '#1e293b',
          border: isUser ? '1px solid #3b82f6' : '1px solid #334155',
          borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          padding: '12px 16px',
          color: '#e2e8f0',
          fontSize: '14px',
          lineHeight: '1.6',
          boxShadow: isUser ? '0 2px 12px rgba(37,99,235,0.2)' : '0 2px 8px rgba(0,0,0,0.2)',
          wordBreak: 'break-word',
        }}>
          {message.content}
        </div>
        {message.timestamp && (
          <div style={{
            fontSize: '11px', color: '#64748b',
            textAlign: isUser ? 'right' : 'left',
            paddingLeft: isUser ? 0 : '4px',
            paddingRight: isUser ? '4px' : 0,
          }}>
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
    </div>
  );
};

const DateDivider = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 20px' }}>
    <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {label}
    </span>
    <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
  </div>
);

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function EcommerceDashboard() {
  const [currentPage, setCurrentPage] = useState('home');
  const [aggregatedData, setAggregatedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphQuery, setGraphQuery] = useState('');
  const [generatedCharts, setGeneratedCharts] = useState([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all');

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Graph chat state
  const [graphChatMessages, setGraphChatMessages] = useState([]);
  const [graphChatInput, setGraphChatInput] = useState('');
  const [graphChatLoading, setGraphChatLoading] = useState(false);
  const [graphChatHistoryLoaded, setGraphChatHistoryLoaded] = useState(false);
  const graphMessagesEndRef = useRef(null);
  const graphInputRef = useRef(null);

  const [selectedRegions, setSelectedRegions] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTenure, setSelectedTenure] = useState([]);
  const [selectedRecency, setSelectedRecency] = useState([]);
  const [totalTransactionsMin, setTotalTransactionsMin] = useState(0);
  const [totalTransactionsMax, setTotalTransactionsMax] = useState(50);
  const [discountMin, setDiscountMin] = useState(0);
  const [discountMax, setDiscountMax] = useState(1.0);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [chatMessages, chatLoading]);

  // Load chat history when text page is opened
  useEffect(() => {
    if (currentPage === 'text' && !chatHistoryLoaded) {
      APIClient.fetchChatHistory().then(history => {
        if (history.length > 0) {
          const loaded = [];
          history.forEach(row => {
            loaded.push({ role: 'user', content: row.user_message, timestamp: row.created_at });
            loaded.push({ role: 'assistant', content: row.assistant_response, timestamp: row.created_at });
          });
          setChatMessages(loaded);
        }
        setChatHistoryLoaded(true);
      });
    }
  }, [currentPage, chatHistoryLoaded]);

  // Focus input when text page opens
  useEffect(() => {
    if (currentPage === 'text') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentPage]);

  // Scroll graph chat to bottom on new messages
  useEffect(() => { graphMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [graphChatMessages, graphChatLoading]);

  // Load graph history when graph page opens
  useEffect(() => {
    if (currentPage === 'graphs' && !graphChatHistoryLoaded) {
      fetch(`${API_BASE_URL}/graphs/history?limit=20`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.history && data.history.length > 0) {
            // Graph history only has user messages (charts can't be re-rendered from DB text)
            // So we just show a "session loaded" indicator
            const loaded = data.history.map(row => ({
              role: 'user', content: row.user_message, timestamp: row.created_at
            }));
            // Interleave with assistant "Charts were generated" placeholders
            const msgs = [];
            loaded.forEach(m => {
              msgs.push(m);
              msgs.push({ role: 'assistant', content: '📊 Charts were generated for this question (re-ask to regenerate).', charts: [], timestamp: m.timestamp });
            });
            setGraphChatMessages(msgs);
          }
          setGraphChatHistoryLoaded(true);
        })
        .catch(() => setGraphChatHistoryLoaded(true));
    }
  }, [currentPage, graphChatHistoryLoaded]);

  // Focus graph input when graph page opens
  useEffect(() => {
    if (currentPage === 'graphs') {
      setTimeout(() => graphInputRef.current?.focus(), 100);
    }
  }, [currentPage]);

  const handleSelectAll = (filterType) => {
    if (!aggregatedData?.filterLists) return;
    if (filterType === 'regions') setSelectedRegions(aggregatedData.filterLists.regions || []);
    else if (filterType === 'categories') setSelectedCategories(aggregatedData.filterLists.categories || []);
    else if (filterType === 'tenure') setSelectedTenure(aggregatedData.filterLists.tenureList || []);
    else if (filterType === 'recency') setSelectedRecency(aggregatedData.filterLists.recencyList || []);
  };

  const handleClearFilter = (filterType) => {
    if (filterType === 'regions') setSelectedRegions([]);
    else if (filterType === 'categories') setSelectedCategories([]);
    else if (filterType === 'tenure') setSelectedTenure([]);
    else if (filterType === 'recency') setSelectedRecency([]);
  };

  const clearAllFilters = () => {
    setSelectedRegions([]);
    setSelectedCategories([]);
    setSelectedTenure([]);
    setSelectedRecency([]);
    setTotalTransactionsMin(0);
    setTotalTransactionsMax(aggregatedData?.filterLists?.transactionsMax || 50);
    setDiscountMin(0);
    setDiscountMax(aggregatedData?.filterLists?.discountMax || 1.0);
    setTimeFilter('all');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await APIClient.fetchDashboardData({
          regions: selectedRegions, categories: selectedCategories,
          customerTenure: selectedTenure, customerRecency: selectedRecency,
          totalTransactionsMin, totalTransactionsMax, discountMin, discountMax, timeFilter
        });
        if (!data) { setError('No data returned from API'); setAggregatedData(null); }
        else {
          setAggregatedData(data);
          if (data.filterLists) {
            setTotalTransactionsMax(data.filterLists.transactionsMax);
            setDiscountMax(data.filterLists.discountMax);
          }
          setError(null);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch data'); setAggregatedData(null);
      } finally { setLoading(false); }
    };
    fetchData();
  }, [selectedRegions, selectedCategories, selectedTenure, selectedRecency, totalTransactionsMin, totalTransactionsMax, discountMin, discountMax, timeFilter]);

  // ── Send chat message ──────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    const result = await APIClient.analyzeText(text);

    if (result.success) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: result.summary,
        timestamp: result.timestamp || new Date().toISOString()
      }]);
    } else {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I ran into an issue: ${result.error}`,
        timestamp: new Date().toISOString()
      }]);
    }
    setChatLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleGenerateGraphs = async (e) => {
    e?.preventDefault();
    if (!graphQuery.trim()) return;
    setGraphLoading(true);
    setGeneratedCharts([]);
    const result = await APIClient.generateGraphs(graphQuery);
    if (result.success) setGeneratedCharts(result.charts || []);
    else setGeneratedCharts([{ title: 'Error', chart_type: 'error', error: result.error || 'Failed to generate graphs' }]);
    setGraphLoading(false);
    setGraphQuery('');
  };

  const handleSendGraphMessage = async () => {
    const text = graphChatInput.trim();
    if (!text || graphChatLoading) return;

    const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString() };
    setGraphChatMessages(prev => [...prev, userMsg]);
    setGraphChatInput('');
    setGraphChatLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/graphs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_message: text }),
      });
      const data = await response.json();
      if (data.success) {
        setGraphChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Here are your charts for: "${text}"`,
          charts: data.charts || [],
          timestamp: data.timestamp || new Date().toISOString()
        }]);
      } else {
        setGraphChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, I ran into an issue: ${data.error || 'Unknown error'}`,
          charts: [],
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      setGraphChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Connection error: ${err.message}`,
        charts: [],
        timestamp: new Date().toISOString()
      }]);
    }
    setGraphChatLoading(false);
  };

  // ── Must be above early returns to satisfy rules-of-hooks ─────────────────
  const chatGroupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = null;
    chatMessages.forEach((msg, idx) => {
      const dateLabel = formatDate(msg.timestamp);
      if (dateLabel && dateLabel !== lastDate) {
        groups.push({ type: 'divider', label: dateLabel, key: `divider-${idx}` });
        lastDate = dateLabel;
      }
      groups.push({ type: 'message', message: msg, key: `msg-${idx}` });
    });
    return groups;
  }, [chatMessages]);

  const chatSuggestions = [
    'What is my total revenue this year?',
    'Which product category has the highest ROAS?',
    'Show me the top regions by order volume',
    'What is the average customer lifetime value?',
  ];

  if (loading) {
    return <div style={{...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><div style={{color: 'white', fontSize: '18px'}}>⏳ Loading data...</div></div>;
  }

  if (error) {
    return <div style={{...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}><div style={{color: '#ef4444', fontSize: '18px'}}>❌ {error}</div></div>;
  }

  const Navigation = () => (
    <div style={styles.header}>
      <div style={styles.headerContent}>
        <h1 style={styles.logo}>📊 Analytics Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {currentPage === 'dashboard' && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '20px', padding: '4px 8px' }} title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}>
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
          <nav style={styles.nav}>
            {['home', 'dashboard', 'text', 'graphs'].map(page => (
              <button key={page} onClick={() => setCurrentPage(page)} style={styles.navButton(currentPage === page)}>
                {page === 'text' ? 'Analyse' : page.charAt(0).toUpperCase() + page.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );

  const HomePage = () => (
    <div style={styles.container}>
      <Navigation />
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '1rem' }}>Advanced Analytics Dashboard</h2>
        <p style={{ fontSize: '1.25rem', color: '#cbd5e1', marginBottom: '3rem' }}>Track revenue, customer metrics, and product performance</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {[
            { page: 'dashboard', icon: '📊', title: 'Dashboard', desc: 'Monitor KPIs and analytics' },
            { page: 'text', icon: '💬', title: 'Analyse', desc: 'Chat with your data using natural language' },
            { page: 'graphs', icon: '📈', title: 'Reports', desc: 'Generate custom visualizations' }
          ].map(card => (
            <div key={card.page} style={{ backgroundColor: '#1e293b', borderRadius: '1rem', padding: '2rem', border: '1px solid #475569', cursor: 'pointer' }} onClick={() => setCurrentPage(card.page)}>
              <span style={{ fontSize: '3.75rem', marginBottom: '1rem', display: 'block' }}>{card.icon}</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.75rem' }}>{card.title}</h3>
              <p style={{color: '#cbd5e1', marginBottom: '1.5rem'}}>{card.desc}</p>
              <button style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(to right, #2563eb, #1d4ed8)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Explore →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const DashboardPage = () => !aggregatedData ? null : (
    <div style={styles.container}>
      <Navigation />
      <div style={sidebarOpen ? styles.mainContainer : styles.mainContainerCollapsed}>
        {sidebarOpen && (
          <div style={styles.sidebar}>
            <div style={{flex: 1, overflowY: 'auto'}}>
              <div style={styles.sidebarSection}>
                <label style={styles.sidebarLabel}>📍 Region</label>
                <select multiple style={{...styles.sidebarSelect, height: '80px'}} value={selectedRegions} onChange={(e) => setSelectedRegions(Array.from(e.target.selectedOptions, opt => opt.value))}>
                  {(aggregatedData.filterLists?.regions || []).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div style={styles.filterButtonRow}>
                  <button style={{...styles.filterButton, backgroundColor: '#2563eb', color: 'white', border: '1px solid #3b82f6'}} onClick={() => handleSelectAll('regions')}>Select All</button>
                  <button style={styles.filterButton} onClick={() => handleClearFilter('regions')}>Clear</button>
                </div>
              </div>
              <div style={styles.sidebarSection}>
                <label style={styles.sidebarLabel}>📦 Product Category</label>
                <select multiple style={{...styles.sidebarSelect, height: '80px'}} value={selectedCategories} onChange={(e) => setSelectedCategories(Array.from(e.target.selectedOptions, opt => opt.value))}>
                  {(aggregatedData.filterLists?.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={styles.filterButtonRow}>
                  <button style={{...styles.filterButton, backgroundColor: '#2563eb', color: 'white', border: '1px solid #3b82f6'}} onClick={() => handleSelectAll('categories')}>Select All</button>
                  <button style={styles.filterButton} onClick={() => handleClearFilter('categories')}>Clear</button>
                </div>
              </div>
              <div style={styles.sidebarSection}>
                <label style={styles.sidebarLabel}>👤 Customer Tenure</label>
                <select multiple style={{...styles.sidebarSelect, height: '80px'}} value={selectedTenure} onChange={(e) => setSelectedTenure(Array.from(e.target.selectedOptions, opt => opt.value))}>
                  {(aggregatedData.filterLists?.tenureList || []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div style={styles.filterButtonRow}>
                  <button style={{...styles.filterButton, backgroundColor: '#2563eb', color: 'white', border: '1px solid #3b82f6'}} onClick={() => handleSelectAll('tenure')}>Select All</button>
                  <button style={styles.filterButton} onClick={() => handleClearFilter('tenure')}>Clear</button>
                </div>
              </div>
              <div style={styles.sidebarSection}>
                <label style={styles.sidebarLabel}>📅 Customer Recency</label>
                <select multiple style={{...styles.sidebarSelect, height: '80px'}} value={selectedRecency} onChange={(e) => setSelectedRecency(Array.from(e.target.selectedOptions, opt => opt.value))}>
                  {(aggregatedData.filterLists?.recencyList || []).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div style={styles.filterButtonRow}>
                  <button style={{...styles.filterButton, backgroundColor: '#2563eb', color: 'white', border: '1px solid #3b82f6'}} onClick={() => handleSelectAll('recency')}>Select All</button>
                  <button style={styles.filterButton} onClick={() => handleClearFilter('recency')}>Clear</button>
                </div>
              </div>
              <div style={styles.sidebarSection}>
                <label style={styles.sidebarLabel}>🛒 Total Transactions: {totalTransactionsMin.toFixed(0)} - {totalTransactionsMax.toFixed(0)}</label>
                <input type="range" min="0" max={aggregatedData.filterLists?.transactionsMax || 50} step="1" value={totalTransactionsMin} onChange={(e) => setTotalTransactionsMin(parseFloat(e.target.value))} style={{width: '100%', marginBottom: '4px', cursor: 'pointer'}} />
                <input type="range" min="0" max={aggregatedData.filterLists?.transactionsMax || 50} step="1" value={totalTransactionsMax} onChange={(e) => setTotalTransactionsMax(parseFloat(e.target.value))} style={{width: '100%', cursor: 'pointer'}} />
              </div>
              <div style={styles.sidebarSection}>
                <label style={styles.sidebarLabel}>💰 Discount Applied: {(discountMin * 100).toFixed(1)}% - {(discountMax * 100).toFixed(1)}%</label>
                <input type="range" min="0" max={aggregatedData.filterLists?.discountMax || 1.0} step="0.01" value={discountMin} onChange={(e) => setDiscountMin(parseFloat(e.target.value))} style={{width: '100%', marginBottom: '4px', cursor: 'pointer'}} />
                <input type="range" min="0" max={aggregatedData.filterLists?.discountMax || 1.0} step="0.01" value={discountMax} onChange={(e) => setDiscountMax(parseFloat(e.target.value))} style={{width: '100%', cursor: 'pointer'}} />
              </div>
            </div>
            <div style={{borderTop: '1px solid #475569', paddingTop: '16px', marginTop: '16px'}}>
              <button onClick={clearAllFilters} style={{width: '100%', padding: '12px', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '8px', color: '#fca5a5', fontWeight: '600', cursor: 'pointer', fontSize: '12px'}}
                onMouseEnter={(e) => {e.target.style.backgroundColor = '#991b1b'}}
                onMouseLeave={(e) => {e.target.style.backgroundColor = '#7f1d1d'}}>
                🗑️ Clear All Filters
              </button>
            </div>
          </div>
        )}

        <div style={styles.content}>
          <div style={styles.kpiContainer}>
            <div style={styles.kpiGrid}>
              {[
                { label: 'Total Revenue', value: formatCurrency(aggregatedData.kpis?.totalRevenue || 0), color: 'linear-gradient(135deg, #3b82f6, #06b6d4)' },
                { label: 'Avg AOV', value: formatCurrency(aggregatedData.kpis?.avgAOV || 0), color: 'linear-gradient(135deg, #10b981, #059669)' },
                { label: 'Avg LTV', value: formatCurrency(aggregatedData.kpis?.avgLTV || 0), color: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
                { label: 'Avg CAC %', value: `${(aggregatedData.kpis?.avgCACPercent || 0).toFixed(2)}%`, color: 'linear-gradient(135deg, #f97316, #ea580c)' },
                { label: 'Avg ROAS', value: `${(aggregatedData.kpis?.avgROAS || 0).toFixed(2)}x`, color: 'linear-gradient(135deg, #ec4899, #db2777)' },
                { label: 'Avg Lifetime', value: `${(aggregatedData.kpis?.avgLifetime || 0).toFixed(0)} days`, color: 'linear-gradient(135deg, #64748b, #475569)' },
              ].map((kpi, idx) => (
                <div key={idx} style={styles.kpiCard(kpi.color)}>
                  <div style={styles.kpiLabel}>{kpi.label}</div>
                  <h2 style={styles.kpiValue}>{kpi.value}</h2>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginBottom: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%'}}>
            {['1m', '3m', '6m', '1y', 'all'].map(period => (
              <button key={period} onClick={() => setTimeFilter(period)} style={{padding: '10px 20px', flex: '1 1 auto', backgroundColor: timeFilter === period ? '#3b82f6' : '#334155', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', minWidth: '120px'}}>
                {period === '1m' ? 'Last Month' : period === '3m' ? '3 Months' : period === '6m' ? '6 Months' : period === '1y' ? '1 Year' : 'All Time'}
              </button>
            ))}
          </div>

          <div style={styles.chartsGrid}>
            <div style={{...styles.graphCard, ...styles.graphCardFull}}>
              <h3 style={styles.graphCardTitle}>📈 Monthly Revenue vs Customer Acquisition Cost</h3>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={aggregatedData.monthlyData || []} margin={{top: 20, right: 80, left: 80, bottom: 20}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="month" stroke="white" tick={{ fill: 'white' }}
                    tickFormatter={(value) => { const d = new Date(value); return isNaN(d) ? value : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }}
                    label={{ value: 'Month', position: 'insideBottom', offset: -15, fill: 'white' }} />
                  <YAxis yAxisId="left" stroke="white" width={70} tick={{ fill: 'white' }}
                    tickFormatter={(value) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    domain={['dataMin - dataMin * 0.1', 'dataMax + dataMax * 0.1']}
                    label={{ value: 'Revenue ($)', angle: -90, position: 'center', dx: -100, fill: 'white', style: { textAnchor: 'middle' } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="white" width={70} tick={{ fill: 'white' }}
                    tickFormatter={(value) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    domain={['dataMin - dataMin * 0.1', 'dataMax + dataMax * 0.1']}
                    label={{ value: 'CAC ($)', angle: 90, position: 'center', dx: 40, fill: 'white', style: { textAnchor: 'middle' } }} />
                  <Tooltip content={<EnhancedTooltip isCurrency={true} showAllData={true} />} />
                  <Legend wrapperStyle={{ marginTop: '-20px' }} verticalAlign="top" />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Total Revenue" dot={{ r: 4 }} />
                  <Line yAxisId="right" type="monotone" dataKey="cac" stroke="#f97316" strokeWidth={2} name="CAC" dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.graphCard}>
              <h3 style={styles.graphCardTitle}>🗺️ Order Distribution by Region</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={aggregatedData.regionData || []} cx="50%" cy="50%" dataKey="value" nameKey="name">
                    {(aggregatedData.regionData || []).map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<EnhancedTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...styles.graphCard, paddingBottom: 0 }}>
              <h3 style={styles.graphCardTitle}>📦 Product Category Order Volume Trends</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={[...(aggregatedData.categoryMonthlyData || [])].sort((a, b) => new Date(a.month) - new Date(b.month))} margin={{ top: 10, right: 20, left: 20, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="month" stroke="white" tick={{ fill: 'white' }} label={{ value: 'Month', position: 'insideBottom', offset: -20, fill: 'white' }} />
                  <YAxis stroke="white" width={70} tick={{ fill: 'white' }} label={{ value: 'Order Count', angle: -90, position: 'center', dx: -20, fill: 'white', style: { textAnchor: 'middle' } }} />
                  <Tooltip content={<EnhancedTooltip />} />
                  <Legend verticalAlign="top" align="center" wrapperStyle={{ marginTop: -15 }} />
                  {aggregatedData.categoryMonthlyData && aggregatedData.categoryMonthlyData.length > 0
                    ? Object.keys(aggregatedData.categoryMonthlyData[0]).filter(key => key !== 'month').map((category, idx) => {
                        const colors = ['#3b82f6', '#f97316', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];
                        return <Bar key={category} dataKey={category} stackId="volume" fill={colors[idx % colors.length]} name={category} radius={[0, 0, 0, 0]} />;
                      })
                    : null}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.graphCard}>
              <h3 style={styles.graphCardTitle}>🛍️ Customer Purchase Frequency Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={aggregatedData.histogramData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="num_purchases" stroke="white" tick={{ fill: 'white' }} label={{ value: 'Number of Purchases', position: 'insideBottom', offset: -5, fill: 'white' }} />
                  <YAxis stroke="white" width={70} tick={{ fill: 'white' }} label={{ value: 'Customer Count', angle: -90, position: 'center', dx: -25, fill: 'white', style: { textAnchor: 'middle' } }} />
                  <Tooltip content={<EnhancedTooltip />} />
                  <Bar dataKey="customer_count" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.graphCard}>
              <h3 style={styles.graphCardTitle}>📊 Return on Ad Spend by Product Category</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={aggregatedData.roasCategoryData || []} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis type="number" stroke="white" tick={{ fill: 'white' }} label={{ value: 'ROAS (x)', position: 'insideBottom', offset: -15, fill: 'white', style: { textAnchor: 'middle' } }} />
                  <YAxis dataKey="category" type="category" stroke="white" width={120} tick={{ fill: 'white' }} />
                  <Tooltip content={<EnhancedTooltip />} />
                  <Bar dataKey="avg_roas" fill="#ec4899" radius={[0, 8, 8, 0]} name="Avg ROAS" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...styles.graphCard, ...styles.graphCardFull }}>
              <h3 style={styles.graphCardTitle}>💰 Average Order Value vs Customer Lifetime Value by Tenure</h3>
              <div style={{ marginBottom: 10 }}>
                <Legend verticalAlign="top" align="center" payload={[{ value: "Avg Order Value", type: "line", color: "#10b981" }]} />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={aggregatedData.aovDaysData || []} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="weeks_since_first" stroke="white" tick={{ fill: "white" }} label={{ value: "Weeks Since First Purchase", position: "insideBottom", offset: -15, fill: "white" }} />
                  <YAxis stroke="white" width={70} tick={{ fill: "white" }} domain={([dataMin, dataMax]) => [Math.floor(dataMin * 0.95), Math.ceil(dataMax * 1.05)]}
                    label={{ value: "Average Order Value ($)", angle: -90, position: "center", dx: -40, fill: "white", style: { textAnchor: "middle" } }} />
                  <Tooltip content={<EnhancedTooltip isCurrency={true} />} />
                  <Line type="monotone" dataKey="avg_aov" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const chatPageJSX = (
      <div style={{ ...styles.container, display: 'flex', flexDirection: 'column' }}>
        <style>{`
          @keyframes bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-6px); opacity: 1; }
          }
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .chat-message-animate { animation: fadeSlideIn 0.25s ease-out forwards; }
          textarea:focus { outline: none; }
          textarea { resize: none; }
        `}</style>
        <Navigation />

        {/* Chat wrapper — full height minus header */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: '860px', width: '100%', margin: '0 auto', padding: '0 16px' }}>

          {/* Header strip */}
          <div style={{ padding: '20px 0 12px', borderBottom: '1px solid #1e293b', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(59,130,246,0.4)' }}>
              <Bot size={18} color="white" />
            </div>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '15px' }}>Data Analyst</div>
              <div style={{ color: '#22c55e', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                Connected to your database
              </div>
            </div>
          </div>

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>
            {/* Empty state */}
            {chatMessages.length === 0 && !chatLoading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px 0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
                  <h3 style={{ color: '#e2e8f0', margin: '0 0 8px', fontSize: '20px', fontWeight: '700' }}>Ask about your data</h3>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>I can query your database and explain the results in plain language.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', maxWidth: '560px' }}>
                {chatSuggestions.map((s, i) => (
                    <button key={i} onClick={() => { setChatInput(s); inputRef.current?.focus(); }}
                      style={{ padding: '12px 14px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', textAlign: 'left', lineHeight: '1.4', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#273549'; e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}>
                      → {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {chatGroupedMessages.map(item =>
              item.type === 'divider'
                ? <DateDivider key={item.key} label={item.label} />
                : <div key={item.key} className="chat-message-animate"><ChatMessage message={item.message} /></div>
            )}

            {/* Typing indicator */}
            {chatLoading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ flexShrink: 0, paddingBottom: '20px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              backgroundColor: '#1e293b', border: '1px solid #334155',
              borderRadius: '16px', padding: '10px 12px',
              boxShadow: '0 0 0 0px #3b82f6', transition: 'box-shadow 0.2s',
            }}
              onFocusCapture={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.4)'}
              onBlurCapture={e => e.currentTarget.style.boxShadow = '0 0 0 0px #3b82f6'}
            >
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Ask a question about your data..."
                value={chatInput}
                onChange={e => { setChatInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={handleKeyDown}
                disabled={chatLoading}
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: '#e2e8f0', fontSize: '14px', lineHeight: '1.5',
                  fontFamily: 'inherit', padding: '4px 0',
                  maxHeight: '120px', overflowY: 'auto',
                  opacity: chatLoading ? 0.6 : 1,
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: chatInput.trim() && !chatLoading ? 'linear-gradient(135deg, #3b82f6, #06b6d4)' : '#334155',
                  border: 'none', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  boxShadow: chatInput.trim() && !chatLoading ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                }}
              >
                <Send size={16} color={chatInput.trim() && !chatLoading ? 'white' : '#64748b'} />
              </button>
            </div>
            <p style={{ color: '#475569', fontSize: '11px', margin: '8px 0 0', textAlign: 'center' }}>
              Press Enter to send · Shift+Enter for new line · Conversation is saved to your database
            </p>
          </div>
        </div>
      </div>
  );

  // ── GRAPH CHAT STATE (above early returns — OK here since no early returns above us) ──
  // graphChatMessages, graphChatInput etc. are defined at top of component

  const graphPageJSX = (
    <div style={{ ...styles.container, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .graph-msg-animate { animation: fadeSlideIn 0.25s ease-out forwards; }
        textarea.graph-input:focus { outline: none; }
        textarea.graph-input { resize: none; }
      `}</style>
      <Navigation />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '0 16px' }}>

        {/* Header strip */}
        <div style={{ padding: '20px 0 12px', borderBottom: '1px solid #1e293b', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
          </div>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '15px' }}>Chart Generator</div>
            <div style={{ color: '#22c55e', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
              Connected to your database
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column' }}>

          {/* Empty state */}
          {graphChatMessages.length === 0 && !graphChatLoading && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📈</div>
                <h3 style={{ color: '#e2e8f0', margin: '0 0 8px', fontSize: '20px', fontWeight: '700' }}>Generate charts from your data</h3>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Ask a business question and I'll create visualizations automatically.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', maxWidth: '600px' }}>
                {[
                  'Show total revenue trends over time',
                  'Which product categories perform best?',
                  'How are customers distributed by region?',
                  'What is the relationship between discount and revenue?',
                ].map((s, i) => (
                  <button key={i} onClick={() => { setGraphChatInput(s); graphInputRef.current?.focus(); }}
                    style={{ padding: '12px 14px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', textAlign: 'left', lineHeight: '1.4', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#273549'; e.currentTarget.style.color = '#e2e8f0'; e.currentTarget.style.borderColor = '#7c3aed'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1e293b'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}>
                    → {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message + chart bubbles */}
          {graphChatMessages.map((msg, idx) => {
            if (msg.role === 'user') {
              return (
                <div key={idx} className="graph-msg-animate" style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: '10px', marginBottom: '20px', maxWidth: '70%', alignSelf: 'flex-end', marginLeft: 'auto' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}>
                    <User size={16} color="white" />
                  </div>
                  <div>
                    <div style={{ backgroundColor: '#7c3aed', border: '1px solid #8b5cf6', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6', boxShadow: '0 2px 12px rgba(124,58,237,0.2)' }}>
                      {msg.content}
                    </div>
                    {msg.timestamp && <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right', paddingRight: '4px', marginTop: '4px' }}>{new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
                  </div>
                </div>
              );
            }

            if (msg.role === 'assistant') {
              return (
                <div key={idx} className="graph-msg-animate" style={{ marginBottom: '24px', maxWidth: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(124,58,237,0.3)' }}>
                      <span style={{ fontSize: '14px' }}>📊</span>
                    </div>
                    <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6' }}>
                      {msg.content}
                    </div>
                  </div>

                  {/* Charts for this message */}
                  {msg.charts && msg.charts.length > 0 && (
                    <div style={{ paddingLeft: '44px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {msg.charts.map((chart, ci) => {
                        // ── Always show something — never silently drop ──────
                        const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#f59e0b', '#06b6d4'];

                        if (chart.chart_type === 'error') {
                          return (
                            <div key={ci} style={{ backgroundColor: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '12px', padding: '14px 16px' }}>
                              <div style={{ color: '#f87171', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>⚠️ {chart.title}</div>
                              <div style={{ color: '#fca5a5', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{chart.error}</div>
                            </div>
                          );
                        }

                        // Validate data
                        if (!chart.data || !Array.isArray(chart.data) || chart.data.length === 0) {
                          return (
                            <div key={ci} style={{ backgroundColor: '#1c1a0a', border: '1px solid #713f12', borderRadius: '12px', padding: '14px 16px' }}>
                              <span style={{ color: '#fde68a', fontSize: '13px' }}>⚠️ {chart.title}: No data returned</span>
                            </div>
                          );
                        }

                        // Derive x/y keys robustly — use xKey/yKey from backend, or fall back to first/second column of first record
                        const firstRecord = chart.data[0];
                        const allKeys = Object.keys(firstRecord);
                        const xKey = chart.xKey && allKeys.includes(chart.xKey) ? chart.xKey : allKeys[0];
                        const yKey = chart.yKey && allKeys.includes(chart.yKey) ? chart.yKey : allKeys[1];

                        if (!xKey || !yKey) {
                          return (
                            <div key={ci} style={{ backgroundColor: '#1c1a0a', border: '1px solid #713f12', borderRadius: '12px', padding: '14px 16px' }}>
                              <span style={{ color: '#fde68a', fontSize: '13px' }}>⚠️ {chart.title}: Could not determine chart columns (got: {allKeys.join(', ')})</span>
                            </div>
                          );
                        }

                        const chartType = chart.chart_type || 'bar';
                        const commonMargin = { top: 10, right: 20, left: 10, bottom: 40 };
                        const xAxisProps = {
                          dataKey: xKey,
                          stroke: '#64748b',
                          tick: { fill: '#94a3b8', fontSize: 11 },
                          interval: 0,
                          angle: chart.data.length > 8 ? -35 : 0,
                          textAnchor: chart.data.length > 8 ? 'end' : 'middle',
                          height: chart.data.length > 8 ? 60 : 30,
                        };
                        const yAxisProps = {
                          stroke: '#64748b',
                          width: 70,
                          tick: { fill: '#94a3b8', fontSize: 11 },
                          tickFormatter: v => {
                            const n = Number(v);
                            if (isNaN(n)) return v;
                            if (Math.abs(n) >= 1000000) return `${(n/1000000).toFixed(1)}M`;
                            if (Math.abs(n) >= 1000) return `${(n/1000).toFixed(1)}K`;
                            return n.toLocaleString();
                          }
                        };

                        let chartComponent;
                        if (chartType === 'pie') {
                          chartComponent = (
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie data={chart.data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={110}
                                  label={({ name, percent }) => percent > 0.04 ? `${String(name).slice(0,15)} ${(percent*100).toFixed(0)}%` : ''}
                                  labelLine={{ stroke: '#475569' }}>
                                  {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(val) => [Number(val).toLocaleString(), yKey]} />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          );
                        } else if (chartType === 'line' || chartType === 'area') {
                          chartComponent = (
                            <ResponsiveContainer width="100%" height={280}>
                              <LineChart data={chart.data} margin={commonMargin}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis {...xAxisProps} />
                                <YAxis {...yAxisProps} />
                                <Tooltip formatter={(val) => [Number(val).toLocaleString(), yKey]} />
                                <Line type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={2.5} dot={{ r: 4, fill: COLORS[0], strokeWidth: 0 }} activeDot={{ r: 6 }} name={yKey} />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        } else {
                          // bar (default for anything else)
                          chartComponent = (
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={chart.data} margin={commonMargin}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis {...xAxisProps} />
                                <YAxis {...yAxisProps} />
                                <Tooltip formatter={(val) => [Number(val).toLocaleString(), yKey]} />
                                <Bar dataKey={yKey} radius={[6, 6, 0, 0]} name={yKey} maxBarSize={60}>
                                  {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        }

                        return (
                          <div key={ci} style={{ backgroundColor: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '16px', padding: '20px 16px 12px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
                            <h4 style={{ color: '#cbd5e1', margin: '0 0 16px', fontSize: '13px', fontWeight: '600', textAlign: 'center', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{chart.title}</h4>
                            {chartComponent}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })}

          {/* Typing / loading indicator */}
          {graphChatLoading && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px' }}>📊</span>
              </div>
              <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#7c3aed', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s`, display: 'inline-block' }} />
                ))}
                <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>Generating charts…</span>
              </div>
            </div>
          )}

          <div ref={graphMessagesEndRef} />
        </div>

        {/* Input area */}
        <div style={{ flexShrink: 0, paddingBottom: '20px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
          <div style={{
            display: 'flex', gap: '10px', alignItems: 'flex-end',
            backgroundColor: '#1e293b', border: '1px solid #334155',
            borderRadius: '16px', padding: '10px 12px', transition: 'box-shadow 0.2s',
          }}
            onFocusCapture={e => e.currentTarget.style.boxShadow = '0 0 0 2px rgba(124,58,237,0.4)'}
            onBlurCapture={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <textarea
              ref={graphInputRef}
              className="graph-input"
              rows={1}
              placeholder="Ask a business question to generate charts..."
              value={graphChatInput}
              onChange={e => { setGraphChatInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendGraphMessage(); } }}
              disabled={graphChatLoading}
              style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: '14px', lineHeight: '1.5', fontFamily: 'inherit', padding: '4px 0', maxHeight: '120px', overflowY: 'auto', opacity: graphChatLoading ? 0.6 : 1 }}
            />
            <button
              onClick={handleSendGraphMessage}
              disabled={!graphChatInput.trim() || graphChatLoading}
              style={{
                width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                background: graphChatInput.trim() && !graphChatLoading ? 'linear-gradient(135deg, #7c3aed, #ec4899)' : '#334155',
                border: 'none', cursor: graphChatInput.trim() && !graphChatLoading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                boxShadow: graphChatInput.trim() && !graphChatLoading ? '0 2px 8px rgba(124,58,237,0.3)' : 'none',
              }}
            >
              <Send size={16} color={graphChatInput.trim() && !graphChatLoading ? 'white' : '#64748b'} />
            </button>
          </div>
          <p style={{ color: '#475569', fontSize: '11px', margin: '8px 0 0', textAlign: 'center' }}>
            Enter to send · Shift+Enter for new line · Charts are saved to your database
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {currentPage === 'home' && <HomePage />}
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'text' && chatPageJSX}
      {currentPage === 'graphs' && graphPageJSX}
    </>
  );
}