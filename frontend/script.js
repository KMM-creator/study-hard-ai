// ============================================================
// 1. TABS
// ============================================================
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ============================================================
// 1.5. DROPDOWN MENU (⋮)
// ============================================================
const menuBtn  = document.getElementById('menu-btn');
const dropdown = document.getElementById('dropdown');

if (menuBtn && dropdown) {
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== menuBtn) {
            dropdown.classList.remove('open');
        }
    });

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const screen = item.dataset.screen;
            dropdown.classList.remove('open');

            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

            if (screen === 'goals') {
                document.getElementById('goals').classList.add('active');
            } else if (screen === 'stats') {
                document.getElementById('stats').classList.add('active');
                loadStats();
            } else if (screen === 'notifications') {
                document.getElementById('notifications').classList.add('active');
                loadNotifications();
            } else if (screen === 'timer') {
                document.getElementById('timer').classList.add('active');
            } else if (screen === 'ai') {
                document.getElementById('ai').classList.add('active');
            }
        });
    });
}

// ============================================================
// 2. CLOCK
// ============================================================
async function tick() {
    try {
        const r = await fetch('/api/time');
        const data = await r.json();
        document.getElementById('big-time').textContent = data.time;
        document.getElementById('big-date').textContent =
            data.weekday + ', ' + data.date;
    } catch (e) {
        console.error('Clock error:', e);
    }
}
tick();
setInterval(tick, 1000);

// ============================================================
// 3. CALENDAR (Часть 1)
// ============================================================
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['MON','TUE','WED','THU','FRI','SAT','SUN'];

let currentDate = new Date();
let selectedDate = null;

const grid       = document.getElementById('calendar-grid');
const monthTitle = document.getElementById('month-title');
const sideTitle  = document.getElementById('selected-date-title');
const eventsList = document.getElementById('events-list');
const eventForm  = document.getElementById('event-form');

function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
}

async function renderCalendar() {
    grid.innerHTML = '';
    monthTitle.textContent =
        MONTHS[currentDate.getMonth()] + ' ' + currentDate.getFullYear();

    DAYS.forEach(d => {
        const el = document.createElement('div');
        el.className = 'day-name';
        el.textContent = d;
        grid.appendChild(el);
    });

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);

    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const monthStr = year + '-' + String(month + 1).padStart(2, '0');

    let monthEvents = [];
    let monthGoals = [];
    try {
        const r1 = await fetch('/api/events');
        const d1 = await r1.json();
        monthEvents = d1.events.filter(e => e.date.startsWith(monthStr));

        const r2 = await fetch('/api/goals');
        const d2 = await r2.json();
        monthGoals = d2.goals.filter(g => g.deadline.startsWith(monthStr));
    } catch (e) { console.error(e); }

    const todayISO = toISO(new Date());

    for (let i = 0; i < startOffset; i++) {
        const prev = new Date(year, month, -startOffset + i + 1);
        const el = document.createElement('div');
        el.className = 'day other-month';
        el.textContent = prev.getDate();
        grid.appendChild(el);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const dateObj = new Date(year, month, d);
        const iso = toISO(dateObj);
        const el = document.createElement('div');
        el.className = 'day';
        el.textContent = d;
        el.dataset.date = iso;

        if (iso === todayISO) el.classList.add('today');
        if (iso === selectedDate) el.classList.add('selected');

        const hasEvent = monthEvents.some(e => e.date === iso);
        const hasGoal  = monthGoals.some(g => g.deadline === iso);

        if (hasEvent) {
            const dot = document.createElement('span');
            dot.className = 'dot';
            el.appendChild(dot);
        }
        if (hasGoal) {
            el.classList.add('has-goal');
            const flag = document.createElement('span');
            flag.className = 'goal-flag';
            flag.textContent = '\uD83D\uDEA9';
            el.appendChild(flag);
        }

        el.addEventListener('click', () => selectDay(iso, dateObj));
        grid.appendChild(el);
    }
}

function selectDay(iso, dateObj) {
    selectedDate = iso;
    sideTitle.textContent = dateObj.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
    });
    document.querySelectorAll('.day').forEach(el => {
        el.classList.toggle('selected', el.dataset.date === iso);
    });
    loadEvents();
}

async function loadEvents() {
    eventsList.innerHTML = '';
    if (!selectedDate) return;
    try {
        const r = await fetch('/api/events?date=' + selectedDate);
        const data = await r.json();
        if (data.events.length === 0) {
            eventsList.innerHTML =
                '<li class="empty-hint">Nothing yet. Add an event above</li>';
            return;
        }
        data.events.forEach(ev => {
            const li = document.createElement('li');
            li.className = ev.type;
            li.innerHTML =
                '<div>' +
                    '<div>' + ev.title + '</div>' +
                    '<div class="ev-time">' + ev.time + '</div>' +
                '</div>' +
                '<button class="ev-del" data-id="' + ev.id + '">&times;</button>';
            li.querySelector('.ev-del').addEventListener('click', () => delEvent(ev.id));
            eventsList.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedDate) {
        alert('Pick a day in the calendar first!');
        return;
    }
    const title = document.getElementById('event-title').value.trim();
    const time  = document.getElementById('event-time').value;
    const type  = document.getElementById('event-type').value;
    if (!title || !time) return;
    try {
        await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title, date: selectedDate, time: time, type: type })
        });
        eventForm.reset();
        await loadEvents();
        await renderCalendar();
        loadTodayPlans();
    } catch (e) { console.error(e); }
});

async function delEvent(id) {
    try {
        await fetch('/api/events/' + id, { method: 'DELETE' });
        await loadEvents();
        await renderCalendar();
    } catch (e) { console.error(e); }
}

document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

renderCalendar();

// ============================================================
// 4. GRADES (Обновленная логика с СОР/СОЧ)
// ============================================================
const subjectsList  = document.getElementById('subjects-list');
const subjectForm   = document.getElementById('subject-form');
const overallGpaEl  = document.getElementById('overall-gpa');
const subjectsCount = document.getElementById('subjects-count');
const clearAllBtn   = document.getElementById('clear-all-btn');

async function loadSubjects() {
    try {
        const r = await fetch('/api/subjects');
        const data = await r.json();
        renderSubjects(data);
    } catch (e) {
        console.error('Subjects error:', e);
    }
}

function renderSubjects(data) {
    const subjects = data.subjects || [];
    subjectsList.innerHTML = '';

    if (subjects.length === 0) {
        subjectsList.innerHTML =
            '<div class="empty-hint-block">No subjects yet. Add your first one above</div>';
        overallGpaEl.textContent = '\u2014';
        subjectsCount.textContent = 'No subjects yet';
        return;
    }

    subjects.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'subject-card';

        let gradesHtml = '';
(sub.grades || []).forEach((g, i) => {
    let score = typeof g === 'object' ? g.score : g;
    let max_score = typeof g === 'object' ? g.max_score : 10;
    let gtype = typeof g === 'object' ? g.type : 'formative';
    
    let percent = max_score > 0 ? (score / max_score) * 100 : 0;
    
    // Определяем цвет
    let colorClass = 'grade-badge';
    if (percent >= 85) colorClass += ' grade-10';
    else if (percent >= 70) colorClass += ' grade-7';
    else if (percent >= 50) colorClass += ' grade-4';
    else colorClass += ' grade-1';

    // Вот главное изменение: как отображать!
    let displayText = '';
    if (gtype === 'formative') {
        displayText = score; // Форматив — просто цифра
    } else {
        displayText = score + '/' + max_score; // СОР/СОЧ — дробь
    }

    gradesHtml += `<span class="${colorClass}" data-idx="${i}" 
        title="${gtype}: ${score}/${max_score} (Click to delete)">
        ${displayText}
        </span>`;
});
        card.innerHTML =
            '<div class="subject-header">' +
                '<div>' +
                    '<span class="subject-name">' + sub.name + '</span>' +
                    '<span class="subject-avg">avg ' + (sub.percent || '\u2014') + '% &middot; Grade ' + (sub.grade10 || '\u2014') + ' &middot; GPA ' + (sub.gpa || '\u2014') + '</span>' +
                '</div>' +
                '<button class="subject-del" title="Delete subject">&times;</button>' +
            '</div>' +
            '<div class="grades-row">' +
                (gradesHtml || '<span class="empty-hint">no grades yet</span>') +
            '</div>' +
            
            // Новое поле для добавления оценки
            '<div class="add-grade-form">' +
                '<select class="grade-type-select">' +
                    '<option value="formative">Форматив</option>' +
                    '<option value="sor">СОР</option>' +
                    '<option value="soch">СОЧ</option>' +
                '</select>' +
                '<input type="number" class="grade-score" placeholder="Балл" min="0" step="0.1">' +
                '<input type="number" class="grade-max" placeholder="Из" value="10" min="1">' +
                '<button class="add-grade-btn">+ Add</button>' +
            '</div>';

        // Удаление предмета
        card.querySelector('.subject-del').addEventListener('click', () =>
            deleteSubject(sub.id)
        );

        // Удаление оценки (по клику на бейдж)
        card.querySelectorAll('.grade-badge').forEach(badge => {
            badge.addEventListener('click', () => {
                const idx = parseInt(badge.dataset.idx);
                deleteGrade(sub.id, idx);
            });
        });

        // Добавление оценки
        const addBtn = card.querySelector('.add-grade-btn');
        addBtn.addEventListener('click', () => {
            const type = card.querySelector('.grade-type-select').value;
            const scoreInput = card.querySelector('.grade-score');
            const maxInput = card.querySelector('.grade-max');
            
            const score = parseFloat(scoreInput.value);
            const max_score = parseFloat(maxInput.value);

            if (isNaN(score) || isNaN(max_score) || score < 0 || max_score <= 0 || score > max_score) {
                alert('Please enter valid score (0 <= score <= max)');
                return;
            }

            addGrade(sub.id, score, max_score, type);
            scoreInput.value = ''; // очищаем поле после добавления
        });

        subjectsList.appendChild(card);
    });

    overallGpaEl.textContent =
        (data.overall_gpa !== null && data.overall_gpa !== undefined)
            ? data.overall_gpa.toFixed(2) : '\u2014';

    subjectsCount.textContent = data.total_subjects + ' subjects';
}

// Добавление нового предмета
subjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('subject-name').value.trim();
    if (!name) return;
    try {
        await fetch('/api/subjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        subjectForm.reset();
        loadSubjects();
    } catch (e) { console.error(e); }
});

// Очистить все
clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Delete ALL subjects and ALL grades? This cannot be undone.')) return;
    try {
        await fetch('/api/subjects', { method: 'DELETE' });
        loadSubjects();
    } catch (e) { console.error(e); }
});

// Удаление предмета
async function deleteSubject(id) {
    if (!confirm('Delete this subject with all its grades?')) return;
    try {
        await fetch('/api/subjects/' + id, { method: 'DELETE' });
        loadSubjects();
    } catch (e) { console.error(e); }
}

// Добавление оценки (новая логика с отправкой JSON)
async function addGrade(subjectId, score, max_score, type) {
    try {
        await fetch('/api/subjects/' + subjectId + '/grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score: score, max_score: max_score, type: type })
        });
        loadSubjects();
    } catch (e) { console.error(e); }
}

// Удаление оценки
async function deleteGrade(subjectId, index) {
    try {
        await fetch('/api/subjects/' + subjectId + '/grades/' + index, {
            method: 'DELETE'
        });
        loadSubjects();
    } catch (e) { console.error(e); }
}

loadSubjects();

// ============================================================
// 5. GOALS
// ============================================================
const goalsList  = document.getElementById('goals-list');
const goalForm   = document.getElementById('goal-form');

async function loadGoals() {
    try {
        const r = await fetch('/api/goals');
        const data = await r.json();
        renderGoals(data.goals || []);
    } catch (e) { console.error('Goals error:', e); }
}

function renderGoals(goals) {
    goalsList.innerHTML = '';

    if (goals.length === 0) {
        goalsList.innerHTML =
            '<div class="empty-hint-block">No goals yet. Add your first one above</div>';
        return;
    }

    const todayIso = toISO(new Date());

    goals.forEach(g => {
        const card = document.createElement('div');
        card.className = 'goal-card';
        const done = g.current >= g.target;
        if (done) card.classList.add('is-done');

        const percent = g.target > 0
            ? Math.min(100, Math.round((g.current / g.target) * 100))
            : 0;

        const isPast = g.deadline < todayIso && !done;

        card.innerHTML =
            '<div class="goal-header">' +
                '<div>' +
                    '<div class="goal-title">' + g.title + '</div>' +
                    '<div class="goal-deadline' + (isPast ? ' is-past' : '') + '">' +
                        'deadline: ' + g.deadline +
                    '</div>' +
                '</div>' +
                '<button class="goal-del" title="Delete goal">&times;</button>' +
            '</div>' +
            '<div class="goal-progress-row">' +
                '<div class="goal-bar"><div class="goal-bar__fill" style="width:' + percent + '%"></div></div>' +
                '<div class="goal-count">' + g.current + ' / ' + g.target + '</div>' +
            '</div>' +
            '<div class="goal-actions">' +
                '<button class="goal-btn" data-delta="-1" title="-1">&minus;</button>' +
                '<button class="goal-btn" data-delta="1" title="+1">+</button>' +
            '</div>';

        card.querySelector('.goal-del').addEventListener('click', () =>
            deleteGoal(g.id)
        );
        card.querySelectorAll('.goal-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const delta = parseInt(btn.dataset.delta);
                updateGoal(g.id, delta);
            });
        });

        goalsList.appendChild(card);
    });
}

if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title    = document.getElementById('goal-title').value.trim();
        const deadline = document.getElementById('goal-deadline').value;
        const target   = parseInt(document.getElementById('goal-target').value) || 1;
        if (!title || !deadline) return;
        try {
            await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    deadline: deadline,
                    target: target,
                    current: 0
                })
            });
            goalForm.reset();
            document.getElementById('goal-target').value = 20;
            loadGoals();
            renderCalendar();
        } catch (e) { console.error(e); }
    });
}

async function updateGoal(id, delta) {
    try {
        await fetch('/api/goals/' + id + '/progress?delta=' + delta, {
            method: 'PATCH'
        });
        loadGoals();
        renderCalendar();
    } catch (e) { console.error(e); }
}

async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    try {
        await fetch('/api/goals/' + id, { method: 'DELETE' });
        loadGoals();
        renderCalendar();
    } catch (e) { console.error(e); }
}

loadGoals();

// ============================================================
// 6. TODAY PLANS
// ============================================================
const todayPlansEl = document.getElementById('today-plans');

const PLAN_CATEGORIES = [
    { key: 'study',    title: 'School' },
    { key: 'exam',     title: 'Exams' },
    { key: 'hobby',    title: 'Hobbies' },
    { key: 'personal', title: 'Personal' },
];

function todayISO() {
    return toISO(new Date());
}

function minutesUntil(timeStr) {
    const parts = timeStr.split(':');
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    return Math.floor((target - now) / 60000);
}

async function loadTodayPlans() {
    if (!todayPlansEl) return;
    todayPlansEl.innerHTML = '';
    try {
        const r = await fetch('/api/events?date=' + todayISO());
        const data = await r.json();
        const events = data.events || [];

        PLAN_CATEGORIES.forEach(cat => {
            const col = document.createElement('div');
            col.className = 'plan-col';

            const h = document.createElement('div');
            h.className = 'plan-col__title';
            h.textContent = cat.title;
            col.appendChild(h);

            const items = events.filter(e => e.type === cat.key);
            if (items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'plan-col__empty';
                empty.textContent = '\u2014';
                col.appendChild(empty);
            } else {
                items.forEach(ev => {
                    const diff = minutesUntil(ev.time);
                    const soon = diff >= 0 && diff <= 60;
                    const item = document.createElement('div');
                    item.className = 'plan-item' + (soon ? ' plan-item--soon' : '');
                    item.innerHTML =
                        '<span class="plan-item__time">' + ev.time + '</span>' +
                        '<span class="plan-item__title">' + ev.title + '</span>';
                    col.appendChild(item);
                });
            }
            todayPlansEl.appendChild(col);
        });
    } catch (e) {
        console.error('Today plans error:', e);
        todayPlansEl.innerHTML = '<div class="plan-col__empty">Error</div>';
    }
}

loadTodayPlans();
window.setInterval(loadTodayPlans, 60000);

// ============================================================
// 7. STATISTICS
// ============================================================
async function loadStats() {
    try {
        const r = await fetch('/api/subjects');
        const data = await r.json();

        const gpaEl    = document.getElementById('stats-gpa');
        const hintEl   = document.getElementById('stats-gpa-hint');
        const subjEl   = document.getElementById('kpi-subjects');
        const gradesEl = document.getElementById('kpi-grades');
        const avg10El  = document.getElementById('kpi-avg10');

        // GPA
        if (data.overall_gpa !== null && data.overall_gpa !== undefined) {
            gpaEl.textContent = data.overall_gpa.toFixed(2);
            hintEl.textContent = statusFromGpa(data.overall_gpa);
        } else {
            gpaEl.textContent = '\u2014';
            hintEl.textContent = 'no grades yet';
        }

        // Subjects / Grades
        subjEl.textContent   = data.total_subjects;
        gradesEl.textContent = data.total_grades;

        // Средний по 10-балльной
        let sum = 0, count = 0;
        (data.subjects || []).forEach(s => {
            s.grades.forEach(g => { 
                let score = typeof g === 'object' ? g.score : g;
                let max_score = typeof g === 'object' ? g.max_score : 10;
                sum += (score / max_score) * 10; // переводим в 10-балльную
                count++; 
            });
        });
        avg10El.textContent = count > 0 ? (sum / count).toFixed(2) : '\u2014';

        renderGradesChart(data.subjects || []);
        loadStatsGoals();
    } catch (e) {
        console.error('Stats error:', e);
    }
}

function statusFromGpa(gpa) {
    if (gpa >= 3.7) return 'excellent';
    if (gpa >= 3.0) return 'good';
    if (gpa >= 2.0) return 'ok';
    return 'needs work';
}

// ============================================================
// 7.5. GRADES CHART
// ============================================================
function renderGradesChart(subjects) {
    const container = document.getElementById('grades-chart');
    if (!container) return;

    if (!subjects || subjects.length === 0) {
        container.innerHTML =
            '<div class="stats-placeholder">No subjects yet. Add some in the Grades tab.</div>';
        return;
    }

    const withGrades = subjects.filter(s => s.grade10 !== null && s.grade10 !== undefined);

    if (withGrades.length === 0) {
        container.innerHTML =
            '<div class="stats-placeholder">No grades yet. Add grades to see the chart.</div>';
        return;
    }

    const MAX_HEIGHT = 260;
    container.innerHTML = '';

    withGrades.forEach(s => {
        const avg = s.grade10; // Используем новое поле (10-балльная оценка)
        const heightPx = Math.max(4, Math.round((avg / 10) * MAX_HEIGHT));
        const colorClass = 'chart-bar--' + Math.round(avg);

        const col = document.createElement('div');
        col.className = 'chart-col';
        col.innerHTML =
            '<div class="chart-col__value">' + avg.toFixed(2) + '</div>' +
            '<div class="chart-col__bar ' + colorClass + '" style="height:' + heightPx + 'px"></div>' +
            '<div class="chart-col__label" title="' + s.name + '">' + s.name + '</div>' +
            '<div class="chart-col__sub">' + s.grades.length + ' grade' + (s.grades.length === 1 ? '' : 's') + '</div>';

        container.appendChild(col);
    });
}

// ============================================================
// 7.6. STATS → GOALS
// ============================================================
async function loadStatsGoals() {
    try {
        const r = await fetch('/api/goals');
        const data = await r.json();
        renderStatsGoals(data.goals || []);
    } catch (e) {
        console.error('Stats goals error:', e);
    }
}

function renderStatsGoals(goals) {
    const activeEl    = document.getElementById('kpi-goals-active');
    const completedEl = document.getElementById('kpi-goals-completed');
    const overdueEl   = document.getElementById('kpi-goals-overdue');
    const countEl     = document.getElementById('overall-goals-count');
    const fillEl      = document.getElementById('overall-goals-fill');
    const listEl      = document.getElementById('stats-goals-list');

    if (!listEl) return;
    const todayIso = toISO(new Date());
    let active = 0, completed = 0, overdue = 0;
    let sumCurrent = 0, sumTarget = 0;

    goals.forEach(g => {
        const done = g.current >= g.target;
        const isPast = g.deadline < todayIso && !done;
        if (done)      completed++;
        else if (isPast) overdue++;
        else           active++;
        sumCurrent += Math.min(g.current, g.target);
        sumTarget  += g.target;
    });

    if (activeEl)    activeEl.textContent    = active;
    if (completedEl) completedEl.textContent = completed;
    if (overdueEl)   overdueEl.textContent   = overdue;

    const overallPercent = sumTarget > 0 ? Math.round((sumCurrent / sumTarget) * 100) : 0;
    if (countEl) countEl.textContent = sumCurrent + ' / ' + sumTarget;
    if (fillEl)  fillEl.style.width  = overallPercent + '%';
    listEl.innerHTML = '';

    if (goals.length === 0) {
        listEl.innerHTML = '<div class="empty-hint-block">No goals yet. Add some in the Goals tab.</div>';
        return;
    }

    goals.forEach(g => {
        const done = g.current >= g.target;
        const isPast = g.deadline < todayIso && !done;
        const percent = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
        let rowClass = 'stat-goal-row';
        if (done)   rowClass += ' is-done';
        else if (isPast) rowClass += ' is-overdue';

        const row = document.createElement('div');
        row.className = rowClass;
        row.innerHTML =
            '<div class="stat-goal-row__main">' +
                '<div class="stat-goal-row__title" title="' + g.title + '">' + g.title + '</div>' +
                '<div class="stat-goal-row__deadline">deadline: ' + g.deadline + '</div>' +
            '</div>' +
            '<div class="stat-goal-row__progress">' +
                '<div class="goal-bar"><div class="goal-bar__fill" style="width:' + percent + '%"></div></div>' +
                '<div class="stat-goal-row__count">' + g.current + ' / ' + g.target + '</div>' +
            '</div>';
        listEl.appendChild(row);
    });
}

document.querySelectorAll('.stats-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.stats-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.stab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('stab-' + btn.dataset.stab).classList.add('active');
    });
});

// ============================================================
// 8. NOTIFICATIONS
// ============================================================
const NOTIF_KEYS = {
    'notif-reminder': 'reminder_before_event',
    'notif-morning':  'morning_summary',
    'notif-evening':  'evening_goals_check',
    'notif-gpa':      'gpa_drop_warning',
};

async function loadNotifications() {
    try {
        const r = await fetch('/api/settings');
        const data = await r.json();
        Object.entries(NOTIF_KEYS).forEach(([htmlId, key]) => {
            const el = document.getElementById(htmlId);
            if (el) el.checked = !!data[key];
        });
    } catch (e) {
        console.error('Settings load error:', e);
    }
}

function showStatus(text) {
    const statusEl = document.getElementById('notif-status');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove('is-hidden');
    clearTimeout(statusEl._timer);
    statusEl._timer = setTimeout(() => {
        statusEl.classList.add('is-hidden');
    }, 1500);
}

async function saveNotifications() {
    const payload = {};
    Object.entries(NOTIF_KEYS).forEach(([htmlId, key]) => {
        const el = document.getElementById(htmlId);
        payload[key] = el ? el.checked : false;
    });

    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        showStatus('Saved');
    } catch (e) {
        console.error('Settings save error:', e);
        showStatus('Error saving');
    }
}

Object.keys(NOTIF_KEYS).forEach(htmlId => {
    const el = document.getElementById(htmlId);
    if (el) {
        el.addEventListener('change', saveNotifications);
    }
});

// ============================================================
// 9. TIMER (POMODORO)
// ============================================================
const TIMER_WORK       = 25 * 60;
const TIMER_BREAK      = 5 * 60;
const TIMER_LONG_BREAK = 15 * 60;
const TIMER_CYCLES     = 4;

let timerRemaining = TIMER_WORK;
let timerRunning   = false;
let timerMode      = 'work';
let timerPomsDone  = 0;
let timerInterval  = null;

const timerModeEl    = document.getElementById('timer-mode');
const timerDisplayEl = document.getElementById('timer-display');
const timerPomsEl    = document.getElementById('timer-poms');
const timerHintEl    = document.getElementById('timer-hint');
const timerStartBtn  = document.getElementById('timer-start');
const timerPauseBtn  = document.getElementById('timer-pause');
const timerResetBtn  = document.getElementById('timer-reset');

function formatTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return m + ':' + s;
}

function updateTimerDisplay() {
    if (!timerDisplayEl) return;
    timerDisplayEl.textContent = formatTime(timerRemaining);

    timerModeEl.classList.remove('is-break', 'is-long');
    timerDisplayEl.classList.remove('is-break', 'is-long');

    if (timerMode === 'work') {
        timerModeEl.textContent = 'WORK';
        timerHintEl.textContent = '4 work sessions, then a long break';
    } else if (timerMode === 'break') {
        timerModeEl.textContent = 'BREAK';
        timerModeEl.classList.add('is-break');
        timerDisplayEl.classList.add('is-break');
        timerHintEl.textContent = 'Short break — relax';
    } else {
        timerModeEl.textContent = 'LONG BREAK';
        timerModeEl.classList.add('is-long');
        timerDisplayEl.classList.add('is-long');
        timerHintEl.textContent = 'Long break — you earned it';
    }

    timerPomsEl.innerHTML = '';
    for (let i = 0; i < TIMER_CYCLES; i++) {
        const pom = document.createElement('div');
        pom.className = 'pom' + (i < timerPomsDone ? ' is-done' : '');
        timerPomsEl.appendChild(pom);
    }

    timerStartBtn.disabled = timerRunning;
    timerPauseBtn.disabled = !timerRunning;
}

function setMode(mode) {
    timerMode = mode;
    if (mode === 'work')  timerRemaining = TIMER_WORK;
    if (mode === 'break') timerRemaining = TIMER_BREAK;
    if (mode === 'long')  timerRemaining = TIMER_LONG_BREAK;
    updateTimerDisplay();
}

function nextMode() {
    if (timerMode === 'work') {
        savePomodoro();
        timerPomsDone++;
        if (timerPomsDone >= TIMER_CYCLES) {
            setMode('long');
        } else {
            setMode('break');
        }
    } else {
        if (timerMode === 'long') timerPomsDone = 0;
        setMode('work');
    }
}

function tickTimer() {
    if (timerRemaining > 0) {
        timerRemaining--;
        updateTimerDisplay();
    } else {
        stopTimer();
        nextMode();
    }
}

function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerInterval = setInterval(tickTimer, 1000);
    updateTimerDisplay();
}

function stopTimer() {
    timerRunning = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    updateTimerDisplay();
}

function resetTimer() {
    stopTimer();
    timerPomsDone = 0;
    setMode('work');
}

if (timerStartBtn) timerStartBtn.addEventListener('click', startTimer);
if (timerPauseBtn) timerPauseBtn.addEventListener('click', stopTimer);
if (timerResetBtn) timerResetBtn.addEventListener('click', resetTimer);

if (timerDisplayEl) updateTimerDisplay();

// ============================================================
// 10. TIMER → SUBJECT + POMODOROS
// ============================================================
const timerSubjectSelect = document.getElementById('timer-subject-select');
const pomodoroTodayList  = document.getElementById('pomodoro-today-list');

async function loadTimerSubjects() {
    if (!timerSubjectSelect) return;
    try {
        const r = await fetch('/api/subjects');
        const data = await r.json();
        const current = timerSubjectSelect.value;

        timerSubjectSelect.innerHTML = '<option value="">— pick a subject —</option>';

        (data.subjects || []).forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.id;
            opt.textContent = sub.name;
            opt.dataset.name = sub.name;
            timerSubjectSelect.appendChild(opt);
        });

        if (current) timerSubjectSelect.value = current;
    } catch (e) {
        console.error('Timer subjects error:', e);
    }
}

async function loadTodayPomodoros() {
    if (!pomodoroTodayList) return;
    try {
        const today = toISO(new Date());
        const r = await fetch('/api/pomodoros?date=' + today);
        const data = await r.json();

        pomodoroTodayList.innerHTML = '';

        if (!data.by_subject || data.by_subject.length === 0) {
            pomodoroTodayList.innerHTML = '<div class="pomodoro-empty">No pomodoros yet today.</div>';
            return;
        }

        data.by_subject.forEach(item => {
            const row = document.createElement('div');
            row.className = 'pomodoro-row';
            row.innerHTML =
                '<div class="pomodoro-row__name">' + item.subject_name + '</div>' +
                '<div class="pomodoro-row__count">' + item.count + '</div>';
            pomodoroTodayList.appendChild(row);
        });
    } catch (e) {
        console.error('Pomodoros load error:', e);
    }
}

async function savePomodoro() {
    if (!timerSubjectSelect) return;
    const subjectId   = timerSubjectSelect.value;
    const subjectName = timerSubjectSelect.options[timerSubjectSelect.selectedIndex]?.dataset.name;

    if (!subjectId || !subjectName) return;

    try {
        await fetch('/api/pomodoros', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subject_id: subjectId,
                subject_name: subjectName,
                date: toISO(new Date())
            })
        });
        loadTodayPomodoros();
    } catch (e) {
        console.error('Pomodoro save error:', e);
    }
}

loadTimerSubjects();
loadTodayPomodoros();

document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        if (item.dataset.screen === 'timer') {
            loadTimerSubjects();
            loadTodayPomodoros();
        }
    });
});

// ============================================================
// 11. AI CHAT
// ============================================================
const aiForm        = document.getElementById('ai-form');
const aiInput       = document.getElementById('ai-input');
const aiSubmitBtn   = document.getElementById('ai-submit');
const aiChatContainer = document.getElementById('ai-chat-container');

function addAIMessage(text, isUser = false) {
    if (!aiChatContainer) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-message ' + (isUser ? 'ai-message--user' : 'ai-message--bot');

    const avatar = document.createElement('div');
    avatar.className = 'ai-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';

    const textDiv = document.createElement('div');
    textDiv.className = 'ai-text';
    
    if (isUser) {
        textDiv.textContent = text;
    } else {
        // Используем нашу функцию форматирования
        textDiv.innerHTML = formatAIText(text);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(textDiv);
    aiChatContainer.appendChild(msgDiv);
    aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
}

function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message ai-message--bot';
    typingDiv.id = 'ai-typing';
    typingDiv.innerHTML = `
        <div class="ai-avatar">🤖</div>
        <div class="ai-typing">
            <span></span><span></span><span></span>
        </div>
    `;
    aiChatContainer.appendChild(typingDiv);
    aiChatContainer.scrollTop = aiChatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typing = document.getElementById('ai-typing');
    if (typing) typing.remove();
}

if (aiForm) {
    aiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = aiInput.value.trim();
        if (!message) return;

        addAIMessage(message, true);
        aiInput.value = '';
        
        aiSubmitBtn.disabled = true;
        addTypingIndicator();

        try {
            const r = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message })
            });
            const data = await r.json();
            removeTypingIndicator();

            if (r.ok && data.reply) {
                addAIMessage(data.reply, false);
            } else {
                addAIMessage('Ошибка: не удалось получить ответ от ИИ.', false);
            }
        } catch (err) {
            console.error('AI error:', err);
            removeTypingIndicator();
            addAIMessage('Ошибка сети. Проверь, запущен ли сервер.', false);
        } finally {
            aiSubmitBtn.disabled = false;
            aiInput.focus();
        }
    });
}

// ============================================================
// ПАРСЕР MARKDOWN ДЛЯ ИИ (убирает звездочки и делает красиво)
// ============================================================
function formatAIText(text) {
    if (!text) return '';
    
    let html = text;

    // 1. Заголовки ### и ## и #
    html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^# (.*$)/gim, '<h4>$1</h4>');

    // 2. Жирный текст **текст** или __текст__
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/__(.+?)__/g, '<b>$1</b>');

    // 3. Списки (строки, начинающиеся с - или *)
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // 4. Переносы строк, чтобы абзацы не слипались
    html = html.replace(/\n/g, '<br>');

    return html;
} 