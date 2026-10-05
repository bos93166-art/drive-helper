(() => {
  const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
  const C = window.Complaint;
  const MEMOS = window.MEMOS;
  const $ = s => document.querySelector(s);
  const view = $("#view");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- иконки
  const I = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/><path d="M8 7h7M8 11h7"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    tint: '<path d="M4 17l2.5-7.5A3 3 0 019.3 7.5h5.4a3 3 0 012.8 2L20 17"/><path d="M3 17h18v3H3z"/><path d="M8 11l3 3M11 10l4 4"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 00-5.4 5L4 16.6 7.4 20l5.1-5.1a4 4 0 005-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
    plate: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h2M11 12h2M15 12h2"/>',
    alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    check: '<path d="M4 12l5 5L20 6"/>'
  };
  const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n] || ""}</svg>`;
  const tint = (hex, a) => `color-mix(in srgb, ${hex} ${a}%, transparent)`;

  // ---------- хранилище: localStorage + облако Telegram, если есть
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} cloudSet(k, JSON.stringify(v)); }
  };
  function cloudOk() { return TG && TG.CloudStorage && TG.isVersionAtLeast && TG.isVersionAtLeast("6.9"); }
  function cloudSet(k, s) {
    if (!cloudOk() || k !== "draft") return;
    const parts = s.match(/[\s\S]{1,3500}/g) || [""];
    TG.CloudStorage.setItem(k + "_n", String(parts.length));
    parts.forEach((p, i) => TG.CloudStorage.setItem(k + "_" + i, p));
  }
  function cloudLoad(k, cb) {
    if (!cloudOk()) return cb(null);
    TG.CloudStorage.getItem(k + "_n", (err, n) => {
      n = parseInt(n, 10);
      if (err || !n) return cb(null);
      const keys = Array.from({ length: n }, (_, i) => k + "_" + i);
      TG.CloudStorage.getItems(keys, (e2, res) => {
        if (e2 || !res) return cb(null);
        try { cb(JSON.parse(keys.map(x => res[x] || "").join(""))); } catch (e) { cb(null); }
      });
    });
  }

  // ---------- тема
  function curTheme() {
    return document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  }
  function applyTheme() {
    const t = store.get("theme", null) || (TG ? TG.colorScheme : null);
    if (t) document.documentElement.setAttribute("data-theme", t);
    $("#themeBtn").innerHTML = svg(curTheme() === "light" ? "moon" : "sun");
    try { TG && TG.setHeaderColor && TG.setHeaderColor(curTheme() === "light" ? "#f4f6fb" : "#0f1522"); TG && TG.setBackgroundColor && TG.setBackgroundColor(curTheme() === "light" ? "#f4f6fb" : "#0f1522"); } catch (e) {}
  }
  $("#themeBtn").onclick = () => { store.set("theme", curTheme() === "light" ? "dark" : "light"); applyTheme(); haptic(); };

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function copy(text) {
    const done = () => toast("Скопировано");
    const fallback = () => {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Не получилось скопировать"); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function haptic() { try { TG && TG.HapticFeedback && TG.HapticFeedback.selectionChanged(); } catch (e) {} }

  // ---------- навигация
  const TABS = [["home", "Главная", "home"], ["memos", "Памятки", "book"], ["complaint", "Жалоба", "pen"], ["ref", "Справка", "info"]];
  $("#tabs").innerHTML = TABS.map(t => `<button data-tab="${t[0]}">${svg(t[2])}${t[1]}</button>`).join("");
  let tab = store.get("tab", "home");
  function go(t, opts) {
    tab = t; store.set("tab", tab); haptic(); render(); window.scrollTo(0, 0);
    if (opts && opts.anchor) setTimeout(() => { const el = document.getElementById(opts.anchor); el && el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
  }
  document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => go(b.dataset.tab));
  document.querySelector("[data-go=home]").onclick = () => go("home");
  function render() {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    if (tab === "home") renderHome();
    else if (tab === "memos") renderMemos();
    else if (tab === "complaint") renderComplaint();
    else renderRef();
    updateBack();
  }
  function updateBack() {
    if (!TG || !TG.BackButton) return;
    const inWizard = tab === "complaint" && step > 0;
    if (tab !== "home" || inWizard) TG.BackButton.show(); else TG.BackButton.hide();
  }
  if (TG && TG.BackButton) TG.BackButton.onClick(() => {
    if (tab === "complaint" && step > 0) { step--; save(); renderComplaint(); updateBack(); window.scrollTo(0, 0); }
    else go("home");
  });

  const topicTile = (k, on) => {
    const M = MEMOS[k];
    return `<button class="tile ${on ? "on" : ""}" data-topic="${k}"><span class="ico" style="background:${tint(M.color, 18)};color:${M.color}">${svg(M.icon)}</span><span><b>${M.title}</b><small>${M.sub}</small></span></button>`;
  };

  // ================= ГЛАВНАЯ
  function renderHome() {
    const topic = store.get("memoTopic", "tonirovka");
    const dl = D.copyDate ? C.deadline(D.copyDate) : null;
    let deadlineRow = "";
    if (dl) {
      const days = Math.round((new Date(C.isoOf(dl) + "T12:00:00") - new Date(C.todayIso() + "T12:00:00")) / 864e5);
      deadlineRow = `<button class="rowcard ${days <= 3 ? "alert" : ""}" data-go-tab="complaint"><span class="ico">${svg("clock")}</span><span class="tx"><b>${days < 0 ? "Срок жалобы прошёл" : days === 0 ? "Сегодня последний день" : "До конца срока " + days + " дн."}</b><span>Жалоба № ${esc(D.postNum || "без номера")} · до ${C.fmtDate(C.isoOf(dl))}</span></span><span class="chev">›</span></button>`;
    }
    view.innerHTML = `
      <div class="hero">
        <div class="eyebrow">Остановили</div>
        <h1>Спокойно, всё по шагам</h1>
        <p>Выбери тему, открой чек-лист и делай по нему. Дома соберёшь жалобу</p>
        <button class="btn big" id="stopBtn">${svg("alert")}Меня остановили</button>
      </div>
      <div class="section-title">Темы</div>
      <div class="tiles">${Object.keys(MEMOS).map(k => topicTile(k, k === topic)).join("")}</div>
      ${deadlineRow}
      <div class="section-title">Документы</div>
      <button class="rowcard" data-go-tab="complaint"><span class="ico">${svg("doc")}</span><span class="tx"><b>${D.postNum ? "Продолжить жалобу" : "Собрать жалобу"}</b><span>Тонировка и конструкция, готовый PDF</span></span><span class="chev">›</span></button>
      <button class="rowcard" data-go-tab="ref"><span class="ico">${svg("info")}</span><span class="tx"><b>Штрафы и статьи</b><span>Сроки, суммы, ссылки</span></span><span class="chev">›</span></button>
      <p class="muted small" style="text-align:center;margin-top:24px">Памятка для себя, не юридическая консультация</p>`;
    view.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => { store.set("memoTopic", b.dataset.topic); go("memos"); });
    view.querySelectorAll("[data-go-tab]").forEach(b => b.onclick = () => go(b.dataset.goTab));
    $("#stopBtn").onclick = () => go("memos", { anchor: "checklist" });
  }

  // ================= ПАМЯТКИ
  const stepRow = (st, j) => `<div class="step"><div class="num">${j + 1}</div><div><h3>${st[0]}</h3><p>${st[1]}</p>${st[2] ? `<div class="why">${st[2]}</div>` : ""}</div></div>`;
  const extraBlock = list => list && list.length ? `<div class="extra"><div class="extra-h"><span class="tag accent">Дополнительно</span><span class="muted small">мои советы сверх Кощея</span></div>${list.map(stepRow).join("")}</div>` : "";
  function stageHtml(s, i, open) {
    const cls = s.tag === "Важно" ? "red" : /03/.test(s.tag) ? "green" : "";
    return `<details class="acc" ${open ? "open" : ""}><summary><div><span class="tag ${cls}">${s.tag}</span><h3 style="display:inline">${s.name}</h3></div></summary><div class="body">${s.steps.map(stepRow).join("")}${extraBlock(s.extra)}</div></details>`;
  }
  function sectionsHtml(M) {
    let h = "";
    if (M.materials) {
      h += `<div class="section-title">${M.materials.title}</div><div class="card"><table><tr><th>Документ</th><th>Как в Кощее</th><th>Дополнительно</th></tr>
        ${M.materials.rows.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="muted">${r[2]}</td></tr>`).join("")}</table></div>`;
    }
    if (M.rules) {
      h += `<details class="acc" open><summary><div><span class="tag">Правила</span><h3 style="display:inline">${M.rules.title}</h3></div></summary><div class="body">
        <p class="muted small" style="margin:12px 0 4px">${M.rules.intro}</p>
        ${M.rules.items.map(stepRow).join("")}
        <div class="phrase"><span>Не разъяснены</span><button data-copy="Не разъяснены">Копировать</button></div>
        <div class="phrase"><span>Отказ от подписи</span><button data-copy="Отказ от подписи">Копировать</button></div>
        ${extraBlock(M.rules.extra)}</div></details>`;
    }
    if (M.photos) {
      M.photos.forEach((ph, k) => {
        h += `<details class="acc"><summary><div><span class="tag">Фото-пример ${k + 1}</span><h3 style="display:inline">${ph.title}</h3></div></summary><div class="body">
          <p class="muted small" style="margin:12px 0 6px">В Кощее это авторский снимок бланка со стрелками. Что на нём отмечено:</p>
          <table>${ph.rows.map(r => `<tr><td style="width:42%"><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join("")}</table>
          ${ph.note ? `<p class="muted small">${ph.note}</p>` : ""}</div></details>`;
      });
    }
    return h;
  }
  function renderMemos() {
    const topic = store.get("memoTopic", "tonirovka");
    const M = MEMOS[topic];
    const checks = store.get("checks_" + topic, {});
    const after = M.sectionsAfter == null ? M.stages.length - 1 : M.sectionsAfter;
    let h = `<div class="tiles">${Object.keys(MEMOS).map(k => topicTile(k, k === topic)).join("")}</div>
      <div class="topichead"><span class="ico" style="background:${tint(M.color, 18)};color:${M.color}">${svg(M.icon)}</span><div><h1>${M.title}</h1><span class="tag">${M.article}</span></div></div>
      <div class="card"><p class="small">${M.intro}</p></div>`;
    M.stages.forEach((s, i) => {
      h += stageHtml(s, i, i === 0);
      if (i === after) h += sectionsHtml(M);
    });
    if (M.warnings) h += M.warnings.map(w => `<div class="riskcard"><h3>${w[0]}</h3><p>${w[1]}</p></div>`).join("");
    h += `<div class="section-title" id="checklist">${topic === "grz" ? "Перед поездкой" : "Чек-лист на остановке"}</div><div class="card check">
      ${M.checklist.map((c, i) => `<label><input type="checkbox" data-ci="${i}" ${checks[i] ? "checked" : ""}><span>${c}</span></label>`).join("")}</div>
      <button class="btn ghost" id="resetChecks">Сбросить чек-лист</button>`;
    const ph = (M.phrases || []), px = (M.phrasesExtra || []);
    if (ph.length || px.length) {
      h += `<div class="section-title">Фразы</div><p class="muted small" style="margin-top:0">Нажми, чтобы скопировать и вписать в протокол или показать инспектору</p>
        ${ph.map(p => `<div class="phrase"><span>${p}</span><button data-copy="${esc(p)}">Копировать</button></div>`).join("")}
        ${px.length ? `<div class="extra-h" style="margin-top:12px"><span class="tag accent">Дополнительно</span></div>` + px.map(p => `<div class="phrase extra-phrase"><span>${p}</span><button data-copy="${esc(p)}">Копировать</button></div>`).join("") : ""}`;
    }
    if (C.ART[topic]) h += `<button class="btn" data-go-tab="complaint" style="margin-top:18px">Собрать жалобу по теме ${M.title}</button>`;
    view.innerHTML = h;
    view.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => { store.set("memoTopic", b.dataset.topic); haptic(); renderMemos(); });
    view.querySelectorAll("[data-ci]").forEach(cb => cb.onchange = () => { checks[cb.dataset.ci] = cb.checked; store.set("checks_" + topic, checks); haptic(); });
    $("#resetChecks").onclick = () => { store.set("checks_" + topic, {}); renderMemos(); };
    view.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy(b.dataset.copy));
    view.querySelectorAll("[data-go-tab]").forEach(b => b.onclick = () => { if (C.ART[topic]) { D.topic = topic; save(); } go("complaint"); });
  }

  // ================= ЖАЛОБА
  const STEPS = ["Постановление", "Твои данные", "Остановка", "Инспектор", "Доводы", "Куда подавать", "Готово"];
  let D = store.get("draft", null) || newDraft();
  let step = store.get("step", 0);
  function newDraft() {
    return { topic: "tonirovka", gender: "m", fine: "fine", fineSum: "500", args: {}, requestMaterials: true, wantPresent: true, photos: true, signDate: C.todayIso() };
  }
  function save() { store.set("draft", D); store.set("step", step); }

  const F = (id, label, opts = {}) => {
    const v = D[id] == null ? "" : D[id];
    const type = opts.type || "text";
    const req = opts.req ? " *" : "";
    const input = type === "textarea"
      ? `<textarea data-f="${id}" placeholder="${esc(opts.ph || "")}">${esc(v)}</textarea>`
      : `<input data-f="${id}" type="${type}" value="${esc(v)}" placeholder="${esc(opts.ph || "")}" ${opts.mode ? `inputmode="${opts.mode}"` : ""}>`;
    return `<div class="field" data-field="${id}"><label>${label}${req}</label>${input}${opts.hint ? `<div class="hint">${opts.hint}</div>` : ""}<div class="err">Заполни это поле</div></div>`;
  };
  const REQ = [["postNum", "postDate", "copyDate"], ["fio", "addr"], ["place"], ["inspFio", "unit"], [], ["courtName", "courtAddr"], []];

  function deadlineCard() {
    const dl = C.deadline(D.copyDate);
    if (!dl) return `<div class="card muted small">Укажи дату получения копии, и я посчитаю последний день подачи</div>`;
    const days = Math.round((new Date(C.isoOf(dl) + "T12:00:00") - new Date(C.todayIso() + "T12:00:00")) / 864e5);
    const late = days < 0;
    const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Последний день подать жалобу")}&dates=${C.isoOf(dl).replace(/-/g, "")}/${C.isoOf(new Date(dl.getTime() + 864e5)).replace(/-/g, "")}`;
    return `<div class="${late ? "warn" : "ok"}">
      <div class="small">${late ? "Срок прошёл" : "Последний день подачи"}</div>
      <div class="deadline">${C.fmtDate(C.isoOf(dl))}</div>
      <div class="small">${late ? "Можно просить восстановить срок, но нужна уважительная причина" : days === 0 ? "Это сегодня" : "Осталось дней: " + days}. Праздники не учитываю, лучше подать заранее</div>
      ${late ? "" : `<div class="btns" style="margin-top:10px"><button class="btn ghost" id="icsBtn">В календарь</button><a class="btn ghost" href="${gcal}" target="_blank" rel="noopener" id="gcalBtn">Google Календарь</a></div>`}
    </div>`;
  }

  function renderComplaint() {
    if (!C.ART[D.topic]) D.topic = "tonirovka";
    const prog = STEPS.map((_, i) => `<span class="${i < step ? "done" : i === step ? "cur" : ""}"></span>`).join("");
    let h = `<div class="eyebrow">Жалоба на постановление</div>
      <div class="wizbar"><span class="muted">Шаг ${step + 1} из ${STEPS.length}</span>${step > 0 ? `<button id="backBtn">← Назад</button>` : `<button id="resetBtn">Начать заново</button>`}</div>
      <div class="progress">${prog}</div><h1>${STEPS[step]}</h1>`;
    h += stepHtml();
    if (step < STEPS.length - 1) h += `<button class="btn" id="nextBtn">Дальше →</button><p class="muted small" style="text-align:center">Данные хранятся только у тебя: на устройстве и в облаке твоего Telegram</p>`;
    view.innerHTML = h;
    bindStep();
    updateBack();
  }

  function stepHtml() {
    const topicSeg = `<div class="seg">${Object.keys(C.ART).map(k => `<button data-set-topic="${k}" class="${D.topic === k ? "on" : ""}">${MEMOS[k].title}</button>`).join("")}</div>`;
    switch (step) {
      case 0: return `
        <p class="lead">Тема, номер и даты с копии постановления</p>
        ${topicSeg}
        ${F("postNum", "Номер постановления", { req: 1, ph: "18810077...", hint: "Переписать с бланка до цифры" })}
        <div class="row2">${F("postDate", "Дата постановления", { req: 1, type: "date" })}${F("copyDate", "Когда получил копию", { req: 1, type: "date" })}</div>
        ${deadlineCard()}
        ${C.isLate(D) ? F("lateReason", "Почему пропустил срок", { type: "textarea", ph: "Например: копию постановления получил только ... по почте", hint: "Без уважительной причины срок не восстановят" }) : ""}
        <div class="field"><label>Наказание</label><select data-f="fine"><option value="fine" ${D.fine !== "warn" ? "selected" : ""}>Штраф</option><option value="warn" ${D.fine === "warn" ? "selected" : ""}>Предупреждение</option></select></div>
        ${D.fine !== "warn" ? F("fineSum", "Сумма штрафа, ₽", { mode: "numeric" }) : ""}`;
      case 1: return `
        <p class="lead">Попадёт в шапку документов</p>
        ${F("fio", "ФИО полностью", { req: 1 })}
        <div class="seg"><button data-gender="m" class="${D.gender !== "f" ? "on" : ""}">Мужской род</button><button data-gender="f" class="${D.gender === "f" ? "on" : ""}">Женский род</button></div>
        ${F("addr", "Адрес регистрации или для писем", { req: 1, hint: "Сюда суд пришлёт извещение" })}
        ${F("phone", "Телефон", { type: "tel" })}
        ${F("email", "Электронная почта", { type: "email" })}`;
      case 2: return `
        <p class="lead">Где и когда остановили</p>
        <div class="row2">${F("stopDate", "Дата", { type: "date" })}${F("stopTime", "Время", { type: "time" })}</div>
        ${F("place", "Место", { req: 1, ph: "г. Москва, ул. ..., д. ...", hint: "Как в постановлении" })}
        <div class="row2">${F("carModel", "Марка и модель")}${F("carPlate", "Госномер")}</div>`;
      case 3: return `
        <p class="lead">Кто вынес постановление, сверь с бланком</p>
        ${F("inspRank", "Должность и звание", { ph: "инспектор ДПС, лейтенант полиции" })}
        ${F("inspFio", "ФИО инспектора", { req: 1 })}
        ${F("unit", "Подразделение", { req: 1, ph: "Полное название батальона или полка ДПС", hint: "Целиком, как в постановлении" })}
        ${D.topic === "tonirovka" ? F("device", "Прибор, если знаешь", { ph: "например ТОНИК, номер ...", hint: "Попадёт в довод про поверку" }) : ""}`;
      case 4: return `
        <p class="lead">Отмечай только то, что правда было. Каждая галочка превращается в абзац жалобы</p>
        <div class="warn">Суд сверит жалобу с материалами и видео. Довод, которого не было, только навредит</div>
        <div class="section-title">${MEMOS[D.topic].title}</div>
        <div class="card check">${C.ARGS[D.topic].map(argRow).join("")}</div>
        ${D.topic === "konstrukciya" && D.args.documents_ok ? F("docs", "Какие документы на изменения", { type: "textarea", ph: "свидетельство о соответствии ТС с внесёнными изменениями № ... от ..., отметка в СТС ..." }) : ""}
        <div class="section-title">Процедура</div>
        <div class="card check">${C.ARGS.common.map(argRow).join("")}</div>
        ${F("extra", "Свои доводы", { type: "textarea", ph: "Что ещё было не так. Каждый абзац станет отдельным пунктом", hint: "Пиши фактами: что было и почему это нарушение" })}
        <div class="field" data-field="_args"><div class="err">Отметь хотя бы один довод или напиши свой</div></div>`;
      case 5: return `
        <p class="lead">Жалобу подают в районный суд. Обычно это суд по месту, где вынесли постановление, то есть по месту остановки</p>
        <a class="btn ghost" href="https://sudrf.ru/index.php?id=300" target="_blank" rel="noopener">Найти суд на sudrf.ru ↗</a>
        ${F("courtName", "Суд", { req: 1, ph: "Тверской районный суд г. Москвы" })}
        ${F("courtAddr", "Адрес суда", { req: 1 })}
        <div class="section-title">Что ещё добавить</div>
        <div class="card check">
          ${toggle("requestMaterials", "Попросить суд истребовать материалы и видео" + (D.topic === "tonirovka" ? ", сведения о поверке" : ""))}
          ${toggle("wantPresent", "Хочу участвовать в рассмотрении")}
          ${toggle("photos", "Приложу фото документов с места")}
          ${toggle("withStatement", "Сделать ещё заявление в ГАИ, что жалоба подана")}
        </div>
        ${D.withStatement ? F("unitAddr", "Почтовый адрес подразделения", { hint: "Есть на сайте Госавтоинспекции" }) : ""}
        ${F("signDate", "Дата подписания жалобы", { type: "date" })}`;
      case 6: return resultHtml();
    }
  }
  const argRow = a => `<label><input type="checkbox" data-arg="${a.id}" ${D.args[a.id] ? "checked" : ""}><span>${a.label}${a.hint ? `<br><span class="muted small">${a.hint}</span>` : ""}</span></label>`;
  const toggle = (id, label) => `<label><input type="checkbox" data-t="${id}" ${D[id] ? "checked" : ""}><span>${label}</span></label>`;

  function resultHtml() {
    const text = C.blocksToText(C.buildComplaint(D));
    let h = `<p class="lead">Проверь текст, скачай PDF, распечатай и подпиши от руки</p>
      ${C.isLate(D) ? `<div class="warn">Срок пропущен, в жалобу добавлена просьба его восстановить</div>` : ""}
      <div class="btns"><button class="btn" data-pdf="c">Скачать PDF</button><button class="btn ghost" data-copytext="c">Копировать текст</button></div>
      <div class="section-title">Жалоба</div><div class="doc">${esc(text)}</div>`;
    if (D.withStatement) {
      const st = C.blocksToText(C.buildStatement(D));
      h += `<div class="section-title">Заявление в ГАИ</div>
        <p class="muted small" style="margin-top:0">Отправляй после подачи жалобы. Дата в заявлении это дата подачи жалобы</p>
        ${F("filedDate", "Когда подал жалобу", { type: "date" })}
        <div class="btns"><button class="btn" data-pdf="s">PDF заявления</button><button class="btn ghost" data-copytext="s">Копировать</button></div>
        <div class="doc" style="margin-top:10px">${esc(st)}</div>`;
    }
    h += `<div class="section-title">Как подать</div>
      <details class="acc" open><summary><h3>Заказным письмом</h3></summary><div class="body">
        <div class="step"><div class="num">1</div><div><p>Распечатай жалобу и подпиши от руки</p></div></div>
        <div class="step"><div class="num">2</div><div><p>Приложи копию постановления и всё из списка Приложение</p></div></div>
        <div class="step"><div class="num">3</div><div><p>Отправь заказным письмом с описью вложения и уведомлением на адрес суда</p></div></div>
        <div class="step"><div class="num">4</div><div><p>Сохрани квитанцию и опись, по дате отправки считается, что ты успел в срок</p></div></div>
      </div></details>
      <details class="acc"><summary><h3>Лично в суд</h3></summary><div class="body">
        <div class="step"><div class="num">1</div><div><p>Распечатай два экземпляра и подпиши оба</p></div></div>
        <div class="step"><div class="num">2</div><div><p>Отдай в канцелярию суда, на втором экземпляре попроси поставить отметку о принятии с датой</p></div></div>
      </div></details>
      <details class="acc"><summary><h3>Через подразделение</h3></summary><div class="body">
        <p class="muted">Можно подать в подразделение, которое вынесло постановление, оно обязано за 3 суток переслать жалобу в суд. Удобно, если батальон ближе суда. Тоже бери отметку о принятии</p>
      </div></details>
      <div class="warn">Электронная подача жалоб по таким делам возможна не везде. Надёжнее всего бумага с подписью</div>
      <div class="btns"><button class="btn ghost" id="editBtn">Изменить данные</button><button class="btn ghost" id="newBtn">Новая жалоба</button></div>`;
    return h;
  }

  function bindStep() {
    view.querySelectorAll("[data-f]").forEach(el => {
      const ev = el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
      el.addEventListener(ev, () => {
        D[el.dataset.f] = el.value;
        const fld = el.closest(".field"); if (fld) fld.classList.remove("bad");
        save();
        if (["copyDate", "fine", "signDate"].includes(el.dataset.f) && step === 0) renderComplaint();
        if (el.dataset.f === "filedDate" && step === 6) renderComplaint();
      });
    });
    view.querySelectorAll("[data-set-topic]").forEach(b => b.onclick = () => { D.topic = b.dataset.setTopic; save(); haptic(); renderComplaint(); });
    view.querySelectorAll("[data-gender]").forEach(b => b.onclick = () => { D.gender = b.dataset.gender; save(); haptic(); renderComplaint(); });
    view.querySelectorAll("[data-arg]").forEach(cb => cb.onchange = () => { D.args[cb.dataset.arg] = cb.checked; save(); haptic(); if (cb.dataset.arg === "documents_ok") renderComplaint(); });
    view.querySelectorAll("[data-t]").forEach(cb => cb.onchange = () => { D[cb.dataset.t] = cb.checked; save(); haptic(); if (cb.dataset.t === "withStatement") renderComplaint(); });
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on("#nextBtn", next);
    on("#backBtn", () => { step--; save(); renderComplaint(); window.scrollTo(0, 0); });
    on("#resetBtn", () => { if (confirm("Стереть анкету и начать заново?")) { D = newDraft(); step = 0; save(); renderComplaint(); } });
    on("#editBtn", () => { step = 0; save(); renderComplaint(); window.scrollTo(0, 0); });
    on("#newBtn", () => { if (confirm("Стереть эту жалобу и начать новую?")) { D = newDraft(); step = 0; save(); renderComplaint(); window.scrollTo(0, 0); } });
    on("#icsBtn", downloadIcs);
    view.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => makePdf(b.dataset.pdf));
    view.querySelectorAll("[data-copytext]").forEach(b => b.onclick = () => copy(C.blocksToText(b.dataset.copytext === "s" ? C.buildStatement(D) : C.buildComplaint(D))));
  }

  function next() {
    let ok = true, first = null;
    const mark = id => { ok = false; const f = view.querySelector(`[data-field="${id}"]`); if (f) { f.classList.add("bad"); first = first || f; } };
    REQ[step].forEach(id => { if (!String(D[id] || "").trim()) mark(id); });
    if (step === 0 && C.isLate(D) && !String(D.lateReason || "").trim()) mark("lateReason");
    if (step === 4) {
      const ids = C.ARGS.common.concat(C.ARGS[D.topic]).map(a => a.id);
      if (!ids.some(k => D.args[k]) && !String(D.extra || "").trim()) mark("_args");
    }
    if (!ok) {
      try { TG && TG.HapticFeedback && TG.HapticFeedback.notificationOccurred("error"); } catch (e) {}
      first && first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    step++; save(); renderComplaint(); window.scrollTo(0, 0);
  }

  // ---------- PDF и календарь
  let pdfLoading = null;
  function loadPdfLib() {
    if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve();
    if (pdfLoading) return pdfLoading;
    const add = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    pdfLoading = add("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js")
      .then(() => add("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js"));
    return pdfLoading;
  }
  function makePdf(which) {
    toast("Собираю PDF");
    loadPdfLib().then(() => {
      const B = which === "s" ? C.buildStatement(D) : C.buildComplaint(D);
      const name = (which === "s" ? "Заявление в ГАИ " : "Жалоба ") + (D.postNum || "") + ".pdf";
      window.pdfMake.createPdf(C.blocksToPdf(B)).getBlob(blob => deliver(blob, name, "application/pdf"));
    }).catch(() => toast("Не загрузилась библиотека PDF, проверь интернет"));
  }
  function deliver(blob, name, type) {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(() => {}); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    if (TG) toast("Если файл не сохранился, скопируй текст");
  }
  function downloadIcs() {
    const dl = C.deadline(D.copyDate); if (!dl) return;
    const d1 = C.isoOf(dl).replace(/-/g, ""), d2 = C.isoOf(new Date(dl.getTime() + 864e5)).replace(/-/g, "");
    const rem = C.isoOf(new Date(dl.getTime() - 3 * 864e5)).replace(/-/g, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//lucky-drive//RU", "BEGIN:VEVENT",
      "UID:" + Date.now() + "@lucky-drive", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      "DTSTART;VALUE=DATE:" + d1, "DTEND;VALUE=DATE:" + d2, "SUMMARY:Последний день подать жалобу",
      "BEGIN:VALARM", "TRIGGER;VALUE=DATE-TIME:" + rem + "T090000", "ACTION:DISPLAY", "DESCRIPTION:Через 3 дня срок жалобы", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    deliver(new Blob([ics], { type: "text/calendar" }), "Срок жалобы.ics", "text/calendar");
  }

  // ================= СПРАВКА
  function renderRef() {
    const R = window.REF;
    view.innerHTML = `<div class="eyebrow">Справка</div><h1>Статьи и ссылки</h1>
      <div class="section-title">Штрафы</div><div class="card"><table><tr><th>Статья</th><th>Про что</th><th>Наказание</th></tr>
      ${R.fines.map(r => `<tr><td style="white-space:nowrap"><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table></div>
      <div class="section-title">Сроки</div><div class="card">
        <p><b>10 дней</b> на жалобу со дня получения копии постановления</p>
        <p><b>10 дней</b> на регистрацию машины после покупки</p>
        <p><b>20 дней</b> чтобы оплатить штраф со скидкой 50 процентов</p>
        <p><b>3 суток</b> у подразделения, чтобы переслать жалобу в суд, если подал через него</p>
        <p class="muted small">Пока жалобу не рассмотрели, постановление не вступает в силу</p>
      </div>
      <div class="section-title">Статьи</div><div class="card"><table>
      ${R.articles.map(r => `<tr><td style="white-space:nowrap"><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join("")}</table></div>
      <div class="section-title">Ссылки</div>${R.links.map(l => `<a class="rowcard" href="${l[1]}" target="_blank" rel="noopener"><span class="ico">${svg("info")}</span><span class="tx"><b>${l[0]}</b></span><span class="chev">↗</span></a>`).join("")}
      <div class="warn">Это памятка для себя, а не юридическая консультация. В спорной ситуации лучше показать документы юристу</div>`;
  }

  // ---------- старт
  applyTheme();
  if (TG) { try { TG.ready(); TG.expand(); } catch (e) {} }
  cloudLoad("draft", v => {
    if (v && !localStorage.getItem("draft")) D = v;
    render();
  });
})();
