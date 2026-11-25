
"use strict";

/*
 * AFTERHOURS COMMUNITY CHART
 * STEP 24 - ARTWORK FIX
 *
 * Features:
 * - Correct album artwork display
 * - Supabase voting rankings
 * - Archived monthly rankings
 * - Monthly movement indicators
 * - Automatic refresh (30 seconds)
 * - HIP-HOP / R&B filters
 */

(() => {
  const INTERVAL = 30000;

  const config = window.AFTERHOURS_SUPABASE;
  const library = window.AFTERHOURS_DATA || {};

  const ui = {
    list: document.querySelector("#community-list"),
    status: document.querySelector("#status"),
    empty: document.querySelector("#empty-message"),
    month: document.querySelector("#chart-month"),
    hiphop: document.querySelector("#tab-hiphop"),
    rnb: document.querySelector("#tab-rnb"),
    refresh: document.querySelector("#refresh-chart")
  };

  if (Object.values(ui).some(element => !element)) {
    console.error("Missing community page elements");
    return;
  }

  const state = {
    db: null,
    ready: false,
    genre: "hiphop",
    artwork: {},
    currentMonth: "",
    request: 0,
    loading: false,
    timer: null,
    lastUpdate: 0,
    signature: "",
    loaded: false
  };

  // ======================================
  // DATE
  // ======================================

  function japanMonth() {
    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit"
      }
    ).formatToParts(new Date());

    const year = parts.find(
      part => part.type === "year"
    ).value;

    const month = parts.find(
      part => part.type === "month"
    ).value;

    return `${year}-${month}`;
  }

  function shiftMonth(value, offset) {
    const [year, month] = value.split("-").map(Number);

    return new Date(
      Date.UTC(year, month - 1 + offset, 1)
    ).toISOString().slice(0, 7);
  }

  function formatMonth(value) {
    const [year, month] = value.split("-").map(Number);

    return new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "long",
        timeZone: "UTC"
      }
    ).format(
      new Date(Date.UTC(year, month - 1, 1))
    ).toUpperCase();
  }

  function japanClock() {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo"
      }
    ).format(new Date());
  }

  function fillMonths(selected) {
    const latest = japanMonth();

    ui.month.replaceChildren();

    for (let i = 0; i < 12; i++) {
      const month = shiftMonth(latest, -i);
      const option = document.createElement("option");

      option.value = month;
      option.textContent = formatMonth(month);

      ui.month.append(option);
    }

    ui.month.value = Array.from(ui.month.options)
      .some(option => option.value === selected)
      ? selected
      : latest;

    state.currentMonth = latest;
  }

  function checkMonthRollover() {
    const latest = japanMonth();

    if (latest === state.currentMonth) return;

    const followingCurrent =
      ui.month.value === state.currentMonth;

    fillMonths(
      followingCurrent ? latest : ui.month.value
    );

    state.signature = "";
  }

  // ======================================
  // HELPERS
  // ======================================

  function setStatus(message, error = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("error", error);
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(value);

      if (url.protocol !== "https:") {
        return null;
      }

      return url.href;
    } catch {
      return null;
    }
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function getTracks(genre) {
    const tracks = library[genre];

    return Array.isArray(tracks)
      ? tracks.slice(0, 50)
      : [];
  }

  function updateTabs() {
    const hiphop = state.genre === "hiphop";

    ui.hiphop.classList.toggle("active", hiphop);
    ui.rnb.classList.toggle("active", !hiphop);

    ui.hiphop.setAttribute(
      "aria-pressed",
      String(hiphop)
    );

    ui.rnb.setAttribute(
      "aria-pressed",
      String(!hiphop)
    );
  }

  // ======================================
  // STYLES
  // ======================================

  function installStyles() {
    if (document.querySelector("#ah-community-css")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "ah-community-css";

    style.textContent = `
      .ah-movement {
        display: inline-flex;
        align-items: center;
        margin-top: 9px;
        padding: 5px 9px;
        border-radius: 6px;
        font: 800 10px "Space Grotesk", sans-serif;
        letter-spacing: .5px;
      }
      .ah-movement.up {
        color: #48f3bc;
        background: #48f3bc16;
        border: 1px solid #48f3bc45;
      }
      .ah-movement.down {
        color: #ff92a1;
        background: #ff92a116;
        border: 1px solid #ff92a145;
      }
      .ah-movement.same {
        color: #a9b8ce;
        background: #a9b8ce16;
        border: 1px solid #a9b8ce45;
      }
      .ah-movement.new {
        color: #eaa4ff;
        background: #eaa4ff16;
        border: 1px solid #eaa4ff45;
      }
      .ah-chart-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 13px 16px;
        margin: 0 0 22px;
        border: 1px solid #273147;
        border-radius: 10px;
        background: #111729;
        color: #98a6bd;
        font-size: 12px;
        line-height: 1.6;
      }
      .ah-state-label {
        padding: 5px 10px;
        border-radius: 5px;
        font: 800 11px "Space Grotesk", sans-serif;
        letter-spacing: 1px;
      }
      .ah-state-label.live {
        color: #40e5ed;
        background: #40e5ed1b;
      }
      .ah-state-label.final {
        color: #48f3bc;
        background: #48f3bc1b;
      }
      .ah-state-label.provisional {
        color: #ffce82;
        background: #ffce821b;
      }
      .artwork {
        position: relative;
        overflow: hidden;
      }
      .artwork img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `;

    document.head.append(style);
  }

  function ensureMeta() {
    let meta = document.querySelector("#ah-chart-meta");

    if (meta) return meta;

    meta = document.createElement("div");
    meta.id = "ah-chart-meta";
    meta.className = "ah-chart-meta";

    document.querySelector(".board-heading")
      ?.insertAdjacentElement("afterend", meta);

    return meta;
  }

  function updateMeta(chart, previous) {
    const meta = ensureMeta();

    const label = document.createElement("span");
    label.className =
      `ah-state-label ${chart.status.toLowerCase()}`;
    label.textContent = chart.status;

    const description = document.createElement("span");

    const detail = chart.status === "FINAL"
      ? "Finalized community vote results"
      : chart.status === "LIVE"
        ? "Voting currently open"
        : "Past results not yet finalized";

    description.textContent =
      `${formatMonth(chart.month)} · ${detail}`;

    const comparison = document.createElement("span");

    comparison.textContent =
      !previous.available
        ? "Monthly movement: comparison unavailable"
        : previous.ranking.length === 0
          ? "Monthly movement: no previous-month votes"
          : `Compared with ${formatMonth(previous.month)}`;

    meta.replaceChildren(
      label,
      description,
      comparison
    );
  }

  // ======================================
  // ARTWORK
  // ======================================

  async function loadArtwork() {
    try {
      const response = await fetch(
        "images/artwork-map.json",
        { cache: "no-cache" }
      );

      if (!response.ok) {
        throw new Error(
          `Artwork map HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
      ) {
        state.artwork = result;

        console.info(
          "[AFTERHOURS] Artwork entries:",
          Object.keys(result).length
        );
      }
    } catch (error) {
      console.warn(
        "[AFTERHOURS] Artwork loading failed:",
        error
      );
    }
  }

  function createArtwork(track) {
    const box = document.createElement("div");
    box.className = "artwork";

    const fallback = document.createElement("span");
    fallback.textContent = String(
      track.title || "?"
    ).charAt(0).toUpperCase();

    const saved = state.artwork[track.id];

    if (!saved) {
      box.append(fallback);
      return box;
    }

    // Prevent a different song's artwork
    // from being attached to this track.
    if (
      normalize(saved.title) !== normalize(track.title) ||
      normalize(saved.artist) !== normalize(track.artist)
    ) {
      console.warn(
        "[AFTERHOURS] Artwork metadata mismatch:",
        track.id
      );

      box.append(fallback);
      return box;
    }

    const url = safeImageUrl(saved.image);

    if (!url) {
      box.append(fallback);
      return box;
    }

    const image = document.createElement("img");

    image.alt = `${track.title} artwork`;
    image.loading = "lazy";
    image.decoding = "async";

    // IMPORTANT FIX:
    // Put the image in the DOM immediately.
    // The old implementation waited for onload
    // and checked box.isConnected. That could
    // leave the artwork permanently hidden.
    image.onerror = () => {
      console.warn(
        "[AFTERHOURS] Image failed:",
        track.id
      );

      box.replaceChildren(fallback);
    };

    image.src = url;
    box.append(image);

    return box;
  }

  // ======================================
  // DATABASE
  // ======================================

  async function rpc(name, params) {
    const { data, error } = await state.db.rpc(
      name,
      params
    );

    if (error) throw error;

    return data;
  }

  function voteTotals(rows) {
    const totals = new Map();

    for (const row of rows || []) {
      const votes = Number(row.votes);

      if (
        typeof row.track_id === "string" &&
        Number.isSafeInteger(votes) &&
        votes > 0
      ) {
        totals.set(row.track_id, votes);
      }
    }

    return totals;
  }

  function rankLive(genre, rows) {
    const totals = voteTotals(rows);

    return getTracks(genre)
      .map(track => ({
        track,
        votes: totals.get(track.id) || 0
      }))
      .filter(item => item.votes > 0)
      .sort((a, b) =>
        b.votes - a.votes ||
        a.track.id.localeCompare(b.track.id)
      )
      .slice(0, 50)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }

  function rankArchived(genre, rows) {
    const tracks = new Map(
      getTracks(genre).map(track => [
        track.id,
        track
      ])
    );

    return (rows || [])
      .filter(row => tracks.has(row.track_id))
      .map(row => ({
        track: tracks.get(row.track_id),
        votes: Number(row.votes),
        rank: Number(row.chart_rank)
      }))
      .filter(item =>
        Number.isSafeInteger(item.votes) &&
        item.votes > 0 &&
        Number.isInteger(item.rank) &&
        item.rank >= 1 &&
        item.rank <= 50
      )
      .sort((a, b) => a.rank - b.rank);
  }

  async function getChart(month, genre) {
    const finalized = await rpc(
      "is_chart_month_finalized",
      { p_month: month }
    );

    if (finalized === true) {
      const rows = await rpc(
        "get_archived_chart",
        { p_month: month }
      );

      return {
        month,
        status: "FINAL",
        ranking: rankArchived(genre, rows)
      };
    }

    if (finalized !== false) {
      throw new Error("Invalid finalized status");
    }

    const rows = await rpc(
      "get_vote_counts",
      { p_month: month }
    );

    return {
      month,
      status:
        month === japanMonth()
          ? "LIVE"
          : "PROVISIONAL",
      ranking: rankLive(genre, rows)
    };
  }

  // ======================================
  // MOVEMENT
  // ======================================

  function addMovement(current, previous) {
    if (
      !previous.available ||
      previous.ranking.length === 0
    ) {
      return current.map(item => ({
        ...item,
        movement: null
      }));
    }

    const positions = new Map(
      previous.ranking.map(item => [
        item.track.id,
        item.rank
      ])
    );

    return current.map(item => {
      const oldRank = positions.get(item.track.id);

      if (oldRank === undefined) {
        return {
          ...item,
          movement: {
            type: "new",
            label: "NEW"
          }
        };
      }

      const change = oldRank - item.rank;

      return {
        ...item,
        movement:
          change > 0
            ? {
                type: "up",
                label: `↑ UP ${change}`
              }
            : change < 0
              ? {
                  type: "down",
                  label: `↓ DOWN ${Math.abs(change)}`
                }
              : {
                  type: "same",
                  label: "— SAME"
                }
      };
    });
  }

  // ======================================
  // RENDER
  // ======================================

  function createRow(item) {
    const row = document.createElement("li");
    row.className = "chart-row";

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(
      item.rank
    ).padStart(2, "0");

    const info = document.createElement("div");
    info.className = "song-info";

    const title = document.createElement("h3");
    title.textContent = item.track.title;

    const artist = document.createElement("p");
    artist.textContent = item.track.artist;

    info.append(title, artist);

    if (item.movement) {
      const badge = document.createElement("span");

      badge.className =
        `ah-movement ${item.movement.type}`;

      badge.textContent = item.movement.label;

      info.append(badge);
    }

    const votes = document.createElement("div");
    votes.className = "votes";

    const number = document.createElement("span");
    number.textContent =
      item.votes.toLocaleString("en-US");

    const label = document.createElement("small");
    label.textContent = "VOTES";

    votes.append(number, label);

    row.append(
      rank,
      createArtwork(item.track),
      info,
      votes
    );

    return row;
  }

  function render(chart, ranking) {
    const signature = JSON.stringify({
      genre: state.genre,
      month: chart.month,
      status: chart.status,
      rows: ranking.map(item => [
        item.track.id,
        item.rank,
        item.votes,
        item.movement?.label || ""
      ])
    });

    if (
      state.loaded &&
      signature === state.signature
    ) {
      return;
    }

    const fragment =
      document.createDocumentFragment();

    for (const item of ranking) {
      fragment.append(createRow(item));
    }

    ui.list.replaceChildren(fragment);

    ui.empty.hidden = ranking.length > 0;

    if (ranking.length === 0) {
      ui.empty.textContent =
        chart.status === "FINAL"
          ? "No votes were recorded for this genre in the finalized month."
          : "No votes have been recorded for this genre and month yet.";
    }

    state.signature = signature;
    state.loaded = true;
  }

  // ======================================
  // REFRESH
  // ======================================

  async function loadRanking(reason = "manual") {
    if (!state.ready) return;

    if (reason === "auto" && document.hidden) {
      return;
    }

    if (reason === "auto" && state.loading) {
      return;
    }

    checkMonthRollover();

    const requestId = ++state.request;

    const month = ui.month.value;
    const genre = state.genre;
    const previousMonth = shiftMonth(month, -1);

    state.loading = true;
    ui.refresh.disabled = true;

    setStatus(
      state.loaded
        ? "SYNCING CHART..."
        : "LOADING CHART..."
    );

    try {
      const [chart, previous] = await Promise.all([
        getChart(month, genre),

        getChart(previousMonth, genre)
          .then(result => ({
            ...result,
            available: true
          }))
          .catch(error => {
            console.warn(
              "Previous chart unavailable:",
              error
            );

            return {
              month: previousMonth,
              ranking: [],
              available: false
            };
          })
      ]);

      if (requestId !== state.request) {
        return;
      }

      const ranking = addMovement(
        chart.ranking,
        previous
      );

      render(chart, ranking);
      updateMeta(chart, previous);

      state.lastUpdate = Date.now();

      setStatus(
        `● ${chart.status} / ` +
        `${ranking.length} TRACKS / ` +
        `${japanClock()} JST`
      );
    } catch (error) {
      if (requestId !== state.request) {
        return;
      }

      console.error(
        "[AFTERHOURS] Chart error:",
        error
      );

      setStatus(
        state.loaded
          ? "SYNC FAILED / SHOWING LAST RESULTS"
          : "DATABASE ERROR / PLEASE RETRY",
        true
      );
    } finally {
      if (requestId === state.request) {
        state.loading = false;
        ui.refresh.disabled = false;
      }
    }
  }

  // ======================================
  // AUTHENTICATION
  // ======================================

  async function connect() {
    if (
      !config ||
      !safeImageUrl(config.url) ||
      !config.publishableKey
    ) {
      throw new Error(
        "Supabase configuration missing"
      );
    }

    if (!window.supabase?.createClient) {
      throw new Error("Supabase SDK unavailable");
    }

    state.db = window.supabase.createClient(
      config.url,
      config.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );

    const session = await state.db.auth.getSession();

    if (session.error) {
      throw session.error;
    }

    if (!session.data.session) {
      const result = await state.db.auth
        .signInAnonymously();

      if (result.error) throw result.error;
    }

    const user = await state.db.auth.getUser();

    if (user.error || !user.data.user) {
      throw user.error ||
        new Error("Authentication failed");
    }

    state.ready = true;
  }

  // ======================================
  // AUTO REFRESH
  // ======================================

  function stopTimer() {
    if (state.timer !== null) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function startTimer() {
    stopTimer();

    state.timer = setInterval(() => {
      if (
        state.ready &&
        !document.hidden &&
        !state.loading
      ) {
        loadRanking("auto");
      }
    }, INTERVAL);
  }

  // ======================================
  // EVENTS
  // ======================================

  ui.hiphop.addEventListener("click", () => {
    if (state.genre === "hiphop") return;

    state.genre = "hiphop";
    updateTabs();
    loadRanking("genre");
  });

  ui.rnb.addEventListener("click", () => {
    if (state.genre === "rnb") return;

    state.genre = "rnb";
    updateTabs();
    loadRanking("genre");
  });

  ui.month.addEventListener(
    "change",
    () => loadRanking("month")
  );

  ui.refresh.addEventListener(
    "click",
    () => loadRanking("manual")
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!state.ready || document.hidden) return;

      if (Date.now() - state.lastUpdate >= 10000) {
        loadRanking("return");
      }
    }
  );

  window.addEventListener("pagehide", stopTimer);

  window.addEventListener("pageshow", event => {
    if (event.persisted && state.ready) {
      startTimer();
      loadRanking("return");
    }
  });

  // ======================================
  // START
  // ======================================

  async function start() {
    installStyles();
    fillMonths(japanMonth());
    updateTabs();

    ui.refresh.disabled = true;
    setStatus("CONNECTING TO SUPABASE...");

    try {
      await Promise.all([
        connect(),
        loadArtwork()
      ]);

      await loadRanking("initial");

      startTimer();
    } catch (error) {
      console.error(
        "[AFTERHOURS] Startup failed:",
        error
      );

      setStatus(
        "CONNECTION FAILED / CHECK CONSOLE",
        true
      );

      ui.refresh.disabled = false;
    }
  }

  start();
})();
