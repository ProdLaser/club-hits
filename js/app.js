
"use strict";

/* ======================================
   AFTERHOURS
   STEP 10 - MONTHLY CHART SYSTEM
====================================== */

// 01. 基本設定

const DATA = window.AFTERHOURS_DATA || {
  hiphop: [],
  rnb: []
};

const page = document.body.dataset.page;
const genre = document.body.dataset.genre;

const HISTORY_PREFIX = "afterhours-history-v1-";
const COVER_PREFIX = "afterhours-cover-v2-";
const REC_KEY = "afterhours-v2-demo-recs";

// 日本時間で年月を取得

const dateParts = new Intl.DateTimeFormat(
  "en-US",
  {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo"
  }
).formatToParts(new Date());

const year = dateParts.find(
  p => p.type === "year"
).value;

const month = dateParts.find(
  p => p.type === "month"
).value;

const CURRENT_MONTH = `${year}-${month}`;

let selectedMonth = CURRENT_MONTH;

// 02. 保存処理

function readLocal(key, fallback) {
  try {
    return JSON.parse(
      localStorage.getItem(key)
    ) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
    return true;
  } catch {
    return false;
  }
}

// 03. 共通HTML要素

function el(tag, className = "", text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

// 04. 年月の表示

function monthLabel(value) {
  const [y, m] = value.split("-").map(Number);

  const date = new Date(
    Date.UTC(y, m - 1, 1)
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }
  ).format(date).toUpperCase();
}

function previousMonth(value) {
  const [y, m] = value.split("-").map(Number);

  return new Date(
    Date.UTC(y, m - 2, 1)
  ).toISOString().slice(0, 7);
}

// 05. ランキングデータ

function getTracks(type) {
  return Array.isArray(DATA[type])
    ? DATA[type].slice(0, 50)
    : [];
}

function historyKey(month, type) {
  return `${HISTORY_PREFIX}${month}-${type}`;
}

// 06. 毎月のランキングを保存

function saveCurrentHistory() {
  for (const type of ["hiphop", "rnb"]) {

    const key = historyKey(
      CURRENT_MONTH,
      type
    );

    // 保存済みなら変更しない
    if (readLocal(key, null)) {
      continue;
    }

    const tracks = getTracks(type);

    const snapshot = {
      month: CURRENT_MONTH,
      genre: type,
      dataType: "DEMO",
      createdAt: new Date().toISOString(),

      tracks: tracks.map((track, index) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        rank: index + 1
      }))
    };

    saveLocal(key, snapshot);
  }
}

// 07. 過去のランキングを取得

function getHistory(month, type) {
  const record = readLocal(
    historyKey(month, type),
    null
  );

  if (
    !record ||
    record.dataType !== "DEMO" ||
    !Array.isArray(record.tracks)
  ) {
    return null;
  }

  return record.tracks;
}

// 08. 選択された月のランキング

function selectedTracks() {

  if (selectedMonth === CURRENT_MONTH) {
    return getTracks(genre);
  }

  const history = getHistory(
    selectedMonth,
    genre
  );

  if (!history) {
    return [];
  }

  return [...history]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 50);
}

// 09. 前月との比較

function getMovement(track, rank) {
  const previous = getHistory(
    previousMonth(selectedMonth),
    genre
  );

  if (!previous) {
    return {
      label: "—",
      color: "#8c97b0"
    };
  }

  const old = previous.find(
    item => item.id === track.id
  );

  if (!old) {
    return {
      label: "NEW",
      color: "#3ee6ef"
    };
  }

  const diff = old.rank - rank;

  if (diff > 0) {
    return {
      label: `↑ UP ${diff}`,
      color: "#58e9a1"
    };
  }

  if (diff < 0) {
    return {
      label: `↓ DOWN ${Math.abs(diff)}`,
      color: "#ff7895"
    };
  }

  return {
    label: "— STAY",
    color: "#a4afc8"
  };
}

function movementElement(track, rank) {
  const result = getMovement(track, rank);

  const node = el(
    "span",
    "rank-movement",
    result.label
  );

  node.style.cssText = `
    display: inline-block;
    margin-top: 8px;
    font: 700 11px monospace;
    letter-spacing: 0.04em;
  `;

  node.style.color = result.color;

  return node;
}

/* ======================================
   10. MONTH SELECTOR
====================================== */

function availableMonths(type) {

  const months = new Set([
    CURRENT_MONTH
  ]);

  try {
    for (let i = 0; i < localStorage.length; i++) {

      const key = localStorage.key(i);

      const pattern = new RegExp(
        `^afterhours-history-v1-(\\d{4}-\\d{2})-${type}$`
      );

      const match = key.match(pattern);

      if (match) {
        const savedMonth = match[1];

        if (
          savedMonth <= CURRENT_MONTH &&
          getHistory(savedMonth, type)
        ) {
          months.add(savedMonth);
        }
      }
    }
  } catch {
    // 保存機能が使えない場合は現在月のみ
  }

  return [...months].sort().reverse();
}

function initMonthSelector() {

  const tools = document.querySelector(
    ".chart-tools"
  );

  if (!tools) {
    return;
  }

  const wrapper = el(
    "label",
    "month-selector"
  );

  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 7px;
    color: #3ee6ef;
    font: 700 10px monospace;
    letter-spacing: 0.08em;
  `;

  wrapper.append(
    el("span", "", "CHART MONTH")
  );

  const select = el("select");

  select.id = "month-select";

  select.setAttribute(
    "aria-label",
    "Select chart month"
  );

  select.style.cssText = `
    background: #111729;
    color: #f5f7ff;
    border: 1px solid #35445b;
    padding: 12px;
    min-width: 190px;
    font-size: 12px;
    cursor: pointer;
  `;

  availableMonths(genre).forEach(value => {

    const option = el(
      "option",
      "",
      monthLabel(value)
    );

    option.value = value;

    if (value === CURRENT_MONTH) {
      option.textContent += " / CURRENT";
    }

    select.append(option);
  });

  select.value = CURRENT_MONTH;

  select.addEventListener("change", () => {

    selectedMonth = select.value;

    updateMonthDisplay();

    renderChart();
  });

  wrapper.append(select);

  tools.prepend(wrapper);

  updateMonthDisplay();
}

// 11. 表示中の年月を更新

function updateMonthDisplay() {

  document
    .querySelectorAll(".month-label")
    .forEach(node => {
      node.textContent = monthLabel(
        selectedMonth
      );
    });
}

/* ======================================
   12. ARTWORK SYSTEM
====================================== */

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function safeUrl(value) {
  try {
    const url = new URL(value);

    return url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const coverPromises = new Map();

let requestQueue = Promise.resolve();
let lastRequest = 0;

function lookupArtwork(track) {

  const cacheKey = COVER_PREFIX + track.id;

  if (coverPromises.has(cacheKey)) {
    return coverPromises.get(cacheKey);
  }

  const cached = readLocal(cacheKey, null);

  if (
    cached &&
    typeof cached.savedAt === "number" &&
    Date.now() - cached.savedAt <
      7 * 24 * 60 * 60 * 1000
  ) {

    const promise = Promise.resolve(
      cached.result
    );

    coverPromises.set(cacheKey, promise);

    return promise;
  }

  const task = requestQueue.then(async () => {

    const pause = Math.max(
      0,
      3200 - (Date.now() - lastRequest)
    );

    if (pause > 0) {
      await new Promise(resolve => {
        setTimeout(resolve, pause);
      });
    }

    lastRequest = Date.now();

    const params = new URLSearchParams({
      term: `${track.title} ${track.artist}`,
      country: "US",
      media: "music",
      entity: "song",
      limit: "15"
    });

    try {

      const response = await fetch(
        `https://itunes.apple.com/search?${params}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      const target = normalize(track.title);

      const artistName = normalize(
        track.artist.split(
          /,|&|\bfeat\.?\b|\bft\.?\b/i
        )[0]
      );

      const match = (data.results || []).find(
        item => {

          const title = normalize(
            item.trackName
          );

          const artist = normalize(
            item.artistName
          );

          return (
            (title === target ||
              title.startsWith(target)) &&
            artist.includes(artistName) &&
            safeUrl(item.artworkUrl100)
          );
        }
      );

      if (!match) {
        return null;
      }

      const result = {
        image: safeUrl(
          match.artworkUrl100.replace(
            "100x100bb",
            "600x600bb"
          )
        ),
        link: safeUrl(match.trackViewUrl)
      };

      saveLocal(cacheKey, {
        savedAt: Date.now(),
        result
      });

      return result;

    } catch {
      return null;
    }
  });

  requestQueue = task.then(
    () => undefined,
    () => undefined
  );

  coverPromises.set(cacheKey, task);

  return task;
}

// 13. ジャケット表示

const coverTracks = new WeakMap();

const observer =
  "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {

        for (const entry of entries) {

          if (!entry.isIntersecting) {
            continue;
          }

          observer.unobserve(entry.target);

          displayArtwork(
            entry.target,
            coverTracks.get(entry.target)
          );
        }

      }, {
        rootMargin: "250px"
      })
    : null;

async function displayArtwork(cover, track) {

  if (!track) {
    return;
  }

  const artwork = await lookupArtwork(track);

  if (
    !artwork ||
    !artwork.image ||
    !cover.isConnected
  ) {
    return;
  }

  const img = new Image();

  img.alt = `${track.title} album artwork`;
  img.decoding = "async";

  img.style.cssText = `
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  `;

  img.onload = () => {

    if (!cover.isConnected) {
      return;
    }

    const link = el("a");

    link.href = artwork.link ||
      `https://music.apple.com/us/search?term=${
        encodeURIComponent(
          `${track.title} ${track.artist}`
        )
      }`;

    link.target = "_blank";
    link.rel = "noopener noreferrer";

    link.setAttribute(
      "aria-label",
      `Open ${track.title} in Apple Music`
    );

    link.style.cssText = `
      position: absolute;
      inset: 0;
      display: block;
      z-index: 2;
    `;

    link.append(img);
    cover.replaceChildren(link);
  };

  img.src = artwork.image;
}

function makeCover(track, index) {

  const cover = el(
    "div",
    "cover-art",
    track.title.charAt(0).toUpperCase()
  );

  cover.dataset.tone = String(index % 5);

  coverTracks.set(cover, track);

  if (observer) {
    observer.observe(cover);
  } else {
    displayArtwork(cover, track);
  }

  return cover;
}

/* ======================================
   14. MUSIC LINKS
====================================== */

function musicLink(track, service) {

  const term = encodeURIComponent(
    `${track.title} ${track.artist}`
  );

  const href = service === "Spotify"
    ? `https://open.spotify.com/search/${term}`
    : `https://music.apple.com/us/search?term=${term}`;

  const link = el(
    "a",
    "",
    service === "Spotify" ? "SP" : "AM"
  );

  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  link.setAttribute(
    "aria-label",
    `Search ${track.title} on ${service}`
  );

  return link;
}

function makeLinks(track) {

  const box = el("div", "track-links");

  box.append(
    musicLink(track, "Spotify"),
    musicLink(track, "Apple Music")
  );

  return box;
}

/* ======================================
   15. VOTE SYSTEM
====================================== */

function voteKeyFor(month) {
  return `afterhours-v2-demo-votes-${month}`;
}

function makeVoteButton(track) {

  const button = el(
    "button",
    "vote-btn"
  );

  button.type = "button";

  const archived =
    selectedMonth !== CURRENT_MONTH;

  const voteKey = voteKeyFor(
    CURRENT_MONTH
  );

  const stored = readLocal(voteKey, []);

  const votes = new Set(
    Array.isArray(stored) ? stored : []
  );

  if (archived) {
    button.textContent = "ARCHIVE";
    button.disabled = true;
    button.title = "Past charts are read-only";
    return button;
  }

  function update() {

    const voted = votes.has(track.id);

    button.textContent = voted
      ? "♥ VOTED"
      : "♡ VOTE";

    button.setAttribute(
      "aria-pressed",
      String(voted)
    );
  }

  update();

  button.addEventListener("click", () => {

    if (votes.has(track.id)) {
      votes.delete(track.id);
    } else {
      votes.add(track.id);
    }

    saveLocal(voteKey, [...votes]);

    update();
  });

  return button;
}

/* ======================================
   16. TOP THREE
====================================== */

function makePodiumCard(track, index) {

  const card = el(
    "article",
    "podium-card"
  );

  card.append(
    el(
      "span",
      "podium-rank",
      String(index + 1).padStart(2, "0")
    ),
    makeCover(track, index)
  );

  const bottom = el("div");

  bottom.append(
    el("h3", "", track.title),
    el("p", "", track.artist),
    movementElement(track, index + 1),
    makeVoteButton(track),
    makeLinks(track)
  );

  card.append(bottom);

  return card;
}

/* ======================================
   17. RANKING ROWS
====================================== */

function makeRow(track, index) {

  const row = el(
    "li",
    track ? "chart-row" : "chart-row is-pending"
  );

  const rank = index + 1;

  row.append(
    el(
      "span",
      "rank-no",
      String(rank).padStart(2, "0")
    )
  );

  const main = el("div", "row-track");

  if (track) {

    main.append(makeCover(track, index));

    const info = el("div");

    info.append(
      el("h3", "", track.title),
      el("p", "", track.artist),
      movementElement(track, rank)
    );

    main.append(info);

    row.append(
      main,
      makeVoteButton(track),
      makeLinks(track)
    );

  } else {

    main.append(
      el(
        "span",
        "slot-label",
        "AWAITING CHART DATA"
      )
    );

    row.append(
      main,
      el("span", "slot-label", "—"),
      el("span", "slot-label", "—")
    );
  }

  return row;
}

/* ======================================
   18. RENDER RANKING
====================================== */

function renderChart() {

  const tracks = selectedTracks();

  const search = document.querySelector(
    "#chart-search"
  );

  const query = search
    ? search.value.trim().toLowerCase()
    : "";

  const podium = document.querySelector(
    "#podium"
  );

  const board = document.querySelector(
    "#chart-list"
  );

  if (!podium || !board) {
    return;
  }

  podium.replaceChildren();
  board.replaceChildren();

  let shown = 0;

  // 過去データの有無
  const hasArchive =
    selectedMonth === CURRENT_MONTH ||
    getHistory(selectedMonth, genre) !== null;

  if (!hasArchive) {

    const message = el(
      "p",
      "chart-empty",
      "NO SAVED CHART FOR THIS MONTH"
    );

    board.append(message);

    return;
  }

  // TOP 3

  tracks.slice(0, 3).forEach(
    (track, index) => {

      const target =
        `${track.title} ${track.artist}`
          .toLowerCase();

      if (!query || target.includes(query)) {

        podium.append(
          makePodiumCard(track, index)
        );

        shown++;
      }
    }
  );

  // 4〜50位

  for (let i = 3; i < 50; i++) {

    const track = tracks[i];

    if (query) {

      if (!track) {
        continue;
      }

      const target =
        `${track.title} ${track.artist}`
          .toLowerCase();

      if (!target.includes(query)) {
        continue;
      }
    }

    board.append(
      makeRow(track, i)
    );

    if (track) {
      shown++;
    }
  }

  const results = document.querySelector(
    "#chart-results"
  );

  if (results) {
    results.textContent = query
      ? `${shown} DEMO TRACKS FOUND`
      : `50 SLOTS / ${tracks.length} DEMO TRACKS`;
  }

  const empty = document.querySelector(
    "#chart-empty"
  );

  if (empty) {
    empty.hidden = shown !== 0 || !query;
  }
}

/* ======================================
   19. HOME FEATURED TRACKS
====================================== */

function renderHome() {

  const list = document.querySelector(
    "#home-featured"
  );

  if (!list) {
    return;
  }

  list.replaceChildren();

  const featured = [

    ...getTracks("hiphop").slice(0, 3).map(
      (track, index) => ({
        track,
        index,
        type: "HIP-HOP"
      })
    ),

    ...getTracks("rnb").slice(0, 3).map(
      (track, index) => ({
        track,
        index,
        type: "R&B"
      })
    )
  ];

  featured.forEach(({ track, index, type }) => {

    const card = el(
      "article",
      "featured-card"
    );

    const top = el(
      "div",
      "featured-card-top"
    );

    top.append(
      el("span", "", type),
      el(
        "span",
        "",
        `DEMO / ${String(index + 1).padStart(2, "0")}`
      )
    );

    card.append(
      top,
      makeCover(track, index),
      el("h3", "", track.title),
      el("p", "", track.artist)
    );

    const link = el(
      "a",
      "",
      `EXPLORE ${type} CHART ↗`
    );

    link.href = type === "HIP-HOP"
      ? "hiphop.html"
      : "RnB.html";

    card.append(link);
    list.append(card);
  });

  initRecommendations();
}

/* ======================================
   20. RECOMMENDATIONS
====================================== */

function initRecommendations() {

  const form = document.querySelector(
    "#recommend-form"
  );

  const list = document.querySelector(
    "#recommend-list"
  );

  if (!form || !list) {
    return;
  }

  const stored = readLocal(REC_KEY, []);

  let recommendations = Array.isArray(stored)
    ? stored
    : [];

  function render() {

    list.replaceChildren();

    recommendations.slice(0, 5).forEach(
      item => {

        if (
          typeof item.song !== "string" ||
          typeof item.artist !== "string"
        ) {
          return;
        }

        list.append(
          el(
            "li",
            "",
            `${item.song.slice(0, 100)} — ${item.artist.slice(0, 80)}`
          )
        );
      }
    );
  }

  form.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      const artist = form.elements.artist
        .value.trim().slice(0, 80);

      const song = form.elements.song
        .value.trim().slice(0, 100);

      if (!artist || !song) {
        return;
      }

      recommendations.unshift({
        artist,
        song
      });

      recommendations =
        recommendations.slice(0, 10);

      const saved = saveLocal(
        REC_KEY,
        recommendations
      );

      form.reset();
      render();

      const message = document.querySelector(
        "#form-message"
      );

      if (message) {
        message.textContent = saved
          ? "SAVED ON THIS DEVICE ONLY"
          : "LOCAL STORAGE IS UNAVAILABLE";
      }
    }
  );

  render();
}

/* ======================================
   21. NAVIGATION
====================================== */

function initMenu() {

  const button = document.querySelector(
    ".mobile-menu"
  );

  const nav = document.querySelector(
    ".nav"
  );

  document
    .querySelectorAll('a[href="rnb.html"]')
    .forEach(link => {
      link.href = "RnB.html";
    });

  if (button && nav) {

    button.addEventListener("click", () => {

      const opened =
        nav.classList.toggle("is-open");

      button.setAttribute(
        "aria-expanded",
        String(opened)
      );
    });

    nav.querySelectorAll("a").forEach(
      link => {

        link.addEventListener("click", () => {

          nav.classList.remove("is-open");

          button.setAttribute(
            "aria-expanded",
            "false"
          );
        });
      }
    );
  }

  updateMonthDisplay();
}

/* ======================================
   22. START
====================================== */

// 現在月のデモ順位を記録
saveCurrentHistory();

// 共通ナビゲーション
initMenu();

// HOME
if (page === "home") {
  renderHome();
}

// HIP-HOP / R&B
if (page === "chart") {

  initMonthSelector();

  const search = document.querySelector(
    "#chart-search"
  );

  if (search) {
    search.addEventListener(
      "input",
      renderChart
    );
  }

  renderChart();
}
