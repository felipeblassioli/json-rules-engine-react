import React, { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import { Engine, type Rule as EngineRule } from 'json-rules-engine';
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaPlay,
  FaSave,
  FaTimes,
  FaCheckCircle,
  FaExclamationCircle,
  FaUpload,
  FaDownload,
} from 'react-icons/fa';

// --- Type Definitions ---

// UI-friendly types for conditions, including a unique ID for React keys
interface UICondition {
  _id: string;
  fact: string;
  operator: string;
  value: string | number | boolean | string[]; // Value can be various types
  isValid?: boolean;
  errorMessage?: string;
}

interface UIConditionGroup {
  _id: string;
  operator: 'all' | 'any';
  children: (UICondition | UIConditionGroup)[];
  isValid?: boolean;
  errorMessage?: string;
}

// Type for the event part of a rule
interface RuleEvent {
  type: string;
  params?: { [key: string]: any };
}

// Type for a complete rule, including UI-friendly conditions
interface Rule {
  id: string; // Unique ID for the rule (for persistence and lookup)
  name: string;
  conditions: UIConditionGroup; // Using UI-friendly conditions here
  event: RuleEvent;
  priority?: number;
}

// Type for facts
interface Fact {
  key: string;
  value: any;
}

// Type for toast notifications
interface ToastState {
  message: string;
  type: 'success' | 'error';
  isVisible: boolean;
}

// --- Utility Functions ---

const generateUniqueId = () =>
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Converts UI-friendly conditions (with _id) to json-rules-engine format (without _id)
const cleanConditionsForEngine = (
  uiConditions: UICondition | UIConditionGroup
): EngineRule['conditions'] | EngineRule['conditions']['all'][number] => {
  if ('fact' in uiConditions) {
    const { _id, isValid, errorMessage, ...rest } = uiConditions;
    // Attempt to parse value to number if it looks like one, otherwise keep as string
    const value =
      typeof rest.value === 'string' && !isNaN(Number(rest.value)) && rest.value.trim() !== ''
        ? Number(rest.value)
        : rest.value;
    return { ...rest, value };
  } else {
    const { _id, isValid, errorMessage, children, operator } = uiConditions;
    const cleanedChildren = children.map(cleanConditionsForEngine);
    return { [operator]: cleanedChildren };
  }
};

// Converts json-rules-engine format conditions to UI-friendly format (adds _id)
const addIdsToConditionsForUI = (
  engineConditions: EngineRule['conditions'] | EngineRule['conditions']['all'][number]
): UICondition | UIConditionGroup => {
  if ('fact' in engineConditions) {
    return { ...engineConditions, _id: generateUniqueId() } as UICondition;
  } else {
    const group = engineConditions as EngineRule['conditions'];
    const operator = group.all ? 'all' : 'any';
    const children = (group.all || group.any || []).map(addIdsToConditionsForUI);
    return { _id: generateUniqueId(), operator, children };
  }
};

// --- Constants ---

const OPERATORS = [
  { label: 'Equal', value: 'equal' },
  { label: 'Not Equal', value: 'notEqual' },
  { label: 'Greater Than', value: 'greaterThan' },
  { label: 'Greater Than or Equal', value: 'greaterThanInclusive' },
  { label: 'Less Than', value: 'lessThan' },
  { label: 'Less Than or Equal', value: 'lessThanInclusive' },
  { label: 'In (comma-separated)', value: 'in' },
  { label: 'Not In (comma-separated)', value: 'notIn' },
  { label: 'Contains', value: 'contains' },
  { label: 'Does Not Contain', value: 'doesNotContain' },
];

const INITIAL_NEW_RULE: Rule = {
  id: generateUniqueId(),
  name: '',
  conditions: {
    _id: generateUniqueId(),
    operator: 'all',
    children: [
      {
        _id: generateUniqueId(),
        fact: '',
        operator: 'equal',
        value: '',
      },
    ],
  },
  event: {
    type: '',
    params: {},
  },
};

const INITIAL_FACTS: { [key: string]: any } = {
  gameDuration: 40,
  personalFoulCount: 5,
  technicalFoulCount: 1,
  playerStatus: 'active',
  teamScore: 90,
};

// --- Reusable UI Components (Modals, Toast) ---

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full ${maxWidthClass} overflow-hidden`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-indigo-600 text-white">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white hover:text-indigo-100">
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="p-4 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const Icon = type === 'success' ? FaCheckCircle : FaExclamationCircle;

  return (
    <div
      className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-lg text-white flex items-center space-x-3 ${bgColor} z-50`}
    >
      <Icon size={20} />
      <span>{message}</span>
      <button onClick={onClose} className="ml-auto text-white hover:text-opacity-80">
        <FaTimes size={16} />
      </button>
    </div>
  );
};

// --- Condition Builder Component ---

interface ConditionBuilderProps {
  conditionGroup: UIConditionGroup;
  onUpdate: (updatedGroup: UIConditionGroup) => void;
  onRemove?: (id: string) => void; // Optional for top-level group
  availableFacts: string[];
}

const ConditionBuilder: React.FC<ConditionBuilderProps> = ({
  conditionGroup,
  onUpdate,
  onRemove,
  availableFacts,
}) => {
  const handleOperatorChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newOperator = e.target.value as 'all' | 'any';
    onUpdate({ ...conditionGroup, operator: newOperator });
  };

  const handleConditionChange = (id: string, field: keyof UICondition, value: any) => {
    const updatedChildren = conditionGroup.children.map((child) => {
      if ('_id' in child && child._id === id) {
        return { ...child, [field]: value };
      }
      return child;
    });
    onUpdate({
      ...conditionGroup,
      children: updatedChildren as (UICondition | UIConditionGroup)[],
    });
  };

  const handleNestedGroupUpdate = (id: string, updatedNestedGroup: UIConditionGroup) => {
    const updatedChildren = conditionGroup.children.map((child) => {
      if ('_id' in child && child._id === id) {
        return updatedNestedGroup;
      }
      return child;
    });
    onUpdate({
      ...conditionGroup,
      children: updatedChildren as (UICondition | UIConditionGroup)[],
    });
  };

  const addCondition = () => {
    const newCondition: UICondition = {
      _id: generateUniqueId(),
      fact: '',
      operator: 'equal',
      value: '',
    };
    onUpdate({ ...conditionGroup, children: [...conditionGroup.children, newCondition] });
  };

  const addConditionGroup = () => {
    const newGroup: UIConditionGroup = {
      _id: generateUniqueId(),
      operator: 'all',
      children: [
        {
          _id: generateUniqueId(),
          fact: '',
          operator: 'equal',
          value: '',
        },
      ],
    };
    onUpdate({ ...conditionGroup, children: [...conditionGroup.children, newGroup] });
  };

  const removeChild = (idToRemove: string) => {
    const updatedChildren = conditionGroup.children.filter((child) => child._id !== idToRemove);
    onUpdate({ ...conditionGroup, children: updatedChildren });
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4 mb-4 bg-gray-50">
      <div className="flex items-center mb-4 space-x-3">
        <span className="font-semibold text-gray-700">Conditions must match:</span>
        <select
          value={conditionGroup.operator}
          onChange={handleOperatorChange}
          className="p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="all">All (AND)</option>
          <option value="any">Any (OR)</option>
        </select>
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(conditionGroup._id)}
            className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors"
            title="Remove Group"
          >
            <FaTrash size={16} />
          </button>
        )}
      </div>

      <div className="space-y-4 pl-4 border-l-2 border-gray-200">
        {conditionGroup.children.map((child) => (
          <div key={child._id} className="flex items-start space-x-3">
            {'fact' in child ? (
              // Render a single condition
              <div className="flex flex-wrap items-center gap-3 p-3 border border-gray-200 rounded-md bg-white flex-grow">
                <select
                  value={child.fact}
                  onChange={(e) => handleConditionChange(child._id, 'fact', e.target.value)}
                  className="p-2 border border-gray-300 rounded-md flex-grow min-w-[120px] focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select Fact</option>
                  {availableFacts.map((fact) => (
                    <option key={fact} value={fact}>
                      {fact}
                    </option>
                  ))}
                  {/* Allow custom fact input if not in availableFacts */}
                  {!availableFacts.includes(child.fact) && child.fact && (
                    <option value={child.fact}>{child.fact} (Custom)</option>
                  )}
                </select>
                <select
                  value={child.operator}
                  onChange={(e) => handleConditionChange(child._id, 'operator', e.target.value)}
                  className="p-2 border border-gray-300 rounded-md flex-grow min-w-[120px] focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={child.value}
                  onChange={(e) => handleConditionChange(child._id, 'value', e.target.value)}
                  placeholder="Value"
                  className="p-2 border border-gray-300 rounded-md flex-grow min-w-[120px] focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => removeChild(child._id)}
                  className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors"
                  title="Remove Condition"
                >
                  <FaTrash size={16} />
                </button>
              </div>
            ) : (
              // Render a nested condition group
              <div className="flex-grow">
                <ConditionBuilder
                  conditionGroup={child as UIConditionGroup}
                  onUpdate={(updatedGroup) => handleNestedGroupUpdate(child._id, updatedGroup)}
                  onRemove={removeChild}
                  availableFacts={availableFacts}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-3 mt-4">
        <button
          type="button"
          onClick={addCondition}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors flex items-center space-x-2"
        >
          <FaPlus size={14} />
          <span>Add Condition</span>
        </button>
        <button
          type="button"
          onClick={addConditionGroup}
          className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors flex items-center space-x-2"
        >
          <FaPlus size={14} />
          <span>Add Group</span>
        </button>
      </div>
    </div>
  );
};

// --- Main RulesEngineUI Component ---

const RulesEngineUI: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [facts, setFacts] = useState<{ [key: string]: any }>(INITIAL_FACTS);
  const [activeView, setActiveView] = useState<'rules' | 'facts' | 'import-export'>('rules');

  const [showRuleEditorModal, setShowRuleEditorModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null); // null for new rule

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

  const [showTestResultsModal, setShowTestResultsModal] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testFacts, setTestFacts] = useState<{ [key: string]: any }>({}); // Facts for temporary testing

  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'success',
    isVisible: false,
  });

  // Load rules and facts from localStorage on mount
  useEffect(() => {
    try {
      const storedRules = localStorage.getItem('rules');
      if (storedRules) {
        const parsedRules: Rule[] = JSON.parse(storedRules);
        // Ensure conditions have _id for UI if loaded from old format
        const rulesWithIds = parsedRules.map((rule) => ({
          ...rule,
          conditions: addIdsToConditionsForUI(rule.conditions) as UIConditionGroup,
        }));
        setRules(rulesWithIds);
      }
      const storedFacts = localStorage.getItem('facts');
      if (storedFacts) {
        setFacts(JSON.parse(storedFacts));
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      showToast('Error loading data from storage.', 'error');
    }
  }, []);

  // Save rules and facts to localStorage whenever they change
  useEffect(() => {
    try {
      // Clean rules before saving (remove _id from conditions)
      const rulesToSave = rules.map((rule) => ({
        ...rule,
        conditions: cleanConditionsForEngine(rule.conditions) as EngineRule['conditions'],
      }));
      localStorage.setItem('rules', JSON.stringify(rulesToSave));
      localStorage.setItem('facts', JSON.stringify(facts));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      showToast('Error saving data to storage.', 'error');
    }
  }, [rules, facts]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }));
    }, 3000);
  }, []);

  // --- Rule Management Handlers ---

  const handleCreateRule = () => {
    setEditingRule(INITIAL_NEW_RULE);
    setShowRuleEditorModal(true);
  };

  const handleEditRule = (rule: Rule) => {
    // Deep copy the rule to avoid direct state mutation
    setEditingRule(JSON.parse(JSON.stringify(rule)));
    setShowRuleEditorModal(true);
  };

  const handleSaveRule = (rule: Rule) => {
    // Basic validation
    if (!rule.name.trim()) {
      showToast('Rule Name is required.', 'error');
      return;
    }
    if (!rule.event.type.trim()) {
      showToast('Event Type is required.', 'error');
      return;
    }
    // More robust validation for conditions could be added here
    // For simplicity, we'll assume conditions are valid if they exist.

    if (rules.some((r) => r.name === rule.name && r.id !== rule.id)) {
      showToast('Rule with this name already exists.', 'error');
      return;
    }

    if (editingRule && rules.some((r) => r.id === editingRule.id)) {
      // Update existing rule
      setRules(rules.map((r) => (r.id === rule.id ? rule : r)));
      showToast('Rule updated successfully!', 'success');
    } else {
      // Add new rule
      setRules([...rules, { ...rule, id: generateUniqueId() }]);
      showToast('Rule created successfully!', 'success');
    }
    setShowRuleEditorModal(false);
    setEditingRule(null);
  };

  const handleDeleteRule = (rule: Rule) => {
    setRuleToDelete(rule);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteRule = () => {
    if (ruleToDelete) {
      setRules(rules.filter((r) => r.id !== ruleToDelete.id));
      showToast(`Rule "${ruleToDelete.name}" deleted.`, 'success');
    }
    setShowDeleteConfirmModal(false);
    setRuleToDelete(null);
  };

  // --- Facts Management Handlers ---

  const handleFactChange = (key: string, value: any) => {
    setFacts((prevFacts) => ({ ...prevFacts, [key]: value }));
  };

  const handleAddFact = () => {
    let newKey = `newFact${Object.keys(facts).length + 1}`;
    while (facts.hasOwnProperty(newKey)) {
      newKey = `newFact${Math.floor(Math.random() * 1000)}`;
    }
    setFacts((prevFacts) => ({ ...prevFacts, [newKey]: '' }));
  };

  const handleDeleteFact = (keyToDelete: string) => {
    setFacts((prevFacts) => {
      const newFacts = { ...prevFacts };
      delete newFacts[keyToDelete];
      return newFacts;
    });
  };

  const handleSaveFacts = () => {
    // Basic validation for facts (e.g., ensure keys are not empty)
    const invalidKeys = Object.keys(facts).filter((key) => !key.trim());
    if (invalidKeys.length > 0) {
      showToast('Fact keys cannot be empty.', 'error');
      return;
    }
    showToast('Facts saved successfully!', 'success');
  };

  const handleResetFacts = () => {
    setFacts(INITIAL_FACTS);
    showToast('Facts reset to initial values.', 'success');
  };

  // --- Rule Testing Handlers ---

  const handleTestRule = async (rule: Rule) => {
    setTestFacts(facts); // Initialize test facts with current facts
    setShowTestResultsModal(true);
    await runRuleTest(rule, facts);
  };

  const runRuleTest = async (rule: Rule, currentFacts: { [key: string]: any }) => {
    const engine = new Engine();

    // Add the rule to the engine, cleaning its conditions
    const engineRule: EngineRule = {
      conditions: cleanConditionsForEngine(rule.conditions) as EngineRule['conditions'],
      event: rule.event,
      name: rule.name,
      priority: rule.priority || 1,
    };
    engine.addRule(engineRule);

    const triggeredEvents: string[] = [];

    engine.on('success', (event) => {
      const params = event.params ? JSON.stringify(event.params) : '';
      triggeredEvents.push(`Rule "${rule.name}" triggered event: ${event.type} ${params}`);
    });

    engine.on('failure', (event) => {
      // This typically means the rule conditions were not met, not an error in execution
      // We don't need to show this as an error, just that it didn't trigger.
    });

    try {
      await engine.run(currentFacts);
      if (triggeredEvents.length === 0) {
        setTestResults(['No events triggered for this rule with the given facts.']);
      } else {
        setTestResults(triggeredEvents);
      }
    } catch (error) {
      console.error('Error during rule evaluation:', error);
      setTestResults([
        `Error during rule evaluation: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  };

  const handleTestFactsChange = (key: string, value: any) => {
    setTestFacts((prev) => ({ ...prev, [key]: value }));
  };

  const handleRunTestWithModifiedFacts = async (rule: Rule) => {
    await runRuleTest(rule, testFacts);
  };

  // --- Import/Export Handlers ---

  const handleExport = () => {
    const data = {
      rules: rules.map((rule) => ({
        ...rule,
        conditions: cleanConditionsForEngine(rule.conditions) as EngineRule['conditions'],
      })),
      facts: facts,
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rules_engine_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!', 'success');
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string);
        if (importedData.rules && Array.isArray(importedData.rules)) {
          const importedRules: Rule[] = importedData.rules.map((rule: any) => ({
            ...rule,
            id: generateUniqueId(), // Assign new IDs to imported rules
            conditions: addIdsToConditionsForUI(rule.conditions) as UIConditionGroup,
          }));
          setRules(importedRules);
        }
        if (importedData.facts && typeof importedData.facts === 'object') {
          setFacts(importedData.facts);
        }
        showToast('Data imported successfully!', 'success');
      } catch (error) {
        console.error('Error importing data:', error);
        showToast('Failed to import data. Invalid JSON format.', 'error');
      }
    };
    reader.readAsText(file);
    // Clear the input value to allow re-importing the same file
    event.target.value = '';
  };

  const availableFactsKeys = Object.keys(facts);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-6">
      {/* Header/Navigation */}
      <header className="bg-white shadow-md rounded-lg p-4 mb-6">
        <h1 className="text-3xl font-bold text-indigo-700 mb-4">Rules Engine Dashboard</h1>
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveView('rules')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeView === 'rules'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Rule Management
          </button>
          <button
            onClick={() => setActiveView('facts')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeView === 'facts'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Facts Editor
          </button>
          <button
            onClick={() => setActiveView('import-export')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeView === 'import-export'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Import/Export
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="bg-white shadow-md rounded-lg p-6">
        {activeView === 'rules' && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-700">Rule List</h2>
              <button
                onClick={handleCreateRule}
                className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-md"
              >
                <FaPlus size={16} />
                <span>Create New Rule</span>
              </button>
            </div>

            {rules.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                No rules defined yet. Click "Create New Rule" to get started!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 border-b border-gray-200">
                        Rule Name
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 border-b border-gray-200">
                        Conditions Summary
                      </th>
                      <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600 border-b border-gray-200">
                        Event Type
                      </th>
                      <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600 border-b border-gray-200">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 border-b border-gray-200">{rule.name}</td>
                        <td className="py-3 px-4 border-b border-gray-200 text-sm text-gray-600">
                          {/* Simple summary, could be more detailed */}
                          {rule.conditions.operator === 'all' ? 'All' : 'Any'} of{' '}
                          {rule.conditions.children.length} conditions
                        </td>
                        <td className="py-3 px-4 border-b border-gray-200">{rule.event.type}</td>
                        <td className="py-3 px-4 border-b border-gray-200 text-right space-x-2">
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="p-2 text-indigo-600 hover:text-indigo-800 rounded-full hover:bg-indigo-100 transition-colors"
                            title="Edit Rule"
                          >
                            <FaEdit size={18} />
                          </button>
                          <button
                            onClick={() => handleTestRule(rule)}
                            className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-100 transition-colors"
                            title="Test Rule"
                          >
                            <FaPlay size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule)}
                            className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors"
                            title="Delete Rule"
                          >
                            <FaTrash size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeView === 'facts' && (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-700">Facts Editor</h2>
              <div className="space-x-3">
                <button
                  onClick={handleAddFact}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors flex items-center space-x-2"
                >
                  <FaPlus size={14} />
                  <span>Add Fact</span>
                </button>
                <button
                  onClick={handleSaveFacts}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center space-x-2"
                >
                  <FaSave size={14} />
                  <span>Save Facts</span>
                </button>
                <button
                  onClick={handleResetFacts}
                  className="px-4 py-2 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition-colors flex items-center space-x-2"
                >
                  <FaTimes size={14} />
                  <span>Reset Facts</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(facts).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-md bg-gray-50"
                >
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newKey = e.target.value;
                      setFacts((prev) => {
                        const newFacts = { ...prev };
                        if (newKey !== key) {
                          delete newFacts[key];
                        }
                        newFacts[newKey] = value;
                        return newFacts;
                      });
                    }}
                    placeholder="Fact Key"
                    className="p-2 border border-gray-300 rounded-md w-1/2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => {
                      let val: any = e.target.value;
                      // Attempt to infer type for better testing
                      if (!isNaN(Number(val)) && val.trim() !== '') {
                        val = Number(val);
                      } else if (val.toLowerCase() === 'true') {
                        val = true;
                      } else if (val.toLowerCase() === 'false') {
                        val = false;
                      }
                      handleFactChange(key, val);
                    }}
                    placeholder="Fact Value"
                    className="p-2 border border-gray-300 rounded-md w-1/2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleDeleteFact(key)}
                    className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors"
                    title="Delete Fact"
                  >
                    <FaTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeView === 'import-export' && (
          <section>
            <h2 className="text-2xl font-semibold text-gray-700 mb-6">Import / Export Data</h2>
            <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
              <button
                onClick={handleExport}
                className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-md w-full md:w-auto justify-center"
              >
                <FaDownload size={18} />
                <span>Export All Data (JSON)</span>
              </button>
              <label
                htmlFor="import-file"
                className="cursor-pointer px-6 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center space-x-2 shadow-md w-full md:w-auto justify-center"
              >
                <FaUpload size={18} />
                <span>Import Data (JSON)</span>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Import/Export will include all rules and facts. Importing will overwrite existing
              data.
            </p>
          </section>
        )}
      </main>

      {/* Rule Editor Modal */}
      <Modal
        isOpen={showRuleEditorModal}
        onClose={() => setShowRuleEditorModal(false)}
        title={editingRule?.id ? 'Edit Rule' : 'Create New Rule'}
        size="xl"
        footer={
          <>
            <button
              onClick={() => setShowRuleEditorModal(false)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors flex items-center space-x-2"
            >
              <FaTimes size={14} />
              <span>Cancel</span>
            </button>
            <button
              onClick={() => editingRule && handleSaveRule(editingRule)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <FaSave size={14} />
              <span>Save Rule</span>
            </button>
          </>
        }
      >
        {editingRule && (
          <div className="space-y-6">
            <div>
              <label htmlFor="ruleName" className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="ruleName"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., PlayerFouledOut"
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Conditions</h3>
              <ConditionBuilder
                conditionGroup={editingRule.conditions}
                onUpdate={(updatedGroup) =>
                  setEditingRule({ ...editingRule, conditions: updatedGroup })
                }
                availableFacts={availableFactsKeys}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Event</h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="eventType"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Event Type <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="eventType"
                    value={editingRule.event.type}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        event: { ...editingRule.event, type: e.target.value },
                      })
                    }
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., fouledOut"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Parameters (Key-Value Pairs)
                  </label>
                  <div className="space-y-3">
                    {Object.entries(editingRule.event.params || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-3">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            setEditingRule((prevRule) => {
                              if (!prevRule) return null;
                              const newParams = { ...prevRule.event.params };
                              if (newKey !== key) {
                                delete newParams[key];
                              }
                              newParams[newKey] = value;
                              return {
                                ...prevRule,
                                event: { ...prevRule.event, params: newParams },
                              };
                            });
                          }}
                          placeholder="Param Key"
                          className="p-2 border border-gray-300 rounded-md w-1/2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={String(value)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingRule((prevRule) => {
                              if (!prevRule) return null;
                              const newParams = { ...prevRule.event.params, [key]: val };
                              return {
                                ...prevRule,
                                event: { ...prevRule.event, params: newParams },
                              };
                            });
                          }}
                          placeholder="Param Value"
                          className="p-2 border border-gray-300 rounded-md w-1/2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditingRule((prevRule) => {
                              if (!prevRule) return null;
                              const newParams = { ...prevRule.event.params };
                              delete newParams[key];
                              return {
                                ...prevRule,
                                event: { ...prevRule.event, params: newParams },
                              };
                            })
                          }
                          className="p-2 text-red-600 hover:text-red-800 rounded-full hover:bg-red-100 transition-colors"
                          title="Remove Parameter"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingRule((prevRule) => {
                          if (!prevRule) return null;
                          const newParamKey = `param${Object.keys(prevRule.event.params || {}).length + 1}`;
                          return {
                            ...prevRule,
                            event: {
                              ...prevRule.event,
                              params: { ...prevRule.event.params, [newParamKey]: '' },
                            },
                          };
                        })
                      }
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center space-x-2 text-sm"
                    >
                      <FaPlus size={12} />
                      <span>Add Parameter</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowDeleteConfirmModal(false)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteRule}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-gray-700">
          Are you sure you want to delete rule "
          <span className="font-semibold">{ruleToDelete?.name}</span>"? This action cannot be
          undone.
        </p>
      </Modal>

      {/* Test Results Modal */}
      <Modal
        isOpen={showTestResultsModal}
        onClose={() => setShowTestResultsModal(false)}
        title={`Test Rule: ${editingRule?.name || 'N/A'}`}
        size="lg"
        footer={
          <button
            onClick={() => setShowTestResultsModal(false)}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        }
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              Facts for Testing (Temporary)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {Object.entries(testFacts).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <label className="block text-sm font-medium text-gray-700 w-1/3">{key}:</label>
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => {
                      let val: any = e.target.value;
                      if (!isNaN(Number(val)) && val.trim() !== '') {
                        val = Number(val);
                      } else if (val.toLowerCase() === 'true') {
                        val = true;
                      } else if (val.toLowerCase() === 'false') {
                        val = false;
                      }
                      handleTestFactsChange(key, val);
                    }}
                    className="p-2 border border-gray-300 rounded-md flex-grow focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => editingRule && handleRunTestWithModifiedFacts(editingRule)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center space-x-2"
            >
              <FaPlay size={14} />
              <span>Run Test with Modified Facts</span>
            </button>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Test Results</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 min-h-[100px] max-h-[300px] overflow-y-auto">
              {testResults.length > 0 ? (
                <ul className="list-disc list-inside space-y-2">
                  {testResults.map((result, index) => (
                    <li key={index} className="text-gray-700 text-sm">
                      {result}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">Run the test to see results.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
        />
      )}
    </div>
  );
};

export default RulesEngineUI;
