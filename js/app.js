
"use strict";

/* ==========================================
   AFTERHOURS - STEP 17
   FAST ALBUM ARTWORK SYSTEM
========================================== */

const DATA = window.AFTERHOURS_DATA || {
  hiphop: [],
  rnb: []
};

const page = document.body.dataset.page;
const genre = document.body.dataset.genre;

const HISTORY_PREFIX = "afterhours-history-v1-";
const COVER_PREFIX = "afterhours-cover-v2-";
const REC_KEY = "afterhours-v2-demo-recs";

/* ==========================================
   DATE
========================================== */

const dateParts = new Intl.DateTimeFormat(
  "en-US",
  {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Tokyo"
  }
).formatToParts(new Date());

const CURRENT_MONTH = `${
  dateParts.find(p => p.type === "year").value
}-${
  dateParts.find(p => p.type === "month").value
}`;

let selectedMonth = CURRENT_MONTH;

/* ==========================================
   STORAGE
========================================== */

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

/* ==========================================
   COMMON FUNCTIONS
========================================== */

function el(tag, className = "", value) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (value !== undefined) {
    node.textContent = value;
  }

  return node;
}

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

/* ==========================================
   MONTHLY RANKING SYSTEM
========================================== */

function monthLabel(value) {
  const [year, month] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, 1)
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
  const [year, month] = value
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(year, month - 2, 1)
  ).toISOString().slice(0, 7);
}

function getTracks(type) {
  return Array.isArray(DATA[type])
    ? DATA[type].slice(0, 50)
    : [];
}

function historyKey(month, type) {
  return `${HISTORY_PREFIX}${month}-${type}`;
}

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

function saveCurrentHistory() {
  for (const type of ["hiphop", "rnb"]) {
    if (getHistory(CURRENT_MONTH, type)) {
      continue;
    }

    const tracks = getTracks(type);

    if (tracks.length === 0) {
      continue;
    }

    saveLocal(
      historyKey(CURRENT_MONTH, type),
      {
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
      }
    );
  }
}

function selectedTracks() {
  if (selectedMonth === CURRENT_MONTH) {
    return getTracks(genre);
  }

  const saved = getHistory(
    selectedMonth,
    genre
  );

  return saved
    ? [...saved]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 50)
    : [];
}

/* ==========================================
   RANK MOVEMENT
========================================== */

function getMovement(track, rank) {
  const previous = getHistory(
    previousMonth(selectedMonth),
    genre
  );

  if (!previous || previous.length === 0) {
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

  if (!Number.isInteger(old.rank)) {
    return {
      label: "—",
      color: "#8c97b0"
    };
  }

  const difference = old.rank - rank;

  if (difference > 0) {
    return {
      label: `↑ UP ${difference}`,
      color: "#58e9a1"
    };
  }

  if (difference < 0) {
    return {
      label: `↓ DOWN ${Math.abs(difference)}`,
      color: "#ff7895"
    };
  }

  return {
    label: "— STAY",
    color: "#a4afc8"
  };
}

function movementElement(track, rank) {
  const movement = getMovement(track, rank);

  const node = el(
    "span",
    "rank-movement",
    movement.label
  );

  node.style.cssText = `
    display: inline-block;
    margin-top: 8px;
    font: 700 11px monospace;
    letter-spacing: 0.04em;
  `;

  node.style.color = movement.color;

  return node;
}

/* ==========================================
   MONTH SELECTOR
========================================== */

function availableMonths(type) {
  const months = new Set([CURRENT_MONTH]);

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      const match = key &&
        /^afterhours-history-v1-(\d{4}-\d{2})-(hiphop|rnb)$/
          .exec(key);

      if (
        match &&
        match[2] === type &&
        match[1] <= CURRENT_MONTH &&
        getHistory(match[1], type)
      ) {
        months.add(match[1]);
      }
    }
  } catch {
    // Local storage unavailable.
  }

  return [...months].sort().reverse();
}

function updateMonthDisplay() {
  document
    .querySelectorAll(".month-label")
    .forEach(node => {
      node.textContent = monthLabel(
        selectedMonth
      );
    });
}

function initMonthSelector() {
  const tools = document.querySelector(
    ".chart-tools"
  );

  if (!tools || tools.querySelector("#month-select")) {
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
    max-width: 100%;
    font-size: 12px;
    cursor: pointer;
  `;

  availableMonths(genre).forEach(value => {
    const option = el(
      "option",
      "",
      monthLabel(value) +
        (value === CURRENT_MONTH
          ? " / CURRENT"
          : "")
    );

    option.value = value;
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
}

/* ==========================================
   FAST ARTWORK SYSTEM
========================================== */

// First load saved artwork URLs.
// This avoids searching Apple for every song
// each time the page opens.

const ARTWORK_MANIFEST = fetch(
  "images/artwork-map.json",
  { cache: "no-cache" }
)
  .then(response => {
    return response.ok
      ? response.json()
      : {};
  })
  .then(value => {
    return value && typeof value === "object"
      ? value
      : {};
  })
  .catch(() => ({}));

const artworkPromises = new Map();
const artworkNodes = new WeakMap();

let requestQueue = Promise.resolve();
let lastRequestAt = 0;

/* ==========================================
   VALIDATE ARTWORK
========================================== */

function validArtwork(entry, track) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if (
    entry.title &&
    normalize(entry.title) !== normalize(track.title)
  ) {
    return null;
  }

  if (
    entry.artist &&
    normalize(entry.artist) !== normalize(track.artist)
  ) {
    return null;
  }

  const image = safeUrl(entry.image);

  return image
    ? {
        image,
        link: safeUrl(entry.link)
      }
    : null;
}

function improveArtworkSize(url) {
  if (!url) {
    return null;
  }

  return safeUrl(
    url.replace(
      /\b\d+x\d+bb(?=\.)/,
      "300x300bb"
    )
  );
}

/* ==========================================
   FALLBACK ARTWORK SEARCH
========================================== */

function lookupLiveArtwork(track) {
  const key = [
    normalize(track.id),
    normalize(track.title),
    normalize(track.artist)
  ].join("-");

  if (artworkPromises.has(key)) {
    return artworkPromises.get(key);
  }

  const cached = readLocal(
    COVER_PREFIX + track.id,
    null
  );

  if (
    cached &&
    typeof cached.savedAt === "number" &&
    Date.now() - cached.savedAt < 7 * 86400000
  ) {
    const valid = validArtwork(
      cached.result,
      track
    );

    if (valid) {
      const result = Promise.resolve(valid);
      artworkPromises.set(key, result);
      return result;
    }
  }

  const task = requestQueue.then(async () => {
    const pause = Math.max(
      0,
      3200 - (Date.now() - lastRequestAt)
    );

    if (pause > 0) {
      await new Promise(resolve => {
        setTimeout(resolve, pause);
      });
    }

    lastRequestAt = Date.now();

    const params = new URLSearchParams({
      term: `${track.title} ${track.artist}`,
      country: "US",
      media: "music",
      entity: "song",
      limit: "20"
    });

    try {
      const response = await fetch(
        `https://itunes.apple.com/search?${params}`
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      const targetTitle = normalize(
        track.title
      );

      const mainArtist = normalize(
        track.artist.split(
          /,|&|\bfeat\.?\b|\bft\.?\b/i
        )[0]
      );

      const match = (data.results || []).find(
        item => {
          const foundTitle = normalize(
            item.trackName
          );

          const foundArtist = normalize(
            item.artistName
          );

          return (
            (
              foundTitle === targetTitle ||
              foundTitle.startsWith(targetTitle)
            ) &&
            foundArtist.includes(mainArtist) &&
            safeUrl(item.artworkUrl100)
          );
        }
      );

      if (!match) {
        return null;
      }

      const result = {
        image: improveArtworkSize(
          match.artworkUrl100
        ),
        link: safeUrl(match.trackViewUrl)
      };

      if (!result.image) {
        return null;
      }

      saveLocal(
        COVER_PREFIX + track.id,
        {
          savedAt: Date.now(),
          result: {
            ...result,
            title: track.title,
            artist: track.artist
          }
        }
      );

      return result;
    } catch {
      return null;
    }
  });

  requestQueue = task.then(
    () => undefined,
    () => undefined
  );

  artworkPromises.set(key, task);

  return task;
}

async function resolveArtwork(track) {
  const manifest = await ARTWORK_MANIFEST;

  const saved = validArtwork(
    manifest[track.id],
    track
  );

  if (saved) {
    return saved;
  }

  return lookupLiveArtwork(track);
}

/* ==========================================
   DISPLAY ARTWORK
========================================== */

async function displayArtwork(
  cover,
  track,
  highPriority = false
) {
  if (
    !cover ||
    !track ||
    cover.dataset.coverRequested === "yes"
  ) {
    return;
  }

  cover.dataset.coverRequested = "yes";

  const artwork = await resolveArtwork(track);

  if (!artwork || !cover.isConnected) {
    return;
  }

  const img = new Image();

  img.alt = `${track.title} album artwork`;
  img.decoding = "async";
  img.loading = "eager";

  if (highPriority) {
    img.fetchPriority = "high";
  }

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

    link.title = `Open ${track.title} in Apple Music`;

    link.setAttribute(
      "aria-label",
      link.title
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

  img.onerror = () => {
    // Keep the initial-letter placeholder.
  };

  img.src = artwork.image;
}

/* ==========================================
   LAZY LOADING
========================================== */

const coverObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) {
              return;
            }

            coverObserver.unobserve(
              entry.target
            );

            const value = artworkNodes.get(
              entry.target
            );

            if (value) {
              displayArtwork(
                entry.target,
                value.track,
                value.highPriority
              );
            }
          });
        },
        {
          rootMargin: "350px"
        }
      )
    : null;

function makeCover(track, index) {
  const cover = el(
    "div",
    "cover-art",
    String(track.title || "?")
      .charAt(0)
      .toUpperCase()
  );

  cover.dataset.tone = String(index % 5);

  cover.style.position = "relative";
  cover.style.overflow = "hidden";

  artworkNodes.set(
    cover,
    {
      track,
      highPriority: index < 3
    }
  );

  if (coverObserver) {
    coverObserver.observe(cover);
  } else {
    displayArtwork(
      cover,
      track,
      index < 3
    );
  }

  return cover;
}

/* ==========================================
   MUSIC LINKS
========================================== */

function musicLink(track, service) {
  const term = encodeURIComponent(
    `${track.title} ${track.artist}`
  );

  const url = service === "Spotify"
    ? `https://open.spotify.com/search/${term}`
    : `https://music.apple.com/us/search?term=${term}`;

  const link = el(
    "a",
    "",
    service === "Spotify" ? "SP" : "AM"
  );

  link.href = url;
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

/* ==========================================
   VOTING SYSTEM
========================================== */

function makeVoteButton(track) {
  const button = el(
    "button",
    "vote-btn"
  );

  button.type = "button";

  if (selectedMonth !== CURRENT_MONTH) {
    button.textContent = "ARCHIVE";
    button.disabled = true;
    button.title = "Past charts are read-only";
    return button;
  }

  const voteKey =
    `afterhours-v2-demo-votes-${CURRENT_MONTH}`;

  const stored = readLocal(voteKey, []);

  const votes = new Set(
    Array.isArray(stored) ? stored : []
  );

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

/* ==========================================
   TOP 3
========================================== */

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

/* ==========================================
   CHART ROW
========================================== */

function makeRow(track, index) {
  const row = el(
    "li",
    track
      ? "chart-row"
      : "chart-row is-pending"
  );

  row.append(
    el(
      "span",
      "rank-no",
      String(index + 1).padStart(2, "0")
    )
  );

  const main = el(
    "div",
    "row-track"
  );

  if (!track) {
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

    return row;
  }

  main.append(
    makeCover(track, index)
  );

  const info = el("div");

  info.append(
    el("h3", "", track.title),
    el("p", "", track.artist),
    movementElement(track, index + 1)
  );

  main.append(info);

  row.append(
    main,
    makeVoteButton(track),
    makeLinks(track)
  );

  return row;
}

/* ==========================================
   RENDER CHART
========================================== */

function renderChart() {
  const podium = document.querySelector(
    "#podium"
  );

  const board = document.querySelector(
    "#chart-list"
  );

  if (!podium || !board) {
    return;
  }

  const tracks = selectedTracks();

  const search = document.querySelector(
    "#chart-search"
  );

  const query = search
    ? search.value.trim().toLowerCase()
    : "";

  podium.replaceChildren();
  board.replaceChildren();

  const hasArchive =
    selectedMonth === CURRENT_MONTH ||
    getHistory(selectedMonth, genre) !== null;

  if (!hasArchive) {
    board.append(
      el(
        "li",
        "chart-row",
        "NO SAVED CHART FOR THIS MONTH"
      )
    );

    return;
  }

  let shown = 0;

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

/* ==========================================
   HOME PAGE
========================================== */

function renderHome() {
  const list = document.querySelector(
    "#home-featured"
  );

  if (!list) {
    return;
  }

  list.replaceChildren();

  const featured = [
    ...getTracks("hiphop")
      .slice(0, 3)
      .map((track, index) => ({
        track,
        index,
        type: "HIP-HOP"
      })),

    ...getTracks("rnb")
      .slice(0, 3)
      .map((track, index) => ({
        track,
        index,
        type: "R&B"
      }))
  ];

  featured.forEach(
    ({ track, index, type }) => {
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
    }
  );

  initRecommendations();
}

/* ==========================================
   RECOMMENDATIONS
========================================== */

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

  const stored = readLocal(
    REC_KEY,
    []
  );

  let recommendations = Array.isArray(stored)
    ? stored
    : [];

  function render() {
    list.replaceChildren();

    recommendations
      .slice(0, 5)
      .forEach(item => {
        if (
          typeof item.song === "string" &&
          typeof item.artist === "string"
        ) {
          list.append(
            el(
              "li",
              "",
              `${item.song.slice(0, 100)} — ${item.artist.slice(0, 80)}`
            )
          );
        }
      });
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

/* ==========================================
   NAVIGATION
========================================== */

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
    button.addEventListener(
      "click",
      () => {
        const opened = nav.classList.toggle(
          "is-open"
        );

        button.setAttribute(
          "aria-expanded",
          String(opened)
        );
      }
    );

    nav.querySelectorAll("a").forEach(
      link => {
        link.addEventListener(
          "click",
          () => {
            nav.classList.remove(
              "is-open"
            );

            button.setAttribute(
              "aria-expanded",
              "false"
            );
          }
        );
      }
    );
  }

  updateMonthDisplay();
}

/* ==========================================
   START AFTERHOURS
========================================== */

saveCurrentHistory();

initMenu();

if (page === "home") {
  renderHome();
}

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
