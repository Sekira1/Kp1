const $ = (id) => document.getElementById(id);
const fields = ["kpNumber","kpDate","clientName","clientPhone","objectAddress","manager","paymentTerms","deliveryTime"];
let items = JSON.parse(localStorage.getItem("kp_items_roll") || "[]");
let history = JSON.parse(localStorage.getItem("kp_history_roll") || "[]");

function todayISO(){ return new Date().toISOString().slice(0,10); }
function money(n){ return (Number(n)||0).toLocaleString("ru-RU") + " ₽"; }
function parseMoney(v){ return Number(String(v||'').replace(/[^0-9,.-]/g,'').replace(',','.')) || 0; }
function formatDate(iso){ if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}.${m}.${y}`; }
function parseDateRu(text){
  const t = String(text||'').trim();
  const m = t.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if(!m) return $('kpDate').value || todayISO();
  let y = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
}
function totalItem(it){ return (Number(it.price)||0)*(Number(it.qty)||1); }
function totalAll(list = items){ return list.reduce((s,it)=>s+totalItem(it),0); }
function getData(){ const data = {}; fields.forEach(f => data[f] = $(f).value); return data; }
function setData(data){ fields.forEach(f => { $(f).value = data?.[f] || ""; }); }
function nextKpNumber(){
  const n = history.length + 1;
  return "КП-" + String(n).padStart(3,"0");
}
function save(){
  localStorage.setItem("kp_data_roll", JSON.stringify(getData()));
  localStorage.setItem("kp_items_roll", JSON.stringify(items));
  localStorage.setItem("kp_history_roll", JSON.stringify(history));
}
function load(){
  const data = JSON.parse(localStorage.getItem("kp_data_roll") || "{}");
  setData(data);
  if(!$('kpDate').value) $('kpDate').value = todayISO();
  if(!$('kpNumber').value) $('kpNumber').value = nextKpNumber();
  if(!$('manager').value) $('manager').value = "Папикян Мовсес";
  if(!$('paymentTerms').value) $('paymentTerms').value = "50% предоплата / 50% по готовности";
  if(!$('deliveryTime').value) $('deliveryTime').value = "от 3 до 10 рабочих дней";
}
function bindDoc(){
  const data = getData();
  document.querySelectorAll("[data-bind]").forEach(el => {
    if(document.activeElement === el) return;
    const k = el.dataset.bind;
    el.textContent = k === "kpDateText" ? formatDate(data.kpDate) : (data[k] || "—");
  });
}
function itemDescription(it){
  if(it.descriptionEdited) return it.description || "";
  const parts=[];
  if(it.model) parts.push(`модель/профиль: ${it.model}`);
  if(it.controlType) parts.push(`тип управления: ${it.controlType}`);
  if(it.width || it.height) parts.push(`размер: ${it.width||"—"} × ${it.height||"—"} мм`);
  if(it.color) parts.push(`цвет: ${it.color}`);
  if(it.note) parts.push(it.note);
  return parts.join("; ");
}
function renderItems(){
  const list = $('itemsList');
  if(!list) return;
  list.innerHTML = "";
  if(items.length === 0) list.innerHTML = '<p class="hint">Пока нет добавленных услуг.</p>';
}
function renderDocRows(){
  const rows = $('kpRows');
  rows.innerHTML = "";
  if(items.length === 0){
    rows.innerHTML = '<tr class="empty"><td colspan="7">Добавьте услуги через форму выше</td></tr>';
  }
  items.forEach((it, idx)=>{
    const sum = totalItem(it);
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td contenteditable="true" data-row="${idx}" data-field="serviceName"><b>${it.serviceName || ''}</b></td>
      <td contenteditable="true" data-row="${idx}" data-field="description">${itemDescription(it)}</td>
      <td contenteditable="true" data-row="${idx}" data-field="qty">${it.qty || 1}</td>
      <td contenteditable="true" data-row="${idx}" data-field="price">${money(it.price)}</td>
      <td>${money(sum)}</td>
      <td class="no-print edit-col"><button class="delete-row" data-del-row="${idx}">Удалить</button></td>`;
    rows.appendChild(tr);
  });
  $('totalSum').textContent = money(totalAll());
  attachRowEditEvents();
}
function attachRowEditEvents(){
  document.querySelectorAll('[data-row][data-field]').forEach(cell => {
    cell.addEventListener('blur', () => {
      const idx = Number(cell.dataset.row);
      const field = cell.dataset.field;
      if(!items[idx]) return;
      const value = cell.innerText.trim();
      if(field === 'qty') items[idx].qty = Math.max(1, parseMoney(value));
      else if(field === 'price') items[idx].price = parseMoney(value);
      else if(field === 'description') { items[idx].description = value; items[idx].descriptionEdited = true; }
      else items[idx][field] = value;
      save(); renderDocRows(); renderHistory();
    });
  });
  document.querySelectorAll('[data-del-row]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.delRow);
      if(!confirm('Удалить эту позицию из КП?')) return;
      items.splice(idx,1); save(); render();
    };
  });
}
function renderHistory(){
  const box = $('historyList');
  box.innerHTML = "";
  if(history.length === 0){
    box.innerHTML = '<p class="hint">Сохранённых КП пока нет.</p>';
    return;
  }
  [...history].reverse().forEach((kp) => {
    const div = document.createElement('div');
    div.className = 'history-card';
    div.innerHTML = `
      <strong>${kp.data.kpNumber || 'КП'} — ${kp.data.clientName || 'Без клиента'}</strong>
      <div class="meta">Дата: ${formatDate(kp.data.kpDate)} · Сумма: ${money(kp.total)} · Позиций: ${kp.items.length}</div>
      <div class="history-actions">
        <button class="open" data-open="${kp.id}">Открыть</button>
        <button class="pdf" data-pdf="${kp.id}">PDF</button>
        <button class="delete" data-hdel="${kp.id}">Удалить</button>
      </div>`;
    box.appendChild(div);
  });
  box.querySelectorAll('[data-open]').forEach(btn => btn.onclick = () => openHistory(btn.dataset.open, false));
  box.querySelectorAll('[data-pdf]').forEach(btn => btn.onclick = () => openHistory(btn.dataset.pdf, true));
  box.querySelectorAll('[data-hdel]').forEach(btn => btn.onclick = () => deleteHistory(btn.dataset.hdel));
}
function render(){
  bindDoc();
  renderItems();
  renderDocRows();
  renderHistory();
}
function saveKpToHistory(){
  if(items.length === 0){ alert('Сначала добавьте хотя бы одну позицию в КП.'); return; }
  const data = getData();
  const existingIndex = history.findIndex(kp => kp.data.kpNumber === data.kpNumber);
  const record = {
    id: existingIndex >= 0 ? history[existingIndex].id : String(Date.now()),
    createdAt: new Date().toISOString(),
    data,
    items: JSON.parse(JSON.stringify(items)),
    total: totalAll()
  };
  if(existingIndex >= 0) history[existingIndex] = record;
  else history.push(record);
  save(); renderHistory();
  alert('КП сохранено в историю.');
}
function openHistory(id, printAfter){
  const kp = history.find(x => x.id === id);
  if(!kp) return;
  setData(kp.data);
  items = JSON.parse(JSON.stringify(kp.items));
  save(); render();
  document.getElementById('kpDocument').scrollIntoView({behavior:'smooth'});
  if(printAfter) setTimeout(() => window.print(), 350);
}
function deleteHistory(id){
  if(!confirm('Удалить это КП из истории?')) return;
  history = history.filter(x => x.id !== id);
  save(); renderHistory();
}
function newKp(){
  if(items.length && !confirm('Начать новое КП? Текущие позиции очистятся.')) return;
  items = [];
  setData({
    kpNumber: nextKpNumber(),
    kpDate: todayISO(),
    clientName: '', clientPhone: '', objectAddress: '',
    manager: 'Папикян Мовсес',
    paymentTerms: '50% предоплата / 50% по готовности',
    deliveryTime: 'от 3 до 10 рабочих дней'
  });
  clearServiceFields();
  save(); render();
}
function updateControlTypeVisibility(){
  const service = $('serviceName').value.toLowerCase();
  const box = $('controlType').closest('label');
  if(service.includes('управлен') || service.includes('автомат')) box.classList.add('highlight-label');
  else box.classList.remove('highlight-label');
}
function clearServiceFields(){ ["model","controlType","width","height","color","qty","price","note"].forEach(id => $(id).value = id==='qty' ? 1 : ""); }
function attachDocFieldEditors(){
  document.querySelectorAll('[data-edit-field]').forEach(el => {
    el.addEventListener('blur', () => {
      const field = el.dataset.editField;
      let value = el.innerText.trim();
      if(field === 'kpDate') value = parseDateRu(value);
      if($(field)) $(field).value = value;
      save(); bindDoc(); renderHistory();
    });
  });
}

$('addItem').onclick = () => {
  const it = {
    serviceName: $('serviceName').value,
    model: $('model').value.trim(),
    controlType: $('controlType').value,
    width: $('width').value,
    height: $('height').value,
    color: $('color').value.trim(),
    qty: Number($('qty').value)||1,
    price: Number($('price').value)||0,
    note: $('note').value.trim()
  };
  if(!it.serviceName || it.price <= 0){ alert('Укажите услугу и цену.'); return; }
  items.push(it); save(); clearServiceFields(); render();
  document.getElementById('kpDocument').scrollIntoView({behavior:'smooth'});
};
$('clearItem').onclick = clearServiceFields;
$('clearAll').onclick = () => { if(confirm('Очистить все позиции КП?')){ items=[]; save(); render(); } };
$('btnSaveKp').onclick = saveKpToHistory;
$('btnPrint').onclick = () => { saveKpToHistory(); render(); setTimeout(() => window.print(), 150); };
$('btnPrintTop').onclick = () => { save(); render(); window.print(); };
$('newKp').onclick = newKp;
$('clearHistory').onclick = () => { if(confirm('Удалить всю историю КП?')){ history=[]; save(); renderHistory(); } };
fields.forEach(f => $(f).addEventListener('input', () => { save(); render(); }));
$('serviceName').addEventListener('change', updateControlTypeVisibility);

load(); updateControlTypeVisibility(); attachDocFieldEditors(); render();
