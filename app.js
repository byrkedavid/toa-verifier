const STORAGE_KEY = 'toa-verifier-v1';

const state = loadState();

const els = {
  input: document.querySelector('#positionInput'),
  add: document.querySelector('#addPositionButton'),
  list: document.querySelector('#positionList'),
  empty: document.querySelector('#emptyState'),
  clear: document.querySelector('#clearButton'),
  formMessage: document.querySelector('#formMessage'),
  template: document.querySelector('#positionCardTemplate'),
  positionCount: document.querySelector('#positionCount'),
  preview: document.querySelector('#previewButton'),
  copy: document.querySelector('#copyButton'),
  dialog: document.querySelector('#exportDialog'),
  exportText: document.querySelector('#exportText'),
  dialogCopy: document.querySelector('#dialogCopyButton'),
  download: document.querySelector('#downloadButton'),
  theme: document.querySelector('#themeButton')
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (_) {}

  return [];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizePosition(value) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function formatPositionInput(value) {
  const digits = value.replace(/\D+/g, '').slice(0, 9);

  if (digits.length <= 2) return digits;

  const parts = [digits.slice(0, 2)];

  if (digits.length <= 4) {
    parts.push(digits.slice(2));
    return parts.join('-');
  }

  parts.push(digits.slice(2, 4));

  if (digits.length <= 7) {
    parts.push(digits.slice(4));
    return parts.join('-');
  }

  parts.push(digits.slice(4, 7));

  if (digits.length <= 9) {
    parts.push(digits.slice(7));
    return parts.join('-');
  }

  parts.push(digits.slice(7, 9));
  return parts.join('-');
}

function formatPositionInputValue(value, selectionStart) {
  const digitsBeforeCursor = value
    .slice(0, selectionStart)
    .replace(/\D+/g, '').length;

  const formatted = formatPositionInput(value);

  let cursor = 0;
  let seenDigits = 0;

  while (cursor < formatted.length && seenDigits < digitsBeforeCursor) {
    if (/\d/.test(formatted[cursor])) {
      seenDigits += 1;
    }

    cursor += 1;
  }

  return { formatted, cursor };
}

function positionParts(position) {
  return position
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
}

function comparePositions(a, b) {
  const aa = positionParts(a.position);
  const bb = positionParts(b.position);
  const length = Math.max(aa.length, bb.length);

  for (let i = 0; i < length; i += 1) {
    const av = aa[i] ?? -1;
    const bv = bb[i] ?? -1;

    if (av !== bv) {
      return av - bv;
    }
  }

  return a.position.localeCompare(b.position, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function addPosition() {
  const position = normalizePosition(
    formatPositionInput(els.input.value)
  );

  els.input.value = position;
  els.formMessage.textContent = '';

  if (!position) {
    els.formMessage.textContent = 'Enter a position code first.';
    els.input.focus();
    return;
  }

  if (!/^\d{2}-\d{2}-\d{3}-\d{2}$/.test(position)) {
    els.formMessage.textContent =
      'Use a full position code in the form xx-xx-xxx-xx.';

    els.input.focus();
    return;
  }

  if (state.some(item => item.position === position)) {
    els.formMessage.textContent =
      'That position is already on the list.';

    els.input.select();
    return;
  }

  state.push({
    position,
    fiber: 0,
    orange: 0,
    green: 0
  });

  state.sort(comparePositions);
  saveState();
  render();

  els.input.value = '';
  els.input.focus();

  pulseMessage(`Added ${position}.`, false);
}

function pulseMessage(message, isError = false) {
  els.formMessage.style.color = isError
    ? 'var(--danger)'
    : 'var(--green)';

  els.formMessage.textContent = message;

  window.clearTimeout(pulseMessage.timer);

  pulseMessage.timer = window.setTimeout(() => {
    els.formMessage.textContent = '';
    els.formMessage.style.color = '';
  }, 1500);
}

function setCount(position, type, value) {
  const item = state.find(
    entry => entry.position === position
  );

  if (!item) return;

  const parsed = Number.parseInt(value, 10);

  item[type] = Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : 0;

  saveState();
}

function updateCount(position, type, delta, input) {
  const item = state.find(
    entry => entry.position === position
  );

  if (!item) return;

  item[type] = Math.max(0, item[type] + delta);
  input.value = item[type];

  saveState();
}

function deletePosition(position) {
  const index = state.findIndex(
    entry => entry.position === position
  );

  if (index === -1) return;

  state.splice(index, 1);

  saveState();
  render();
}

function render() {
  state.sort(comparePositions);

  els.list.replaceChildren();
  els.empty.hidden = state.length > 0;

  state.forEach(item => {
    const node = els.template.content.cloneNode(true);
    const card = node.querySelector('.position-card');

    node.querySelector('.position-code').textContent =
      item.position;

    node
      .querySelector('.delete-position')
      .addEventListener('click', () => {
        deletePosition(item.position);
      });

    card.querySelectorAll('.compact-counter').forEach(counter => {
      const type = counter.dataset.type;
      const input = counter.querySelector('.count-input');

      input.value = item[type];

      input.addEventListener('input', () => {
        setCount(item.position, type, input.value);
      });

      input.addEventListener('blur', () => {
        const current = state.find(
          entry => entry.position === item.position
        );

        input.value = current ? current[type] : 0;
      });

      counter
        .querySelector('.minus')
        .addEventListener('click', () => {
          updateCount(
            item.position,
            type,
            -1,
            input
          );
        });

      counter
        .querySelector('.plus')
        .addEventListener('click', () => {
          updateCount(
            item.position,
            type,
            1,
            input
          );
        });
    });

    els.list.appendChild(node);
  });

  els.positionCount.textContent =
    `${state.length} position${state.length === 1 ? '' : 's'}`;
}

function buildExportText() {
  if (!state.length) {
    return 'No positions added.';
  }

  return [...state]
    .sort(comparePositions)
    .map(item =>
      `${item.position} — Fiber: ${item.fiber} | Orange copper: ${item.orange} | Green copper: ${item.green}`
    )
    .join('\n');
}

async function copyExportText(button) {
  const text = buildExportText();

  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    els.exportText.value = text;
    els.exportText.focus();
    els.exportText.select();

    document.execCommand('copy');
  }

  const original = button.textContent;

  button.textContent = 'Copied';

  setTimeout(() => {
    button.textContent = original;
  }, 1200);
}

function showPreview() {
  els.exportText.value = buildExportText();

  if (typeof els.dialog.showModal === 'function') {
    els.dialog.showModal();
  } else {
    alert(els.exportText.value);
  }
}

function downloadText() {
  const blob = new Blob(
    [buildExportText()],
    { type: 'text/plain;charset=utf-8' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `toa-receiving-${date}.txt`;

  link.click();

  URL.revokeObjectURL(url);
}

function applyTheme(theme) {
  const darkModeEnabled = theme === 'dark';

  document.body.classList.toggle(
    'dark-mode',
    darkModeEnabled
  );

  els.theme.textContent = darkModeEnabled
    ? '☀'
    : '◐';

  els.theme.setAttribute(
    'aria-label',
    darkModeEnabled
      ? 'Switch to light mode'
      : 'Switch to dark mode'
  );

  const themeColor = document.querySelector(
    'meta[name="theme-color"]'
  );

  if (themeColor) {
    themeColor.setAttribute(
      'content',
      darkModeEnabled
        ? '#111820'
        : '#131A22'
    );
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('toa-theme');

  if (savedTheme === 'dark' || savedTheme === 'light') {
    applyTheme(savedTheme);
    return;
  }

  const prefersDark = window
    .matchMedia('(prefers-color-scheme: dark)')
    .matches;

  applyTheme(
    prefersDark ? 'dark' : 'light'
  );
}

els.add.addEventListener('click', addPosition);

els.input.addEventListener('input', event => {
  const input = event.target;
  const position = input.value;

  const { formatted, cursor } =
    formatPositionInputValue(
      position,
      input.selectionStart || position.length
    );

  input.value = formatted;
  input.setSelectionRange(cursor, cursor);
});

els.input.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    addPosition();
  }
});

els.clear.addEventListener('click', () => {
  if (!state.length) return;

  if (confirm('Clear every position and quantity?')) {
    state.splice(0, state.length);

    saveState();
    render();
  }
});

els.preview.addEventListener('click', showPreview);

els.copy.addEventListener('click', () => {
  copyExportText(els.copy);
});

els.dialogCopy.addEventListener('click', () => {
  copyExportText(els.dialogCopy);
});

els.download.addEventListener('click', downloadText);

els.theme.addEventListener('click', () => {
  const nextTheme =
    document.body.classList.contains('dark-mode')
      ? 'light'
      : 'dark';

  localStorage.setItem('toa-theme', nextTheme);
  applyTheme(nextTheme);
});

initializeTheme();
render();

if (
  'serviceWorker' in navigator &&
  location.protocol.startsWith('http')
) {
  navigator.serviceWorker
    .register('./service-worker.js')
    .catch(() => {});
}