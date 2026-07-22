import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  ShieldAlert,
  FileText,
  Code,
  Cpu,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Settings,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Info
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [activeTab, setActiveTab] = useState('plagiarism'); // plagiarism | ai
  const [serverOnline, setServerOnline] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);

  // ----------------------------------------------------
  // Server Liveliness Check
  // ----------------------------------------------------
  const checkServerStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/plagiarism/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] })
      });
      // A 400 Bad Request is fine, it means the API route exists is responsive.
      if (res.status === 400 || res.ok) {
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    } finally {
      setCheckingServer(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  // ----------------------------------------------------
  // Component render mapping
  // ----------------------------------------------------
  return (
    <div className="app-container">
      {/* Header Banner */}
      <header className="dashboard-header">
        <div className="brand-section">
          <div className="brand-logo-glow">
            <ShieldAlert size={26} />
          </div>
          <div className="brand-title">
            <h1>VERIFY: Plagiarism & AI Shield</h1>
            <p>Advanced syntactic winnowing and LLM authorship detection engine</p>
          </div>
        </div>

        <div className="server-status">
          <div className={`status-dot ${serverOnline ? '' : 'offline'}`} />
          <span>Server: {serverOnline ? 'Connected' : 'Offline (Local Fallback)'}</span>
          <button
            onClick={() => { setCheckingServer(true); checkServerStatus(); }}
            className="remove-file-btn"
            title="Refresh connection"
            style={{ display: 'inline-flex', marginLeft: '5px' }}
          >
            <RefreshCw size={12} className={checkingServer ? 'spinner' : ''} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'plagiarism' ? 'active' : ''}`}
          onClick={() => setActiveTab('plagiarism')}
        >
          <FileText size={16} />
          Plagiarism Matcher
        </button>
        <button
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <Cpu size={16} />
          AI Authorship Detector
        </button>
      </nav>

      {/* Main Feature Content panels */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'plagiarism' ? (
          <PlagiarismPanel serverOnline={serverOnline} />
        ) : (
          <AIDetectorPanel serverOnline={serverOnline} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// PLAGIARISM CHECKER MODULE
// ============================================================================
function PlagiarismPanel({ serverOnline }) {
  const [inputType, setInputType] = useState('text'); // files | text
  const [kValue, setKValue] = useState(8);
  const [wValue, setWValue] = useState(5);

  // Custom copy-pasted text inputs
  const [snippets, setSnippets] = useState([
    { name: 'Document Alpha.txt', content: '', isCode: false },
    { name: 'Document Beta.txt', content: '', isCode: false }
  ]);

  // Upload Files state
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Loading & Results
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [selectedCompIdx, setSelectedCompIdx] = useState(0);

  // 1. Text snippet actions
  const addSnippet = () => {
    setSnippets([
      ...snippets,
      { name: `Snippet ${snippets.length + 1}.txt`, content: '', isCode: false }
    ]);
  };

  const removeSnippet = (idx) => {
    if (snippets.length <= 2) {
      setError('Provide at least 2 snippets to compare.');
      return;
    }
    const copy = [...snippets];
    copy.splice(idx, 1);
    setSnippets(copy);
  };

  const handleSnippetChange = (idx, field, val) => {
    const copy = [...snippets];
    copy[idx][field] = val;
    setSnippets(copy);
  };

  // 2. Drag/Drop File Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addUploadedFiles(e.dataTransfer.files);
    }
  };

  const fileSelected = (e) => {
    if (e.target.files) {
      addUploadedFiles(e.target.files);
    }
  };

  const addUploadedFiles = (newFiles) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr]);
  };

  const removeFile = (idx) => {
    const copy = [...files];
    copy.splice(idx, 1);
    setFiles(copy);
  };

  // 3. API Submission
  const runComparison = async () => {
    setError('');
    setResults(null);
    setSelectedCompIdx(0);
    setIsLoading(true);

    if (!serverOnline) {
      setError('FastAPI Server is offline. Please start uvicorn before performing comparison calculations.');
      setIsLoading(false);
      return;
    }

    try {
      if (inputType === 'text') {
        // Validate
        const emptySnippet = snippets.some(s => !s.content.trim());
        if (emptySnippet) {
          setError('Verify all snippets contain some copy-pasted content before scanning.');
          setIsLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/plagiarism/compare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: snippets.map(s => ({
              name: s.name,
              content: s.content,
              is_code: s.isCode
            })),
            k_value: kValue,
            w_value: wValue
          })
        });

        if (!res.ok) {
          const detail = await res.json();
          throw new Error(detail.detail || 'Failed running plagiarism analysis');
        }

        const data = await res.json();
        setResults(data);
      } else {
        // Upload processing
        if (files.length < 2) {
          setError('Upload at least 2 document/code files to generate comparison matrix.');
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('k_value', kValue.toString());
        formData.append('w_value', wValue.toString());

        const res = await fetch(`${API_BASE}/api/plagiarism/compare-files`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          const detail = await res.json();
          throw new Error(detail.detail || 'Errors during file parsing / verification API');
        }

        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Highlight helper
  const parsedComp = results?.comparisons?.[selectedCompIdx];
  const sourceDoc = snippets.find(s => s.name === parsedComp?.source_name)?.content ||
    results?.items?.[parsedComp?.source_index]?.name;

  // Look up source text content from the original arrays if we did a text run
  let docAContent = '';
  let docBContent = '';
  if (results && inputType === 'text') {
    docAContent = snippets[parsedComp?.source_index]?.content || '';
    docBContent = snippets[parsedComp?.target_index]?.content || '';
  } else if (results) {
    // If files, we'll request details from matching spans
    // For simplicity, we can reconstruct documents from matches if needed,
    // but a cleaner backend structure returns items index contents.
    // Let's modify comparison returns to return full texts in results so that we can show file diffs easily!
    // Wait, the backend returns item name and list of matches.
    // What if the backend also returned the raw doc contents in responses or we extract it locally? 
    // In files mode, we should have the frontend render the matching substrings in a readable card.
    // Let's build a matches list that displays the exact matching strings!
  }

  return (
    <div className="dashboard-grid">
      {/* Configuration & Input Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-card">
          <div className="toggle-switch-wrapper">
            <h2 className="card-title" style={{ margin: 0 }}>
              <FileText size={18} />
              Input Methods
            </h2>
            <div className="toggle-switch">
              <button
                className={`toggle-switch-btn ${inputType === 'text' ? 'active' : ''}`}
                onClick={() => setInputType('text')}
              >
                Copy & Paste Snippets
              </button>
              <button
                className={`toggle-switch-btn ${inputType === 'files' ? 'active' : ''}`}
                onClick={() => setInputType('files')}
              >
                Upload Files
              </button>
            </div>
          </div>

          {/* Copy-Paste Forms */}
          {inputType === 'text' && (
            <div className="snippets-inputs">
              {snippets.map((snip, index) => (
                <div key={index} className="snippet-card">
                  <div className="snippet-header">
                    <input
                      type="text"
                      className="snippet-title-input"
                      value={snip.name}
                      onChange={(e) => handleSnippetChange(index, 'name', e.target.value)}
                    />
                    <div className="snippet-toggles">
                      <button
                        className={`code-badge-toggle ${snip.isCode ? 'active' : ''}`}
                        onClick={() => handleSnippetChange(index, 'isCode', !snip.isCode)}
                      >
                        <Code size={12} />
                        {snip.isCode ? 'Code Mode' : 'Script Mode'}
                      </button>
                      {snippets.length > 2 && (
                        <button onClick={() => removeSnippet(index)} className="remove-file-btn" title="Remove content check">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="snippet-textarea"
                    placeholder={snip.isCode ? "Paste code here..." : "Paste script or text document here..."}
                    value={snip.content}
                    onChange={(e) => handleSnippetChange(index, 'content', e.target.value)}
                  />
                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Characters: {snip.content.length}
                  </div>
                </div>
              ))}

              <button className="btn-outline-plus" onClick={addSnippet}>
                + Add Another Snippet
              </button>
            </div>
          )}

          {/* File Upload zone */}
          {inputType === 'files' && (
            <div>
              <div
                className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <UploadCloud size={32} style={{ color: 'var(--primary)' }} />
                <h3>Drag & Drop Files Here</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Supports .txt, .pdf, .docx, .py, .js, .java, .cpp and other code scripts
                </p>
                <button className="clear-btn" type="button" style={{ pointerEvents: 'none' }}>
                  Browse Local Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={fileSelected}
                />
              </div>

              {files.length > 0 && (
                <div className="file-list">
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>Uploaded Files ({files.length}):</h4>
                  {files.map((file, idx) => (
                    <div key={idx} className="file-item">
                      <div className="file-info">
                        <FileText size={14} style={{ color: 'var(--secondary)' }} />
                        <span className="file-name">{file.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button className="remove-file-btn" onClick={() => removeFile(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel & Run Button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-card">
          <h2 className="card-title">
            <Settings size={18} />
            Winnowing Parameters
          </h2>

          <div className="form-group">
            <div className="form-label" style={{ display: 'flex', justify: 'space-between' }}>
              <span>Noise threshold token size (K-gram)</span>
              <span className="slider-value">{kValue}</span>
            </div>
            <div className="slider-container">
              <input
                type="range"
                min="4"
                max="20"
                className="styled-slider"
                value={kValue}
                onChange={(e) => setKValue(parseInt(e.target.value))}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Smallest matching block of characters/keywords we analyze. Less than K tokens are ignored to filter formatting noise.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <div className="form-label">
              <span>Hashed window range (W size)</span>
              <span className="slider-value" style={{ float: 'right' }}>{wValue}</span>
            </div>
            <div className="slider-container">
              <input
                type="range"
                min="2"
                max="12"
                className="styled-slider"
                value={wValue}
                onChange={(e) => setWValue(parseInt(e.target.value))}
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Windows define matching density. If structure is shifting, smaller windows catch localized structural copy-pastes.
            </p>
          </div>

          <button className="btn-primary" onClick={runComparison} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw size={18} className="spinner" />
                Scanning Databases...
              </>
            ) : (
              <>
                <TrendingUp size={18} />
                Verify Plagiarism Matches
              </>
            )}
          </button>

          {error && (
            <div style={{ marginTop: '1rem', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Matrix Heatmap */}
        {results && (
          <div className="glass-card">
            <h2 className="card-title">
              <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
              Similarity Matches Matrix
            </h2>

            <div className="matrix-container">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Comparisons</th>
                    <th>Score</th>
                    <th>Select</th>
                  </tr>
                </thead>
                <tbody>
                  {results.comparisons.map((c, idx) => {
                    const scorePercent = Math.round(c.score * 100);
                    let scoreClass = 'low';
                    if (scorePercent > 50) scoreClass = 'high';
                    else if (scorePercent > 20) scoreClass = 'mid';

                    return (
                      <tr key={idx} style={{ background: selectedCompIdx === idx ? 'rgba(168, 85, 247, 0.05)' : 'transparent' }}>
                        <td style={{ fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.source_name}</span>
                          <span style={{ margin: '0 0.4rem', color: 'var(--text-muted)' }}>vs</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{c.target_name}</span>
                        </td>
                        <td>
                          <span className={`matrix-cell-score ${scoreClass}`}>
                            {scorePercent}%
                          </span>
                        </td>
                        <td>
                          <button
                            className="comparison-select-btn"
                            onClick={() => setSelectedCompIdx(idx)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full Page Comparison Span Detail */}
      {results && results.comparisons.length > 0 && (
        <div className="glass-card" style={{ gridColumn: '1 / -1' }}>
          <PlagiarismDetailedViewer
            comparison={results.comparisons[selectedCompIdx]}
            inputType={inputType}
            docAContent={docAContent}
            docBContent={docBContent}
          />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// COMPARISON INSPECTOR UTILS (Highlights matching sentences or winnowed code)
// ----------------------------------------------------
function PlagiarismDetailedViewer({ comparison, inputType, docAContent, docBContent }) {
  if (!comparison) return null;
  const scorePercent = Math.round(comparison.score * 100);

  // Highlight Renderer standard logic
  const renderDocumentHighlights = (text, matches, isSource) => {
    if (!text) {
      return (
        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
          Document text is represented inside matching chunk logs. Select paste inputs to review full side-by-side highlight layouts.
        </div>
      );
    }

    // Build ranges
    const ranges = matches.map(m => isSource ? m.source : m.target);

    // Sort and overlap-merge intervals
    if (!ranges.length) return <span>{text}</span>;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [];

    for (let r of sorted) {
      if (merged.length === 0) {
        merged.push({ ...r });
      } else {
        const last = merged[merged.length - 1];
        if (r.start <= last.end) {
          last.end = Math.max(last.end, r.end);
        } else {
          merged.push({ ...r });
        }
      }
    }

    const elements = [];
    let lastIdx = 0;

    merged.forEach((r, idx) => {
      // Add unhighlighted chunk
      if (r.start > lastIdx) {
        elements.push(<span key={`u-${idx}`}>{text.substring(lastIdx, r.start)}</span>);
      }
      // Add highlighted chunk
      const hClass = comparison.is_code ? 'highlight-code-match' : 'highlight-text-match';
      elements.push(
        <span
          key={`h-${idx}`}
          className={hClass}
          title={comparison.is_code ? "Winnowed code token block matching counterpart structure" : `Highly similar text sentence matching counterpart`}
        >
          {text.substring(r.start, r.end)}
        </span>
      );
      lastIdx = r.end;
    });

    if (lastIdx < text.length) {
      elements.push(<span key="u-end">{text.substring(lastIdx)}</span>);
    }

    return elements;
  };

  return (
    <div className="compare-split-container">
      <div className="split-header">
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            Inspecting: {comparison.source_name} ↔ {comparison.target_name}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Method: {comparison.is_code ? 'Tokenized Winnowing Fingerprinting' : 'Cosine Similarity + Sentence Overlap Mapping'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparison Match</span>
          <h2 style={{ color: comparison.score > 0.5 ? 'var(--danger)' : comparison.score > 0.2 ? 'var(--warning)' : 'var(--success)' }}>
            {scorePercent}%
          </h2>
        </div>
      </div>

      <div className="split-grids">
        {/* Source Panel */}
        <div className="side-panel">
          <div className="side-panel-header">
            <span>[SOURCE 1]: {comparison.source_name}</span>
            <span>{docAContent.length || comparison.matches.length} chars/tokens</span>
          </div>
          <div className="code-viewer-container">
            {inputType === 'text'
              ? renderDocumentHighlights(docAContent, comparison.matches, true)
              : renderHighlightChunkList(comparison.matches, true)
            }
          </div>
        </div>

        {/* Target Panel */}
        <div className="side-panel">
          <div className="side-panel-header">
            <span>[SOURCE 2]: {comparison.target_name}</span>
            <span>{docBContent.length || comparison.matches.length} chars/tokens</span>
          </div>
          <div className="code-viewer-container">
            {inputType === 'text'
              ? renderDocumentHighlights(docBContent, comparison.matches, false)
              : renderHighlightChunkList(comparison.matches, false)
            }
          </div>
        </div>
      </div>

      {comparison.matches.length === 0 && (
        <div className="quick-info-tip">
          <Info size={14} />
          <span>Zero overlapping blocks detected between these documents. System indicates low plagiarism likelihood.</span>
        </div>
      )}
    </div>
  );
}

function renderHighlightChunkList(matches, isSource) {
  if (!matches || matches.length === 0) return <div style={{ color: 'var(--text-muted)' }}>No matches found.</div>;
  // Group or just display list of matched codes
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
        Identified Match Segments:
      </div>
      {matches.slice(0, 15).map((m, idx) => {
        const item = isSource ? m.source : m.target;
        return (
          <div
            key={idx}
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderLeft: '3px solid var(--primary)',
              padding: '0.4rem',
              fontSize: '0.8rem',
              borderRadius: '4px',
              fontStyle: 'normal'
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'flex', justify: 'space-between' }}>
              <span>Match Offset #{idx + 1} ({item.start} - {item.end})</span>
            </div>
            <code style={{ background: 'transparent', padding: 0, color: 'var(--primary)' }}>
              {item.text}
            </code>
          </div>
        );
      })}
      {matches.length > 15 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
          + {matches.length - 15} more similar chunks detected...
        </div>
      )}
    </div>
  );
}


// ============================================================================
// AI AUTHORSHIP DETECTOR MODULE
// ============================================================================
function AIDetectorPanel({ serverOnline }) {
  const [aiMode, setAiMode] = useState('text'); // text | upload
  const [isCode, setIsCode] = useState(false);
  const [textInput, setTextInput] = useState('');

  // Upload State
  const [uploadedFile, setUploadedFile] = useState(null);
  const fileRef = useRef(null);

  // States
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const clearForm = () => {
    setTextInput('');
    setUploadedFile(null);
    setResults(null);
    setError('');
  };

  const handleScan = async () => {
    setError('');
    setResults(null);
    setAiLoading(true);

    if (!serverOnline) {
      setError('FastAPI Server is offline. Please start uvicorn before performing comparison calculations.');
      setAiLoading(false);
      return;
    }

    try {
      if (aiMode === 'text') {
        if (!textInput.trim()) {
          setError('Please paste text or code content before running authorship check.');
          setAiLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/ai/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: textInput,
            is_code: isCode
          })
        });

        if (!res.ok) {
          throw new Error('Errors running AI detector endpoint');
        }

        const data = await res.json();
        setResults(data);
      } else {
        if (!uploadedFile) {
          setError('Please upload a document file to scan.');
          setAiLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', uploadedFile);
        if (isCode) {
          formData.append('is_code', 'true');
        }

        const res = await fetch(`${API_BASE}/api/ai/detect-file`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          throw new Error('Errors uploading / running AI file analysis');
        }

        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Rendering styling mappings
  const aiScore = results ? Math.round(results.score) : 0;

  // Radial gauge progress computations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (aiScore / 100) * circumference;

  let scoreColor = 'var(--success)';
  let statusBadge = 'Likely Human Written';
  let badgeClass = 'likely-human';
  if (aiScore > 70) {
    scoreColor = 'var(--danger)';
    statusBadge = 'AI Generated Content';
    badgeClass = 'likely-ai';
  } else if (aiScore > 35) {
    scoreColor = 'var(--warning)';
    statusBadge = 'Mixed AI & Human Elements';
    badgeClass = 'mixed';
  }

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: results ? '1.5fr 1fr' : '1fr' }}>

      {/* Input controls form card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="toggle-switch-wrapper">
          <h2 className="card-title" style={{ margin: 0 }}>
            <Cpu size={18} style={{ color: 'var(--primary)' }} />
            Authorship Scanner
          </h2>

          <div className="toggle-switch">
            <button
              className={`toggle-switch-btn ${aiMode === 'text' ? 'active' : ''}`}
              onClick={() => setAiMode('text')}
            >
              Paste Material
            </button>
            <button
              className={`toggle-switch-btn ${aiMode === 'upload' ? 'active' : ''}`}
              onClick={() => setAiMode('upload')}
            >
              Upload Material
            </button>
          </div>
        </div>

        {/* Input Toggle selection type */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
          <button
            className={`code-badge-toggle ${!isCode ? 'active' : ''}`}
            onClick={() => setIsCode(false)}
            style={{ padding: '0.4rem 1rem' }}
          >
            Script / Text Classifier
          </button>
          <button
            className={`code-badge-toggle ${isCode ? 'active' : ''}`}
            onClick={() => setIsCode(true)}
            style={{ padding: '0.4rem 1rem' }}
          >
            Source Code Classifier
          </button>
        </div>

        {aiMode === 'text' ? (
          <textarea
            className="snippet-textarea"
            placeholder={isCode ? "Paste code source file here..." : "Paste script text, emails, essays or papers here..."}
            style={{ minHeight: '300px' }}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
          />
        ) : (
          <div className="dropzone" onClick={() => fileRef.current.click()}>
            <UploadCloud size={32} style={{ color: 'var(--primary)' }} />
            <h3>Upload Authorship script</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {uploadedFile ? `Selected: ${uploadedFile.name} (${(uploadedFile.size / 1024).toFixed(1)} KB)` : 'Select local .txt, .pdf, .docx or source code files'}
            </span>
            <input
              type="file"
              ref={fileRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="clear-btn" onClick={clearForm}>
            Clear
          </button>
          <button className="btn-primary" onClick={handleScan} disabled={aiLoading} style={{ flexGrow: 1 }}>
            {aiLoading ? (
              <>
                <RefreshCw size={18} className="spinner" />
                Classifying syntax styles...
              </>
            ) : (
              <>
                <Cpu size={18} />
                Analyze AI Authorship
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Dashboard Panel */}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Main Dial Summary card */}
          <div className="glass-card ai-results-panel">
            <h2 className="card-title" style={{ alignSelf: 'flex-start' }}>Result Classification</h2>

            <div className="gauge-wrapper">
              <svg className="gauge-svg">
                <circle className="gauge-bg" cx="90" cy="90" r={radius} />
                <circle
                  className="gauge-fill"
                  cx="90"
                  cy="90"
                  r={radius}
                  stroke={scoreColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="gauge-info-text">
                <span className="gauge-percent" style={{ color: scoreColor }}>{aiScore}%</span>
                <span className="gauge-label">AI probability</span>
              </div>
            </div>

            <div className={`ai-status-badge ${badgeClass}`}>
              {statusBadge}
            </div>

            {results.confidence && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                System confidence score: <strong>{results.confidence}%</strong> (using {results.method})
              </div>
            )}

            <div className="ai-insights-block">
              <div className="insights-title">Authorship Assessment Details</div>
              <p className="insights-text">{results.explanation}</p>
            </div>
          </div>

          {/* Detailed Paragraph Breakdown lists */}
          {results.highlights && results.highlights.length > 0 && (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="card-title">
                <CheckCircle2 size={16} />
                Segment-by-Segment Style Heatmap
              </h2>
              <div className="ai-highlight-editor">
                {results.highlights.map((h, idx) => {
                  let cls = 'ai-human';
                  if (h.score > 70) cls = 'ai-heavy';
                  else if (h.score > 35) cls = 'ai-mixed';

                  return (
                    <div key={idx} className={`ai-paragraph-card ${cls}`}>
                      <p style={{ fontStyle: isCode ? 'normal' : 'normal', fontFamily: isCode ? 'var(--font-mono)' : 'inherit', fontSize: '0.85rem' }}>
                        {isCode ? <code>{h.text}</code> : h.text}
                      </p>
                      <div className="para-stats">
                        <span>Segment likelihood: {Math.round(h.score)}% AI</span>
                        <span>{h.reason || 'Conforms with syntax rules'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
