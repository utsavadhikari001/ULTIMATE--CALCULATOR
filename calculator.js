const state = {
  input: '0',
  expression: '',
  memory: 0,
  history: [],
  angleMode: 'deg',
  precision: 10,
  notation: 'auto',
  theme: 'dark',
  currentMode: 'basic',
  backendAvailable: false,
  lastAnswer: 0,
  justEvaluated: false,
  wordSize: 32
};

const layouts = {
  basic: [
    ['CE', 'C', '%', '÷', '⌫'],
    ['7', '8', '9', '×', 'sin'],
    ['4', '5', '6', '-', 'cos'],
    ['1', '2', '3', '+', 'tan'],
    ['0', '.', 'π', 'e', '='],
    ['(', ')', '1/x', 'x!', 'Ans']
  ],
  scientific: [
    ['CE', 'C', '%', '÷', '⌫', 'x²'],
    ['7', '8', '9', '×', 'sin', 'x³'],
    ['4', '5', '6', '-', 'cos', '√'],
    ['1', '2', '3', '+', 'tan', '∛'],
    ['0', '.', 'π', 'e', '=', 'log'],
    ['(', ')', '^', '10^', 'ln', 'Ans']
  ],
  programming: [
    ['CE', 'C', '%', '÷', '⌫', 'AND'],
    ['7', '8', '9', '×', 'OR', 'XOR'],
    ['4', '5', '6', '-', 'NOT', 'MOD'],
    ['1', '2', '3', '+', '<<', '>>'],
    ['0', '.', 'BIN', 'HEX', '=', 'DEC']
  ],
  graphing: [
    ['CE', 'C', '%', '÷', '⌫'],
    ['7', '8', '9', '×', 'sin'],
    ['4', '5', '6', '-', 'cos'],
    ['1', '2', '3', '+', 'tan'],
    ['0', '.', 'π', 'e', '='],
    ['PLOT', 'CLEAR', 'x', '^', 'Ans']
  ],
  calculus: [
    ['CE', 'C', '%', '÷', '⌫'],
    ['7', '8', '9', '×', 'sin'],
    ['4', '5', '6', '-', 'cos'],
    ['1', '2', '3', '+', 'tan'],
    ['0', '.', 'π', 'e', '='],
    ['x', '^', '(', ')', 'Ans']
  ]
};

const insertMap = {
  sin: 'sin(',
  cos: 'cos(',
  tan: 'tan(',
  log: 'log(',
  ln: 'ln(',
  '√': 'sqrt(',
  '∛': 'cbrt(',
  '10^': '10^('
};

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  renderButtons(state.currentMode);
  bindUi();
  populateConstants();
  populateUnits();
  initGraph();
  updateDisplay();
  checkBackend();
});

function bindUi() {
  // Main calculator modes
  document.querySelectorAll('.mode-toggle button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.mode-toggle button').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.currentMode = button.dataset.mode;
      renderButtons(state.currentMode);
      if (state.justEvaluated) state.input = formatNumber(state.lastAnswer);
      updateDisplay();
    });
  });

  // Side tabs: Programmer / Constants / Units
  document.querySelectorAll('#sideTabs .tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#sideTabs .tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      document.getElementById('programmerTab').hidden = true;
      document.getElementById('constantsTab').hidden = true;
      document.getElementById('unitsTab').hidden = true;

      const panel = document.getElementById(tab.dataset.tab + 'Tab');
      if (panel) panel.hidden = false;
    });
  });

  document.getElementById('degToggle').addEventListener('click', () => {
    const modes = ['deg', 'rad', 'grad'];
    state.angleMode = modes[(modes.indexOf(state.angleMode) + 1) % 3];
    document.getElementById('degLabel').textContent = state.angleMode.toUpperCase();
    saveSettings();
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    const themes = ['dark', 'light', 'matrix'];
    state.theme = themes[(themes.indexOf(state.theme) + 1) % 3];
    document.getElementById('app').setAttribute('data-theme', state.theme);
    saveSettings();
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(state.input);
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    openSettings();
    document.getElementById('settingsModal').hidden = false;
  });

  document.getElementById('cancelSettings').addEventListener('click', () => {
    document.getElementById('settingsModal').hidden = true;
  });

  document.getElementById('saveSettings').addEventListener('click', persistSettingsFromModal);

  document.getElementById('precisionRange').addEventListener('input', (e) => {
    document.getElementById('precisionValue').textContent = e.target.value + ' digits';
  });

  document.getElementById('mc').addEventListener('click', () => {
    state.memory = 0;
    updateMemory();
  });
  document.getElementById('mr').addEventListener('click', () => append(formatNumber(state.memory)));
  document.getElementById('mplus').addEventListener('click', () => {
    state.memory += currentValueSafe();
    updateMemory();
  });
  document.getElementById('mminus').addEventListener('click', () => {
    state.memory -= currentValueSafe();
    updateMemory();
  });
  document.getElementById('ms').addEventListener('click', () => {
    state.memory = currentValueSafe();
    updateMemory();
  });

  document.getElementById('toFraction').addEventListener('click', showFraction);
  document.getElementById('clearHistory').addEventListener('click', clearHistory);
  document.getElementById('pasteResult').addEventListener('click', () => {
    if (!state.history.length) return;
    state.input = state.history[state.history.length - 1].result;
    state.justEvaluated = true;
    updateDisplay();
  });
  document.getElementById('syncHistory').addEventListener('click', syncHistory);
  document.getElementById('downloadHistory').addEventListener('click', exportHistory);
  document.getElementById('importData').addEventListener('click', importHistory);
  document.getElementById('plotGraph').addEventListener('click', plotFunction);

  document.getElementById('wordSizeLabel').addEventListener('click', () => {
    state.wordSize = state.wordSize === 32 ? 16 : state.wordSize === 16 ? 8 : 32;
    document.getElementById('wordSizeLabel').textContent = 'Word size: ' + state.wordSize + '-bit';
    updateProgrammer();
  });

  document.querySelectorAll('[data-bit]').forEach((btn) => {
    btn.addEventListener('click', () => handle(btn.dataset.bit));
  });

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('graphFunction').value = btn.dataset.preset;
      plotFunction();
    });
  });

  document.getElementById('unitCategory').addEventListener('change', populateUnits);
  document.getElementById('unitFrom').addEventListener('input', convertUnits);
  document.getElementById('unitFromType').addEventListener('change', convertUnits);
  document.getElementById('unitToType').addEventListener('change', convertUnits);

  document.getElementById('differentiate').addEventListener('click', () => calculus('differentiate'));
  document.getElementById('integrate').addEventListener('click', () => calculus('integrate'));
  document.getElementById('solveEq').addEventListener('click', () => calculus('solve'));
  document.getElementById('limitBtn').addEventListener('click', () => calculus('limit'));
  document.getElementById('seriesBtn').addEventListener('click', () => calculus('series'));

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select') return;
    if (/^[0-9]$/.test(e.key)) return append(e.key);
    if (e.key === '.') return append('.');
    if (e.key === '+') return append('+');
    if (e.key === '-') return append('-');
    if (e.key === '*') return append('×');
    if (e.key === '/') {
      e.preventDefault();
      return append('÷');
    }
    if (e.key === 'Enter' || e.key === '=') {
      e.preventDefault();
      return calculate();
    }
    if (e.key === 'Backspace') return backspace();
    if (e.key === 'Escape') return clearAll();
    if (e.key === '(' || e.key === ')') return append(e.key);
  });
}

function renderButtons(mode) {
  const root = document.getElementById('layoutContainer');
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'grid ' + mode;

  layouts[mode].forEach((row) => {
    row.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key';
      btn.textContent = label;

      if (/^\d$/.test(label) || label === '.') btn.classList.add('number');
      else if ('+-×÷^'.includes(label)) btn.classList.add('operator');
      else if (['sin', 'cos', 'tan', 'log', 'ln', '√', '∛'].includes(label)) btn.classList.add('function');
      else if (['C', 'CE', '⌫'].includes(label)) btn.classList.add('clear');
      else if (label === '=') btn.classList.add('equals');
      if (label === '0') btn.classList.add('wide');

      btn.addEventListener('click', () => handle(label));
      grid.appendChild(btn);
    });
  });

  root.appendChild(grid);
}

function handle(value) {
  if (insertMap[value]) return insertFn(insertMap[value]);
  if (value === 'C') return clearAll();
  if (value === 'CE') return clearEntry();
  if (value === '⌫') return backspace();
  if (value === '=') return calculate();
  if (value === '%') return percent();
  if (value === 'π' || value === 'e') return append(value);
  if (value === 'x²') return power(2);
  if (value === 'x³') return power(3);
  if (value === '1/x') return wrap('1/(');
  if (value === 'x!') return wrap('factorial(');
  if (value === 'Ans') return append(formatNumber(state.lastAnswer));
  if (value === 'x') return append('x');
  if (value === 'NOT') return commit(~Math.trunc(currentValueSafe()), 'NOT(' + state.input + ')');
  if (['AND', 'OR', 'XOR', 'MOD', '<<', '>>'].includes(value)) {
    return append(value === 'MOD' ? '%' : ' ' + value + ' ');
  }
  if (value === 'BIN') return showBase(2);
  if (value === 'OCT') return showBase(8);
  if (value === 'DEC') return showBase(10);
  if (value === 'HEX') return showBase(16);
  if (value === 'PLOT') return plotFunction();
  if (value === 'CLEAR') return clearGraph();
  append(value);
}

function insertFn(token) {
  if (state.justEvaluated) {
    state.input = token + state.input + ')';
    state.justEvaluated = false;
    return calculate();
  }
  append(token);
}

function wrap(token) {
  state.input = token + state.input + ')';
  state.justEvaluated = false;
  calculate();
}

function power(n) {
  state.input = '(' + state.input + ')^' + n;
  state.justEvaluated = false;
  calculate();
}

function append(value) {
  if (state.input === 'Error') state.input = '0';
  if (state.justEvaluated) {
    state.input = '+-×÷^%'.includes(value) || String(value).startsWith(' ')
      ? state.input + value
      : value;
    state.justEvaluated = false;
    return updateDisplay();
  }
  state.input = (state.input === '0' && value !== '.' && value !== ')') ? value : state.input + value;
  updateDisplay();
}

function clearAll() {
  state.input = '0';
  state.expression = '';
  state.justEvaluated = false;
  updateDisplay();
}

function clearEntry() {
  state.input = '0';
  state.justEvaluated = false;
  updateDisplay();
}

function backspace() {
  const tokens = ['sin(', 'cos(', 'tan(', 'log(', 'ln(', 'sqrt(', 'cbrt(', 'factorial(', '10^('];
  for (const token of tokens) {
    if (state.input.endsWith(token)) {
      state.input = state.input.slice(0, -token.length) || '0';
      return updateDisplay();
    }
  }
  state.input = state.input.length > 1 ? state.input.slice(0, -1) : '0';
  state.justEvaluated = false;
  updateDisplay();
}

function calculate() {
  try {
    commit(evaluate(state.input), state.input);
  } catch (error) {
    state.input = 'Error';
    state.justEvaluated = false;
    updateDisplay();
  }
}

function percent() {
  try {
    const match = state.input.match(/^(.*)([+\-×÷])([^+\-×÷]+)$/);
    if (match) {
      const left = evaluate(match[1]);
      const right = evaluate(match[3]);
      const op = match[2];
      let value = right / 100;
      if (op === '+') value = left + left * right / 100;
      if (op === '-') value = left - left * right / 100;
      if (op === '×') value = left * right / 100;
      if (op === '÷') value = left / (right / 100);
      return commit(value, state.input + '%');
    }
    commit(evaluate(state.input) / 100, state.input + '%');
  } catch (error) {
    state.input = 'Error';
    updateDisplay();
  }
}

function currentValueSafe() {
  try {
    return evaluate(state.input);
  } catch (e) {
    return 0;
  }
}

function toRad(value) {
  if (state.angleMode === 'deg') return value * Math.PI / 180;
  if (state.angleMode === 'grad') return value * Math.PI / 200;
  return value;
}

function evaluate(input, x) {
  let expression = String(input).trim();
  const combo = expression.match(/^(.+)\s*(AND|OR|XOR)\s*(.+)$/i);
  if (combo) {
    const left = Math.trunc(evaluate(combo[1], x));
    const right = Math.trunc(evaluate(combo[3], x));
    if (combo[2].toUpperCase() === 'AND') return left & right;
    if (combo[2].toUpperCase() === 'OR') return left | right;
    return left ^ right;
  }

  expression = expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, '(' + Math.PI + ')')
    .replace(/\be\b/g, '(' + Math.E + ')')
    .replace(/\^/g, '**');

  if (!/^[0-9+\-*/%().,\s<>&|~^A-Za-z_]+$/.test(expression)) throw new Error('bad');

  const fns = {
    sin: (v) => Math.sin(toRad(v)),
    cos: (v) => Math.cos(toRad(v)),
    tan: (v) => Math.tan(toRad(v)),
    log: Math.log10,
    ln: Math.log,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    factorial: (v) => factorial(v)
  };

  const names = expression.match(/[A-Za-z_]\w*/g) || [];
  const allowed = new Set(Object.keys(fns).concat(x === undefined ? [] : ['x']));
  if (names.some((n) => !allowed.has(n))) throw new Error('bad name');

  const value = Function(...Object.keys(fns), 'x', '"use strict"; return (' + expression + ');')(
    ...Object.values(fns),
    x
  );

  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('nan');
  return value;
}

function factorial(n) {
  if (n < 0 || Math.abs(n - Math.round(n)) > 1e-9 || n > 170) throw new Error('fact');
  n = Math.round(n);
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '0';

  const nearest = Math.round(n);
  if (Math.abs(n - nearest) < 1e-12 && Math.abs(nearest) <= Number.MAX_SAFE_INTEGER) {
    return String(nearest);
  }

  const abs = Math.abs(n);
  const digits = Math.min(12, Math.max(2, Number(state.precision) || 10));

  if (state.currentMode !== 'basic' && state.notation === 'scientific' && (abs >= 1000 || abs < 0.001)) {
    const raw = n.toExponential(Math.max(1, digits - 1));
    const parts = raw.split(/e/i);
    const exp = Number(parts[1]);
    const coef = parts[0].replace(/\.?0+$/, '');
    if (exp === 0) return coef;
    return coef + 'e' + (exp >= 0 ? '+' : '') + exp;
  }

  if (abs >= 1e-12 && abs < 1e15) {
    return n.toFixed(digits).replace(/\.?0+$/, '');
  }

  const raw = n.toExponential(6);
  const parts = raw.split(/e/i);
  if (Number(parts[1]) === 0) return parts[0].replace(/\.?0+$/, '');
  return raw.replace(/\.0+e/, 'e');
}

function commit(value, expression) {
  const result = formatNumber(value);
  state.expression = '';
  state.input = result;
  state.lastAnswer = value;
  state.justEvaluated = true;
  state.history.push({ expression: expression, result: result });
  renderHistory();
  updateDisplay();
  updateProgrammer();

  if (state.backendAvailable) {
    requestJson('/save_history', {
      method: 'POST',
      body: JSON.stringify({ expr: expression, result: result })
    }).catch(() => setBackend(false));
  }
}

function updateDisplay() {
  document.getElementById('resultDisplay').textContent = state.input;
  document.getElementById('exprDisplay').textContent = '';
  document.getElementById('miniHistory').textContent = '';
  document.getElementById('display').classList.toggle('error', state.input === 'Error');
}

function updateMemory() {
  document.getElementById('memLed').classList.toggle('active', state.memory !== 0);
}

function renderHistory() {
  const box = document.getElementById('historyList');
  if (!state.history.length) {
    box.textContent = 'No calculations yet';
    return;
  }
  box.innerHTML = '';
  state.history.slice(-12).reverse().forEach((item) => {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = '<span>' + item.expression + '</span><strong>' + item.result + '</strong>';
    row.addEventListener('click', () => {
      state.input = item.result;
      state.justEvaluated = true;
      updateDisplay();
    });
    box.appendChild(row);
  });
}

function clearHistory() {
  state.history = [];
  renderHistory();
  if (state.backendAvailable) {
    requestJson('/clear_history', { method: 'POST' }).catch(() => setBackend(false));
  }
}

function showFraction() {
  const value = currentValueSafe();
  let bestNum = 1;
  let bestDen = 1;
  let bestErr = Math.abs(value - 1);
  for (let den = 1; den <= 200; den++) {
    const num = Math.round(value * den);
    const err = Math.abs(value - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
    }
  }
  if (bestErr < 1e-8) {
    state.input = bestNum + '/' + bestDen;
    state.justEvaluated = true;
    updateDisplay();
  }
}

function updateProgrammer() {
  let n = 0;
  try {
    n = Math.trunc(currentValueSafe());
  } catch (e) {}
  const range = 2 ** state.wordSize;
  const unsigned = ((n % range) + range) % range;
  document.getElementById('binVal').textContent = unsigned.toString(2);
  document.getElementById('hexVal').textContent = unsigned.toString(16).toUpperCase();
  document.getElementById('octVal').textContent = unsigned.toString(8);
  document.getElementById('decVal').textContent = String(n);
}

function showBase(radix) {
  const value = Math.trunc(currentValueSafe());
  const prefix = { 2: '0b', 8: '0o', 10: '', 16: '0x' }[radix];
  state.input = (value < 0 ? '-' : '') + prefix + Math.abs(value).toString(radix).toUpperCase();
  state.justEvaluated = true;
  updateDisplay();
}

function populateConstants() {
  const values = { π: Math.PI, e: Math.E, c: 299792458, g: 9.80665 };
  const box = document.getElementById('constantsList');
  box.innerHTML = '';
  Object.keys(values).forEach((key) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'small-btn';
    btn.textContent = key;
    btn.addEventListener('click', () => {
      state.input = formatNumber(values[key]);
      state.justEvaluated = true;
      updateDisplay();
    });
    box.appendChild(btn);
  });
}

function populateUnits() {
  const units = {
    length: ['meter', 'kilometer', 'centimeter', 'inch', 'foot'],
    mass: ['kilogram', 'gram', 'pound'],
    time: ['second', 'minute', 'hour'],
    temperature: ['celsius', 'fahrenheit', 'kelvin']
  }[document.getElementById('unitCategory').value];

  const from = document.getElementById('unitFromType');
  const to = document.getElementById('unitToType');
  from.innerHTML = '';
  to.innerHTML = '';
  units.forEach((unit) => {
    from.appendChild(new Option(unit, unit));
    to.appendChild(new Option(unit, unit));
  });
  to.selectedIndex = 1;
  convertUnits();
}

function convertUnits() {
  const category = document.getElementById('unitCategory').value;
  const value = Number(document.getElementById('unitFrom').value) || 0;
  const from = document.getElementById('unitFromType').value;
  const to = document.getElementById('unitToType').value;
  let result = value;

  if (category === 'length') {
    const toM = { meter: 1, kilometer: 1000, centimeter: 0.01, inch: 0.0254, foot: 0.3048 };
    result = value * toM[from] / toM[to];
  } else if (category === 'mass') {
    const toKg = { kilogram: 1, gram: 0.001, pound: 0.45359237 };
    result = value * toKg[from] / toKg[to];
  } else if (category === 'time') {
    const toS = { second: 1, minute: 60, hour: 3600 };
    result = value * toS[from] / toS[to];
  } else {
    let c = value;
    if (from === 'fahrenheit') c = (value - 32) * 5 / 9;
    if (from === 'kelvin') c = value - 273.15;
    if (to === 'fahrenheit') result = c * 9 / 5 + 32;
    else if (to === 'kelvin') result = c + 273.15;
    else result = c;
  }

  document.getElementById('unitTo').value = String(Math.round(result * 1e6) / 1e6);
}

function initGraph() {
  if (!window.Chart) return;
  const ctx = document.getElementById('graphCanvas').getContext('2d');
  window.graph = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'f(x)',
        data: [],
        borderColor: '#6366f1',
        pointRadius: 0,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { type: 'linear' } }
    }
  });
}

function plotFunction() {
  if (!window.graph) return;
  const expr = document.getElementById('graphFunction').value.replace(/^\s*f\(x\)\s*=\s*/i, '');
  const min = Number(document.getElementById('graphMin').value);
  const max = Number(document.getElementById('graphMax').value);
  if (!expr || min >= max) return;

  const data = [];
  for (let i = 0; i <= 100; i++) {
    const x = min + (max - min) * i / 100;
    try {
      data.push({ x: x, y: evaluate(expr, x) });
    } catch (e) {}
  }
  window.graph.data.datasets[0].data = data;
  window.graph.update();
}

function clearGraph() {
  if (!window.graph) return;
  window.graph.data.datasets[0].data = [];
  window.graph.update();
}

async function calculus(kind) {
  const expr = document.getElementById('calcExpression').value.trim() || state.input;
  const out = document.getElementById('calcResult');
  if (!state.backendAvailable) {
    out.textContent = 'Start server.py to use symbolic calculus.';
    return;
  }
  try {
    let url = '';
    if (kind === 'differentiate') {
      url = '/differentiate?expr=' + encodeURIComponent(expr) + '&var=x';
    }
    if (kind === 'integrate') {
      url = '/integrate?expr=' + encodeURIComponent(expr) + '&var=x';
      const lower = document.getElementById('calcLower').value.trim();
      const upper = document.getElementById('calcUpper').value.trim();
      if (lower && upper) {
        url += '&lower=' + encodeURIComponent(lower) + '&upper=' + encodeURIComponent(upper);
      }
    }
    if (kind === 'solve') {
      url = '/solve?eq=' + encodeURIComponent(expr) + '&var=x';
    }
    if (kind === 'limit') {
      url = '/limit?expr=' + encodeURIComponent(expr) + '&var=x&point=' +
        encodeURIComponent(document.getElementById('calcPoint').value || '0');
    }
    if (kind === 'series') {
      url = '/series?expr=' + encodeURIComponent(expr) + '&var=x&point=' +
        encodeURIComponent(document.getElementById('calcPoint').value || '0') + '&order=6';
    }
    const data = await requestJson(url);
    out.textContent = JSON.stringify(data);
  } catch (error) {
    out.textContent = error.message;
  }
}

function openSettings() {
  document.getElementById('precisionRange').value = state.precision;
  document.getElementById('precisionValue').textContent = state.precision + ' digits';
  document.getElementById('angleMode').value = state.angleMode;
  document.getElementById('notationMode').value = state.notation;
}

function persistSettingsFromModal() {
  state.precision = Number(document.getElementById('precisionRange').value);
  state.angleMode = document.getElementById('angleMode').value;
  state.notation = document.getElementById('notationMode').value;
  document.getElementById('degLabel').textContent = state.angleMode.toUpperCase();
  document.getElementById('settingsModal').hidden = true;
  if (state.justEvaluated) state.input = formatNumber(state.lastAnswer);
  updateDisplay();
  saveSettings();
}

function saveSettings() {
  localStorage.setItem('calculatorSettings', JSON.stringify({
    precision: state.precision,
    angleMode: state.angleMode,
    notation: state.notation,
    theme: state.theme
  }));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('calculatorSettings') || '{}');
    state.precision = saved.precision || 10;
    state.angleMode = saved.angleMode || 'deg';
    state.notation = saved.notation || 'auto';
    state.theme = saved.theme || 'dark';
    document.getElementById('app').setAttribute('data-theme', state.theme);
    document.getElementById('degLabel').textContent = state.angleMode.toUpperCase();
  } catch (e) {}
}

function exportHistory() {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state.history, null, 2)], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calculator-history.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importHistory() {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'application/json';
  picker.addEventListener('change', () => {
    const file = picker.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        state.history = Array.isArray(data) ? data : (data.history || []);
        renderHistory();
      } catch (e) {}
    };
    reader.readAsText(file);
  });
  picker.click();
}

async function requestJson(url, options) {
  const opts = options || {};
  opts.headers = opts.headers || {};
  if (opts.body) opts.headers['Content-Type'] = 'application/json';
  const response = await fetch(url, opts);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
}

function setBackend(ok) {
  state.backendAvailable = ok;
  const el = document.getElementById('connectionStatus');
  el.textContent = ok ? 'Backend: Connected' : 'Backend: Disconnected';
  el.classList.toggle('connected', ok);
  el.classList.toggle('disconnected', !ok);
}

async function checkBackend() {
  try {
    await requestJson('/health');
    setBackend(true);
    await syncHistory();
  } catch (e) {
    setBackend(false);
  }
}

async function syncHistory() {
  if (!state.backendAvailable) return;
  const rows = await requestJson('/history');
  state.history = (rows || []).reverse().map((row) => ({
    expression: row.expr,
    result: row.result
  }));
  renderHistory();
}