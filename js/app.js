
"use strict";

/*
  AFTERHOURS - STEP 19
  SUPABASE ONLINE COMMUNITY

  Keep existing:
  - HOME
  - HIP-HOP / R&B TOP 50
  - Artwork
  - Monthly archives
  - Search
  - Navigation

  Add:
  - Anonymous authentication
  - Online votes
  - Global vote counts
  - Online song requests
*/

// ========================================
// 1. CONFIGURATION
// ========================================

const DATA = window.AFTERHOURS_DATA || {
  hiphop: [],
  rnb: []
};

const page = document.body.dataset.page;
const genre = document.body.dataset.genre;

const HISTORY_PREFIX = "afterhours-history-v1-";
const COVER_PREFIX = "afterhours-cover-v2-";
const REC_KEY = "afterhours-v2-demo-recs";

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

// ========================================
// 2. COMMON FUNCTIONS
// ========================================

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

// ========================================
// 3. MONTHLY CHARTS
// ========================================

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

    if (!tracks.length) {
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

  const tracks = getHistory(
    selectedMonth,
    genre
  );

  return tracks
    ? [...tracks]
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 50)
    : [];
}

function getMovement(track, rank) {
  const previous = getHistory(
    previousMonth(selectedMonth),
    genre
  );

  if (!previous?.length) {
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

function availableMonths(type) {
  const months = new Set([CURRENT_MONTH]);

  try {
    for (
      let i = 0;
      i < localStorage.length;
      i++
    ) {
      const key = localStorage.key(i) || "";

      const match =
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
    // Storage unavailable
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

  if (
    !tools ||
    tools.querySelector("#month-select")
  ) {
    return;
  }

  const label = el(
    "label",
    "month-selector"
  );

  label.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 7px;
    color: #3ee6ef;
    font: 700 10px monospace;
    letter-spacing: 0.08em;
  `;

  label.append(
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

  label.append(select);
  tools.prepend(label);
}

// ========================================
// 4. ARTWORK SYSTEM
// ========================================

const ARTWORK_MANIFEST = fetch(
  "images/artwork-map.json",
  {
    cache: "no-cache"
  }
)
  .then(response => {
    return response.ok
      ? response.json()
      : {};
  })
  .catch(() => ({}));

const artworkPromises = new Map();
const coverTracks = new WeakMap();

let requestQueue = Promise.resolve();
let lastRequestAt = 0;

function artworkEntry(entry, track) {
  if (
    !entry ||
    typeof entry !== "object"
  ) {
    return null;
  }

  if (
    entry.title &&
    normalize(entry.title) !==
      normalize(track.title)
  ) {
    return null;
  }

  if (
    entry.artist &&
    normalize(entry.artist) !==
      normalize(track.artist)
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

function lookupLiveArtwork(track) {
  const key = `${
    track.id
  }:${
    normalize(track.title)
  }:${
    normalize(track.artist)
  }`;

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
    Date.now() - cached.savedAt <
      7 * 86400000
  ) {
    const valid = artworkEntry(
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

    if (pause) {
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

      const payload = await response.json();

      const title = normalize(
        track.title
      );

      const artist = normalize(
        track.artist.split(
          /,|&|\bfeat\.?\b|\bft\.?\b/i
        )[0]
      );

      const match = (
        payload.results || []
      ).find(item => {
        const matchTitle = normalize(
          item.trackName
        );

        return (
          (
            matchTitle === title ||
            matchTitle.startsWith(title)
          ) &&
          normalize(item.artistName)
            .includes(artist) &&
          safeUrl(item.artworkUrl100)
        );
      });

      if (!match) {
        return null;
      }

      const result = {
        image: safeUrl(
          match.artworkUrl100.replace(
            /\b\d+x\d+bb(?=\.)/,
            "300x300bb"
          )
        ),
        link: safeUrl(match.trackViewUrl),
        title: track.title,
        artist: track.artist
      };

      if (!result.image) {
        return null;
      }

      saveLocal(
        COVER_PREFIX + track.id,
        {
          savedAt: Date.now(),
          result
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

  return (
    artworkEntry(manifest[track.id], track) ||
    lookupLiveArtwork(track)
  );
}

async function displayArtwork(cover, track) {
  if (
    !cover ||
    !track ||
    cover.dataset.requested
  ) {
    return;
  }

  cover.dataset.requested = "true";

  const result = await resolveArtwork(track);

  if (!result || !cover.isConnected) {
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

    link.href =
      result.link ||
      `https://music.apple.com/us/search?term=${
        encodeURIComponent(
          track.title + " " + track.artist
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

  img.src = result.image;
}

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

            displayArtwork(
              entry.target,
              coverTracks.get(entry.target)
            );
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

  coverTracks.set(cover, track);

  if (coverObserver) {
    coverObserver.observe(cover);
  } else {
    displayArtwork(cover, track);
  }

  return cover;
}

// ========================================
// 5. MUSIC LINKS
// ========================================

function musicLink(track, service) {
  const term = encodeURIComponent(
    `${track.title} ${track.artist}`
  );

  const link = el(
    "a",
    "",
    service === "Spotify" ? "SP" : "AM"
  );

  link.href = service === "Spotify"
    ? `https://open.spotify.com/search/${term}`
    : `https://music.apple.com/us/search?term=${term}`;

  link.target = "_blank";
  link.rel = "noopener noreferrer";

  link.setAttribute(
    "aria-label",
    `Search ${track.title} on ${service}`
  );

  return link;
}

function makeLinks(track) {
  const box = el(
    "div",
    "track-links"
  );

  box.append(
    musicLink(track, "Spotify"),
    musicLink(track, "Apple Music")
  );

  return box;
}

// ========================================
// 6. SUPABASE CONNECTION
// ========================================

let cloudMode = "connecting";
let db = null;
let cloudUserId = null;

const globalCounts = new Map();
const cloudVotes = new Set();
const busyVotes = new Set();

let myRequests = [];
let recommendationForm = null;
let recommendationList = null;

function setCommunityStatus(message) {
  let notice = document.querySelector(
    "#community-connection-state"
  );

  if (!notice) {
    const container =
      document.querySelector(".chart-tools") ||
      document.querySelector("#recommend-form");

    if (!container) {
      return;
    }

    notice = el("p", "", message);

    notice.id = "community-connection-state";

    notice.style.cssText = `
      font: 600 11px monospace;
      letter-spacing: .03em;
      color: #95a1bb;
      margin: 8px 0;
    `;

    container.after(notice);
  }

  notice.textContent = message;
}

function refreshUI() {
  document
    .querySelectorAll("[data-vote-track]")
    .forEach(button => {
      updateVoteButton(
        button,
        button.dataset.voteTrack
      );
    });

  renderRecommendations();

  const messages = {
    ready:
      "ONLINE COMMUNITY / VOTES SAVED TO SUPABASE (CHART ORDER IS DEMO)",

    demo:
      "DEMO MODE / VOTES AND REQUESTS SAVED ON THIS DEVICE",

    connecting:
      "CONNECTING TO AFTERHOURS COMMUNITY...",

    error:
      "COMMUNITY DATABASE UNAVAILABLE / ONLINE VOTES PAUSED"
  };

  setCommunityStatus(
    messages[cloudMode]
  );
}

function scriptLoad(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement(
      "script"
    );

    script.src = src;

    script.onload = resolve;

    script.onerror = () => {
      reject(
        new Error(
          `Failed to load: ${src}`
        )
      );
    };

    document.head.append(script);
  });
}

async function initCloud() {
  try {
    // Load local public configuration
    await scriptLoad(
      "js/supabase-config.js"
    );

    const config =
      window.AFTERHOURS_SUPABASE;

    if (
      !config ||
      !safeUrl(config.url) ||
      !config.publishableKey ||
      config.url.includes("YOUR_PROJECT_REF") ||
      config.publishableKey.includes(
        "REPLACE_WITH_YOUR_KEY"
      )
    ) {
      cloudMode = "demo";
      refreshUI();
      return;
    }

    // Load Supabase JavaScript SDK
    await scriptLoad(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
    );

    if (!window.supabase?.createClient) {
      throw new Error(
        "Supabase SDK unavailable"
      );
    }

    db = window.__AFTERHOURS_SHARED_DB ||
      (window.__AFTERHOURS_SHARED_DB =
        window.supabase.createClient(
          config.url,
          config.publishableKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true
            }
          }
        ));

    const sessionResult =
      await db.auth.getSession();

    if (sessionResult.error) {
      throw sessionResult.error;
    }

    if (!sessionResult.data.session) {
      const signIn =
        await db.auth.signInAnonymously();

      if (signIn.error) {
        throw signIn.error;
      }
    }

    const userResult =
      await db.auth.getUser();

    if (
      userResult.error ||
      !userResult.data.user
    ) {
      throw (
        userResult.error ||
        new Error("No signed-in user")
      );
    }

    cloudUserId =
      userResult.data.user.id;

    const [
      voteResult,
      countResult,
      requestResult
    ] = await Promise.all([
      db.from("chart_votes")
        .select("track_id")
        .eq(
          "chart_month",
          CURRENT_MONTH
        ),

      db.rpc(
        "get_vote_counts",
        {
          p_month: CURRENT_MONTH
        }
      ),

      db.from("song_requests")
        .select("title,artist")
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(5)
    ]);

    for (const result of [
      voteResult,
      countResult,
      requestResult
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    cloudVotes.clear();

    voteResult.data.forEach(row => {
      cloudVotes.add(row.track_id);
    });

    globalCounts.clear();

    countResult.data.forEach(row => {
      globalCounts.set(
        row.track_id,
        Number(row.votes) || 0
      );
    });

    myRequests = requestResult.data.map(
      row => ({
        song: row.title,
        artist: row.artist
      })
    );

    cloudMode = "ready";

    refreshUI();

  } catch (error) {
    console.error(
      "AFTERHOURS database connection:",
      error
    );

    cloudMode =
      window.AFTERHOURS_SUPABASE?.url
        ?.includes("YOUR_PROJECT_REF")
        ? "demo"
        : "error";

    refreshUI();
  }
}

// ========================================
// 7. VOTING SYSTEM
// ========================================

function demoVoteKey() {
  return `afterhours-v2-demo-votes-${CURRENT_MONTH}`;
}

function getDemoVotes() {
  const values = readLocal(
    demoVoteKey(),
    []
  );

  return new Set(
    Array.isArray(values) ? values : []
  );
}

function updateVoteButton(button, trackId) {
  if (selectedMonth !== CURRENT_MONTH) {
    button.textContent = "ARCHIVE";
    button.disabled = true;

    button.setAttribute(
      "aria-pressed",
      "false"
    );

    return;
  }

  if (cloudMode === "connecting") {
    button.textContent = "CONNECTING...";
    button.disabled = true;
    return;
  }

  if (cloudMode === "error") {
    button.textContent = "VOTE OFFLINE";
    button.disabled = true;
    return;
  }

  const voted = cloudMode === "ready"
    ? cloudVotes.has(trackId)
    : getDemoVotes().has(trackId);

  const count = cloudMode === "ready"
    ? globalCounts.get(trackId) || 0
    : null;

  button.textContent = cloudMode === "ready"
    ? `${
        voted ? "♥ VOTED" : "♡ VOTE"
      } · ${count}`
    : `${
        voted ? "♥ DEMO VOTED" : "♡ DEMO VOTE"
      }`;

  button.disabled = busyVotes.has(trackId);

  button.setAttribute(
    "aria-pressed",
    String(voted)
  );
}

async function toggleVote(trackId) {
  if (
    selectedMonth !== CURRENT_MONTH ||
    busyVotes.has(trackId)
  ) {
    return;
  }

  if (cloudMode === "demo") {
    const votes = getDemoVotes();

    if (votes.has(trackId)) {
      votes.delete(trackId);
    } else {
      votes.add(trackId);
    }

    saveLocal(
      demoVoteKey(),
      [...votes]
    );

    refreshUI();
    return;
  }

  if (
    cloudMode !== "ready" ||
    !cloudUserId
  ) {
    return;
  }

  busyVotes.add(trackId);
  refreshUI();

  const already =
    cloudVotes.has(trackId);

  try {
    const result = already
      ? await db.from("chart_votes")
          .delete()
          .eq("user_id", cloudUserId)
          .eq("track_id", trackId)
          .eq("chart_month", CURRENT_MONTH)

      : await db.from("chart_votes")
          .insert({
            user_id: cloudUserId,
            track_id: trackId,
            chart_month: CURRENT_MONTH
          });

    if (result.error) {
      throw result.error;
    }

    if (already) {
      cloudVotes.delete(trackId);
    } else {
      cloudVotes.add(trackId);
    }

    const counts = await db.rpc(
      "get_vote_counts",
      {
        p_month: CURRENT_MONTH
      }
    );

    if (!counts.error) {
      globalCounts.clear();

      counts.data.forEach(row => {
        globalCounts.set(
          row.track_id,
          Number(row.votes) || 0
        );
      });
    }

  } catch (error) {
    console.error(
      "Vote failed:",
      error
    );

    setCommunityStatus(
      "VOTE FAILED / PLEASE TRY AGAIN"
    );

  } finally {
    busyVotes.delete(trackId);
    refreshUI();
  }
}

function makeVoteButton(track) {
  const button = el(
    "button",
    "vote-btn"
  );

  button.type = "button";

  button.dataset.voteTrack = track.id;

  button.addEventListener(
    "click",
    () => toggleVote(track.id)
  );

  updateVoteButton(
    button,
    track.id
  );

  return button;
}

// ========================================
// 8. SONG REQUESTS
// ========================================

function renderRecommendations() {
  if (!recommendationList) {
    return;
  }

  recommendationList.replaceChildren();

  const saved = cloudMode === "ready"
    ? myRequests
    : cloudMode === "demo"
      ? readLocal(REC_KEY, [])
      : [];

  const items = Array.isArray(saved)
    ? saved
    : [];

  items.slice(0, 5).forEach(item => {
    if (
      typeof item.song === "string" &&
      typeof item.artist === "string"
    ) {
      recommendationList.append(
        el(
          "li",
          "",
          `${
            item.song.slice(0, 100)
          } — ${
            item.artist.slice(0, 80)
          }`
        )
      );
    }
  });
}

function formMessage(message) {
  const node = document.querySelector(
    "#form-message"
  );

  if (node) {
    node.textContent = message;
  }
}

function initRecommendations() {
  recommendationForm =
    document.querySelector(
      "#recommend-form"
    );

  recommendationList =
    document.querySelector(
      "#recommend-list"
    );

  if (
    !recommendationForm ||
    !recommendationList
  ) {
    return;
  }

  recommendationForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const artist =
        recommendationForm.elements.artist
          ?.value.trim().slice(0, 80);

      const song =
        recommendationForm.elements.song
          ?.value.trim().slice(0, 100);

      if (!artist || !song) {
        return;
      }

      if (cloudMode === "connecting") {
        formMessage(
          "接続中です。もう一度お試しください。"
        );
        return;
      }

      if (cloudMode === "error") {
        formMessage(
          "現在データベースに接続できません。"
        );
        return;
      }

      const submitButton =
        recommendationForm.querySelector(
          '[type="submit"]'
        );

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        if (cloudMode === "ready") {
          const result = await db
            .from("song_requests")
            .insert({
              user_id: cloudUserId,
              title: song,
              artist
            });

          if (result.error) {
            if (
              result.error.code === "23505"
            ) {
              formMessage(
                "リクエストは1日1曲までです。"
              );
              return;
            }

            throw result.error;
          }

          myRequests.unshift({
            song,
            artist
          });

          myRequests =
            myRequests.slice(0, 5);

          formMessage(
            "オンラインに保存しました（自分の履歴に表示）。"
          );

        } else {
          const old = readLocal(
            REC_KEY,
            []
          );

          const next = [
            {
              song,
              artist
            },
            ...(
              Array.isArray(old)
                ? old
                : []
            )
          ].slice(0, 10);

          saveLocal(
            REC_KEY,
            next
          );

          formMessage(
            "この端末のみに保存しました（デモ）。"
          );
        }

        recommendationForm.reset();
        renderRecommendations();

      } catch (error) {
        console.error(
          "Request failed:",
          error
        );

        formMessage(
          "送信に失敗しました。もう一度お試しください。"
        );

      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    }
  );

  renderRecommendations();
}

// ========================================
// 9. TOP THREE
// ========================================

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

// ========================================
// 10. RANKING ROW
// ========================================

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

// ========================================
// 11. RENDER CHART
// ========================================

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

  const query = (
    search?.value || ""
  ).trim().toLowerCase();

  podium.replaceChildren();
  board.replaceChildren();

  if (
    selectedMonth !== CURRENT_MONTH &&
    !getHistory(selectedMonth, genre)
  ) {
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
      const target = `${
        track.title
      } ${
        track.artist
      }`.toLowerCase();

      if (
        !query ||
        target.includes(query)
      ) {
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

      const target = `${
        track.title
      } ${
        track.artist
      }`.toLowerCase();

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

  const results =
    document.querySelector(
      "#chart-results"
    );

  if (results) {
    results.textContent = query
      ? `${shown} DEMO TRACKS FOUND`
      : `50 SLOTS / ${
          tracks.length
        } DEMO TRACKS`;
  }

  const empty =
    document.querySelector(
      "#chart-empty"
    );

  if (empty) {
    empty.hidden =
      !query || shown !== 0;
  }
}

// ========================================
// 12. HOME PAGE
// ========================================

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
          `DEMO / ${
            String(index + 1)
              .padStart(2, "0")
          }`
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

// ========================================
// 13. NAVIGATION
// ========================================

function initMenu() {
  const button =
    document.querySelector(
      ".mobile-menu"
    );

  const nav =
    document.querySelector(
      ".nav"
    );

  // Fix R&B filename capitalization
  document
    .querySelectorAll("a[href]")
    .forEach(link => {
      const raw = link.getAttribute(
        "href"
      );

      if (
        /^rnb\.html(?:[?#].*)?$/i.test(
          raw || ""
        )
      ) {
        link.setAttribute(
          "href",
          raw.replace(
            /^rnb\.html/i,
            "RnB.html"
          )
        );
      }
    });

  if (button && nav) {
    button.addEventListener(
      "click",
      () => {
        const opened =
          nav.classList.toggle(
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

// ========================================
// 14. APPLICATION START
// ========================================

saveCurrentHistory();

initMenu();

if (page === "home") {
  renderHome();
}

if (page === "chart") {
  initMonthSelector();

  document
    .querySelector("#chart-search")
    ?.addEventListener(
      "input",
      renderChart
    );

  renderChart();
}

// Start Supabase connection
initCloud();
