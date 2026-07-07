const STORAGE_KEY = 'papikyan-kp-history-v1';
const DEFAULT_VALID_UNTIL = '10 рабочих дней';
const DEFAULT_PAYMENT_TERMS = '100% предоплата';
const DEFAULT_GUARANTEE_TERMS = '1 год';
const DEFAULT_INTRO = 'Подготовили для вас коммерческое предложение по выбранным позициям. Ниже указаны состав, стоимость и основные условия сотрудничества.';

const seller = {
  name: 'ИП Папикян Торгом Мовсесович',
  ogrnip: '320508100305479',
  inn: '461108842074'
};

const els = {
  form: document.getElementById('offerForm'),
  offerNumber: document.getElementById('offerNumber'),
  offerDate: document.getElementById('offerDate'),
  customer: document.getElementById('customer'),
  customerContact: document.getElementById('customerContact'),
  subject: document.getElementById('subject'),
  intro: document.getElementById('intro'),
  validUntil: document.getElementById('validUntil'),
  paymentTerms: document.getElementById('paymentTerms'),
  guaranteeTerms: document.getElementById('guaranteeTerms'),
  discountType: document.getElementById('discountType'),
  discountValue: document.getElementById('discountValue'),
  notes: document.getElementById('notes'),
  items: document.getElementById('items'),
  addItemBtn: document.getElementById('addItemBtn'),
  saveBtn: document.getElementById('saveBtn'),
  printBtn: document.getElementById('printBtn'),
  mobileSaveBtn: document.getElementById('mobileSaveBtn'),
  mobilePrintBtn: document.getElementById('mobilePrintBtn'),
  newOfferBtn: document.getElementById('newOfferBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  historyList: document.getElementById('historyList'),
  saveStatus: document.getElementById('saveStatus'),
  validationMessage: document.getElementById('validationMessage'),
  docMeta: document.getElementById('docMeta'),
  docCustomer: document.getElementById('docCustomer'),
  docContact: document.getElementById('docContact'),
  docSubject: document.getElementById('docSubject'),
  docIntro: document.getElementById('docIntro'),
  docItems: document.getElementById('docItems'),
  docSubtotalRow: document.getElementById('docSubtotalRow'),
  docSubtotal: document.getElementById('docSubtotal'),
  docDiscountRow: document.getElementById('docDiscountRow'),
  docDiscount: document.getElementById('docDiscount'),
  docTotal: document.getElementById('docTotal'),
  docValidUntil: document.getElementById('docValidUntil'),
  docPaymentTerms: document.getElementById('docPaymentTerms'),
  docGuarantee: document.getElementById('docGuarantee'),
  docNotes: document.getElementById('docNotes')
};

let currentId = null;
let dirty = false;
let validationActive = false;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('ru-RU');
}

function formatMoney(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function makeId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `offer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nextOfferNumber() {
  const count = readHistory().length + 1;
  return `КП-${String(count).padStart(4, '0')}`;
}

function createItem(data = {}) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <label>
      Наименование и описание
      <textarea class="item-name" rows="3" placeholder="Наименование&#10;Описание">${escapeHtml(data.name || '')}</textarea>
    </label>
    <label>
      Кол-во
      <input class="item-qty" type="number" min="0" step="0.01" value="${data.qty ?? 1}">
    </label>
    <label>
      Цена
      <input class="item-price" type="number" min="0" step="0.01" value="${data.price ?? ''}" required>
    </label>
    <button class="remove-item" type="button" title="Удалить позицию" aria-label="Удалить позицию">×</button>
  `;

  row.querySelector('.remove-item').addEventListener('click', () => {
    row.remove();
    markDirty();
    ensureOneItem();
    renderPreview();
  });

  row.querySelectorAll('input, textarea').forEach((input) => {
    input.addEventListener('input', () => {
      markDirty();
      renderPreview();
      if (validationActive) {
        validateOffer(false);
      }
    });
  });

  els.items.appendChild(row);
}

function ensureOneItem() {
  if (!els.items.children.length) {
    createItem();
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function textOrDash(value) {
  return value && value.trim() ? value.trim() : '—';
}

function getItems() {
  return [...els.items.querySelectorAll('.item-row')].map((row) => {
    const raw = row.querySelector('.item-name').value.trim();
    const qtyValue = row.querySelector('.item-qty').value.trim();
    const priceValue = row.querySelector('.item-price').value.trim();
    const [title, ...descriptionLines] = raw.split('\n');
    return {
      name: raw,
      title: title || 'Позиция',
      description: descriptionLines.join('\n').trim(),
      qty: qtyValue === '' ? 0 : Number(qtyValue) || 0,
      price: priceValue === '' ? 0 : Number(priceValue) || 0
    };
  });
}

function getOffer() {
  return {
    id: currentId || makeId(),
    savedAt: new Date().toISOString(),
    seller,
    offerNumber: els.offerNumber.value.trim(),
    offerDate: els.offerDate.value,
    customer: els.customer.value.trim(),
    customerContact: els.customerContact.value.trim(),
    subject: els.subject.value.trim(),
    intro: els.intro.value.trim(),
    validUntil: els.validUntil.value.trim(),
    paymentTerms: els.paymentTerms.value.trim(),
    guaranteeTerms: els.guaranteeTerms.value.trim(),
    discountType: els.discountType.value,
    discountValue: els.discountValue.value.trim(),
    notes: els.notes.value.trim(),
    items: getItems()
  };
}

function loadOffer(offer) {
  currentId = offer.id;
  els.offerNumber.value = offer.offerNumber || nextOfferNumber();
  els.offerDate.value = offer.offerDate || todayIso();
  els.customer.value = offer.customer || '';
  els.customerContact.value = offer.customerContact || '';
  els.subject.value = offer.subject || '';
  els.intro.value = offer.intro || defaultIntro();
  els.validUntil.value = offer.validUntil || DEFAULT_VALID_UNTIL;
  els.paymentTerms.value = offer.paymentTerms || DEFAULT_PAYMENT_TERMS;
  els.guaranteeTerms.value = offer.guaranteeTerms || DEFAULT_GUARANTEE_TERMS;
  els.discountType.value = offer.discountType || 'percent';
  els.discountValue.value = offer.discountValue || '';
  els.notes.value = offer.notes || '';
  els.items.innerHTML = '';
  (offer.items && offer.items.length ? offer.items : [{}]).forEach(createItem);
  dirty = false;
  validationActive = false;
  clearValidation();
  updateSaveStatus();
  renderPreview();
}

function defaultIntro() {
  return DEFAULT_INTRO;
}

function newOffer() {
  currentId = null;
  loadOffer({
    id: null,
    offerNumber: nextOfferNumber(),
    offerDate: todayIso(),
    intro: defaultIntro(),
    validUntil: DEFAULT_VALID_UNTIL,
    paymentTerms: DEFAULT_PAYMENT_TERMS,
    guaranteeTerms: DEFAULT_GUARANTEE_TERMS,
    discountType: 'percent',
    discountValue: '',
    items: [{ qty: 1 }]
  });
}

function saveOffer() {
  if (!validateOffer(true)) {
    return null;
  }
  const offer = getOffer();
  offer.pdfSnapshot = buildPrintableHtml(offer);
  currentId = offer.id;
  const history = readHistory();
  const existingIndex = history.findIndex((entry) => entry.id === offer.id);
  if (existingIndex >= 0) {
    history[existingIndex] = offer;
  } else {
    history.unshift(offer);
  }
  writeHistory(history.slice(0, 100));
  dirty = false;
  validationActive = false;
  clearValidation();
  updateSaveStatus();
  renderHistory();
  return offer;
}

function subtotalOf(offer) {
  return (offer.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
}

function discountValueOf(offer) {
  return Number(offer.discountValue) || 0;
}

function discountAmountOf(offer) {
  const subtotal = subtotalOf(offer);
  const value = discountValueOf(offer);
  if (!subtotal || value <= 0) {
    return 0;
  }
  if (offer.discountType === 'amount') {
    return Math.min(value, subtotal);
  }
  return Math.min((subtotal * value) / 100, subtotal);
}

function totalOf(offer) {
  return Math.max(0, subtotalOf(offer) - discountAmountOf(offer));
}

function formatPercent(value) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value) || 0)}%`;
}

function discountLabel(offer) {
  const discount = discountAmountOf(offer);
  if (discount <= 0) {
    return '';
  }
  if (offer.discountType === 'percent') {
    return `-${formatMoney(discount)} (${formatPercent(discountValueOf(offer))})`;
  }
  return `-${formatMoney(discount)}`;
}

function renderPreview() {
  const offer = getOffer();
  const subtotal = subtotalOf(offer);
  const discount = discountAmountOf(offer);
  const total = totalOf(offer);
  const date = formatDate(offer.offerDate);
  els.docMeta.textContent = `${offer.offerNumber || 'КП'}${date ? ` от ${date}` : ''}`;
  els.docCustomer.textContent = textOrDash(offer.customer);
  els.docContact.textContent = textOrDash(offer.customerContact);
  els.docSubject.textContent = textOrDash(offer.subject);
  els.docIntro.textContent = textOrDash(offer.intro);
  els.docValidUntil.textContent = textOrDash(offer.validUntil);
  els.docPaymentTerms.textContent = textOrDash(offer.paymentTerms);
  els.docGuarantee.textContent = textOrDash(offer.guaranteeTerms);
  els.docNotes.textContent = offer.notes || '';

  const rows = offer.items.map((item, index) => {
    const sum = item.qty * item.price;
    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div class="item-title">${escapeHtml(item.title)}</div>
          ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
        </td>
        <td>${item.qty}</td>
        <td>${formatMoney(item.price)}</td>
        <td>${formatMoney(sum)}</td>
      </tr>
    `;
  }).join('');

  els.docItems.innerHTML = rows;
  els.docSubtotalRow.hidden = discount <= 0;
  els.docDiscountRow.hidden = discount <= 0;
  els.docSubtotal.textContent = formatMoney(subtotal);
  els.docDiscount.textContent = discountLabel(offer);
  els.docTotal.textContent = formatMoney(total);
}

function renderHistory() {
  const history = readHistory();
  if (!history.length) {
    els.historyList.innerHTML = '<p class="empty-state">Сохраненных КП пока нет.</p>';
    return;
  }

  els.historyList.innerHTML = history.map((offer) => `
    <div class="history-entry" data-id="${offer.id}">
      <button class="history-summary" type="button">
        <strong>${escapeHtml(offer.offerNumber || 'КП без номера')}</strong>
        <span>${escapeHtml(offer.customer || 'Без заказчика')}</span>
        <span>${formatDate(offer.offerDate)} · ${formatMoney(totalOf(offer))}</span>
      </button>
      <div class="history-actions">
        <button class="secondary-button history-load" type="button">Открыть</button>
        <button class="primary-button history-pdf" type="button">PDF</button>
      </div>
    </div>
  `).join('');

  els.historyList.querySelectorAll('.history-summary, .history-load').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.history-entry');
      const offer = readHistory().find((entry) => entry.id === card.dataset.id);
      if (offer) loadOffer(offer);
    });
  });

  els.historyList.querySelectorAll('.history-pdf').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('.history-entry');
      const offer = readHistory().find((entry) => entry.id === card.dataset.id);
      if (offer) openSavedPdf(offer);
    });
  });
}

function buildPrintableHtml(offer) {
  const safeOfferNumber = escapeHtml(offer.offerNumber || 'КП');
  const safeCustomer = escapeHtml(textOrDash(offer.customer));
  const safeContact = escapeHtml(textOrDash(offer.customerContact));
  const safeSubject = escapeHtml(textOrDash(offer.subject));
  const safeIntro = escapeHtml(textOrDash(offer.intro));
  const subtotal = subtotalOf(offer);
  const discount = discountAmountOf(offer);
  const discountRows = discount > 0 ? `
    <div class="total-line">
      <span>Сумма без скидки:</span>
      <strong>${formatMoney(subtotal)}</strong>
    </div>
    <div class="total-line discount-line">
      <span>Скидка:</span>
      <strong>${discountLabel(offer)}</strong>
    </div>
  ` : '';
  const rows = (offer.items || []).map((item, index) => {
    const title = escapeHtml(item.title || item.name || 'Позиция');
    const description = item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : '';
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    return `
      <tr>
        <td>${index + 1}</td>
        <td><div class="item-title">${title}</div>${description}</td>
        <td>${qty}</td>
        <td>${formatMoney(price)}</td>
        <td>${formatMoney(qty * price)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <title>${safeOfferNumber} - ${safeCustomer}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #eef3f6; color: #1f2933; font-family: Arial, Helvetica, sans-serif; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 20mm; }
        .doc-header { padding-bottom: 24px; border-bottom: 2px solid #18202a; }
        h1 { margin: 0; font-size: 28px; }
        h2 { margin: 0 0 10px; color: #66717f; font-size: 14px; text-transform: uppercase; }
        p { margin: 0 0 6px; }
        .doc-meta { margin-top: 16px; color: #66717f; }
        .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin: 28px 0; }
        .doc-section { margin: 24px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
        th, td { border: 1px solid #cfd8df; padding: 10px; vertical-align: top; }
        th { background: #edf4f2; color: #29343d; text-align: left; }
        th:nth-child(1), th:nth-child(3), th:nth-child(4), th:nth-child(5),
        td:nth-child(1), td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; white-space: nowrap; }
        .item-title { font-weight: 700; }
        .item-description { margin-top: 4px; color: #596676; white-space: pre-wrap; }
        .totals { display: grid; justify-items: end; gap: 8px; margin-top: 18px; }
        .total-line { display: flex; justify-content: flex-end; align-items: baseline; gap: 14px; width: 100%; font-size: 15px; }
        .total-line span { color: #66717f; }
        .total-line strong { min-width: 140px; text-align: right; }
        .discount-line strong { color: #b65c1f; }
        .grand-total { padding-top: 6px; font-size: 18px; }
        .grand-total strong { font-size: 24px; }
        .conditions { padding-top: 14px; border-top: 1px solid #d9e1e8; }
        .footer { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-top: 56px; }
        .signature-line { width: 210px; border-bottom: 1px solid #1f2933; }
        @media print {
          body { background: white; }
          .page { width: auto; min-height: auto; margin: 0; padding: 0; }
          @page { size: A4; margin: 20mm; }
        }
      </style>
    </head>
    <body>
      <article class="page">
        <header class="doc-header">
          <div>
            <h1>Коммерческое предложение</h1>
            <p class="doc-meta">${safeOfferNumber}${offer.offerDate ? ` от ${formatDate(offer.offerDate)}` : ''}</p>
          </div>
        </header>
        <div class="doc-grid">
          <section>
            <h2>Исполнитель</h2>
            <p><strong>${escapeHtml(seller.name)}</strong></p>
            <p>ОГРНИП: ${escapeHtml(seller.ogrnip)}</p>
            <p>ИНН: ${escapeHtml(seller.inn)}</p>
          </section>
          <section>
            <h2>Заказчик</h2>
            <p><strong>${safeCustomer}</strong></p>
            <p>${safeContact}</p>
          </section>
        </div>
        <section class="doc-section">
          <h2>${safeSubject}</h2>
          <p>${safeIntro}</p>
        </section>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Наименование и описание</th>
              <th>Кол-во</th>
              <th>Цена</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          ${discountRows}
          <div class="total-line grand-total">
            <span>Итого:</span>
            <strong>${formatMoney(totalOf(offer))}</strong>
          </div>
        </div>
        <section class="doc-section conditions">
          <h2>Условия</h2>
          <p><strong>Срок действия:</strong> ${escapeHtml(textOrDash(offer.validUntil))}</p>
          <p><strong>Оплата:</strong> ${escapeHtml(textOrDash(offer.paymentTerms))}</p>
          <p><strong>Гарантия:</strong> ${escapeHtml(textOrDash(offer.guaranteeTerms))}</p>
          <p>${escapeHtml(offer.notes || '')}</p>
        </section>
        <footer class="footer">
          <div>
            <p>С уважением,</p>
            <strong>ИП Папикян Т.М.</strong>
          </div>
          <div class="signature-line"></div>
        </footer>
      </article>
    </body>
    </html>
  `;
}

function openSavedPdf(offer) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Браузер заблокировал новое окно. Разрешите всплывающие окна для этой страницы и нажмите PDF еще раз.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintableHtml(offer));
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

function clearValidation() {
  els.validationMessage.textContent = '';
  document.querySelectorAll('.invalid-field').forEach((field) => {
    field.classList.remove('invalid-field');
    field.setCustomValidity('');
  });
}

function validateOffer(focusInvalid = false) {
  if (focusInvalid) {
    validationActive = true;
  }

  clearValidation();

  const messages = [];
  const invalidFields = [];
  const priceInputs = [...els.items.querySelectorAll('.item-price')];

  priceInputs.forEach((input, index) => {
    const rawPrice = input.value.trim();
    if (rawPrice === '') {
      input.setCustomValidity('Укажите цену');
      input.classList.add('invalid-field');
      invalidFields.push(input);
      messages.push(`Укажите цену в позиции №${index + 1}.`);
    } else if (Number(rawPrice) < 0) {
      input.setCustomValidity('Цена не может быть меньше 0');
      input.classList.add('invalid-field');
      invalidFields.push(input);
      messages.push(`Цена в позиции №${index + 1} не может быть меньше 0.`);
    }
  });

  const rawDiscount = els.discountValue.value.trim();
  if (rawDiscount !== '') {
    const discountValue = Number(rawDiscount);
    const offer = getOffer();
    const subtotal = subtotalOf(offer);

    if (Number.isNaN(discountValue) || discountValue < 0) {
      els.discountValue.setCustomValidity('Проверьте скидку');
      els.discountValue.classList.add('invalid-field');
      invalidFields.push(els.discountValue);
      messages.push('Скидка должна быть числом от 0.');
    } else if (offer.discountType === 'percent' && discountValue > 100) {
      els.discountValue.setCustomValidity('Скидка в процентах не может быть больше 100');
      els.discountValue.classList.add('invalid-field');
      invalidFields.push(els.discountValue);
      messages.push('Скидка в процентах не может быть больше 100%.');
    } else if (offer.discountType === 'amount' && discountValue > subtotal) {
      els.discountValue.setCustomValidity('Скидка не может быть больше суммы КП');
      els.discountValue.classList.add('invalid-field');
      invalidFields.push(els.discountValue);
      messages.push('Скидка в рублях не может быть больше суммы КП.');
    }
  }

  if (invalidFields.length) {
    els.validationMessage.textContent = messages[0];
    els.saveStatus.textContent = 'Проверьте данные';
    els.saveStatus.style.color = 'var(--warn)';
    if (focusInvalid) {
      invalidFields[0].focus();
    }
    return false;
  }

  return true;
}

function markDirty() {
  dirty = true;
  updateSaveStatus();
}

function updateSaveStatus() {
  els.saveStatus.textContent = dirty ? 'Есть изменения' : 'Сохранено';
  els.saveStatus.style.color = dirty ? 'var(--warn)' : 'var(--muted)';
}

function printPdf() {
  const offer = saveOffer();
  if (!offer) {
    return null;
  }
  document.title = `${els.offerNumber.value || 'Коммерческое предложение'} - ${els.customer.value || 'заказчик'}`;
  window.print();
  return offer;
}

els.addItemBtn.addEventListener('click', () => {
  createItem({ qty: 1, price: 0 });
  markDirty();
  renderPreview();
});

els.saveBtn.addEventListener('click', saveOffer);
els.printBtn.addEventListener('click', printPdf);
els.mobileSaveBtn.addEventListener('click', saveOffer);
els.mobilePrintBtn.addEventListener('click', printPdf);
els.newOfferBtn.addEventListener('click', newOffer);

els.clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Очистить всю историю КП?')) {
    writeHistory([]);
    renderHistory();
  }
});

els.form.addEventListener('input', () => {
  markDirty();
  renderPreview();
  if (validationActive) {
    validateOffer(false);
  }
});

renderHistory();
newOffer();
