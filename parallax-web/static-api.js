"use strict";
// Parallax AI without a server. Everything runs in this browser:
// - signals: the same three rules as system/market.py, applied to RECORDED candles (historical examples);
// - chart analysis: a port of system/vision.py (local candle recognition, no AI service);
// - history and favorites: stored on this device only.
(() => {
  const RULES = { cross: "Moving average cross", trend: "Trend & momentum", "break": "Range breakout" };
  const LEVELS = [
    ["Free", 0, 1, 0], ["Basic", 50, 1, 0], ["Advanced", 150, 3, 1],
    ["Professional", 300, 5, 3], ["Expert", 500, 10, 6], ["Unlimited", 1000, null, null],
  ].map(([name, deposit, signals, photos]) => ({ name, deposit, signals, photos, manual: deposit >= 500 }));
  const BROKER = "https://pocketoption.com/";
  const KEY = "parallax-static";

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const now = () => Math.floor(Date.now() / 1000);

  let dataPromise;
  const candles = () => (dataPromise ||= fetch("data/candles.json").then((r) => {
    if (!r.ok) throw new Error("Recorded candles could not be loaded.");
    return r.json();
  }));

  // ---------- market.py ----------
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  function decision(bars, i, rule) {
    const win = bars.slice(i - 21, i + 1), closes = win.map((b) => b.c), cur = closes[closes.length - 1];
    const fast = avg(closes.slice(-9)), slow = avg(closes.slice(-21));
    const diffs = [];
    for (let k = closes.length - 14; k < closes.length; k++) diffs.push(closes[k] - closes[k - 1]);
    const motion = diffs.reduce((s, d) => s + Math.abs(d), 0);
    const rsi = motion ? 100 * diffs.reduce((s, d) => s + Math.max(0, d), 0) / motion : 50;
    let direction = "wait", text;
    if (rule === "cross") {
      const pf = avg(closes.slice(-10, -1)), ps = avg(closes.slice(-22, -1));
      if (pf <= ps && fast > slow && rsi > 50) direction = "up";
      else if (pf >= ps && fast < slow && rsi < 50) direction = "down";
      text = { up: "The 9-candle average crossed above the 21-candle average.",
               down: "The 9-candle average crossed below the 21-candle average.",
               wait: "No fresh average cross confirmed by RSI." }[direction];
    } else if (rule === "trend") {
      if (fast > slow && rsi >= 55 && cur > closes[closes.length - 3]) direction = "up";
      else if (fast < slow && rsi <= 45 && cur < closes[closes.length - 3]) direction = "down";
      text = "Averages, RSI and the two-candle price change " + (direction !== "wait" ? "agree." : "do not agree.");
    } else {
      const prior = win.slice(-21, -1);
      if (cur > Math.max(...prior.map((b) => b.h))) direction = "up";
      else if (cur < Math.min(...prior.map((b) => b.l))) direction = "down";
      text = "The candle closed " + { up: "above the high of the previous 20 candles.",
        down: "below the low of the previous 20 candles.", wait: "inside the range of the previous 20 candles." }[direction];
    }
    return [direction, text, Math.round(rsi * 10) / 10];
  }

  function sessions(market, tf) {
    const base = market.base;
    if (tf < base || tf % base) throw new Error("This timeframe is not available for this source.");
    const count = tf / base, out = [];
    for (const g of market.groups) {
      const bars = [];
      for (let i = 0; i + count <= g.o.length; i++) {
        const t = g.t0 + i * base;
        if (t % tf) continue;
        let h = -Infinity, l = Infinity;
        for (let k = i; k < i + count; k++) { h = Math.max(h, g.h[k]); l = Math.min(l, g.l[k]); }
        bars.push({ t, o: g.o[i], h, l, c: g.c[i + count - 1] });
      }
      if (bars.length >= 24) out.push(bars);
    }
    return out;
  }

  function checked(data, body) {
    const market = data.markets[body.market], rule = body.rule;
    if (!market || !RULES[rule]) throw new Error("Choose a market and a method.");
    const tf = Number(body.tf), expiry = Number(body.expiry);
    const allowed = market.base === 5 ? [5, 15, 60] : [60, 300];
    if (!allowed.includes(tf) || ![tf, tf * 2, tf * 3].includes(expiry))
      throw new Error("This timeframe and expiry combination is not available.");
    return { market, tf, expiry, rule };
  }

  // Search the recorded candles from a moving cursor until a rule gives a direction (like next_replay with scan).
  function replay(data, body, store) {
    const { market, tf, expiry, rule } = checked(data, body);
    const groups = sessions(market, tf);
    const lengths = groups.map((s) => Math.max(0, s.length - 22 - Math.floor(expiry / tf)));
    const total = lengths.reduce((a, b) => a + b, 0);
    if (!total) throw new Error("Not enough continuous candles for this interval.");
    const key = [body.market, tf, expiry, rule].join("|");
    store.cursors ||= {};
    let cursor = store.cursors[key] ?? Math.floor(Math.random() * total);
    let offset = cursor % total, group = 0;
    while (offset >= lengths[group]) { offset -= lengths[group]; group++; }
    const limit = Math.min(1000, total);
    let steps, bars, i, result;
    for (steps = 1; steps <= limit; steps++) {
      bars = groups[group]; i = 21 + offset;
      result = decision(bars, i, rule);
      if (result[0] !== "wait" || steps === limit) break;
      offset++;
      if (offset === lengths[group]) {
        group = (group + 1) % groups.length;
        while (!lengths[group]) group = (group + 1) % groups.length;
        offset = 0;
      }
    }
    store.cursors[key] = (cursor + steps) % total;
    const [direction, reason, rsi] = result;
    return {
      mode: "archive", historical: true, asset: market.name, source: market.source, direction, reason, rsi,
      rule: RULES[rule], tf, expiry, time: bars[i].t + tf, scanned: steps,
      candles: bars.slice(Math.max(0, i - 49), i + 1).map((b) => [b.o, b.h, b.l, b.c]),
    };
  }

  // ---------- vision.py ----------
  const pyRound = (x) => { const r = Math.round(x); return (Math.abs(x % 1) === 0.5 && r % 2) ? r - 1 : r; };
  const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const candle = (x, w, top, bottom, opening, closing, green) => ({ x, w, top, bottom, opening, closing, green, center: x + w / 2 });

  function toHsv(img) {
    const { width, height, data } = img, n = width * height;
    const H = new Uint8Array(n), S = new Uint8Array(n), V = new Uint8Array(n);
    for (let p = 0, q = 0; p < n; p++, q += 4) {
      const r = data[q], g = data[q + 1], b = data[q + 2];
      const v = Math.max(r, g, b), mn = Math.min(r, g, b), d = v - mn;
      V[p] = v;
      S[p] = v ? Math.round(d * 255 / v) : 0;
      let h = 0;
      if (d) {
        if (v === r) h = 60 * (g - b) / d;
        else if (v === g) h = 120 + 60 * (b - r) / d;
        else h = 240 + 60 * (r - g) / d;
        if (h < 0) h += 360;
      }
      H[p] = Math.round(h / 2) % 180;
    }
    return { width, height, H, S, V };
  }

  function colorMasks(hsv) {
    const n = hsv.width * hsv.height, green = new Uint8Array(n), red = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      if (hsv.S[p] < 75 || hsv.V[p] < 83) continue;
      const h = hsv.H[p];
      if (h >= 36 && h <= 96) green[p] = 1;
      else if (h <= 11 || h >= 167) red[p] = 1;
    }
    return [green, red];
  }

  function candidates(mask, W, Hh, green) {
    const labels = new Int32Array(W * Hh), stack = new Int32Array(W * Hh), comps = [];
    for (let p0 = 0; p0 < W * Hh; p0++) {
      if (!mask[p0] || labels[p0]) continue;
      const id = comps.length + 1;
      if (id > 40000) return [];
      let sp = 0, minx = W, miny = Hh, maxx = -1, maxy = -1, area = 0;
      stack[sp++] = p0; labels[p0] = id;
      while (sp) {
        const p = stack[--sp], x = p % W, y = (p - x) / W;
        area++;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= Hh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= W) continue;
            const q = yy * W + xx;
            if (mask[q] && !labels[q]) { labels[q] = id; stack[sp++] = q; }
          }
        }
      }
      comps.push({ id, x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, area });
    }
    const boxes = [];
    for (const c of comps) {
      if (!(c.w >= 3 && c.w <= 80 && c.h < Hh * 0.8 && c.area >= 5)) continue;
      const body = [];
      for (let r = 0; r < c.h; r++) {
        let width = 0;
        for (let k = 0; k < c.w; k++) if (labels[(c.y + r) * W + c.x + k] === c.id) width++;
        if (width >= Math.max(2, c.w * 0.65)) body.push(r);
      }
      if (!body.length || body.length < (body[body.length - 1] - body[0] + 1) * 0.75) continue;
      const top = c.y + body[0], bottom = c.y + body[body.length - 1];
      boxes.push(candle(c.x, c.w, c.y, c.y + c.h - 1, green ? bottom : top, green ? top : bottom, green));
    }
    return boxes;
  }

  const connected = (a, b) =>
    Math.min(Math.abs(b.opening - a.closing), Math.abs(b.opening - (a.opening + a.closing) / 2))
      <= Math.max(4, (a.bottom - a.top + b.bottom - b.top) * 0.26);

  function candleRuns(boxes) {
    if (boxes.length > 2000) return [];
    boxes.sort((a, b) => a.center - b.center);
    const runs = [];
    for (let i = 0; i < boxes.length; i++) {
      const first = boxes[i];
      for (let j = i + 1; j < boxes.length; j++) {
        const second = boxes[j], pitch = second.center - first.center;
        if (pitch > first.w * 3.1 + 3) break;
        if (pitch < Math.max(3, first.w * 0.9) || Math.abs(second.w - first.w) > Math.max(2, first.w * 0.4)) continue;
        const run = [first];
        for (let k = j; k < boxes.length; k++) {
          const item = boxes[k], prev = run[run.length - 1], dx = item.center - prev.center;
          if (dx > pitch * 1.22 + 1) break;
          if (Math.abs(dx - pitch) > Math.max(1.3, pitch * 0.18) || Math.abs(item.w - first.w) > Math.max(2, first.w * 0.42)) continue;
          if (!connected(prev, item)) continue;
          run.push(item);
        }
        if (run.length >= 7) runs.push(run);
      }
    }
    return runs.sort((a, b) => b.length - a.length);
  }

  const sameRow = (a, b) => { const s = new Set(a); return b.filter((x) => s.has(x)).length >= Math.min(3, b.length); };

  function recoverSlot(masks, W, Hh, center, width, neighbor, toRight) {
    const left = pyRound(center - width / 2), right = left + width;
    if (left < 0 || right > W) return null;
    const options = [];
    [[true, masks[0]], [false, masks[1]]].forEach(([green, mask]) => {
      const thick = [], wick = new Uint8Array(Hh);
      const w0 = Math.max(0, Math.floor(width / 2) - 2), w1 = Math.floor(width / 2) + 2;
      for (let y = 0; y < Hh; y++) {
        let sum = 0;
        for (let x = left; x < right; x++) sum += mask[y * W + x];
        if (sum >= Math.max(3, width * 0.64)) thick.push(y);
        for (let x = left + w0; x < Math.min(right, left + w1); x++) if (mask[y * W + x]) { wick[y] = 1; break; }
      }
      if (!thick.length) return;
      const bands = [[thick[0]]];
      for (let k = 1; k < thick.length; k++) {
        if (thick[k] - thick[k - 1] > 2) bands.push([]);
        bands[bands.length - 1].push(thick[k]);
      }
      for (const band of bands) {
        const top = band[0], bottom = band[band.length - 1];
        let high = top, low = bottom;
        while (high && wick[high - 1]) high--;
        while (low + 1 < Hh && wick[low + 1]) low++;
        const c = candle(left, width, high, low, green ? bottom : top, green ? top : bottom, green);
        const [a, b] = toRight ? [neighbor, c] : [c, neighbor];
        if (connected(a, b)) {
          const error = Math.min(Math.abs(a.closing - b.opening), Math.abs((a.opening + a.closing) / 2 - b.opening));
          options.push([error, c]);
        }
      }
    });
    if (!options.length) return null;
    options.sort((a, b) => a[0] - b[0]);
    if (options.length > 1 && options[1][0] <= options[0][0] + 1) return null;
    return options[0][1];
  }

  function completeRun(seed, masks, W, Hh) {
    const n = seed.length, xs = seed.map((c) => c.center), mx = (n - 1) / 2, my = avg(xs);
    let num = 0, den = 0;
    xs.forEach((x, k) => { num += (k - mx) * (x - my); den += (k - mx) ** 2; });
    const pitch = num / den, origin = my - pitch * mx, width = pyRound(median(seed.map((c) => c.w)));
    const run = [...seed];
    for (const sign of [-1, 1]) {
      let index = sign === -1 ? -1 : n;
      for (;;) {
        const neighbor = sign === -1 ? run[0] : run[run.length - 1];
        const c = recoverSlot(masks, W, Hh, origin + index * pitch, width, neighbor, sign === 1);
        if (!c) break;
        if (sign === -1) run.unshift(c); else run.push(c);
        index += sign;
      }
    }
    return [run, pitch];
  }

  function chartStyle(cs) {
    const pairs = [];
    for (let k = 0; k + 1 < cs.length; k++) if (Math.abs(cs[k].opening - cs[k].closing) >= 6) pairs.push([cs[k], cs[k + 1]]);
    if (pairs.length >= 7) {
      const mid = pairs.map(([a, b]) => Math.abs(b.opening - (a.opening + a.closing) / 2));
      const close = pairs.map(([a, b]) => Math.abs(b.opening - a.closing));
      if (mid.filter((e) => e <= 2).length >= 0.8 * pairs.length && median(close) > median(mid) + 2) return "heikin_ashi";
    }
    return "candles";
  }

  function restoreWicks(run, hsv) {
    const { width: W, height: Hh, H, S, V } = hsv;
    return run.map((c) => {
      const x = pyRound(c.center - 0.5), radius = Math.max(1, Math.min(3, Math.floor(c.w / 5)));
      const col = new Uint8Array(Hh);
      for (let y = 0; y < Hh; y++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(W - 1, x + radius); xx++) {
          const p = y * W + xx;
          if (S[p] < 42 || V[p] < 65) continue;
          const h = H[p];
          if (c.green ? (h >= 34 && h <= 99) : (h <= 14 || h >= 155)) { col[y] = 1; break; }
        }
      }
      const dil = new Uint8Array(Hh), column = new Uint8Array(Hh);
      for (let y = 0; y < Hh; y++) dil[y] = col[y] | (y > 0 ? col[y - 1] : 0) | (y + 1 < Hh ? col[y + 1] : 0);
      for (let y = 0; y < Hh; y++) column[y] = dil[y] & (y > 0 ? dil[y - 1] : 1) & (y + 1 < Hh ? dil[y + 1] : 1);
      let high = Math.min(c.opening, c.closing), low = Math.max(c.opening, c.closing);
      while (high && column[high - 1]) high--;
      while (low + 1 < Hh && column[low + 1]) low++;
      return { ...c, top: Math.min(c.top, high), bottom: Math.max(c.bottom, low) };
    });
  }

  function photoDecision(bars, i, rule) {
    let [direction, reason, rsi] = decision(bars, i, rule);
    if (rule === "break" && direction !== "wait") {
      const prior = bars.slice(i - 20, i);
      const margin = direction === "up" ? bars[i].c - Math.max(...prior.map((b) => b.h)) : Math.min(...prior.map((b) => b.l)) - bars[i].c;
      if (margin <= 2) return ["wait", "The breakout is too close to the range edge to read on this image.", rsi];
    }
    return [direction, reason, rsi];
  }

  async function analyzeImage(b64, rule, crop) {
    if (!RULES[rule]) throw new Error("Choose an analysis method.");
    const raw = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const type = raw[0] === 0x89 ? "image/png" : raw[0] === 0xff ? "image/jpeg" : (raw[8] === 0x57 && raw[9] === 0x45) ? "image/webp" : "";
    if (!type) throw new Error("Use a PNG, JPEG or WebP image up to 16 megapixels.");
    let bitmap;
    try { bitmap = await createImageBitmap(new Blob([raw], { type })); }
    catch { throw new Error("The image could not be opened."); }
    const fullW = bitmap.width, fullH = bitmap.height;
    if (fullW * fullH > 16000000) throw new Error("Use a PNG, JPEG or WebP image up to 16 megapixels.");
    let [x0, y0, x1, y1] = [0, 0, fullW, fullH];
    if (crop != null) {
      if (!Array.isArray(crop) || crop.length !== 4 || crop.some((v) => typeof v !== "number" || !isFinite(v) || v < 0 || v > 1))
        throw new Error("Check the crop boundaries.");
      [x0, y0, x1, y1] = crop.map((v, k) => pyRound(v * (k % 2 ? fullH : fullW)));
      if (x1 - x0 < 48 || y1 - y0 < 32) throw new Error("Make the crop area larger.");
    }
    const cw = x1 - x0, ch = y1 - y0, scale = Math.min(1, 1920 / cw, 1600 / ch);
    const W = Math.max(1, Math.round(cw * scale)), Hh = Math.max(1, Math.round(ch * scale));
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = Hh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, x0, y0, cw, ch, 0, 0, W, Hh);
    bitmap.close?.();
    const hsv = toHsv(ctx.getImageData(0, 0, W, Hh));
    const masks = colorMasks(hsv);
    const boxes = candidates(masks[0], W, Hh, true).concat(candidates(masks[1], W, Hh, false));
    const runs = candleRuns(boxes);
    const unreadable = { mode: "photo", direction: "unreadable", source: "Local image analysis", asset: "Your chart",
      reason: "Send a larger image of one chart with red and green candles.", count: 0 };
    if (!runs.length || runs[0].length < 8) return unreadable;
    let [run, pitch] = completeRun(runs[0], masks, W, Hh);
    for (const other of runs.slice(1)) {
      if (sameRow(run, other)) continue;
      const inside = other.filter((c) => run.some((r) => Math.abs(c.center - r.center) < 2 && Math.abs(c.closing - r.closing) < 4));
      if (inside.length >= other.length * 0.6) continue;
      const dx = other[0].center - run[run.length - 1].center;
      if (other.length >= 8 && !inside.length) {
        if (1.5 * pitch <= dx && dx <= 4.5 * pitch && Math.abs(other[0].opening - run[run.length - 1].closing) <= Hh * 0.12) {
          [run, pitch] = completeRun(other, masks, W, Hh);
          continue;
        }
        const back = run[0].center - other[other.length - 1].center;
        if (1.5 * pitch <= back && back <= 4.5 * pitch) continue;
        return { ...unreadable, reason: "Several candle areas found. Crop one chart up to its right edge." };
      }
    }
    const last = run[run.length - 1];
    const tail = boxes.filter((c) => {
      const k = (c.center - last.center) / pitch;
      return k >= 1.55 && k <= 5.3 && Math.abs(c.w - last.w) <= Math.max(2, last.w * 0.35)
        && Math.abs(c.closing - last.closing) <= Math.max(15, Hh * 0.12) && Math.abs(k - Math.round(k)) < 0.18;
    });
    if (tail.length) return { ...unreadable, reason: "The right edge is cut off. Crop the latest candles fully or use another zoom." };
    if (run.length < 12) return unreadable;
    run = restoreWicks(run, hsv);
    const valid = run.slice(0, -1), lastEight = valid.slice(-8);
    let up = 0, down = 0;
    for (let k = 0; k + 1 < lastEight.length; k++) { const d = lastEight[k].closing - lastEight[k + 1].closing; if (d > 0) up++; else if (d < 0) down++; }
    const sx = (x1 - x0) / W / fullW, sy = (y1 - y0) / Hh / fullH;
    const box = [x0 / fullW + run[0].x * sx, y0 / fullH + Math.min(...run.map((c) => c.top)) * sy,
      x0 / fullW + (run[run.length - 1].x + run[run.length - 1].w) * sx, y0 / fullH + (Math.max(...run.map((c) => c.bottom)) + 1) * sy];
    const style = chartStyle(valid);
    let direction, reason;
    if (style === "heikin_ashi") [direction, reason] = ["wait", "This looks like a Heikin Ashi chart. Switch the terminal to regular candles."];
    else if (valid.length >= 22) {
      const bars = valid.map((c) => ({ o: -c.opening, h: -c.top, l: -c.bottom, c: -c.closing }));
      [direction, reason] = photoDecision(bars, bars.length - 1, rule);
    } else [direction, reason] = ["wait", "This method needs 22 closed candles."];
    return { mode: "photo", direction, reason, asset: "Your chart", rule: RULES[rule], source: "Candle positions on the image",
      count: run.length, closedCount: valid.length, chartType: style, box,
      detail: `Last seven closes: ${up} up, ${down} down, ${7 - up - down} flat. The open right-most candle is excluded.`,
      candles: valid.slice(-50).map((c) => [-c.opening, -c.top, -c.bottom, -c.closing]) };
  }

  // ---------- API ----------
  function record(store, result, request) {
    store.history ||= [];
    const known = request && store.history.find((r) => r.request === request);
    if (known) return known;
    const saved = { ...result, saved: now(), request };
    store.history.unshift(saved);
    store.history = store.history.slice(0, 60);
    save(store);
    return saved;
  }

  async function api(endpoint, body = {}) {
    const store = load();
    store.firstSeen ||= now();
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    switch (endpoint) {
      case "init": {
        const data = await candles();
        const markets = Object.fromEntries(Object.entries(data.markets).map(([k, m]) => [k, { name: m.name, source: m.source, base: m.base }]));
        const today = now() - now() % 86400, hist = store.history || [];
        save(store);
        return {
          staticMode: true, profile: { name: tgUser?.first_name || "Trader", first_seen: store.firstSeen },
          historyStats: { total: hist.length, today: hist.filter((r) => r.saved >= today).length },
          local: false, admin: false, registered: true, levels: LEVELS, photoProvider: "Local",
          access: { tier: "Unlimited", remaining: null, limit: null, photoLimit: null, photoRemaining: null, manual: true, resets: null },
          markets, rules: RULES, terminalMarkets: [], liveMarkets: Object.keys(markets), liveFeed: false,
          favorites: store.favorites || [],
        };
      }
      case "history": return store.history || [];
      case "preview": return {};
      case "favorite": {
        const fav = new Set(store.favorites || []);
        if (body.on) fav.add(body.asset); else fav.delete(body.asset);
        store.favorites = [...fav]; save(store); return { ok: true };
      }
      case "register": return { ok: true };
      case "broker": return { url: BROKER };
      case "signal": {
        const data = await candles();
        return record(store, replay(data, body, store), body.request);
      }
      case "auto": {
        const data = await candles();
        const pool = Object.keys(data.markets);
        store.autoIndex = ((store.autoIndex ?? Math.floor(Math.random() * pool.length)) + 1) % pool.length;
        const key = pool[store.autoIndex], base = data.markets[key].base;
        const tf = base === 5 ? 15 : 60;
        return record(store, replay(data, { market: key, tf, expiry: tf, rule: "trend" }, store), body.request);
      }
      case "photo": {
        const result = await analyzeImage(body.image || "", body.rule || "trend", body.crop ?? null);
        return record(store, result, body.request);
      }
      default: throw new Error("This section is not available in this version.");
    }
  }
  window.PARALLAX_STATIC = api;
})();
