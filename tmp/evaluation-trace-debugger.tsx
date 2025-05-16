import React, { useState, useEffect, useContext, createContext } from 'react';
import { ReactFlow, Background, Controls, Panel, Node, Edge, NodeTypes, EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Context for managing trace data
const TraceContext = createContext(null);

// Main App Component
const EvaluationTraceDebugger = () => {
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    ruleStatus: 'all',
    factType: 'all',
    errorStatus: 'all'
  });

  useEffect(() => {
    // Load sample data on mount
    const loadSampleData = async () => {
      try {
        setLoading(true);
        // In a real app, this would be a fetch call to an API or file upload
        const response = await window.fs.readFile('trace-evaluation.json', { encoding: 'utf8' });
        const data = JSON.parse(response);
        setTraceData(data);
        setLoading(false);
      } catch (err) {
        setError("Failed to load trace data: " + err.message);
        setLoading(false);
      }
    };
    
    loadSampleData();
  }, []);

  const handleFileUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      
      setLoading(true);
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          setTraceData(data);
          setError(null);
        } catch (err) {
          setError("Invalid JSON file: " + err.message);
        } finally {
          setLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError("Failed to read file");
        setLoading(false);
      };
      
      reader.readAsText(file);
    } catch (err) {
      setError("File upload error: " + err.message);
      setLoading(false);
    }
  };

  const exportAuditReport = () => {
    if (!traceData) return;
    
    // Create a simple report as JSON
    const report = {
      traceId: traceData.traceId,
      timestamp: traceData.timestamp,
      events: traceData.outputs.events,
      triggeredRules: traceData.evaluations.rules.filter(rule => rule.result),
      criticalFacts: traceData.evaluations.facts.filter(fact => 
        traceData.evaluations.rules.some(rule => 
          rule.result && rule.conds.some(cond => cond.fact === fact.id)
        )
      )
    };
    
    // Convert to a downloadable string
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    
    // Create and trigger download
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `trace-audit-${traceData.traceId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading trace data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-red-600 mb-4">{error}</div>
        <button 
          onClick={() => setError(null)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!traceData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Evaluation Trace Debugger</h1>
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <label className="block text-lg font-medium text-gray-700 mb-4">Upload a Trace JSON File</label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
    );
  }

  return (
    <TraceContext.Provider value={{ traceData, setTraceData }}>
      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <Header 
          traceData={traceData} 
          onSearch={handleSearch} 
        />
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
          />
          
          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4">
            {/* Filter Panel */}
            <FilterPanel 
              filters={filters} 
              onFilterChange={handleFilterChange} 
            />
            
            {/* Tab Content */}
            <div className="mt-4 bg-white rounded-lg shadow p-6">
              {activeTab === 'events' && <EventsTab traceData={traceData} searchQuery={searchQuery} />}
              {activeTab === 'rules' && <RulesTab traceData={traceData} searchQuery={searchQuery} filters={filters} />}
              {activeTab === 'facts' && <FactsTab traceData={traceData} searchQuery={searchQuery} filters={filters} />}
              {activeTab === 'summary' && <SummaryTab traceData={traceData} />}
            </div>
          </main>
        </div>
        
        {/* Footer */}
        <footer className="bg-white p-3 border-t flex justify-between items-center">
          <div className="text-sm text-gray-600">Engine Version: {traceData.engineVersion}</div>
          <button 
            onClick={exportAuditReport}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Export Audit Report
          </button>
        </footer>
      </div>
    </TraceContext.Provider>
  );
};

// Header Component
const Header = ({ traceData, onSearch }) => {
  return (
    <header className="bg-white p-4 border-b shadow-sm">
      <div className="container mx-auto flex flex-col md:flex-row md:justify-between md:items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <h1 className="text-xl font-bold text-gray-800 mr-4">Evaluation Trace Debugger</h1>
          <div className="text-sm text-gray-600">
            <span className="mr-4">TraceID: {traceData.traceId}</span>
            <span>Timestamp: {new Date(traceData.timestamp).toLocaleString()}</span>
          </div>
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search traces, rules, facts..."
            className="w-full md:w-64 pl-10 pr-4 py-2 border rounded-lg"
            onChange={(e) => onSearch(e.target.value)}
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            {/* Search icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
};

// Sidebar Component
const Sidebar = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'events', label: 'Events', icon: 'bell' },
    { id: 'rules', label: 'Rules', icon: 'check-circle' },
    { id: 'facts', label: 'Facts', icon: 'database' },
    { id: 'summary', label: 'Summary', icon: 'clipboard' }
  ];
  
  return (
    <nav className="w-16 md:w-48 bg-gray-800 text-white">
      <ul>
        {tabs.map(tab => (
          <li key={tab.id} className="mb-1">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center p-3 md:p-4 hover:bg-gray-700 ${
                activeTab === tab.id ? 'bg-gray-700' : ''
              }`}
            >
              <span className="mr-3 hidden md:inline">{tab.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

// Filter Panel Component
const FilterPanel = ({ filters, onFilterChange }) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-700 mb-3">Filters</h2>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Rule Status</label>
          <select 
            value={filters.ruleStatus} 
            onChange={(e) => onFilterChange('ruleStatus', e.target.value)}
            className="w-40 border rounded p-1.5"
          >
            <option value="all">All Rules</option>
            <option value="triggered">Triggered Rules</option>
            <option value="not-triggered">Non-Triggered Rules</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Fact Type</label>
          <select 
            value={filters.factType} 
            onChange={(e) => onFilterChange('factType', e.target.value)}
            className="w-40 border rounded p-1.5"
          >
            <option value="all">All Facts</option>
            <option value="compute">Compute Facts</option>
            <option value="reference">Reference Facts</option>
            <option value="aggregate">Aggregate Facts</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Error Status</label>
          <select 
            value={filters.errorStatus} 
            onChange={(e) => onFilterChange('errorStatus', e.target.value)}
            className="w-40 border rounded p-1.5"
          >
            <option value="all">All Facts</option>
            <option value="errored">Errored Facts</option>
            <option value="success">Success Facts</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// Events Tab Component
const EventsTab = ({ traceData, searchQuery }) => {
  const { outputs } = traceData;
  
  // Filter events based on search query
  const filteredEvents = outputs.events.filter(event => 
    event.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.params.message && event.params.message.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Triggered Events</h2>
      
      {filteredEvents.length === 0 ? (
        <p className="text-gray-600">No events match your search criteria.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event, index) => (
            <EventCard key={index} event={event} />
          ))}
        </div>
      )}
      
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Event Summary</h3>
        <div className="bg-gray-50 p-4 rounded">
          <p>Total Events: {outputs.summary.events}</p>
          <p>Total Rules: {outputs.summary.rules}</p>
          <p>Total Facts: {outputs.summary.facts}</p>
          <p>Total Errors: {outputs.summary.errors}</p>
        </div>
      </div>
    </div>
  );
};

// Event Card Component
const EventCard = ({ event }) => {
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-100 border-red-500 text-red-800';
      case 'warning': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'info': return 'bg-blue-100 border-blue-500 text-blue-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };
  
  return (
    <div className={`rounded-lg border-l-4 p-4 shadow ${getSeverityColor(event.params.severity)}`}>
      <div className="font-semibold mb-2">{event.type}</div>
      {event.params.message && <p className="text-sm mb-2">{event.params.message}</p>}
      
      <div className="flex justify-between items-center mt-2">
        {event.params.severity && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-white">
            {event.params.severity}
          </span>
        )}
        
        {event.params.action && (
          <span className="text-xs">Action: {event.params.action}</span>
        )}
      </div>
    </div>
  );
};

// Rules Tab Component
const RulesTab = ({ traceData, searchQuery, filters }) => {
  const { evaluations, inputs } = traceData;
  
  // Get rule details by combining evaluations with inputs
  const rulesWithDetails = evaluations.rules.map(rule => {
    const ruleInput = inputs.rules.find(r => r.id === rule.id);
    return { ...rule, ...ruleInput };
  });
  
  // Filter rules based on search and filters
  const filteredRules = rulesWithDetails.filter(rule => {
    // Filter by search query
    const matchesSearch = rule.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (rule.name && rule.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Filter by rule status
    const matchesStatus = filters.ruleStatus === 'all' || 
                         (filters.ruleStatus === 'triggered' && rule.result) ||
                         (filters.ruleStatus === 'not-triggered' && !rule.result);
    
    return matchesSearch && matchesStatus;
  });
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Rules Evaluation</h2>
      
      {filteredRules.length === 0 ? (
        <p className="text-gray-600">No rules match your search criteria.</p>
      ) : (
        <div className="space-y-4">
          {filteredRules.map(rule => (
            <RulePanel key={rule.id} rule={rule} facts={evaluations.facts} />
          ))}
        </div>
      )}
    </div>
  );
};

// Rule Panel Component
const RulePanel = ({ rule, facts }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState(null);
  
  const toggleExpand = () => setIsExpanded(!isExpanded);
  
  const handleFactClick = (factId) => {
    setSelectedFactId(factId);
  };
  
  return (
    <div className="bg-gray-50 rounded-lg shadow">
      <div 
        className={`p-4 cursor-pointer flex justify-between items-center ${
          rule.result ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'
        }`}
        onClick={toggleExpand}
      >
        <div>
          <h3 className="font-semibold text-gray-800">{rule.name || rule.id}</h3>
          <div className="text-sm text-gray-600">ID: {rule.id}</div>
        </div>
        
        <div className="flex items-center">
          <span className={`mr-2 px-2 py-1 rounded-full text-xs font-medium ${
            rule.result ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {rule.result ? 'Passed' : 'Failed'}
          </span>
          
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4 border-t">
          <h4 className="font-medium text-gray-700 mb-2">Conditions</h4>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fact</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Value</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comparison</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-gray-200">
              {rule.conds.map((cond, index) => {
                const factValue = facts.find(f => f.id === cond.fact)?.value;
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <button 
                        onClick={() => handleFactClick(cond.fact)}
                        className="text-blue-600 hover:underline"
                      >
                        {cond.fact}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      {cond.actual !== undefined ? (
                        typeof cond.actual === 'object' ? 
                          JSON.stringify(cond.actual) : 
                          String(cond.actual)
                      ) : 'N/A'}
                    </td>
                    <td className="px-4 py-2">
                      {rule.conditions?.children.find(c => c.fact === cond.fact)?.operator || 'N/A'} 
                      {rule.conditions?.children.find(c => c.fact === cond.fact)?.value !== undefined ? 
                        ' ' + JSON.stringify(rule.conditions.children.find(c => c.fact === cond.fact).value) : 
                        ''}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        cond.result ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {cond.result ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {selectedFactId && (
            <FactDetailsModal 
              factId={selectedFactId} 
              facts={facts} 
              factDefinitions={traceData.inputs.factDefinitions}
              onClose={() => setSelectedFactId(null)} 
            />
          )}
        </div>
      )}
    </div>
  );
};

// Facts Tab Component
const FactsTab = ({ traceData, searchQuery, filters }) => {
  const { evaluations, inputs } = traceData;
  const [selectedFactId, setSelectedFactId] = useState(null);
  
  // Get fact definitions by ID for easy lookup
  const factDefinitionsMap = inputs.factDefinitions.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
  }, {});
  
  // Filter facts based on search and filters
  const filteredFacts = evaluations.facts.filter(fact => {
    // Filter by search query
    const matchesSearch = fact.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by fact type
    const factDef = factDefinitionsMap[fact.id];
    const factType = factDef?.type || 'unknown';
    const matchesType = filters.factType === 'all' || filters.factType === factType;
    
    // Filter by error status (in a real app, you'd check for error property)
    const hasError = fact.error !== undefined;
    const matchesError = filters.errorStatus === 'all' || 
                         (filters.errorStatus === 'errored' && hasError) ||
                         (filters.errorStatus === 'success' && !hasError);
    
    return matchesSearch && matchesType && matchesError;
  });
  
  const handleRowClick = (factId) => {
    setSelectedFactId(factId);
  };
  
  // Detect potential bug in nighttimeTransactionCount
  const detectPotentialBugs = (fact) => {
    if (fact.id === 'nighttimeTransactionCount') {
      const transactionHistory = evaluations.facts.find(f => f.id === 'transactionHistory');
      if (transactionHistory && Array.isArray(transactionHistory.value)) {
        const nonNightTimeTransactions = transactionHistory.value.filter(
          t => !['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'].includes(t.timeHour)
        );
        
        if (nonNightTimeTransactions.length > 0) {
          return {
            hasBug: true,
            message: `Possible bug: Includes non-nighttime transactions at ${nonNightTimeTransactions.map(t => t.timeHour).join(', ')}`
          };
        }
      }
    }
    
    return { hasBug: false };
  };
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Facts Evaluation</h2>
      
      {filteredFacts.length === 0 ? (
        <p className="text-gray-600">No facts match your search criteria.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dependencies</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFacts.map(fact => {
                const factDef = factDefinitionsMap[fact.id];
                const bugCheck = detectPotentialBugs(fact);
                
                return (
                  <tr 
                    key={fact.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(fact.id)}
                  >
                    <td className="px-4 py-2 font-medium text-blue-600">{fact.id}</td>
                    <td className="px-4 py-2 max-w-xs truncate">
                      {typeof fact.value === 'object' ? 
                        JSON.stringify(fact.value).substring(0, 50) + (JSON.stringify(fact.value).length > 50 ? '...' : '') : 
                        String(fact.value)
                      }
                    </td>
                    <td className="px-4 py-2">{fact.src || 'N/A'}</td>
                    <td className="px-4 py-2">
                      {fact.deps && fact.deps.length > 0 ? 
                        fact.deps.map(dep => dep.id).join(', ') : 
                        'None'
                      }
                    </td>
                    <td className="px-4 py-2">{factDef?.type || 'N/A'}</td>
                    <td className="px-4 py-2">
                      {bugCheck.hasBug && (
                        <span className="text-xs text-red-600 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Issue
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {selectedFactId && (
        <FactDetailsModal 
          factId={selectedFactId} 
          facts={evaluations.facts} 
          factDefinitions={inputs.factDefinitions}
          onClose={() => setSelectedFactId(null)} 
        />
      )}
    </div>
  );
};

// Fact Details Modal Component
const FactDetailsModal = ({ factId, facts, factDefinitions, onClose }) => {
  const [activeTab, setActiveTab] = useState('value');
  
  const fact = facts.find(f => f.id === factId);
  const factDefinition = factDefinitions.find(def => def.id === factId);
  
  // Detect potential bugs
  const bugCheck = () => {
    if (factId === 'nighttimeTransactionCount') {
      const transactionHistory = facts.find(f => f.id === 'transactionHistory');
      if (transactionHistory && Array.isArray(transactionHistory.value)) {
        const nonNightTimeTransactions = transactionHistory.value.filter(
          t => !['00:00', '01:00', '02:00', '03:00', '04:00', '05:00'].includes(t.timeHour)
        );
        
        if (nonNightTimeTransactions.length > 0) {
          return {
            hasBug: true,
            message: `Possible bug: Includes non-nighttime transactions at ${nonNightTimeTransactions.map(t => t.timeHour).join(', ')}`
          };
        }
      }
    }
    
    return { hasBug: false };
  };
  
  const potentialBug = bugCheck();
  
  if (!fact) {
    return null;
  }
  
  // Prepare nodes and edges for dependency graph
  const prepareGraphData = () => {
    const nodes = [];
    const edges = [];
    const processed = new Set();
    
    const processNode = (factId, level = 0, position = { x: 300, y: 100 }) => {
      if (processed.has(factId)) return;
      processed.add(factId);
      
      const currentFact = facts.find(f => f.id === factId);
      if (!currentFact) return;
      
      // Add node
      nodes.push({
        id: factId,
        data: { label: factId },
        position: { 
          x: position.x, 
          y: position.y + (level * 100) 
        },
        style: {
          background: factId === fact.id ? '#93c5fd' : '#ffffff',
          border: '1px solid #64748b',
          padding: 10,
          borderRadius: 5,
          width: 180
        }
      });
      
      // Process dependencies
      if (currentFact.deps && currentFact.deps.length > 0) {
        currentFact.deps.forEach((dep, index) => {
          // Add edge
          edges.push({
            id: `${factId}-${dep.id}`,
            source: factId,
            target: dep.id,
            animated: factId === fact.id,
            style: { stroke: '#94a3b8' }
          });
          
          // Process dependency node
          processNode(
            dep.id, 
            level + 1, 
            { 
              x: position.x - 200 + (index * 200), 
              y: position.y
            }
          );
        });
      }
    };
    
    // Start with the selected fact
    processNode(factId);
    
    return { nodes, edges };
  };
  
  const graphData = prepareGraphData();
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center border-b p-4">
          <h3 className="text-lg font-semibold">Fact Details: {factId}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button 
            className={`px-4 py-2 ${activeTab === 'value' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('value')}
          >
            Value
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'dependencies' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('dependencies')}
          >
            Dependencies
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'definition' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('definition')}
          >
            Definition
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="p-4 overflow-y-auto">
          {/* Value Tab */}
          {activeTab === 'value' && (
            <div>
              <div className="bg-gray-50 p-3 rounded mb-3">
                <pre className="whitespace-pre-wrap break-words">
                  {typeof fact.value === 'object' ? 
                    JSON.stringify(fact.value, null, 2) : 
                    String(fact.value)
                  }
                </pre>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Source</h4>
                  <p className="text-gray-600">{fact.src || 'N/A'}</p>
                </div>
                
                {fact.params && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">Parameters</h4>
                    <pre className="text-sm bg-gray-50 p-2 rounded">
                      {JSON.stringify(fact.params, null, 2)}
                    </pre>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Timestamp</h4>
                  <p className="text-gray-600">{fact.ts ? new Date(fact.ts).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              
              {potentialBug.hasBug && (
                <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700">
                  <div className="flex">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{potentialBug.message}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <div>
              {fact.deps && fact.deps.length > 0 ? (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Direct Dependencies</h4>
                  <ul className="space-y-2">
                    {fact.deps.map(dep => {
                      const depFact = facts.find(f => f.id === dep.id);
                      return (
                        <li key={dep.id} className="p-3 bg-gray-50 rounded">
                          <button 
                            className="font-medium text-blue-600 hover:underline"
                            onClick={() => {
                              onClose();
                              setTimeout(() => {
                                // This would need to be handled with a more global state management
                                // For simplicity, we're just showing the pattern here
                                // In a real app, you'd use context or a state management library
                                document.dispatchEvent(new CustomEvent('showFactDetails', { detail: dep.id }));
                              }, 100);
                            }}
                          >
                            {dep.id}
                          </button>
                          {depFact && (
                            <div className="mt-1 text-sm text-gray-600">
                              Value: {typeof depFact.value === 'object' ? 
                                JSON.stringify(depFact.value).substring(0, 100) + (JSON.stringify(depFact.value).length > 100 ? '...' : '') : 
                                String(depFact.value)
                              }
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-600">This fact has no dependencies.</p>
              )}
              
              {/* Dependency Graph */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-700 mb-3">Dependency Graph</h4>
                <div style={{ height: 400 }} className="border rounded">
                  <ReactFlow
                    nodes={graphData.nodes}
                    edges={graphData.edges}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              </div>
            </div>
          )}
          
          {/* Definition Tab */}
          {activeTab === 'definition' && (
            <div>
              {factDefinition ? (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">Type</h4>
                      <p className="text-gray-600">{factDefinition.type}</p>
                    </div>
                    
                    {factDefinition.source && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-1">Source</h4>
                        <p className="text-gray-600">
                          {factDefinition.source.type}: {factDefinition.source.name}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {factDefinition.compute && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-1">Compute Logic</h4>
                      <pre className="text-sm bg-gray-50 p-3 rounded">
                        {JSON.stringify(factDefinition.compute, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {factDefinition.aggregate && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-1">Aggregate Logic</h4>
                      <pre className="text-sm bg-gray-50 p-3 rounded">
                        {JSON.stringify(factDefinition.aggregate, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {factDefinition.path && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-1">Path</h4>
                      <p className="text-gray-600">{factDefinition.path}</p>
                    </div>
                  )}
                  
                  {factDefinition.params && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-700 mb-1">Parameters</h4>
                      <pre className="text-sm bg-gray-50 p-3 rounded">
                        {JSON.stringify(factDefinition.params, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">No definition found for this fact.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluationTraceDebugger;