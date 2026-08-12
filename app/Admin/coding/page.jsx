"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { mcqDb } from '@/lib/firebaseMCQs';
import CheckDataEntryAuth from "@/lib/CheckDataEntryAuth";

export default function AddQuestionPage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('Basic Syntax & Structure');
  const [level, setLevel] = useState('Level 1');
  const [testCases, setTestCases] = useState([{ input: '', output: '', hidden: false }]);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [filterTopic, setFilterTopic] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const router = useRouter();

  // Concept/Topic categorization with levels available for each
  const conceptTopics = [
    'Basic Syntax & Structure',
    'Data Types & Variables',
    'Data Types & Their Specified Methods',
    'Numbers',
    'Operators & Expressions',
    'Operators',
    'Conditional Statements',
    'Control Statements',
    'Loops & Iterations',
    'Arrays & Lists',
    'Strings & Character Handling',
    'Sets',
    'Dictionaries',
    'Functions / Methods',
    'Recursion',
    'Time & Space Complexity (Big O)',
    'Object-Oriented Programming (OOP)',
    'Exception & File Handling',
    'File Reading & Writing',
    'Input/Output Operations',
    'Zip & Compression Methods',
    'Searching Algorithms',
    'Sorting Algorithms',
    'Stack & Queue',
    'Linked List',
    'Hashing (HashMap / HashSet)',
    'Tree & Binary Search Tree (BST)',
    'Heap / Priority Queue',
    'Graph & Graph Algorithms',
    'Greedy Algorithms',
    'Dynamic Programming (DP)',
    'Backtracking',
    'Bit Manipulation'
  ];

  const levelOptions = [
    { value: 'Level 1', label: 'Level 1: Beginner Basic', emoji: '🟢' },
    { value: 'Level 2', label: 'Level 2: Intermediate', emoji: '🟡' },
    { value: 'Level 3', label: 'Level 3: Advanced', emoji: '🔵' }
  ];

  const levelDescriptions = {
    'Level 1': 'Beginner (Foundations of Logic & Syntax)',
    'Level 2': 'Intermediate (Core Problem-Solving & DSA Foundations)',
    'Level 3': 'Advanced (Strong DSA & Algorithms)'
  };

  // Helper functions for input transformation
  const transformForCompiler = (input) => {
    // Transform each line separately to preserve line breaks
    return input
      .split('\n')                    // Split by lines
      .map(line => 
        line
          .replace(/\[/g, '')         // Remove [ brackets
          .replace(/\]/g, '')         // Remove ] brackets  
          .replace(/,/g, ' ')         // Convert commas to spaces
          .replace(/#/g, '')          // Remove # prefix
          .replace(/\s+/g, ' ')       // Normalize multiple spaces to single space
          .trim()                     // Remove leading/trailing spaces
      )
      .join('\n');                    // Join lines back with line breaks
  };

  const transformForDisplay = (input) => {
    // Only transform # to " " for display, keep everything else as-is
    return input.replace(/#/g, '" "');
  };

  // Fetch all questions
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const querySnapshot = await getDocs(collection(mcqDb, 'codingQuestions'));
      const questionsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuestions(questionsData);
    } catch (err) {
      console.error('Error fetching questions:', err);
      alert('❌ Failed to load questions');
    }
    setLoadingQuestions(false);
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: '', output: '', hidden: false }]);
  };

  const handleTestCaseChange = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLevel('Level 1');
    setTopic('Basic Syntax & Structure');
    setTestCases([{ input: '', output: '', hidden: false }]);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Title cannot be empty");
      return;
    }
    if (!description.trim()) {
      alert("Description cannot be empty");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(mcqDb, 'codingQuestions', editingId), {
          title,
          description,
          level,
          topic,
          testCases,
          updatedAt: new Date().toISOString()
        });
        alert('✅ Question updated!');
      } else {
        await addDoc(collection(mcqDb, 'codingQuestions'), {
          title,
          description,
          level,
          topic,
          testCases,
          type: 'coding', // Mark as coding question
          createdAt: new Date().toISOString()
        });
        alert('✅ Question saved!');
      }
      resetForm();
      fetchQuestions(); // Refresh the questions list
    } catch (err) {
      console.error('Error saving question:', err);
      alert('❌ Failed to save question');
    }
    setLoading(false);
  };

  const handleDelete = async (questionId) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      await deleteDoc(doc(mcqDb, 'codingQuestions', questionId));
      alert('✅ Question deleted successfully!');
      fetchQuestions(); // Refresh the questions list
    } catch (err) {
      console.error('Error deleting question:', err);
      alert('❌ Failed to delete question');
    }
  };

  // Filter questions based on topic, level, and search query
  const filteredQuestions = questions.filter((question) => {
    const matchesTopic = filterTopic === 'All' || question.topic === filterTopic;
    const matchesLevel = filterLevel === 'All' || question.level === filterLevel;
    const matchesSearch = question.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTopic && matchesLevel && matchesSearch;
  });

  // Get unique topics from questions for the topic filter
  const availableTopics = [...new Set(questions.map(q => q.topic).filter(Boolean))];

  return (
    <CheckDataEntryAuth>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-6 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-5 py-2 rounded-lg shadow-md transition-all duration-200 inline-flex items-center gap-2"
            aria-label="Go back"
            title="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M10.5 19.5 3 12l7.5-7.5 1.06 1.06L6.12 12l5.44 5.44-1.06 1.06Z"/><path d="M21 13H4v-2h17v2Z"/></svg>
            <span>Back</span>
          </button>

          {/* Add / Edit Question Form */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{editingId ? 'Edit Question' : 'Add New Question'}</h1>

            {/* Title */}
            <label className="block font-semibold mb-2 text-gray-700">Title:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 mb-4 transition-all outline-none"
              placeholder="Enter question title"
            />

            {/* Description */}
            <label className="block font-semibold mb-2 text-gray-700">Description:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 mb-4 transition-all outline-none"
              placeholder="Enter question description"
            />

            {/* Topic/Concept Selection (First) */}
            <label className="block font-semibold mb-2 text-gray-700">Concept/Topic:</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 mb-4 transition-all outline-none bg-white"
            >
              {conceptTopics.map((topicOption) => (
                <option key={topicOption} value={topicOption}>
                  {topicOption}
                </option>
              ))}
            </select>

            {/* Level Selection (Second) */}
            <label className="block font-semibold mb-2 text-gray-700">Difficulty Level for &ldquo;{topic}&rdquo;:</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 mb-4 transition-all outline-none bg-white"
            >
              {levelOptions.map((levelOpt) => (
                <option key={levelOpt.value} value={levelOpt.value}>
                  {levelOpt.emoji} {levelOpt.label}
                </option>
              ))}
            </select>

            {/* Test cases */}
            <h3 className="text-xl font-semibold mb-3 text-gray-800">Test Cases</h3>
            {testCases.map((test, index) => (
              <div
                key={index}
                className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg mb-3"
              >
                <label className="block text-sm font-medium text-gray-700 mb-1">Input (multi-line supported):</label>
                <textarea
                  placeholder="Enter input (supports multiple lines for vectors, arrays, etc.)
Examples:
- [2,3,4] → compiler receives: 2 3 4
- [[2,3,4],[5,6,7]] → compiler receives: 2 3 4 5 6 7
- 5
  [1,2,3,4,5] → compiler receives:
  5
  1 2 3 4 5
- #{ → compiler receives: {
- # → compiler receives: (space)"
                  value={test.input}
                  onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                  rows={4}
                  className="w-full border-2 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg p-2 mb-2 transition-all outline-none bg-white font-mono text-sm"
                />
                {/* Show compiler input preview */}
                {test.input && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <span className="font-medium text-blue-800">Compiler will receive:</span>
                    <div className="font-mono text-blue-700 mt-1">
                      {transformForCompiler(test.input) || '(empty)'}
                    </div>
                  </div>
                )}
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Output (multi-line supported):</label>
                <textarea
                  placeholder="Enter expected output (supports multiple lines)"
                  value={test.output}
                  onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)}
                  rows={3}
                  className="w-full border-2 border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-lg p-2 mb-2 transition-all outline-none bg-white font-mono text-sm"
                />
                {/* Show compiler output preview */}
                {test.output && (
                  <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <span className="font-medium text-green-800">Compiler will receive:</span>
                    <div className="font-mono text-green-700 mt-1">
                      {transformForCompiler(test.output) || '(empty)'}
                    </div>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 text-gray-700 font-medium">
                  <input
                    type="checkbox"
                    checked={test.hidden}
                    onChange={(e) => handleTestCaseChange(index, 'hidden', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  /> 
                  Hidden
                </label>
              </div>
            ))}

            {/* Add test case button */}
            <button
              onClick={handleAddTestCase}
              className="mb-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-5 py-2 rounded-lg shadow-md transition-all duration-200 inline-flex items-center gap-2"
              aria-label="Add test case"
              title="Add test case"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"/></svg>
              <span>Add Test Case</span>
            </button>

            <br />

            {/* Save / Update & Cancel buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className={`px-8 py-3 rounded-lg text-white font-semibold shadow-lg transition-all duration-200 inline-flex items-center gap-2 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl'}`}
                aria-label={editingId ? 'Update question' : 'Save question'}
                title={editingId ? 'Update question' : 'Save question'}
              >
                {loading ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2Zm10 4H8v2h8V6Zm-8 4v8h8v-8H8Z"/></svg>
                )}
                <span>{loading ? (editingId ? 'Updating...' : 'Saving...') : (editingId ? 'Update Question' : 'Save Question')}</span>
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  type="button"
                  className="px-6 py-3 rounded-lg text-white font-semibold shadow-lg transition-all duration-200 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 inline-flex items-center gap-2"
                  aria-label="Cancel edit"
                  title="Cancel edit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.4 19 5 17.6 10.6 12 5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19Z"/></svg>
                  <span>Cancel Edit</span>
                </button>
              )}
            </div>
          </div>

          {/* Display All Questions Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">All Questions</h1>
            
            {/* Filter Section */}
            <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
              <div className="flex flex-col gap-4">
                {/* First Row: Search and Results Count */}
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Search by title..."
                      className="w-full border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 transition-all outline-none"
                    />
                  </div>
                  
                  {/* Results Count */}
                  <div className="flex items-center justify-center md:justify-start">
                    <span className="text-gray-600 font-medium">
                      {filteredQuestions.length} {filteredQuestions.length === 1 ? 'question' : 'questions'}
                    </span>
                  </div>
                </div>

                {/* Second Row: Topic and Level Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Topic Filter (First) */}
                  <div className="flex-1">
                    <select
                      value={filterTopic}
                      onChange={(e) => setFilterTopic(e.target.value)}
                      className="w-full border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 transition-all outline-none bg-white"
                    >
                      <option value="All">All Topics/Concepts</option>
                      {availableTopics.map((topicOption) => (
                        <option key={topicOption} value={topicOption}>
                          📚 {topicOption}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Level Filter (Second) */}
                  <div className="flex-1">
                    <select
                      value={filterLevel}
                      onChange={(e) => setFilterLevel(e.target.value)}
                      className="w-full border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg p-3 transition-all outline-none bg-white"
                    >
                      <option value="All">All Difficulty Levels</option>
                      <option value="Level 1">🟢 Level 1: Beginner</option>
                      <option value="Level 2">🟡 Level 2: Intermediate</option>
                      <option value="Level 3">🔵 Level 3: Advanced</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {loadingQuestions ? (
              <p className="text-indigo-600 font-medium">Loading questions...</p>
            ) : questions.length === 0 ? (
              <p className="text-gray-500 font-medium">No questions found.</p>
            ) : filteredQuestions.length === 0 ? (
              <p className="text-gray-500 font-medium">No questions match your filters.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuestions.map((question) => {
                  const getLevelColor = (level) => {
                    if (level === 'Level 1') return 'from-green-500 to-emerald-600';
                    if (level === 'Level 2') return 'from-yellow-500 to-orange-600';
                    if (level === 'Level 3') return 'from-red-500 to-pink-600';
                    return 'from-gray-500 to-gray-600';
                  };

                  const getLevelBadge = (level) => {
                    if (level === 'Level 1') return '🟢 Level 1';
                    if (level === 'Level 2') return '🟡 Level 2';
                    if (level === 'Level 3') return '🔵 Level 3';
                    return level || 'N/A';
                  };

                  return (
                    <div
                      key={question.id}
                      className="border-2 border-indigo-200 rounded-xl p-4 bg-gradient-to-br from-white to-indigo-50 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 relative"
                    >
                      {/* Level Badge */}
                      <div className={`inline-block bg-gradient-to-r ${getLevelColor(question.level)} text-white text-xs font-bold px-3 py-1 rounded-full mb-2`}>
                        {getLevelBadge(question.level)}
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-gray-800 mb-2 pr-8 line-clamp-2">{question.title}</h3>
                      
                      {/* Topic */}
                      <p className="text-xs text-gray-600 mb-1 line-clamp-2">
                        <span className="font-semibold">📚 Topic:</span> {question.topic || 'N/A'}
                      </p>

                      {/* Test Cases Count */}
                      <p className="text-xs text-gray-500">
                        <span className="font-semibold">✅ Test Cases:</span> {question.testCases?.length || 0}
                      </p>

                      {/* Edit & Delete Buttons */}
                      <button
                        onClick={() => {
                          setEditingId(question.id);
                          setTitle(question.title || '');
                          setDescription(question.description || '');
                          setTopic(question.topic || 'Basic Syntax & Structure');
                          setLevel(question.level || 'Level 1');
                          setTestCases(Array.isArray(question.testCases) && question.testCases.length > 0 ? question.testCases : [{ input: '', output: '', hidden: false }]);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="absolute top-2 right-10 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-2 py-1 text-xs rounded-lg shadow-md transition-all duration-200 inline-flex items-center justify-center"
                        aria-label="Edit question"
                        title="Edit question"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18-11.5a1 1 0 0 0 0-1.41l-1.59-1.59a1 1 0 0 0-1.41 0l-1.34 1.34 3.75 3.75 1.59-1.59Z"/></svg>
                      </button>
                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(question.id)}
                        className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-2 py-1 text-xs rounded-lg shadow-md transition-all duration-200 inline-flex items-center justify-center"
                        aria-label="Delete question"
                        title="Delete question"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </CheckDataEntryAuth>
  );
}
