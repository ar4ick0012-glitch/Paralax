"use strict";
const $ = (id) => document.getElementById(id);
const names = {
  up: "UP",
  down: "DOWN",
  wait: "No setup",
  unavailable: "Waiting for market data",
  unreadable: "Chart is unreadable",
};
const modes = { archive: "Recorded market", live: "Live market", photo: "Chart image" };
// The server and the Telegram bot speak Russian; the Mini App shows English.
const EN = {
  "Пересечение средних":"Moving average cross","Тренд и импульс":"Trend & momentum","Пробой диапазона":"Range breakout",
  "График на снимке":"Your chart","Пул инструментов":"Market scan","Положение свечей на снимке":"Candle positions on the image","Локальный анализ изображения":"Local image analysis",
  "Демотерминал Pocket Option · запись 18.11.2026":"Pocket Option terminal · recorded 18.11.2026",
  "Pocket Option · публичный демотерминал":"Pocket Option · public terminal",
  "GetData · Forex, архив M1":"GetData · Forex M1 archive","OTC SNIPER · архив тиков Pocket Option":"Pocket Option OTC tick archive",
  "Средняя за 9 свечей пересекла среднюю за 21 снизу вверх.":"The 9-candle average crossed above the 21-candle average.",
  "Средняя за 9 свечей пересекла среднюю за 21 сверху вниз.":"The 9-candle average crossed below the 21-candle average.",
  "Нет нового пересечения средних с подтверждением RSI.":"No fresh average cross confirmed by RSI.",
  "Средние, RSI и изменение цены за две свечи согласованы.":"Averages, RSI and the two-candle price change agree.",
  "Средние, RSI и изменение цены за две свечи не дают общего направления.":"Averages, RSI and the two-candle price change do not agree.",
  "Свеча закрылась выше максимума предыдущих 20 свечей.":"The candle closed above the high of the previous 20 candles.",
  "Свеча закрылась ниже минимума предыдущих 20 свечей.":"The candle closed below the low of the previous 20 candles.",
  "Свеча закрылась внутри диапазона предыдущих 20 свечей.":"The candle closed inside the range of the previous 20 candles.",
  "Источник текущих котировок ещё не подключён.":"The live quote feed is not connected yet.",
  "Терминал перестал присылать новые тики. Ожидаем восстановления потока.":"The terminal stopped sending ticks. Waiting for the feed to resume.",
  "Источник отмечает инструмент как недоступный для торговли.":"This instrument is currently closed for trading.",
  "Время свечей не подходит для нового сигнала. Ждём свежее закрытие.":"Waiting for the next candle close.",
  "С этого сервера не удалось открыть публичный демотерминал Pocket Option. Подключаемся повторно.":"Could not reach the Pocket Option terminal. Reconnecting.",
  "Терминал сейчас пометил инструмент недоступным.":"The terminal marked this instrument as unavailable.",
  "Терминал не открыл график этой пары. Пробуем снова.":"The terminal did not open this chart. Retrying.",
  "Открываем график в публичном демотерминале Pocket Option.":"Opening the chart in the Pocket Option terminal.",
  "Ожидаем первый подтверждённый ряд котировок от терминала.":"Waiting for the first confirmed quotes from the terminal.",
  "Источник не предоставил непрерывный ряд завершённых свечей по этому активу.":"The feed has no continuous closed candles for this asset yet.",
  "Пришлите крупнее один график с красными и зелёными свечами.":"Upload a larger image of one chart with red and green candles.",
  "Вижу несколько участков со свечами. Выделите один график до правого края.":"Several candle areas found. Crop one chart up to its right edge.",
  "Правый край ряда прерывается. Выделите последние свечи целиком или пришлите другой масштаб.":"The right edge is cut off. Crop the latest candles fully or use another zoom.",
  "Для выбранного правила нужно 22 завершённые свечи.":"This method needs 22 closed candles.",
  "Первый записанный тик":"First recorded tick","Открытие свечи":"Candle open",
  "Совпало":"Matched","Не совпало":"Did not match","Равная цена":"Equal price",
  "Нет близкой котировки для входа или экспирации в этой записи.":"No nearby quote for entry or expiry in this record.",
  "Пробный сигнал использован.":"Trial signal used.","Лимит сигналов обновится в 00:00 UTC.":"Signal quota resets at 00:00 UTC.",
  "Лимит фото обновится в 00:00 UTC.":"Chart quota resets at 00:00 UTC.","Подождите минуту перед новым анализом.":"Please wait a minute before the next analysis.",
  "Ручной выбор открывается на уровне Expert.":"Manual selection opens at the Expert level.","Разбор фото открывается на уровне Advanced.":"Chart analysis opens at the Advanced level.",
  "Пришлите снимок до 6 МБ.":"Upload an image up to 6 MB.","Этот снимок уже обрабатывается.":"This image is already being analyzed.",
  "Срок сигнала истёк до выдачи.":"The signal expired before delivery.","В архиве мало непрерывных свечей для такого интервала.":"Not enough continuous candles for this interval.",
  "Не удалось открыть изображение.":"The image could not be opened.","Проверьте границы выделенной области.":"Check the crop boundaries.","Увеличьте выделенную область графика.":"Make the crop area larger.",
};
const tr = (text) => {
  if (text == null) return text;
  const s = String(text);
  if (EN[s]) return EN[s];
  let m;
  if ((m = s.match(/^Из последних семи изменений закрытия вверх — (\d+), вниз — (\d+), без изменения — (\d+)\. Крайняя правая свеча исключена\.$/)))
    return `Last seven closes: ${m[1]} up, ${m[2]} down, ${m[3]} flat. The open right-most candle is excluded.`;
  if ((m = s.match(/^Для анализа нужны 22 закрытые свечи\. Получено: (\d+)\.$/))) return `Analysis needs 22 closed candles. Received: ${m[1]}.`;
  if (/Heikin Ashi/.test(s)) return "This looks like a Heikin Ashi chart. Switch the terminal to regular candles.";
  if (/двух пикселей/.test(s)) return "The breakout is too close to the range edge to read on this image.";
  return s;
};
// Without the live Pocket Option feed (plain local start), the local preview reads the recorded market instead.
const dataMode = () => (state?.staticMode || (state?.local && state?.liveFeed === false) ? "archive" : "live");
const esc = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const period = (n) => (n < 60 ? n + " sec" : n / 60 + " min");
const date = (t) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(t * 1000) + " UTC";
const notice = (msg) => {
  $("notice").textContent = msg;
};
let state,
  tg,
  homeMarket = "fx",
  homeVersion = 0,
  photoFile,
  photoUrl,
  photoContext = null,
  photoVersion = 0,
  photoRequest,
  crop = null,
  anchor = null,
  picking = false,
  previewVersion = 0,
  nextTimer;
let prefs = {};
try {
  prefs = JSON.parse(localStorage.getItem("gorgias-prefs") || "{}");
} catch {}
const remember = () => {
  try {
    localStorage.setItem("gorgias-prefs", JSON.stringify(prefs));
  } catch {}
};

async function api(endpoint, body = {}) {
  if (window.PARALLAX_STATIC) return window.PARALLAX_STATIC(endpoint, body);
  const res = await fetch("/api/" + endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init": tg?.initData || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(tr(data.error) || "The request could not be completed.");
  return data;
}
function requestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // Browsers on local Wi-Fi expose getRandomValues over HTTP.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
function options() {
  return {
    market: $("asset").value,
    rule: $("rule").value,
    tf: Number($("tf").value),
    expiry: Number($("expiry").value),
    mode: dataMode(),
  };
}
function fill(select, items, selected) {
  select.replaceChildren(...items.map(([v, label]) => new Option(label, v)));
  if (items.some(([v]) => String(v) === String(selected)))
    select.value = selected;
}
function updateAssets() {
  const market = document.querySelector('input[name="venue"]:checked').value;
  const items = Object.entries(state.markets)
    .filter(([, v]) => (v.base === 5) === (market === "otc"))
    .filter(([key]) => !state.liveMarkets || state.liveMarkets.includes(key))
    .sort(
      ([a], [b]) =>
        Number(state.favorites.includes(b)) -
        Number(state.favorites.includes(a)),
    );
  fill(
    $("asset"),
    items.map(([v, item]) => [
      v,
      (state.favorites.includes(v) ? "★  " : "") + item.name,
    ]),
    prefs[market],
  );
  fill(
    $("tf"),
    (market === "otc" ? [5, 15, 60] : [60, 300]).map((v) => [
      v,
      period(v),
    ]),
    prefs[market + "Tf"],
  );
  updateExpiry();
  updateStar();
}
function updateExpiry() {
  const tf = Number($("tf").value);
  fill(
    $("expiry"),
    [tf, tf * 2, tf * 3].map((v) => [v, period(v)]),
    prefs.expiry,
  );

}
function updateStar() {
  assetChoices();
  const on = state.favorites.includes($("asset").value);
  $("star").textContent = on ? "★" : "☆";
  $("star").setAttribute("aria-pressed", on);
}
function chart(canvas, candles, meta = {}) {
  if (!canvas || !candles?.length) return;
  const width=Math.max(260,canvas.clientWidth||420), height=190;
  const dpr=Math.min(window.devicePixelRatio||1,3);
  canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
  canvas.style.height=height+"px";
  const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
  const relative=meta.mode==="photo", left=8, right=width-(relative?10:64), top=12, bottom=height-25;
  const high=Math.max(...candles.map(c=>c[1])),low=Math.min(...candles.map(c=>c[2]));
  const pad=(high-low)*.08 || Math.max(Math.abs(high)*.0001,.00001);
  const hi=high+pad,lo=low-pad, y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  const fmt=v=>v.toFixed(high>1000?2:high>10?3:5);
  ctx.fillStyle="#0c101a";ctx.fillRect(0,0,width,height);ctx.font="10px Consolas, monospace";
  for(let i=0;i<=3;i++){
    const v=lo+(hi-lo)*i/3, yy=y(v);
    ctx.strokeStyle="#242836";ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();
    if(!relative){ctx.fillStyle="#9da6ba";ctx.fillText(fmt(v),right+5,yy+3);}
  }
  const step=(right-left)/candles.length;
  candles.forEach(([o,h,l,c],i)=>{
    const x=left+(i+.5)*step;
    ctx.fillStyle=ctx.strokeStyle=c>=o?"#6ee0c1":"#ee879d";
    ctx.beginPath();ctx.moveTo(x,y(h));ctx.lineTo(x,y(l));ctx.stroke();
    ctx.fillRect(x-step*.3,Math.min(y(o),y(c)),Math.max(1,step*.6),Math.max(1,Math.abs(y(o)-y(c))));
  });
  const close=candles[candles.length-1][3],accent=getComputedStyle(document.documentElement).getPropertyValue("--gold").trim()||"#b998ff";
  ctx.strokeStyle=accent;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(left,y(close));ctx.lineTo(right,y(close));ctx.stroke();ctx.setLineDash([]);
  if(!relative){ctx.fillStyle=accent;ctx.fillRect(right,y(close)-7,width-right,14);ctx.fillStyle="#0c101a";ctx.fillText(fmt(close),right+5,y(close)+3);}
  ctx.fillStyle="#9da6ba";
  if(meta.time && meta.tf){const clock=t=>new Date(t*1000).toISOString().slice(11,19);ctx.fillText(clock(meta.time-candles.length*meta.tf),left,height-5);ctx.textAlign="right";ctx.fillText(clock(meta.time)+" UTC",right,height-5);}
  else ctx.fillText("Candles: "+candles.length,left,height-5);
}
function resultHTML(r) {
  const direction=r.direction, photo=r.mode==="photo", title=names[direction]||"Result";
  const arrow=direction==="up"?"↑":direction==="down"?"↓":"◇";
  const source=photo?(r.source?.includes("OpenAI")?"AI vision":"Chart vision"):(r.asset?.includes("OTC")?"OTC":"Standard");
  const detail=(r.historical?'<p class="historical">Historical example: recorded candles'+(r.time?' from '+esc(date(r.time)):'')+'. Live quotes are not connected in this version.</p>':'')+[r.reason,r.detail].filter(Boolean).map(x=>'<p>'+esc(tr(x))+'</p>').join('');
  const rows=[["Source",tr(r.source)],["Data",r.mode==="archive"?modes.archive:""],["Method",tr(r.rule)],["Candle interval",r.tf?period(r.tf):""],["Market time",r.time?date(r.time):""],["Candles read",r.count],["Closed candles",r.closedCount]].filter(([,v])=>v);
  return '<article class="result-card"><div class="result-head"><strong>'+esc(tr(r.asset)||"Your chart")+'</strong><small>'+source+'</small></div><div class="result-direction '+esc(direction)+'"><span aria-hidden="true">'+arrow+'</span>'+esc(title)+'</div><div class="result-meta"><div><small>Expiry</small><b>'+esc(r.expiry?period(r.expiry):photo?"Next candle":"—")+'</b></div><div><small>Market</small><b>'+esc(source)+'</b></div><div><small>Method</small><b>'+(r.source?.includes("OpenAI")?"AI vision":"Technical")+'</b></div></div></article><div class="result-note">'+detail+'</div><details class="result-details"><summary>Analysis details</summary>'+(r.candles?'<canvas aria-label="Analyzed candles" role="img"></canvas>':'')+'<dl>'+rows.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+'</dl></details>';
}
function renderResult(target, r) {
  target.innerHTML = resultHTML(r);
  chart(target.querySelector("canvas"), r.candles,r);
}
function revealResult(panel) {
  if (
    window.matchMedia("(max-width: 700px)").matches &&
    !panel.closest(".page")?.hidden
  )
    panel.scrollIntoView({ block: "start", behavior: "auto" });
}
function offerPhoto(panel, selection) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scan";
  button.textContent =
    "Analyze a screenshot of " + state.markets[selection.market].name;
  button.onclick = () => {
    $("file").value = "";
    selectPhoto(null);
    photoContext = { market: selection.market, tf: selection.tf };
    $("photo-rule").value = selection.rule;
    $("photo-context").textContent =
      "Selected asset · " +
      state.markets[selection.market].name +
      " · " +
      period(selection.tf);
    $("photo-context").hidden = false;
    $("clear-context").hidden = false;
    location.hash = "photo";
  };
  panel.append(button);
}
async function preview(refresh = false) {
  if (!selectedAsset) { $("signal-output").textContent="Select an instrument to check its market connection."; return; }
  const version = ++previewVersion,
    o = options();
  clearTimeout(nextTimer);
  const panel=$("signal-output");
  if (!refresh) panel.textContent="Checking the latest closed candles…";
  try {
    const p = await api("preview", o);
    if (version !== previewVersion) return;
    if (o.mode === "live") {
      panel.innerHTML =
        '<div class="label">Live market</div><h2>' +
        esc(p.asset) +
        "</h2><p>" +
        esc(tr(p.reason)) +
        "</p>";
      if(p.candles?.length){const canvas=document.createElement("canvas");canvas.setAttribute("aria-label","Latest candles "+p.asset);panel.append(canvas);chart(canvas,p.candles,{time:p.time,tf:o.tf});}
      if (p.available) {
        const stamp = document.createElement("small");
        stamp.textContent =
          date(p.time) +
          " · " +
          tr(p.source) +
          (p.payoutPct ? " · Payout " + p.payoutPct + " %" : "");
        panel.append(stamp);
      } else offerPhoto(panel, o);
      return;
    }
    const m = state.markets[o.market];
    panel.innerHTML = '<div class="label">Recorded market</div><h2>' + esc(m?.name) + "</h2><p>Signals here replay recorded candles from " + esc(m?.source) + ". This is a historical example, not a live quote.</p>";
    return;
  } catch (e) {
    if (version === previewVersion) panel.textContent = e.message;
  } finally {
    if (version === previewVersion && !$("signal").hidden && !document.hidden) {
      nextTimer = setTimeout(() => preview(true), Math.max(3000, Math.min(o.tf*1000, 15000)));
    }
  }
}
function submitSignal(e) {
  e.preventDefault();
  if (!selectedAsset || $("generate").disabled) return;
  runSignal("signal",{...options(),scan:e.submitter?.id==="scan"});
}
const cropInputs = ["crop-left", "crop-top", "crop-right", "crop-bottom"];
function drawBox(element, box) {
  element.hidden = !box;
  if (!box) return;
  const [left, top, right, bottom] = box;
  Object.assign(element.style, {
    left: left * 100 + "%",
    top: top * 100 + "%",
    width: (right - left) * 100 + "%",
    height: (bottom - top) * 100 + "%",
  });
}
function resetPhotoResult() {
  photoVersion++;
  photoRequest=null;
  $("bounds").hidden = true;
  $("photo-output").innerHTML =
    "<h2>Chart analysis</h2><p>Upload a chart, then select Analyze chart.</p>";
}
function setCrop(box) {
  crop = box;
  anchor = null;
  picking = false;
  $("preview").classList.remove("selecting");
  $("pick-crop").setAttribute("aria-pressed", "false");
  drawBox($("crop-box"), box);
  $("clear-crop").hidden = !box;
  $("crop-hint").textContent = box ? "The selected area will be analyzed." : "";
  $("crop-fields").hidden = !box;
  cropInputs.forEach((id, i) => {
    $(id).value = Number(((box || [0, 0, 1, 1])[i] * 100).toFixed(3));
  });
  resetPhotoResult();
}
function bindCrop() {
  const preview = $("preview");
  const point = (e) => {
    const rect = preview.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    ];
  };
  const rectangle = (a, b) => [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
  const largeEnough = (b) =>
    (b[2] - b[0]) * $("photo-img").naturalWidth >= 48 &&
    (b[3] - b[1]) * $("photo-img").naturalHeight >= 32;
  $("pick-crop").onclick = () => {
    if (picking) {
      setCrop(crop);
      return;
    }
    picking = true;
    anchor = null;
    preview.classList.add("selecting");
    $("pick-crop").setAttribute("aria-pressed", "true");
    $("crop-fields").hidden = false;
    $("crop-hint").textContent =
      "Mark two opposite corners or drag a crop box. Keep the latest candle visible.";
  };
  $("clear-crop").onclick = () => setCrop(null);
  preview.onpointerdown = (e) => {
    if (!picking || !e.isPrimary || e.button !== 0) return;
    preview.setPointerCapture(e.pointerId);
    if (!anchor) anchor = point(e);
  };
  preview.onpointermove = (e) => {
    if (picking && anchor && e.isPrimary)
      drawBox($("crop-box"), rectangle(anchor, point(e)));
  };
  preview.onpointerup = (e) => {
    if (!picking || !anchor || !e.isPrimary) return;
    const box = rectangle(anchor, point(e));
    if (largeEnough(box)) setCrop(box);
  };
  preview.onpointercancel = () => {
    if (picking) setCrop(crop);
  };
  preview.ondragstart = () => false;
  $("apply-crop").onclick = () => {
    const box = cropInputs.map((id) => $(id).valueAsNumber / 100);
    if (
      box.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      !largeEnough(box)
    ) {
      $("crop-hint").textContent =
        "Select an area of at least 48 × 32 pixels.";
      return;
    }
    setCrop(box);
  };
}
function selectPhoto(file) {
  photoFile = file;
  notice("");
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = file ? URL.createObjectURL(file) : null;
  setCrop(null);
  $("preview").hidden = $("crop-controls").hidden = !file;
  if (photoUrl) $("photo-img").src = photoUrl;
  else $("photo-img").removeAttribute("src");
}

async function submitPhoto(e) {
  e.preventDefault();
  const file = photoFile;
  if (!file) {
    notice("Choose a chart image first.");
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    notice("Choose an image up to 6 MB.");
    return;
  }
  const btn = $("read-photo");
  if (picking) {
    $("crop-hint").textContent =
      "Finish selecting the crop area first.";
    return;
  }
  if(btn.disabled)return;
  const version = ++photoVersion;
  showActivity("Reading your chart", "Processing the selected chart area…", true);
  btn.disabled = true;
  notice("");
  try {
    const reader = new FileReader();
    const b64 = await new Promise((res, rej) => {
      reader.onload = () => res(reader.result.split(",")[1]);
      reader.onerror = () => rej(new Error("The image could not be read."));
      reader.readAsDataURL(file);
    });
    if(version!==photoVersion)return;
    const r = await api("photo", {
      image: b64,
      rule: $("photo-rule").value,
      crop,
      context: photoContext,
      request: photoRequest ||= requestId(),
    });
    if (version !== photoVersion) return;
    await completeActivity(r);
    renderResult($("photo-output"), r);
    drawBox($("bounds"), r.box);
    revealResult($("photo-output"));
  } catch (err) {
    if (version === photoVersion) notice(err.message);
  } finally {
    hideActivity();
    btn.disabled = false;
    try { state=await api("init");refreshPanel(); } catch {}
  }
}
function table(labels, rows) {
  if (!rows.length) return '<p class="hint">Записей пока нет.</p>';
  return (
    "<table><thead><tr>" +
    labels.map((v) => "<th>" + v + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows
      .map(
        (row) =>
          "<tr>" + row.map((v) => "<td>" + v + "</td>").join("") + "</tr>",
      )
      .join("") +
    "</tbody></table>"
  );
}
async function admin() {
  const d = await api("admin");
  $("links").innerHTML = table(
    [
      "Кампания",
      "Переходы",
      "Открыли впервые",
      "К брокеру",
      "Регистрации",
      "Депозиты",
      "",
    ],
    d.campaigns.map((c) => [
      '<a href="/r/' +
        encodeURIComponent(c.slug) +
        '" target="_blank" rel="noopener">' +
        esc(c.title) +
        "</a>",
      c.visits,
      c.opens,
      c.clicks,
      d.lastReport ? c.registrations : "—",
      d.lastReport ? c.deposits : "—",
      '<button class="copy" data-slug="' +
        esc(c.slug) +
        '">Копировать</button> <button class="edit" data-slug="' +
        esc(c.slug) +
        '">Изменить</button>',
    ]),
  );
  $("links")
    .querySelectorAll(".copy")
    .forEach(
      (b) =>
        (b.onclick = async () => {
          const url =
            location.origin + "/r/" + encodeURIComponent(b.dataset.slug);
          try {
            await navigator.clipboard.writeText(url);
            notice("Ссылка скопирована.");
          } catch {
            notice(url);
          }
        }),
    );
  $("links")
    .querySelectorAll(".edit")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const c = d.campaigns.find((x) => x.slug === b.dataset.slug);
          $("slug").value = c.slug;
          $("target").value = c.target;
          $("link-title").value = c.title;
          $("link-title").focus();
        }),
    );
  $("members").innerHTML = table(
    ["User", "ID", "Campaign", "Joined", "Access", "Signals"],
    d.users.map((u) => [
      esc(u.name),
      esc(u.id),
      esc(u.campaign),
      date(u.first_seen),
      '<select class="level-select" data-uid="'+esc(u.id)+'">'+["Automatic",...tierOrder].map(t=>'<option'+(t===u.override?' selected':'')+'>'+t+'</option>').join("")+'</select>',
      '<button class="grant" data-uid="'+esc(u.id)+'">+1 signal</button>',
    ]),
  );
  for(const select of $("members").querySelectorAll(".level-select")){
    select.onchange=async()=>{
      select.disabled=true;
      try{
        await api("admin/level",{uid:select.dataset.uid,tier:select.value,request:requestId()});
        state=await api("init");refreshPanel();
        notice("Access updated.");
      }catch(e){notice(e.message);}
      finally{select.disabled=false;}
    };
  }
  for(const button of $("members").querySelectorAll(".grant")){
    button.onclick=async()=>{
      button.disabled=true;
      button.dataset.request ||= requestId();
      try{
        const result=await api("admin/free-signal",{uid:button.dataset.uid,request:button.dataset.request});
        delete button.dataset.request;
        notice("Сигнал добавлен. Остаток: "+result.remaining);
      }catch(e){notice(e.message);}
      finally{button.disabled=false;}
    };
  }
  $("deposits").innerHTML = d.lastReport
    ? table(
        ["Пользователь", "Сумма", "Дата"],
        d.deposits.map((x) => [esc(x.uid), esc(x.amount), date(x.time)]),
      )
    : '<p class="hint">Партнёрский отчёт пока не загружен.</p>';
}
async function navigate(name) {
  const token=++navigationId;
  const level=tierOrder.find(t=>t.toLowerCase()===name);
  if(level){pickedTier=level;name="tier";}
  if(!["home","register","access","tier","signal","photo","history","admin","profile","auto","decision"].includes(name)||(name==="admin"&&!state.admin))name="home";
  if(name==="signal"&&!state.access.manual){pickedTier="Expert";name="tier";}
  if(name==="photo"&&state.access.photoLimit===0){pickedTier="Advanced";name="tier";}
  if(!state.registered&&name!=="admin")name="register";
  if(name==="decision"&&!lastDecision)name="home";
  if(currentPage)scrollPositions[currentPage]=window.scrollY;
  const moving=currentPage&&currentPage!==name&&!matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(moving){$("page-transition").hidden=false;await pause(180);}
  if(token!==navigationId)return;
  document.querySelectorAll(".page").forEach(p=>p.hidden=p.id!==name);
  $("page-transition").hidden=true;
  if(moving)$(name).animate([{opacity:0,transform:"translateY(6px)"},{opacity:1,transform:"none"}],{duration:240});
  currentPage=name;
  const tabPage=["home","register","history","profile"].includes(name);
  $("page-back").hidden=tabPage;
  if(name!=="signal"){clearTimeout(nextTimer);previewVersion++;}
  document.querySelectorAll("[data-tab]").forEach(b=>{
    const section=name==="history"?"history":["profile","access","tier","admin"].includes(name)?"profile":"home";
    b.classList.toggle("active",b.dataset.tab===section);b.setAttribute("aria-current",b.dataset.tab===section?"page":"false");
  });
  if(tg?.initData&&tg.isVersionAtLeast("6.1")){if(tabPage)tg.BackButton.hide();else tg.BackButton.show();}
  if(name==="tier")tierActions(pickedTier||state.access.tier);
  window.scrollTo(0,["home","profile"].includes(name)?scrollPositions[name]||0:0);
  notice("");
  try {
    if(["home","profile","auto","history"].includes(name)){const next=await api("init");if(token!==navigationId)return;state=next;refreshPanel();}
    if(name==="decision"&&lastDecision)finishDecision(lastDecision);
    if(name==="signal"){assetChoices();await preview();}
    if(name==="history"){
      const all=await api("history");if(token!==navigationId)return;
      $("history-list").innerHTML=all.length?all.map((r,i)=>'<details class="hist"><summary><span>'+esc(tr(r.asset))+' · '+esc(names[r.direction]||r.direction)+'</span><small>'+esc(r.mode==="photo"?"Chart analysis":(r.expiry?period(r.expiry):"Market scan"))+' · '+esc(date(r.saved))+'</small></summary><div data-record="'+i+'"></div></details>').join(""):'<div class="empty-state">Your signals and chart analyses will appear here.</div>';
      $("history-list").querySelectorAll("details").forEach((d,i)=>d.ontoggle=()=>{if(d.open)renderResult(d.querySelector("[data-record]"),all[i]);});
    }
    if(name==="admin")await admin();
  }catch(e){if(token===navigationId)notice(e.message);}
}
let tierOrder = [];
let running = false, pendingRequest, lastQuery, lastDecision, pickedTier, assetFilter="All", expiryTimer, lastIssuedAt=-Infinity;
let category="Currency", selectedAsset=false, navigationId=0, currentPage, activityOpen=false;
const scrollPositions={};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function signalLabel(level) {
  if (level.name==="Free") return "1 trial signal";
  return level.signals===null ? "Unlimited signals" : "Signals per day — "+level.signals;
}
function photoLabel(limit) {
  return limit===null ? "Unlimited chart analyses" : limit===0 ? "Chart analyses from Advanced" : "Chart analyses per day — "+limit;
}
function populateLevels() {
  tierOrder=state.levels.map(l=>l.name);
  const cards=document.querySelector(".tiers"), links=document.querySelector(".tier-links");
  for(const [i,level] of state.levels.entries()){
    const icon=["observer","insider","insider","archon","archon","archon"][i];
    const button=document.createElement("button");
    button.dataset.tier=level.name;
    button.innerHTML='<i aria-hidden="true" class="sigil '+icon+'"></i><span><strong>'+esc(level.name)+'</strong><small>'+signalLabel(level)+'</small></span><em></em>';
    cards.append(button);
    const link=document.createElement("a");
    link.href="#"+level.name.toLowerCase();link.textContent=level.name;links.append(link);
  }
}
function refreshPanel() {
  const a=state.access;
  const signals=a.remaining===null ? "Unlimited signals" : (a.tier==="Free"?"Trial signals left — ":"Signals today — ")+a.remaining+" / "+a.limit;
  const photos=a.photoRemaining===null ? "Unlimited chart analyses" : a.photoLimit ? "Chart analyses today — "+a.photoRemaining+" / "+a.photoLimit : "Chart analyses from Advanced";
  ["home-allowance","profile-allowance"].forEach(id=>$(id).textContent=signals+" · "+photos);
  $("auto-allowance").textContent=signals;
  const from=(flag)=>{const l=state.levels.find(flag);return l?"Min. deposit $"+l.deposit+" · "+l.name:"";};
  const tag=(id,text,open)=>{const el=$(id);if(!el)return;el.textContent=text;el.classList.toggle("locked",!open);};
  tag("tag-auto",a.remaining===null?"Unlimited":a.remaining===0?(a.tier==="Free"?"Trial used":"Resets 00:00 UTC"):a.remaining+" left today",a.remaining!==0);
  tag("tag-signal",a.manual?"Included":from(l=>l.manual),a.manual);
  tag("tag-photo",a.photoRemaining===null?"Unlimited":a.photoLimit?a.photoRemaining+" left today":from(l=>l.photos!==0),a.photoLimit!==0);
  $("photo-allowance").textContent=photos;
  $("photo-source").textContent=state.photoProvider==="OpenAI" ? "Your selected chart area is analyzed with OpenAI." : "Candlestick recognition and technical analysis.";
  $("profile-tier").textContent=a.tier;
  $("profile-name").textContent=state.local?"Your workspace":state.profile?.name||"Trader";
  const days=Math.max(1,Math.floor((Date.now()/1000-(state.profile?.first_seen||Date.now()/1000))/86400)+1);
  $("profile-since").textContent="Day "+days+" of your journey";
  $("history-total").textContent=state.historyStats?.total||0;
  $("history-today").textContent=state.historyStats?.today||0;
  $("read-photo").disabled=activityOpen||a.photoRemaining===0;
  $("generate").disabled=running||!selectedAsset||a.remaining===0;
  $("auto-run").disabled = running || a.remaining===0;
  document.querySelectorAll("[data-tier]").forEach(b=>{
    const t=b.dataset.tier, locked=tierOrder.indexOf(t)>tierOrder.indexOf(a.tier);
    b.classList.toggle("locked",locked);
    b.querySelector("em").textContent=locked ? ("$"+state.levels.find(l=>l.name===t).deposit) : "→";
  });
  if(pickedTier && !$("tier").hidden) tierActions(pickedTier);
}
function tierActions(t) {
  pickedTier=t;
  const panel=$("tier-actions");
  const previous = panel.dataset.level;
  panel.dataset.level = t;
  for (const link of document.querySelectorAll(".tier-links a")) {
    link.setAttribute("aria-current", link.hash === "#" + t.toLowerCase() ? "page" : "false");
  }
  if (previous && previous !== t && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const step = tierOrder.indexOf(t) > tierOrder.indexOf(previous) ? 18 : -18;
    panel.animate([{opacity: .15, transform: "translateX(" + step + "px)"}, {opacity: 1, transform: "none"}], {duration: 260});
  }
  panel.hidden=false;
  panel.replaceChildren();
  const level=state.levels.find(l=>l.name===t);
  const [headline,story]={
    Free:["First perspective","Try your first signal and see the candles behind the direction."],
    Basic:["A daily perspective","One signal each day. Waiting for a setup keeps your allowance available."],
    Advanced:["Bring your chart","Upload your own chart. Chart analysis has its own daily allowance."],
    Professional:["Plan your session","Explore more setups and analyze several charts throughout the day."],
    Expert:["Take control","Choose an asset and expiry yourself, or let Parallax search the market."],
    Unlimited:["Full access","Move between signals, manual selection and chart analysis at your own pace."]
  }[t];
  const features=[signalLabel(level),photoLabel(level.photos)];
  if(level.manual)features.push("Manual asset selection");
  if(level.deposit && level.signals!==null)features.push("Resets at 00:00 UTC");
  panel.className="tier-dossier "+t.toLowerCase();
  panel.innerHTML='<div class="tier-hero"><i aria-hidden="true" class="sigil '+document.querySelector("[data-tier="+t+"] i").classList[1]+'"></i><span>'+headline+'</span><h1>'+t+'</h1></div><p class="tier-story">'+story+'</p><ul class="perks">'+features.map(f=>'<li>'+f+'</li>').join('')+'</ul>';
  const add=(label,act)=>{const b=document.createElement("button");b.className="scan";b.textContent=label;b.onclick=act;panel.append(b);};
  if(tierOrder.indexOf(t)>tierOrder.indexOf(state.access.tier)){
    const p=document.createElement("p");p.textContent="Unlocks with confirmed deposits totalling "+("$"+level.deposit)+".";panel.append(p);
    add("Open Pocket Option ↗",()=>$("broker").click());return;
  }
  add("Find a signal",()=>location.hash="auto");
  if(level.manual)add("Choose asset",()=>location.hash="signal");
  if(level.photos!==0)add("Analyze chart",()=>location.hash="photo");
  if(state.access.remaining===0){const p=document.createElement("p");p.textContent=state.access.tier==="Free"?"Trial signal used.":"Signal quota resets at 00:00 UTC.";panel.append(p);}

}
function setActivityStep(index, status, detail) {
  const item=$("analysis-steps").children[index];
  item.className=status;item.querySelector("small").textContent=detail||(status==="complete"?"Completed":status==="active"?"In progress…":"Pending");
  item.querySelector("i").textContent=status==="complete"?"✓":"";
}
function showActivity(title,detail,photo=false) {
  activityOpen=true;document.body.classList.add("analyzing");
  $("activity-title").textContent=title;$("activity-caption").textContent=detail;
  $("analysis-steps").children[1].querySelector("strong").textContent=photo?"Read the image":state?.staticMode?"Load recorded candles":"Receive market data";
  for(let i=0;i<5;i++)setActivityStep(i,i===0?"complete":i===1?"active":"",i===0?"Ready":undefined);
  $("activity").hidden=false;
  document.querySelectorAll(".page").forEach(p=>p.inert=true);
  $("activity-title").focus({preventScroll:true});
}
async function completeActivity(result) {
  if(!activityOpen)return;
  const failed=["unavailable","unreadable"].includes(result.direction);
  if(failed){setActivityStep(1,"active",result.direction==="unreadable"?"Image needs attention":"Waiting for fresh data");return;}
  const budget=result.validUntil?Math.max(0,Math.min(500,result.validUntil*1000-Date.now()-1200)):500;
  for(let i=1;i<5;i++){
    setActivityStep(i,"complete",i===3&&result.direction==="wait"?"No confirmed setup":undefined);
    if(i<4)setActivityStep(i+1,"active");
    if(budget&&!matchMedia("(prefers-reduced-motion: reduce)").matches)await pause(budget/4);
  }
}
function hideActivity(){
  activityOpen=false;$("activity").hidden=true;document.body.classList.remove("analyzing");
  document.querySelectorAll(".page").forEach(p=>p.inert=false);
}

function finishDecision(r) {
  clearTimeout(expiryTimer);
  if (r.validUntil && r.validUntil*1000<=Date.now()) {
    $("decision-heading").textContent="Signal expired.";$("decision-card").innerHTML='<div class="panel"><h2>A fresh perspective.</h2><p>This entry window has closed. Request a new signal.</p></div>';return;
  }
  $("decision-heading").textContent=r.historical?(["up","down"].includes(r.direction)?"Historical example.":"No setup in this example."):["up","down"].includes(r.direction)?"Signal ready.":r.direction==="wait"?"Patience is a choice.":"Market connection.";
  renderResult($("decision-card"),r);
  if(r.validUntil) expiryTimer=setTimeout(()=>finishDecision(r),Math.max(1,r.validUntil*1000-Date.now()+10));
}
async function runSignal(endpoint,body) {
  if(running || (location.hash==="#decision" && performance.now()-lastIssuedAt<400))return;
  running=true;
  const from=location.hash;
  const key=JSON.stringify([endpoint,body]);
  if(pendingRequest?.key!==key)pendingRequest={key,id:requestId()};
  if(state?.staticMode)showActivity("Reading recorded candles","Replaying recorded market candles in your browser…");
  else showActivity(endpoint==="auto"?"Scanning the market":"Analyzing your setup","Reading the latest available candles…");
  try{
    const r=await api(endpoint,{...body,request:pendingRequest.id});
    await completeActivity(r);
    pendingRequest=null;
    lastQuery={endpoint,body};lastDecision=r;
    lastIssuedAt=performance.now();
    if(location.hash===from){finishDecision(r);location.hash="decision";}
  }catch(e){notice(e.message);}
  finally{
    running=false;hideActivity();
    try{state=await api("init");refreshPanel();}catch{}
  }
}
function assetChoices(){
  const list=$("asset-list"),chips=$("asset-filter");
  if(!list)return;
  $("expiry-chips").replaceChildren();
  for(const option of $("expiry").options){
    const b=document.createElement("button");b.type="button";b.textContent=option.textContent;b.setAttribute("aria-pressed",String(option.selected));
    b.onclick=()=>{$("expiry").value=option.value;$("expiry").dispatchEvent(new Event("change",{bubbles:true}));};$("expiry-chips").append(b);
  }
  chips.replaceChildren();list.replaceChildren();
  for(const label of ["All","Favorites","Major","Minor","Exotic"]){
    const b=document.createElement("button");b.type="button";b.textContent=label;b.setAttribute("aria-pressed",String(label===assetFilter));b.onclick=()=>{assetFilter=label;assetChoices();};chips.append(b);
  }
  for(const o of $("asset").options){
    const item=state.markets[o.value],fav=state.favorites.includes(o.value),isCrypto=item.name.startsWith("BTC");
    if(category!==(isCrypto?"Crypto":"Currency"))continue;
    const group=item.name.includes("USD")?"Major":"Minor";
    if(assetFilter!=="All"&&!(assetFilter==="Favorites"?fav:assetFilter===group))continue;
    const row=document.createElement("div");row.className="instrument";
    const star=document.createElement("button");star.type="button";star.textContent=fav?"★":"☆";star.setAttribute("aria-label","Favorite "+item.name);star.setAttribute("aria-pressed",String(fav));
    star.onclick=async()=>{star.disabled=true;try{await api("favorite",{asset:o.value,on:!fav});state.favorites=state.favorites.filter(x=>x!==o.value);if(!fav)state.favorites.push(o.value);updateStar();}catch(e){notice(e.message);star.disabled=false;}};
    const flags={EUR:"🇪🇺",USD:"🇺🇸",GBP:"🇬🇧",JPY:"🇯🇵",AUD:"🇦🇺",CAD:"🇨🇦",BTC:"₿"};
    const pair=item.name.split(" ")[0].split("/");
    const pick=document.createElement("button");pick.type="button";pick.className="asset-pick";pick.innerHTML='<span class="asset-flags" aria-hidden="true">'+pair.map(x=>flags[x]||'').join('')+'</span><span>'+esc(item.name)+'<small>'+group+'</small></span><b aria-hidden="true">›</b>';pick.setAttribute("aria-pressed",String(selectedAsset&&$("asset").value===o.value));pick.onclick=()=>{selectedAsset=true;$("asset").value=o.value;$("asset").dispatchEvent(new Event("change",{bubbles:true}));};
    row.append(star,pick);list.append(row);
  }
  if(!list.childElementCount)list.innerHTML='<div class="empty-state">'+(assetFilter==="Favorites"?"Tap a star to save an instrument here.":"No connected instruments in this category yet.")+'</div>';
  $("generate").disabled=running||!selectedAsset||state.access.remaining===0;
}

function bindPanel(){
  document.querySelectorAll("[data-tier]").forEach(b=>b.onclick=()=>{location.hash=b.dataset.tier.toLowerCase();});
  $("again").onclick=()=>{if(lastQuery)runSignal(lastQuery.endpoint,lastQuery.body);};
  $("change-options").onclick=()=>location.hash=lastQuery?.endpoint==="auto"?"auto":"signal";
  $("auto-run").onclick=()=>runSignal("auto",{mode:dataMode()});
  $("auto-hint").textContent=state.staticMode?"Replays recorded market candles until a method finds a setup. Results are historical examples, not live signals.":"Search current candles for a setup. Your allowance is used only when a direction is found.";
  $("profile-broker").onclick=()=>$("broker").click();
  const applyTheme=(theme)=>{document.documentElement.dataset.theme=prefs.theme=["violet","graphite","amber"].includes(theme)?theme:"violet";$("theme-label").textContent=$("profile-theme").textContent=prefs.theme[0].toUpperCase()+prefs.theme.slice(1);document.querySelectorAll("[data-color]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.color===prefs.theme)));remember();};
  document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>applyTheme(b.dataset.color));
  applyTheme(prefs.theme);
  $("page-back").onclick=()=>{location.hash=["access","tier","admin"].includes(currentPage)?"profile":"home";};
  document.querySelectorAll("[data-category]").forEach(b=>b.onclick=()=>{category=b.dataset.category;selectedAsset=false;document.querySelectorAll("[data-category]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));assetChoices();});
  refreshPanel();
}

const GATE_ART = '<svg class="gate" viewBox="0 0 400 340" preserveAspectRatio="xMaxYMid slice"><defs><radialGradient id="gate-glow" cx="72%" cy="48%" r="45%"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.42"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient><linearGradient id="gate-core" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.05"/><stop offset=".55" style="stop-color:var(--accent);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.9"/></linearGradient><linearGradient id="gate-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient><filter id="gate-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="400" height="340" fill="url(#gate-glow)"/><g class="gate-rays"><rect x="214" y="0" width="1" height="290" opacity="0.25"/><rect x="236" y="0" width="2" height="290" opacity="0.18"/><rect x="342" y="0" width="1" height="290" opacity="0.3"/><rect x="366" y="0" width="2" height="290" opacity="0.14"/><rect x="382" y="0" width="1" height="290" opacity="0.22"/></g><g class="gate-layer far"><rect class="frame" x="218" y="34" width="150" height="256" rx="2"/></g><g class="gate-layer mid"><rect class="frame" x="242" y="70" width="102" height="220" rx="2"/></g><g class="gate-layer near"><rect class="core" x="268" y="108" width="50" height="182" fill="url(#gate-core)"/><rect class="frame bright" x="268" y="108" width="50" height="182" rx="1"/><rect class="frame bright" x="268" y="108" width="50" height="182" rx="1" filter="url(#gate-blur)"/></g><rect x="120" y="289" width="280" height="1.5" class="horizon"/><path d="M268 291 L318 291 L360 340 L226 340 Z" fill="url(#gate-floor)" opacity=".8"/><ellipse cx="292" cy="296" rx="120" ry="14" class="mist" filter="url(#gate-blur)"/></svg>';
async function init() {
  document.querySelectorAll(".hero-art,.analysis-art").forEach(e=>e.insertAdjacentHTML("afterbegin",GATE_ART));
  const brand=window.PARALLAX_BRAND;document.title=brand.name;
  document.querySelectorAll("[data-brand]").forEach(e=>e.textContent=brand.wordmark);
  document.querySelectorAll("[data-brand-name]").forEach(e=>e.textContent=brand.name);
  document.querySelectorAll("[data-quote]").forEach((el,i)=>{const q=window.PARALLAX_QUOTES[i%window.PARALLAX_QUOTES.length];el.querySelector("p").textContent="“"+q.text+"”";el.querySelector("cite").innerHTML='<a href="'+q.url+'" target="_blank" rel="noopener">'+esc(q.author)+' · '+esc(q.work)+'</a>';});
  if (!document.documentElement.hasAttribute("data-guest") && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://telegram.org/js/telegram-web-app.js";
      s.onload = resolve;
      s.onerror = () => window.PARALLAX_STATIC ? resolve() : reject(new Error("Telegram could not be loaded. Please reopen the app."));
      document.head.append(s);
    });
  }
  tg = window.Telegram?.WebApp;
  tg?.ready();
  tg?.expand();
  state = await api("init", {
    start: new URLSearchParams(location.search).get("start") || "",
  });
  populateLevels();
  bindPanel();
  $("admin-link").hidden = !state.admin;
  if (tg?.initData) {
    if (tg.isVersionAtLeast("6.9")) tg.setHeaderColor("#14191a");
    if (tg.isVersionAtLeast("7.10")) tg.setBottomBarColor("#192020");
    if (tg.isVersionAtLeast("6.1")) {
      tg.BackButton.onClick(() => {
        if (history.state?.gorgiasDepth > 0) history.back();
        else location.replace("#home");
      });
    }
  }
  if (prefs.venue === "otc")
    document.querySelector('[name="venue"][value="otc"]').checked = true;
  fill($("rule"), Object.entries(state.rules).map(([k,v])=>[k,tr(v)]), prefs.rule);
  fill($("photo-rule"), Object.entries(state.rules).map(([k,v])=>[k,tr(v)]), "trend");
  updateAssets();
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        location.hash = b.dataset.tab;
      }),
  );
  const pages = [
    "home","register","access",
    "signal",
    "photo",
    "history","auto","decision","profile",...tierOrder.map(t=>t.toLowerCase()),
    ...(state.admin ? ["admin"] : []),
  ];
  const fragment = location.hash.slice(1);
  let entry = new URLSearchParams(location.search).get("view");
  if(entry==="signal" && !state.access.manual)entry="auto";
  const initial = pages.includes(fragment)
    ? fragment
    : pages.includes(entry)
      ? entry
      : "home";
  let depth = history.state?.gorgiasDepth ?? 0;
  history.replaceState(
    { gorgiasDepth: depth },
    "",
    location.pathname + location.search + "#" + initial,
  );
  window.addEventListener("hashchange", () => {
    depth = history.state?.gorgiasDepth ?? depth + 1;
    history.replaceState({ gorgiasDepth: depth }, "");
    navigate(location.hash.slice(1));
  });
  $("request-form").onchange = (e) => {
    if (e.target.name === "venue") { selectedAsset=false;updateAssets(); }
    if (e.target.id === "tf") updateExpiry();
    updateStar();
    const venue = document.querySelector('[name="venue"]:checked').value,
      o = options();
    Object.assign(prefs, {
      venue,
      [venue]: o.market,
      [venue + "Tf"]: o.tf,
      expiry: o.expiry,
      rule: o.rule,
    });
    remember();
    preview();
  };
  $("request-form").onsubmit = submitSignal;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(nextTimer);
    else if (!$("signal").hidden) preview(true);
  });
  $("photo-form").onsubmit = submitPhoto;
  $("photo-rule").onchange = resetPhotoResult;
  $("clear-context").onclick = () => {
    photoContext = null;
    $("photo-context").hidden = true;
    $("clear-context").hidden = true;
    resetPhotoResult();
  };
  bindCrop();
  $("star").onclick = async () => {
    const a = $("asset").value,
      on = !state.favorites.includes(a);
    try {
      await api("favorite", { asset: a, on });
      state.favorites = state.favorites.filter((x) => x !== a);
      if (on) state.favorites.push(a);
      prefs[document.querySelector('[name="venue"]:checked').value] = a;
      updateAssets();
    } catch (e) {
      notice(e.message);
    }
  };
  $("file").onchange = () => selectPhoto($("file").files[0]);
  // Paste a copied screenshot: Ctrl+V anywhere on the chart screen, or long-press the paste field on a phone.
  const pasteImage = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.kind === "file" && /^image\/(png|jpeg|webp)$/.test(i.type));
    if (!item) { if (e.currentTarget === $("paste-zone")) { e.preventDefault(); notice("The clipboard has no image. Copy a screenshot first."); } return; }
    e.preventDefault();
    const blob = item.getAsFile();
    const file = new File([blob], "pasted-chart." + blob.type.split("/")[1], { type: blob.type });
    $("file").value = "";
    if (location.hash !== "#photo") location.hash = "photo";
    selectPhoto(file);
    $("paste-zone").textContent = "";
    notice("Screenshot pasted. Tap Analyze chart.");
  };
  $("paste-zone").addEventListener("paste", pasteImage);
  $("paste-zone").addEventListener("input", () => { $("paste-zone").textContent = ""; });
  document.addEventListener("paste", (e) => { if (!$("photo").hidden && e.target !== $("paste-zone")) pasteImage(e); });
  $("link-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("admin/link", {
        slug: $("slug").value,
        title: $("link-title").value,
        target: $("target").value,
      });
      e.target.reset();
      await admin();
      notice("Ссылка сохранена.");
    } catch (err) {
      notice(err.message);
    }
  };
  $("register-broker").onclick=()=>{prefs.registrationStarted=true;remember();$("register-continue").hidden=false;$("broker").click();};
  $("register-continue").hidden=!prefs.registrationStarted&&!state.admin;
  $("register-continue").onclick=async()=>{
    $("register-continue").disabled=true;
    try{
      await api("register");
      state=await api("init");refreshPanel();
      location.hash="home";
      await navigate("home");
    }catch(e){notice(e.message);}
    finally{$("register-continue").disabled=false;}
  };
  $("broker").onclick = async () => {
    try {
      const b = await api("broker");
      if (tg) tg.openLink(b.url);
      else location.assign(b.url);
    } catch (e) {
      notice(e.message);
    }
  };
  await navigate(initial);
}
init().catch((e) => {
  notice(e.message);
  document.querySelectorAll("form button").forEach((b) => (b.disabled = true));
});
