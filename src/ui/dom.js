// Helpers para construir DOM de forma declarativa sin frameworks.

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === true) node.setAttribute(k, '');
    else if (v === false || v === null || v === undefined) {} // omitir
    else node.setAttribute(k, v);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') {
      node.appendChild(document.createTextNode(String(c)));
    } else {
      node.appendChild(c);
    }
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function inputNumber({ value, onChange, min, max, step, placeholder }) {
  return el('input', {
    type: 'number',
    value: value ?? '',
    onChange: (e) => onChange && onChange(parseFloat(e.target.value) || 0),
    min, max, step, placeholder,
  });
}

export function inputText({ value, onChange, placeholder }) {
  return el('input', {
    type: 'text',
    value: value ?? '',
    onChange: (e) => onChange && onChange(e.target.value),
    placeholder,
  });
}

export function inputSelect({ value, options, onChange }) {
  const sel = el('select', {
    onChange: (e) => onChange && onChange(e.target.value),
  });
  for (const o of options) {
    const opt = el('option', { value: o.value }, [o.label]);
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

export function inputDate({ value, onChange }) {
  return el('input', { type: 'date', value: value ?? '', onChange: (e) => onChange && onChange(e.target.value) });
}

export function inputCheckbox({ checked, onChange, label }) {
  const wrap = el('label', { class: 'checkbox-row' }, [
    el('input', {
      type: 'checkbox',
      onChange: (e) => onChange && onChange(e.target.checked),
    }),
    el('span', {}, [label || '']),
  ]);
  wrap.firstChild.checked = !!checked;
  return wrap;
}

export function inputRadio({ name, value, options, onChange }) {
  const wrap = el('div', { class: 'radio-group' });
  for (const o of options) {
    const id = `${name}-${o.value}`;
    const radio = el('input', {
      type: 'radio',
      name,
      id,
      value: o.value,
      onChange: () => onChange && onChange(o.value),
    });
    if (o.value === value) radio.checked = true;
    const lbl = el('label', { for: id }, [o.label]);
    wrap.appendChild(radio);
    wrap.appendChild(lbl);
  }
  return wrap;
}

export function formRow({ label, help, control }) {
  return el('div', { class: 'form-row' }, [
    el('div', {}, [
      el('label', {}, [label]),
      help ? el('span', { class: 'label-help' }, [help]) : null,
    ]),
    el('div', {}, [control]),
  ]);
}

export function panel({ title, subtitle, children, actions }) {
  const head = el('div', { class: 'panel-head' }, [
    el('h2', { class: 'panel-title' }, [title || '']),
    actions ? el('div', { class: 'panel-actions' }, [actions]) : null,
  ]);
  const sub = subtitle ? el('div', { class: 'panel-subtitle' }, [subtitle]) : null;
  return el('section', { class: 'panel' }, [
    title ? head : null,
    sub,
    el('div', { class: 'panel-body' }, children || []),
  ]);
}

export function kpi({ label, value, sub }) {
  return el('div', { class: 'kpi' }, [
    el('div', { class: 'kpi-label' }, [label || '']),
    el('div', { class: 'kpi-value' }, [value || '—']),
    sub ? el('div', { class: 'kpi-sub' }, [sub]) : null,
  ]);
}

export function alert({ type = 'info', icon = 'ℹ️', text }) {
  const cls = type === 'warn' ? 'alert alert-warn' : type === 'bad' ? 'alert alert-bad' : type === 'good' ? 'alert alert-good' : 'alert';
  return el('div', { class: cls }, [
    el('span', { class: 'alert-icon' }, [icon]),
    el('span', { class: 'alert-text' }, [text || '']),
  ]);
}
