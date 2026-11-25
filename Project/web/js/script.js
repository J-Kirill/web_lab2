'use strict';

const API_URL = '/fcgi-bin/Lab2-1.0.jar';
 
const MAX_ROWS       = 128;    // столько записей отдаёт сервер в снимке
const POLL_MS        = 5000;   // период опроса, пока вкладка видна
const POLL_HIDDEN_MS = 60000;  // период опроса, пока вкладка скрыта
 
const form     = document.getElementById('point-form');
const yInput   = document.getElementById('y-input');
const rInput   = document.getElementById('r-input');
const errorBox = document.getElementById('error');
const tbody    = document.getElementById('results-body');
const canvas   = document.getElementById('graph');
const ctx      = canvas.getContext('2d');
const xButtons = document.querySelectorAll('.x-btn');
 
let key       = "Lab2-key"
let keyX      = key + "-Stored-X"
let keyY      = key + "-Stored-Y"
let keyR      = key + "-Stored-R"
let selectedX = null;
let records   = [];                         // показанные записи, от старых к новым
let state     = { epoch: null, version: 0 }; // что клиент знает о состоянии сервера

xButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
        selectedX = btn.value;
        xButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        localStorage.setItem(keyX, selectedX)
    });
});

function parseDecimal(str) {
    const clean = str.trim().replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(clean) ? Number(clean) : null;
}
 
function validateX(xStr) {
    if (xStr === null) return { error: 'Выберите X' };
    return { value: Number(xStr) };
}
 
function validateY(yStr) {
    const y = parseDecimal(yStr);
    if (y === null) return { error: 'Y должен быть числом (например, 1.5)' };
    if (!(y > -5 && y < 3)) return { error: 'Y должен быть в диапазоне от -5 до 3' };
    return { value: y };
}
 
function validateR(rStr) {
    const r = parseDecimal(rStr);
    if (r === null) return { error: 'R должен быть числом (например, 1.5)' };
    if (!(r > 1 && r < 4)) return { error: 'R должен быть в диапазоне от 1 до 4' };
    return { value: r };
}

// Возвращает { error } или { x, y, r }
function validate(xStr, yStr, rStr) {
    const x = validateX(xStr), y = validateY(yStr), r = validateR(rStr);
    const bad = [x, y, r].find(v => v.error);
    return bad ? { error: bad.error } : { x: x.value, y: y.value, r: r.value };
}

function currentR() {
    const r = validateR(rInput.value);
    return r.error ? null : r.value;
}
 
function showError(text) {
    errorBox.textContent = text;
}

function formatDate(ts) {
    return new Date(ts).toLocaleString('ru-RU');
}
 
function formatDuration(ns) {
    return (ns / 1e6).toFixed(3) + ' мс';
}

function addRow(rec) {
    const tr = document.createElement('tr');
    const cells = [
        rec.x, rec.y, rec.r,
        rec.hit ? 'Попал' : 'Не попал',
        formatDate(rec.time),
        formatDuration(rec.duration)
    ];
    cells.forEach(function (text, i) {
        const td = document.createElement('td');
        td.textContent = text;
        if (i === 3) td.className = rec.hit ? 'hit' : 'miss';
        tr.appendChild(td);
    });
    tbody.prepend(tr);
}

//Полная замена записей
function renderAll(list) {
    records = list.slice();
    tbody.replaceChildren();
    records.forEach(addRow);
    redraw();
}

//Добавление записи
function addRecord(rec) {
    records.push(rec);
    addRow(rec);
    if (records.length > MAX_ROWS) {
        records.shift();
        tbody.lastElementChild.remove();
    }
    redraw();
}

function getCssColor(className) {
    const el = document.createElement('span');
    el.className = className;
    el.style.display = 'none';
    document.body.appendChild(el);
    const color = getComputedStyle(el).color;
    document.body.removeChild(el);
    return color;
}

function drawPoints(r) {
    if (!r) return;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const R = 150;
    const hitColor  = getCssColor('hit');
    const missColor = getCssColor('miss');
 
    records
        .filter(p => p.r === r)
        .forEach(function (p) {
            const px = cx + p.x / r * R;
            const py = cy - p.y / r * R;
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fillStyle = p.hit ? hitColor : missColor;
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
}

function drawGraph(r) {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const R = 150;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#3399ff';


    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R / 2, Math.PI * (3 / 2), Math.PI * 2);
    ctx.closePath();
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - R / 2, cy);
    ctx.lineTo(cx, cy - R);
    ctx.closePath();
    ctx.fill();


    ctx.fillRect(cx - R, cy, R, R);


    // оси
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(10, cy);  ctx.lineTo(W-10, cy);
    ctx.moveTo(cx, 10);  ctx.lineTo(cx, H-10);
    ctx.stroke();

    // подписи
    ctx.fillStyle = '#000';
    const label = r === null ? 'R' : String(r);
    const half  = r === null ? 'R/2' : String(r / 2);
    ctx.fillText(label,  cx + R - 4, cy - 6);
    ctx.fillText('-' + label, cx - R - 4, cy - 6);
    ctx.fillText(half, cx + 6, cy - R / 2);
    ctx.fillText('-' + label, cx + 6, cy + R);

    drawPoints(r);
}

function redraw() {
    drawGraph(currentR());
}

yInput.addEventListener('input', function(){
    localStorage.setItem(keyY, yInput.value)
});

rInput.addEventListener('input', function(){
    redraw
    localStorage.setItem(keyR, rInput.value)
});
 

function applySnapshot(data) {
    if (data.epoch === state.epoch && data.version <= state.version) return;
    state = { epoch: data.epoch, version: data.version };
    renderAll(data.records);
}
 
async function refreshHistory() {
    // cache: 'no-cache' — браузер сам отправит If-None-Match; при 304 вернёт сохранённое тело
    const response = await fetch(API_URL + '?action=history', { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    applySnapshot(await response.json());
}

let inFlight  = false;
let failures  = 0;
let pollTimer = null;
 
async function pollOnce() {
    if (inFlight) return;               // запросы не накапливаются
    inFlight = true;
    try {
        await refreshHistory();
        failures = 0;
    } catch (err) {
        failures++;
    } finally {
        inFlight = false;
    }
}

function schedule() {
    clearTimeout(pollTimer);
    const base = document.hidden ? POLL_HIDDEN_MS : POLL_MS;
    const delay = base * Math.min(2 ** failures, 8);
    pollTimer = setTimeout(async function () {
        await pollOnce();
        schedule();
    }, delay);
}
 
document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        pollOnce();
        schedule();
    }
});


form.addEventListener('submit', async function (event) {
    event.preventDefault();
 
    const v = validate(selectedX, yInput.value, rInput.value);
    if (v.error) {
        showError(v.error);
        return;
    }
    showError('');
 
    const params = new URLSearchParams({ x: v.x, y: v.y, r: v.r });
    try {
        const response = await fetch(API_URL + '?' + params, { cache: 'no-store' });
        const data = await response.json().catch(() => null);
 
        if (!response.ok) {
            showError(data && data.error ? data.error : 'Ошибка сервера (' + response.status + ')');
            return;
        }
 
        if (data.epoch === state.epoch) {
            if (state.version >= data.version) return;       // запись уже пришла с опросом
            if (state.version === data.base) {               // ровно следующая запись: безопасно добавить
                addRecord(data.record);
                state.version = data.version;
                return;
            }
        }
        await refreshHistory();                              // другая эпоха или пропущены чужие записи
    } catch (err) {
        showError('Сервер недоступен');
    }
});

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem(keyY)) {
        yInput.value = localStorage.getItem(keyY);
    }
    if (localStorage.getItem(keyR)) {
        rInput.value = localStorage.getItem(keyR);
    }
    if (localStorage.getItem(keyX)) {
        selectedX = localStorage.getItem(keyX);
        xButtons.forEach(function(b){
            if (b.value === selectedX) {
                btn.classList.add('selected');
            }
        })
    }
});
 
redraw();
pollOnce();
schedule();