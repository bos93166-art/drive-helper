(() => {
  const TG = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
  const C = window.Complaint;
  const $ = s => document.querySelector(s);
  const view = $("#view");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- хранилище: localStorage + облако Telegram, если есть
  const store = {
    get(k, def) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
      cloudSet(k, JSON.stringify(v));
    }
  };
  function cloudOk() { return TG && TG.CloudStorage && TG.isVersionAtLeast && TG.isVersionAtLeast("6.9"); }
  function cloudSet(k, s) {
    if (!cloudOk()) return;
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
  function applyTheme() {
    const t = store.get("theme", null) || (TG ? TG.colorScheme : null);
    if (t) document.documentElement.setAttribute("data-theme", t);
  }
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme") ||
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "light" ? "dark" : "light";
    store.set("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 1800);
  }
  function copy(text) {
    const done = () => toast("Скопировано");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Не получилось скопировать"); }
      ta.remove();
    }
  }
  function haptic() { try { TG && TG.HapticFeedback && TG.HapticFeedback.selectionChanged(); } catch (e) {} }

  // ---------- вкладки
  let tab = store.get("tab", "memos");
  document.querySelectorAll("nav.tabs button").forEach(b => {
    b.onclick = () => { tab = b.dataset.tab; store.set("tab", tab); haptic(); render(); window.scrollTo(0, 0); };
  });
  function render() {
    document.querySelectorAll("nav.tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
    if (tab === "memos") renderMemos();
    else if (tab === "complaint") renderComplaint();
    else renderRef();
  }

  // ================= ПАМЯТКИ
  function renderMemos() {
    const topic = store.get("memoTopic", "tonirovka");
    const M = window.MEMOS[topic];
    const checks = store.get("checks_" + topic, {});
    let h = `<div class="eyebrow">Памятки</div><h1>${M.title}</h1>
      <div class="seg">${Object.keys(window.MEMOS).map(k => `<button data-topic="${k}" class="${k === topic ? "on" : ""}">${window.MEMOS[k].title}</button>`).join("")}</div>
      <div class="card"><span class="tag">${M.article}</span><p class="muted small" style="margin-top:8px">${M.intro}</p></div>`;
    M.stages.forEach((s, i) => {
      h += `<details class="acc" ${i === 0 ? "open" : ""}><summary><div><span class="tag ${i === 2 ? "green" : ""}">${s.tag}</span><h3 style="display:inline">${s.name}</h3></div></summary><div class="body">`;
      s.steps.forEach((st, j) => {
        h += `<div class="step"><div class="num">${j + 1}</div><div><h3>${st[0]}</h3><p>${st[1]}</p>${st[2] ? `<div class="why">${st[2]}</div>` : ""}</div></div>`;
      });
      h += `</div></details>`;
    });
    h += `<h2>Какие бывают документы</h2><div class="card"><table><tr><th>Документ</th><th>Что это</th><th>Важно</th></tr>
      ${M.materials.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="muted">${r[2]}</td></tr>`).join("")}</table></div>`;
    h += `<h2>Чек-лист на остановке</h2><div class="card check">
      ${M.checklist.map((c, i) => `<label><input type="checkbox" data-ci="${i}" ${checks[i] ? "checked" : ""}><span>${c}</span></label>`).join("")}</div>
      <button class="btn ghost" id="resetChecks">Сбросить чек-лист</button>`;
    h += `<h2>Фразы</h2><p class="muted small">Нажми, чтобы скопировать и вписать или показать инспектору</p>
      ${M.phrases.map(p => `<div class="phrase"><span>${p}</span><button data-copy="${esc(p)}">Копировать</button></div>`).join("")}`;
    view.innerHTML = h;
    view.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => { store.set("memoTopic", b.dataset.topic); haptic(); renderMemos(); });
    view.querySelectorAll("[data-ci]").forEach(cb => cb.onchange = () => { checks[cb.dataset.ci] = cb.checked; store.set("checks_" + topic, checks); haptic(); });
    $("#resetChecks").onclick = () => { store.set("checks_" + topic, {}); renderMemos(); };
    view.querySelectorAll("[data-copy]").forEach(b => b.onclick = () => copy(b.dataset.copy));
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
  const REQ = [
    ["postNum", "postDate", "copyDate"],
    ["fio", "addr"],
    ["place"],
    ["inspFio", "unit"],
    [],
    ["courtName", "courtAddr"],
    []
  ];

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
    const prog = STEPS.map((_, i) => `<span class="${i < step ? "done" : i === step ? "cur" : ""}"></span>`).join("");
    let h = `<div class="eyebrow">Жалоба на постановление</div>
      <div class="wizbar"><span class="muted">Шаг ${step + 1} из ${STEPS.length}</span>${step > 0 ? `<button id="backBtn">← Назад</button>` : `<button id="resetBtn">Начать заново</button>`}</div>
      <div class="progress">${prog}</div><h1>${STEPS[step]}</h1>`;
    h += stepHtml();
    if (step < STEPS.length - 1) h += `<button class="btn" id="nextBtn">Дальше →</button><p class="muted small" style="text-align:center">Данные хранятся только у тебя: на устройстве и в облаке твоего Telegram</p>`;
    view.innerHTML = h;
    bindStep();
  }

  function stepHtml() {
    const topicSeg = `<div class="seg">${Object.keys(C.ART).map(k => `<button data-set-topic="${k}" class="${D.topic === k ? "on" : ""}">${window.MEMOS[k].title}</button>`).join("")}</div>`;
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
      case 4: {
        const list = C.ARGS.common.concat(C.ARGS[D.topic]);
        return `
        <p class="lead">Отмечай только то, что правда было. Каждая галочка превращается в абзац жалобы</p>
        <div class="warn">Суд сверит жалобу с материалами и видео. Довод, которого не было, только навредит</div>
        <h2>${window.MEMOS[D.topic].title}</h2>
        <div class="card check">${C.ARGS[D.topic].map(argRow).join("")}</div>
        ${D.topic === "konstrukciya" && D.args.documents_ok ? F("docs", "Какие документы на изменения", { type: "textarea", ph: "свидетельство о соответствии ТС с внесёнными изменениями № ... от ..., отметка в СТС ..." }) : ""}
        <h2>Процедура</h2>
        <div class="card check">${C.ARGS.common.map(argRow).join("")}</div>
        ${F("extra", "Свои доводы", { type: "textarea", ph: "Что ещё было не так. Каждый абзац станет отдельным пунктом", hint: "Пиши фактами: что было и почему это нарушение" })}
        <div class="field err-args" data-field="_args"><div class="err">Отметь хотя бы один довод или напиши свой</div></div>`;
      }
      case 5: return `
        <p class="lead">Жалобу подают в районный суд. Обычно это суд по месту, где вынесли постановление, то есть по месту остановки</p>
        <a class="btn ghost" href="https://sudrf.ru/index.php?id=300" target="_blank" rel="noopener">Найти суд на sudrf.ru ↗</a>
        ${F("courtName", "Суд", { req: 1, ph: "Тверской районный суд г. Москвы" })}
        ${F("courtAddr", "Адрес суда", { req: 1 })}
        <h2>Что ещё добавить</h2>
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

  function argRow(a) {
    return `<label><input type="checkbox" data-arg="${a.id}" ${D.args[a.id] ? "checked" : ""}><span>${a.label}${a.hint ? `<br><span class="muted small">${a.hint}</span>` : ""}</span></label>`;
  }
  function toggle(id, label) {
    return `<label><input type="checkbox" data-t="${id}" ${D[id] ? "checked" : ""}><span>${label}</span></label>`;
  }

  function resultHtml() {
    const text = C.blocksToText(C.buildComplaint(D));
    let h = `<p class="lead">Проверь текст, скачай PDF, распечатай и подпиши от руки</p>
      ${C.isLate(D) ? `<div class="warn">Срок пропущен, в жалобу добавлена просьба его восстановить</div>` : ""}
      <div class="btns"><button class="btn" data-pdf="c">Скачать PDF</button><button class="btn ghost" data-copytext="c">Копировать текст</button></div>
      <h2>Жалоба</h2><div class="doc">${esc(text)}</div>`;
    if (D.withStatement) {
      const st = C.blocksToText(C.buildStatement(D));
      h += `<h2>Заявление в ГАИ</h2>
        <p class="muted small">Отправляй после подачи жалобы. Дата в заявлении это дата подачи жалобы</p>
        ${F("filedDate", "Когда подал жалобу", { type: "date" })}
        <div class="btns"><button class="btn" data-pdf="s">PDF заявления</button><button class="btn ghost" data-copytext="s">Копировать</button></div>
        <div class="doc" style="margin-top:10px">${esc(st)}</div>`;
    }
    h += `<h2>Как подать</h2>
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
        if (["copyDate", "fine", "signDate"].includes(el.dataset.f) && step === 0) { renderComplaint(); }
        if (el.dataset.f === "filedDate" && step === 6) { renderComplaint(); }
      });
    });
    view.querySelectorAll("[data-set-topic]").forEach(b => b.onclick = () => { D.topic = b.dataset.setTopic; save(); haptic(); renderComplaint(); });
    view.querySelectorAll("[data-gender]").forEach(b => b.onclick = () => { D.gender = b.dataset.gender; save(); haptic(); renderComplaint(); });
    view.querySelectorAll("[data-arg]").forEach(cb => cb.onchange = () => {
      D.args[cb.dataset.arg] = cb.checked; save(); haptic();
      if (cb.dataset.arg === "documents_ok") renderComplaint();
    });
    view.querySelectorAll("[data-t]").forEach(cb => cb.onchange = () => { D[cb.dataset.t] = cb.checked; save(); haptic(); if (cb.dataset.t === "withStatement") renderComplaint(); });
    const nb = $("#nextBtn"); if (nb) nb.onclick = next;
    const bb = $("#backBtn"); if (bb) bb.onclick = () => { step--; save(); renderComplaint(); window.scrollTo(0, 0); };
    const rb = $("#resetBtn"); if (rb) rb.onclick = () => { if (confirm("Стереть анкету и начать заново?")) { D = newDraft(); step = 0; save(); renderComplaint(); } };
    const eb = $("#editBtn"); if (eb) eb.onclick = () => { step = 0; save(); renderComplaint(); window.scrollTo(0, 0); };
    const nw = $("#newBtn"); if (nw) nw.onclick = () => { if (confirm("Стереть эту жалобу и начать новую?")) { D = newDraft(); step = 0; save(); renderComplaint(); window.scrollTo(0, 0); } };
    const ics = $("#icsBtn"); if (ics) ics.onclick = downloadIcs;
    view.querySelectorAll("[data-pdf]").forEach(b => b.onclick = () => makePdf(b.dataset.pdf));
    view.querySelectorAll("[data-copytext]").forEach(b => b.onclick = () => copy(C.blocksToText(b.dataset.copytext === "s" ? C.buildStatement(D) : C.buildComplaint(D))));
  }

  function next() {
    let ok = true, first = null;
    REQ[step].forEach(id => {
      if (!String(D[id] || "").trim()) {
        ok = false;
        const f = view.querySelector(`[data-field="${id}"]`);
        if (f) { f.classList.add("bad"); first = first || f; }
      }
    });
    if (step === 0 && C.isLate(D) && !String(D.lateReason || "").trim()) {
      ok = false; const f = view.querySelector(`[data-field="lateReason"]`); if (f) { f.classList.add("bad"); first = first || f; }
    }
    if (step === 4) {
      const any = Object.keys(D.args).some(k => D.args[k] && C.ARGS.common.concat(C.ARGS[D.topic]).some(a => a.id === k));
      if (!any && !String(D.extra || "").trim()) {
        ok = false; const f = view.querySelector(`[data-field="_args"]`); f.classList.add("bad"); first = first || f;
      }
    }
    if (!ok) {
      try { TG && TG.HapticFeedback && TG.HapticFeedback.notificationOccurred("error"); } catch (e) {}
      first && first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    step++; save(); renderComplaint(); window.scrollTo(0, 0);
  }

  // ---------- PDF
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
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    if (TG) toast("Если файл не сохранился, открой приложение в браузере или скопируй текст");
  }
  function downloadIcs() {
    const dl = C.deadline(D.copyDate); if (!dl) return;
    const d1 = C.isoOf(dl).replace(/-/g, ""), d2 = C.isoOf(new Date(dl.getTime() + 864e5)).replace(/-/g, "");
    const rem = C.isoOf(new Date(dl.getTime() - 3 * 864e5)).replace(/-/g, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//drive-helper//RU", "BEGIN:VEVENT",
      "UID:" + Date.now() + "@drive-helper", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      "DTSTART;VALUE=DATE:" + d1, "DTEND;VALUE=DATE:" + d2, "SUMMARY:Последний день подать жалобу",
      "BEGIN:VALARM", "TRIGGER;VALUE=DATE-TIME:" + rem + "T090000", "ACTION:DISPLAY", "DESCRIPTION:Через 3 дня срок жалобы", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    deliver(new Blob([ics], { type: "text/calendar" }), "Срок жалобы.ics", "text/calendar");
  }

  // ================= СПРАВКА
  function renderRef() {
    const R = window.REF;
    view.innerHTML = `<div class="eyebrow">Справка</div><h1>Статьи и ссылки</h1>
      <h2>Штрафы</h2><div class="card"><table><tr><th>Статья</th><th>Про что</th><th>Наказание</th></tr>
      ${R.fines.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table></div>
      <h2>Статьи из жалобы</h2><div class="card"><table>
      ${R.articles.map(r => `<tr><td style="white-space:nowrap"><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join("")}</table></div>
      <h2>Сроки</h2><div class="card">
        <p><b>10 дней</b> на жалобу со дня получения копии постановления</p>
        <p><b>20 дней</b> чтобы оплатить штраф со скидкой 50 процентов</p>
        <p><b>3 суток</b> у подразделения, чтобы переслать жалобу в суд, если подал через него</p>
        <p class="muted small">Пока жалобу не рассмотрели, постановление не вступает в силу</p>
      </div>
      <h2>Ссылки</h2>${R.links.map(l => `<a class="btn ghost" href="${l[1]}" target="_blank" rel="noopener">${l[0]} ↗</a>`).join("")}
      <div class="warn">Это памятка для себя, а не юридическая консультация. В спорной ситуации лучше показать жалобу юристу</div>`;
  }

  // ---------- старт
  applyTheme();
  if (TG) { try { TG.ready(); TG.expand(); } catch (e) {} }
  cloudLoad("draft", v => {
    if (v && (!localStorage.getItem("draft"))) { D = v; }
    render();
  });
})();
