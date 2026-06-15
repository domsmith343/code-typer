import SNIPPETS from './snippets.js';

// --- GAME STATE ---
let state = {
  currentLanguage: 'javascript',
  currentSnippet: null,
  lines: [], // Array of lines, where each line is an array of characters
  lineIndex: 0,
  charIndex: 0,

  // Game state flags
  testActive: false,
  testStarted: false,
  startTime: null,
  timerInterval: null,
  secondsElapsed: 0,

  // User settings (loaded from localStorage if present)
  soundEnabled: true,
  autoIndent: true,
  currentTheme: 'retro-dark',
  githubToken: '',

  // Typing metrics tracking
  totalTyped: 0,
  correctCount: 0,
  incorrectCount: 0,
  errorsThisTest: 0,
  history: [], // Tracks { second, wpm, errors }

  // GitHub fetching state
  currentRepo: ''
};

// --- AUDIO CONFIG (Web Audio API Keystroke Synth) ---
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playClick(type) {
  if (!state.soundEnabled) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'space') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'enter') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'backspace') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.06);
  } else { // normal key
    osc.type = 'sine';
    const freq = 340 + Math.random() * 60;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq - 90, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

// --- DOM ELEMENTS ---
const elements = {
  themeSelect: document.getElementById('theme-select'),
  langSelect: document.getElementById('lang-select'),
  soundToggle: document.getElementById('sound-toggle'),
  indentToggle: document.getElementById('indent-toggle'),
  githubTokenInput: document.getElementById('github-token'),

  typingContainer: document.getElementById('typing-container'),
  inputHelper: document.getElementById('input-helper'),
  codeDisplay: document.getElementById('code-display'),
  caret: document.getElementById('caret'),
  focusBanner: document.getElementById('focus-banner'),
  statusOverlay: document.getElementById('status-overlay'),
  statusText: document.getElementById('status-text'),

  liveWpm: document.getElementById('live-wpm'),
  liveAccuracy: document.getElementById('live-accuracy'),
  liveTimer: document.getElementById('live-timer'),

  resultsContainer: document.getElementById('results-container'),
  resWpm: document.getElementById('res-wpm'),
  resRaw: document.getElementById('res-raw'),
  resAcc: document.getElementById('res-acc'),
  resErrors: document.getElementById('res-errors'),
  resTime: document.getElementById('res-time'),
  chartBox: document.getElementById('chart-box'),

  customRepoBtn: document.getElementById('custom-repo-btn'),
  repoDialog: document.getElementById('repo-dialog'),
  dialogOverlay: document.getElementById('dialog-overlay'),
  repoInput: document.getElementById('repo-input'),
  repoConfirm: document.getElementById('repo-confirm'),
  repoCancel: document.getElementById('repo-cancel'),

  settingsToggle: document.getElementById('settings-toggle'),
  settingsDrawer: document.getElementById('settings-drawer'),
  closeDrawer: document.getElementById('close-drawer'),

  restartBtn: document.getElementById('restart-btn'),
  resultRestart: document.getElementById('result-restart')
};

// --- INITIALIZE SETTINGS ---
function loadSettings() {
  const savedTheme = localStorage.getItem('code-typer-theme') || 'retro-dark';
  const savedSound = localStorage.getItem('code-typer-sound') !== 'false';
  const savedIndent = localStorage.getItem('code-typer-indent') !== 'false';
  const savedToken = localStorage.getItem('code-typer-token') || '';
  const savedLang = localStorage.getItem('code-typer-lang') || 'javascript';

  state.currentTheme = savedTheme;
  state.soundEnabled = savedSound;
  state.autoIndent = savedIndent;
  state.githubToken = savedToken;
  state.currentLanguage = savedLang;

  // Apply visual state
  document.body.setAttribute('data-theme', savedTheme);
  elements.themeSelect.value = savedTheme;
  elements.langSelect.value = savedLang;
  elements.soundToggle.checked = savedSound;
  elements.indentToggle.checked = savedIndent;
  elements.githubTokenInput.value = savedToken;
}

function saveSetting(key, val) {
  localStorage.setItem(`code-typer-${key}`, val);
}

// --- CODE HIGHLIGHTER (Lightweight tokeniser) ---
function tokenizeLine(lineText) {
  const types = new Array(lineText.length).fill('');

  // 1. Comments
  const commentIdx = lineText.indexOf('//');
  if (commentIdx !== -1) {
    for (let i = commentIdx; i < lineText.length; i++) types[i] = 'comment';
  }
  const hashIdx = lineText.indexOf('#');
  if (hashIdx !== -1 && commentIdx === -1) {
    for (let i = hashIdx; i < lineText.length; i++) types[i] = 'comment';
  }

  // 2. Strings
  let inString = false;
  let quoteChar = '';
  for (let i = 0; i < lineText.length; i++) {
    if (types[i] === 'comment') break;
    const c = lineText[i];
    if ((c === '"' || c === "'" || c === '`') && (i === 0 || lineText[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        quoteChar = c;
        types[i] = 'string';
      } else if (c === quoteChar) {
        inString = false;
        types[i] = 'string';
      }
    } else if (inString) {
      types[i] = 'string';
    }
  }

  // 3. Keywords, numbers, punctuation
  const keywords = ['function', 'const', 'let', 'var', 'class', 'return', 'if', 'else', 'while', 'for', 'import', 'export', 'default', 'from', 'def', 'classonlymethod', 'self', 'pub', 'fn', 'impl', 'struct', 'template', 'typename', 'typedef', 'inline', 'public', 'private', 'protected', 'virtual', 'override', 'void', 'int', 'double', 'float', 'char', 'bool', 'true', 'false', 'nil', 'null', 'err', 'error', 'interface', 'package', 'func', 'go', 'defer'];

  // Find words
  let wordStart = -1;
  for (let i = 0; i <= lineText.length; i++) {
    const c = i < lineText.length ? lineText[i] : ' ';
    if (types[i] === 'comment' || types[i] === 'string') {
      if (wordStart !== -1) wordStart = -1;
      continue;
    }

    if (/[a-zA-Z0-9_$]/.test(c)) {
      if (wordStart === -1) wordStart = i;
    } else {
      if (wordStart !== -1) {
        const word = lineText.substring(wordStart, i);
        if (keywords.includes(word)) {
          for (let j = wordStart; j < i; j++) types[j] = 'keyword';
        } else if (/^[0-9]+$/.test(word)) {
          for (let j = wordStart; j < i; j++) types[j] = 'number';
        }
        wordStart = -1;
      }
      // Punctuation and operators
      if (i < lineText.length) {
        if (['{', '}', '[', ']', '(', ')', ';', '.', ','].includes(c)) {
          types[i] = 'punctuation';
        } else if (['=', '+', '-', '*', '/', '%', '&', '|', '^', '!', '<', '>', '?'].includes(c)) {
          types[i] = 'operator';
        }
      }
    }
  }

  return types;
}

// --- RENDER CODE SNIPPET ---
function renderSnippet() {
  elements.codeDisplay.innerHTML = '<div id="caret" class="blink"></div>';
  elements.caret = document.getElementById('caret');

  state.lines = [];
  const rawLines = state.currentSnippet.code.split('\n');

  rawLines.forEach((lineText, lineIdx) => {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'code-line';
    if (lineIdx === 0) lineDiv.classList.add('active');

    const lineChars = [];
    const syntaxTypes = tokenizeLine(lineText);

    // Find where indentation ends in this line
    let firstNonSpace = 0;
    while (firstNonSpace < lineText.length && (lineText[firstNonSpace] === ' ' || lineText[firstNonSpace] === '\t')) {
      firstNonSpace++;
    }

    for (let i = 0; i < lineText.length; i++) {
      const char = lineText[i];
      const charSpan = document.createElement('span');
      charSpan.className = 'char';

      // Auto-indent highlight
      if (i < firstNonSpace && state.autoIndent) {
        charSpan.classList.add('indent-skip');
        charSpan.textContent = char === '\t' ? '  ' : char; // Render tabs as double space visual helper
      } else {
        charSpan.textContent = char;
        const type = syntaxTypes[i];
        if (type) charSpan.classList.add(`syntax-${type}`);
      }

      lineDiv.appendChild(charSpan);
      lineChars.push(charSpan);
    }

    // Add Enter key symbol at the end of the line if it is not the last line
    if (lineIdx < rawLines.length - 1) {
      const eolSpan = document.createElement('span');
      eolSpan.className = 'char eol';
      lineDiv.appendChild(eolSpan);
      lineChars.push(eolSpan);
    }

    elements.codeDisplay.appendChild(lineDiv);
    state.lines.push(lineChars);
  });

  // Set initial game indexing
  state.lineIndex = 0;
  state.charIndex = 0;

  // Apply auto-indent jump on first line if configured
  jumpOverIndents();
  updateCaret();
}

function jumpOverIndents() {
  if (!state.autoIndent) return;
  const currentLineChars = state.lines[state.lineIndex];
  while (state.charIndex < currentLineChars.length && currentLineChars[state.charIndex].classList.contains('indent-skip')) {
    state.charIndex++;
  }
}

// --- UPDATE CARET LOCATION ---
function updateCaret() {
  if (!state.lines.length) return;

  const currentLine = state.lines[state.lineIndex];

  // If we finished typing the current line and are waiting for Enter
  if (state.charIndex >= currentLine.length) {
    // If not the last line, target is the last character's right side
    const lastChar = currentLine[currentLine.length - 1];
    const lastCharRect = lastChar.getBoundingClientRect();
    const containerRect = elements.codeDisplay.getBoundingClientRect();

    elements.caret.style.left = `${lastCharRect.right - containerRect.left}px`;
    elements.caret.style.top = `${lastCharRect.top - containerRect.top}px`;
    elements.caret.style.height = `${lastCharRect.height}px`;
    return;
  }

  const activeSpan = currentLine[state.charIndex];
  const activeSpanRect = activeSpan.getBoundingClientRect();
  const containerRect = elements.codeDisplay.getBoundingClientRect();

  // Center or align caret relative to container
  elements.caret.style.left = `${activeSpanRect.left - containerRect.left}px`;
  elements.caret.style.top = `${activeSpanRect.top - containerRect.top}px`;
  elements.caret.style.height = `${activeSpanRect.height}px`;
}

// --- GAME LOOP / GAMEPLAY ---
function startTest() {
  state.testActive = true;
  state.testStarted = true;
  state.startTime = new Date();
  state.secondsElapsed = 0;
  state.totalTyped = 0;
  state.correctCount = 0;
  state.incorrectCount = 0;
  state.errorsThisTest = 0;
  state.history = [];

  // Start HUD tick
  state.timerInterval = setInterval(tick, 1000);
  elements.liveTimer.textContent = '0s';
  elements.liveWpm.textContent = '0';
  elements.liveAccuracy.textContent = '100%';

  elements.caret.classList.remove('blink');
}

function tick() {
  state.secondsElapsed++;
  elements.liveTimer.textContent = `${state.secondsElapsed}s`;

  // Calculate live stats
  const mins = state.secondsElapsed / 60;
  const currentWpm = Math.round((state.correctCount / 5) / mins);
  const rawWpm = Math.round((state.totalTyped / 5) / mins);
  const acc = state.totalTyped === 0 ? 100 : Math.round((state.correctCount / state.totalTyped) * 100);

  elements.liveWpm.textContent = currentWpm;
  elements.liveAccuracy.textContent = `${acc}%`;

  // Save history for chart plotting
  state.history.push({
    second: state.secondsElapsed,
    wpm: currentWpm,
    errors: state.errorsThisTest
  });
  state.errorsThisTest = 0; // reset error bucket per second
}

function handleInput(key) {
  if (!state.testActive) {
    startTest();
  }

  const currentLine = state.lines[state.lineIndex];
  const activeSpan = currentLine[state.charIndex];

  let targetChar = '';
  let isEol = activeSpan.classList.contains('eol');

  if (isEol) {
    targetChar = 'Enter';
  } else {
    // If it's a tab or space rendered visually, check standard
    targetChar = activeSpan.textContent;
  }

  state.totalTyped++;

  if (key === targetChar) {
    activeSpan.classList.add('correct');
    activeSpan.classList.remove('incorrect');
    state.correctCount++;

    // Play keystroke audio
    if (isEol) {
      playClick('enter');
    } else if (key === ' ') {
      playClick('space');
    } else {
      playClick('key');
    }

    // Move to next character
    state.charIndex++;

    // Check line transition
    if (state.charIndex >= currentLine.length) {
      // If last character of last line is typed, end the test!
      if (state.lineIndex >= state.lines.length - 1) {
        endTest();
        return;
      }
    }
  } else {
    activeSpan.classList.add('incorrect');
    state.incorrectCount++;
    state.errorsThisTest++;
    playClick('key'); // play standard error click

    // In Monkeytype, mistakes do not halt progress if backspace is allowed. We advance caret
    state.charIndex++;
    if (state.charIndex >= currentLine.length && state.lineIndex >= state.lines.length - 1) {
      endTest();
      return;
    }
  }

  updateCaret();
}

function handleBackspace() {
  if (!state.testActive || (state.lineIndex === 0 && state.charIndex === 0)) return;

  playClick('backspace');

  // If charIndex is at the beginning of the line
  if (state.charIndex === 0) {
    // Return to previous line
    elements.codeDisplay.children[state.lineIndex].classList.remove('active');
    state.lineIndex--;
    elements.codeDisplay.children[state.lineIndex].classList.add('active');

    const prevLine = state.lines[state.lineIndex];
    state.charIndex = prevLine.length - 1; // set to EOL index

    // Remove correctness class from EOL
    prevLine[state.charIndex].classList.remove('correct', 'incorrect');
  } else {
    // Step back index
    state.charIndex--;

    // If we hit an auto-skipped indentation character, skip backwards recursive!
    const currentLine = state.lines[state.lineIndex];
    if (state.autoIndent && currentLine[state.charIndex].classList.contains('indent-skip')) {
      while (state.charIndex > 0 && currentLine[state.charIndex].classList.contains('indent-skip')) {
        currentLine[state.charIndex].classList.remove('correct', 'incorrect');
        state.charIndex--;
      }
      // If we landed back on index 0, and it's an indent-skip character
      if (state.charIndex === 0 && currentLine[0].classList.contains('indent-skip')) {
        // Go back to previous line!
        if (state.lineIndex > 0) {
          elements.codeDisplay.children[state.lineIndex].classList.remove('active');
          state.lineIndex--;
          elements.codeDisplay.children[state.lineIndex].classList.add('active');
          const prevLine = state.lines[state.lineIndex];
          state.charIndex = prevLine.length - 1;
          prevLine[state.charIndex].classList.remove('correct', 'incorrect');
        } else {
          // Stay on first character of line
          jumpOverIndents();
        }
      }
    } else {
      currentLine[state.charIndex].classList.remove('correct', 'incorrect');
    }
  }

  updateCaret();
}

function handleLineEnter() {
  // Enter is only valid when caret is at the end of the line (on EOL span)
  const currentLine = state.lines[state.lineIndex];
  if (state.charIndex === currentLine.length - 1 && currentLine[state.charIndex].classList.contains('eol')) {
    // Type correct Enter
    currentLine[state.charIndex].classList.add('correct');
    state.correctCount++;
    state.totalTyped++;
    playClick('enter');

    // Move to next line
    elements.codeDisplay.children[state.lineIndex].classList.remove('active');
    state.lineIndex++;
    elements.codeDisplay.children[state.lineIndex].classList.add('active');
    state.charIndex = 0;

    jumpOverIndents();
    updateCaret();
  } else {
    // Hitting Enter mid-line is counted as a typo/mistake, or we ignore it. Let's count it as incorrect
    handleInput('Enter');
  }
}

function endTest() {
  clearInterval(state.timerInterval);
  state.testActive = false;

  const finalTime = Math.max(state.secondsElapsed, 1);
  const mins = finalTime / 60;

  // WPM calculations
  const finalWpm = Math.round((state.correctCount / 5) / mins);
  const finalRaw = Math.round((state.totalTyped / 5) / mins);
  const finalAcc = state.totalTyped === 0 ? 100 : Math.round((state.correctCount / state.totalTyped) * 100);
  const finalErrors = state.incorrectCount;

  // Display results
  elements.resWpm.textContent = finalWpm;
  elements.resRaw.textContent = finalRaw;
  elements.resAcc.textContent = `${finalAcc}%`;
  elements.resErrors.textContent = finalErrors;
  elements.resTime.textContent = `${finalTime}s`;

  elements.typingContainer.style.display = 'none';
  elements.resultsContainer.classList.add('show');

  plotResultsChart();
}

function resetGame() {
  clearInterval(state.timerInterval);
  state.testActive = false;
  state.testStarted = false;
  state.secondsElapsed = 0;
  state.history = [];

  elements.liveTimer.textContent = '0s';
  elements.liveWpm.textContent = '0';
  elements.liveAccuracy.textContent = '100%';

  elements.typingContainer.style.display = 'block';
  elements.resultsContainer.classList.remove('show');

  renderSnippet();
  elements.typingContainer.focus();
}

// --- RENDER RESULTS CHART (SVG based plotting) ---
function plotResultsChart() {
  elements.chartBox.innerHTML = '';

  if (state.history.length === 0) return;

  const width = elements.chartBox.clientWidth;
  const height = elements.chartBox.clientHeight;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.overflow = 'visible';

  const maxWpm = Math.max(...state.history.map(d => d.wpm), 20); // cap floor at 20 WPM
  const maxSec = state.history.length;

  // Render grid lines
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const yVal = Math.round(maxWpm * (i / gridLines));
    const yPos = height - (height * (i / gridLines)) * 0.8 - height * 0.1; // padding top/bottom

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', 40);
    line.setAttribute('y1', yPos);
    line.setAttribute('x2', width - 20);
    line.setAttribute('y2', yPos);
    line.setAttribute('stroke', 'var(--sub-color)');
    line.setAttribute('stroke-dasharray', '3,3');
    line.setAttribute('opacity', '0.2');
    svg.appendChild(line);

    // Text label
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', 5);
    txt.setAttribute('y', yPos + 4);
    txt.setAttribute('fill', 'var(--sub-color)');
    txt.setAttribute('font-family', 'var(--font-sans)');
    txt.setAttribute('font-size', '10px');
    txt.textContent = `${yVal} wpm`;
    svg.appendChild(txt);
  }

  // Map points
  const points = [];
  state.history.forEach((d, idx) => {
    const x = 40 + ((width - 60) * (idx / (maxSec - 1 || 1)));
    const y = height - (height * (d.wpm / maxWpm)) * 0.8 - height * 0.1;
    points.push({ x, y, val: d.wpm, sec: d.second, err: d.errors });
  });

  // Draw line path
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let dString = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    dString += ` L ${points[i].x} ${points[i].y}`;
  }
  polyline.setAttribute('d', dString);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', 'var(--main-color)');
  polyline.setAttribute('stroke-width', '3');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);

  // Draw error dots
  points.forEach(pt => {
    if (pt.err > 0) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', Math.min(2 + pt.err * 1.5, 8));
      circle.setAttribute('fill', 'var(--error-color)');
      svg.appendChild(circle);
    }
  });

  elements.chartBox.appendChild(svg);
}

// --- GITHUB REPO FILE PARSER ---
async function fetchSnippetFromGithub(repo) {
  elements.statusOverlay.classList.add('show');
  elements.statusText.textContent = `Fetching files from ${repo}...`;

  const token = state.githubToken;
  const headers = {};
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    // 1. Fetch main repo tree
    let res = await fetch(`https://api.github.com/repos/${repo}/git/trees/main?recursive=1`, { headers });

    // Fallback if branch is master instead of main
    if (res.status === 404) {
      res = await fetch(`https://api.github.com/repos/${repo}/git/trees/master?recursive=1`, { headers });
    }

    if (!res.ok) {
      throw new Error(`Repo not found or API limits exceeded. Status: ${res.status}`);
    }

    const data = await res.json();
    if (!data.tree) {
      throw new Error('Failed to parse repository structure.');
    }

    // Filter matching code file extensions
    const supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.cpp', '.cc', '.h', '.cs', '.java'];
    const codeFiles = data.tree.filter(file => {
      if (file.type !== 'blob') return false;
      const dotIdx = file.path.lastIndexOf('.');
      if (dotIdx === -1) return false;
      const ext = file.path.substring(dotIdx).toLowerCase();
      return supportedExtensions.includes(ext) && !file.path.includes('node_modules/') && !file.path.includes('vendor/');
    });

    if (codeFiles.length === 0) {
      throw new Error('No supported programming files found in repo.');
    }

    // Pick random code file
    const randomFile = codeFiles[Math.floor(Math.random() * codeFiles.length)];
    elements.statusText.textContent = `Loading ${randomFile.path.split('/').pop()}...`;

    // Fetch raw content
    const rawUrl = `https://raw.githubusercontent.com/${repo}/master/${randomFile.path}`;
    const rawRes = await fetch(rawUrl);
    if (!rawRes.ok) {
      // Try with main branch raw
      const rawUrlMain = `https://raw.githubusercontent.com/${repo}/main/${randomFile.path}`;
      const rawResMain = await fetch(rawUrlMain);
      if (!rawResMain.ok) {
        throw new Error('Failed to retrieve file contents.');
      }
      return processCodeText(await rawResMain.text(), repo, randomFile.path);
    }
    return processCodeText(await rawRes.text(), repo, randomFile.path);

  } catch (err) {
    elements.statusOverlay.classList.remove('show');
    alert(`GitHub Fetch Error: ${err.message}`);
    throw err;
  }
}

function processCodeText(text, repo, filepath) {
  const lines = text.split('\n');

  // Find a block of 10-15 lines. We try to find a nice non-empty code chunk
  let startIdx = 0;
  let maxCodeLines = 12;

  // Basic heuristic: search for a class/function keyword or brace to start the snippet, skipping header docs
  for (let i = 0; i < Math.min(lines.length, 120); i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('def ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('pub fn') ||
      trimmed.includes('{') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('let ')) {
      startIdx = i;
      break;
    }
  }

  // If no good start, just pick 10 lines somewhere in the first half
  if (startIdx === 0 && lines.length > maxCodeLines) {
    startIdx = Math.floor(Math.random() * Math.min(lines.length - maxCodeLines, 50));
  }

  let snippetLines = lines.slice(startIdx, startIdx + maxCodeLines);

  // Clean empty lines at start/end
  while (snippetLines.length && snippetLines[0].trim() === '') snippetLines.shift();
  while (snippetLines.length && snippetLines[snippetLines.length - 1].trim() === '') snippetLines.pop();

  if (snippetLines.length === 0) {
    throw new Error('Retrieved snippet is empty.');
  }

  // Replace tabs with double-spaces for consistent typing
  const cleanCode = snippetLines.map(ln => ln.replace(/\t/g, '  ')).join('\n');

  state.currentSnippet = {
    repo: repo,
    file: filepath,
    code: cleanCode
  };

  elements.statusOverlay.classList.remove('show');
  resetGame();
}

function loadLocalSnippet() {
  const currentLangSnippets = SNIPPETS[state.currentLanguage];
  const randSnippet = currentLangSnippets[Math.floor(Math.random() * currentLangSnippets.length)];
  state.currentSnippet = randSnippet;
  resetGame();
}

// --- EVENT LISTENERS ---
function setupEvents() {
  // Focus logic
  elements.typingContainer.addEventListener('click', () => {
    elements.inputHelper.focus();
    elements.focusBanner.classList.remove('show');
    elements.caret.classList.remove('blink');
  });

  elements.inputHelper.addEventListener('blur', () => {
    elements.focusBanner.classList.add('show');
    elements.caret.classList.add('blink');
  });

  // Keyboard entry capturing
  elements.inputHelper.addEventListener('keydown', (e) => {
    // Prevent default scrolling on spacebar, browser shortcuts, backspaces
    if (e.key === ' ' || e.key === 'Backspace' || e.key === 'Enter') {
      e.preventDefault();
    }

    if (e.key === 'Backspace') {
      handleBackspace();
    } else if (e.key === 'Enter') {
      handleLineEnter();
    }
  });

  elements.inputHelper.addEventListener('textInput', (e) => {
    // Chrome/Safari textInput handles actual characters typed
    e.preventDefault();
    handleInput(e.data);
  });

  // Fallback keypress for non-webkit or generic inputs
  elements.inputHelper.addEventListener('keypress', (e) => {
    if (e.key !== 'Enter' && e.key !== 'Backspace') {
      e.preventDefault();
      handleInput(e.key);
    }
  });

  // Theme configuration
  elements.themeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.currentTheme = val;
    document.body.setAttribute('data-theme', val);
    saveSetting('theme', val);
  });

  // Language selection
  elements.langSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    state.currentLanguage = val;
    saveSetting('lang', val);
    loadLocalSnippet();
  });

  // Settings Drawer toggles
  elements.settingsToggle.addEventListener('click', () => {
    elements.settingsDrawer.classList.add('open');
  });

  elements.closeDrawer.addEventListener('click', () => {
    elements.settingsDrawer.classList.remove('open');
  });

  elements.soundToggle.addEventListener('change', (e) => {
    const val = e.target.checked;
    state.soundEnabled = val;
    saveSetting('sound', val);
  });

  elements.indentToggle.addEventListener('change', (e) => {
    const val = e.target.checked;
    state.autoIndent = val;
    saveSetting('indent', val);
    resetGame();
  });

  elements.githubTokenInput.addEventListener('change', (e) => {
    const val = e.target.value.trim();
    state.githubToken = val;
    saveSetting('token', val);
  });

  // Custom repository prompt
  elements.customRepoBtn.addEventListener('click', () => {
    elements.repoDialog.classList.add('show');
    elements.dialogOverlay.classList.add('show');
    elements.repoInput.focus();
  });

  const closeDialog = () => {
    elements.repoDialog.classList.remove('show');
    elements.dialogOverlay.classList.remove('show');
    elements.repoInput.value = '';
  };

  elements.repoCancel.addEventListener('click', closeDialog);
  elements.dialogOverlay.addEventListener('click', closeDialog);

  elements.repoConfirm.addEventListener('click', async () => {
    const val = elements.repoInput.value.trim();
    if (!val) return;

    // Basic owner/repo validation
    const parts = val.split('/');
    if (parts.length !== 2) {
      alert("Invalid repo name. Format must be 'owner/repo' (e.g. facebook/react)");
      return;
    }

    closeDialog();
    try {
      await fetchSnippetFromGithub(val);
    } catch (err) {
      // error handled inside fetchSnippetFromGithub
    }
  });

  elements.repoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      elements.repoConfirm.click();
    }
  });

  // Global shortcut triggers (Monkeytype-like Tab key shortcut for restart)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      resetGame();
    }
  });

  elements.restartBtn.addEventListener('click', resetGame);
  elements.resultRestart.addEventListener('click', resetGame);

  // Window resize to align caret perfectly
  window.addEventListener('resize', updateCaret);
}

// --- APP ENTRY POINT ---
function init() {
  loadSettings();
  setupEvents();
  loadLocalSnippet();
}

window.addEventListener('DOMContentLoaded', init);
