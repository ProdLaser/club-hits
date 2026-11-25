
"use strict";

/*
 * AFTERHOURS STEP 24
 * COMMUNITY CHART - MONTHLY ARCHIVE SUPPORT
 *
 * - Live Supabase voting rankings
 * - Finalized monthly chart snapshots
 * - LIVE / FINAL / PROVISIONAL labels
 * - Previous-month movement
 * - HIP-HOP / R&B
 * - Automatic refresh every 30 seconds
 * - Refresh on tab return
 * - Album artwork cache
 *
 * No changes to existing voting pages.
 */

(() => {
  const REFRESH_INTERVAL = 30_000;
  const CONFIG = window.AFTERHOURS_SUPABASE;
  const DATA = window.AFTERHOURS_DATA || {};

  const ui = {
    list: document.querySelector("#community-list"),
    status: document.querySelector("#status"),
    empty: document.querySelector("#empty-message"),
    month: document.querySelector("#chart-month"),
    hiphop: document.querySelector("#tab-hiphop"),
    rnb: document.querySelector("#tab-rnb"),
    refresh: document.querySelector("#refresh-chart")
  };

  if (Object.values(ui).some(value => !value)) {
    console.error(
      "[AFTERHOURS] Required page elements are missing."
    );
    return;
  }

  const state = {
    db: null,
    ready: false,
    genre: "hiphop",
    artwork: {},
    latestMonth: "",
    requestId: 0,
    loading: false,
    timer: null,
    lastUpdated: 0,
    signature: null,
    loaded: false,
    lastGoodLabel: ""
  };

  // =========================================
  // DATE AND TIME
  // =========================================

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
      item => item.type === "year"
    ).value;

    const month = parts.find(
      item => item.type === "month"
    ).value;

    return `${year}-${month}`;
  }

  function shiftMonth(value, offset) {
    const [year, month] = value
      .split("-")
      .map(Number);

    const date = new Date(
      Date.UTC(year, month - 1 + offset, 1)
    );

    return date.toISOString().slice(0, 7);
  }

  function monthLabel(value) {
    const [year, month] = value
      .split("-")
      .map(Number);

    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "UTC",
        year: "numeric",
        month: "long"
      }
    ).format(
      new Date(Date.UTC(year, month - 1, 1))
    ).toUpperCase();
  }

  function japanClock() {
    return new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }
    ).format(new Date());
  }

  function populateMonths(selected) {
    const latest = japanMonth();

    ui.month.replaceChildren();

    for (let i = 0; i < 12; i++) {
      const value = shiftMonth(latest, -i);

      const option = document.createElement(
        "option"
      );

      option.value = value;
      option.textContent = monthLabel(value);

      ui.month.append(option);
    }

    const valid = Array.from(
      ui.month.options
    ).some(option => option.value === selected);

    ui.month.value = valid ? selected : latest;
    state.latestMonth = latest;
  }

  function checkMonthChange() {
    const latest = japanMonth();

    if (latest === state.latestMonth) {
      return;
    }

    const watchingCurrent =
      ui.month.value === state.latestMonth;

    populateMonths(
      watchingCurrent ? latest : ui.month.value
    );

    state.signature = null;
  }

  // =========================================
  // COMMON HELPERS
  // =========================================

  function setStatus(message, error = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("error", error);
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:"
        ? url.href
        : null;
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
    const items = DATA[genre];
    return Array.isArray(items)
      ? items.slice(0, 50)
      : [];
  }

  function updateGenreTabs() {
    const hiphop = state.genre === "hiphop";

    ui.hiphop.classList.toggle(
      "active",
      hiphop
    );

    ui.rnb.classList.toggle(
      "active",
      !hiphop
    );

    ui.hiphop.setAttribute(
      "aria-pressed",
      String(hiphop)
    );

    ui.rnb.setAttribute(
      "aria-pressed",
      String(!hiphop)
    );
  }

  // =========================================
  // STATUS DESIGN
  // =========================================

  function installStyles() {
    if (document.querySelector("#ah-extra-css")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "ah-extra-css";

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
        margin: 0 0 22px;
        padding: 13px 16px;
        border: 1px solid #273147;
        border-radius: 10px;
        background: #111729;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
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
    `;

    document.head.append(style);
  }

  function ensureMeta() {
    let container = document.querySelector(
      "#ah-chart-meta"
    );

    if (container) {
      return container;
    }

    container = document.createElement("div");
    container.id = "ah-chart-meta";
    container.className = "ah-chart-meta";

    const heading = document.querySelector(
      ".board-heading"
    );

    if (heading) {
      heading.insertAdjacentElement(
        "afterend",
        container
      );
    }

    return container;
  }

  function updateMeta(chart, previous) {
    const container = ensureMeta();

    const label = document.createElement("span");

    label.className =
      `ah-state-label ${chart.status.toLowerCase()}`;

    label.textContent = chart.status;

    const description = document.createElement("span");

    if (chart.status === "FINAL") {
      description.textContent =
        `${monthLabel(chart.month)} · ` +
        "Officially finalized community vote results";
    } else if (chart.status === "LIVE") {
      description.textContent =
        `${monthLabel(chart.month)} · ` +
        "Voting currently open";
    } else {
      description.textContent =
        `${monthLabel(chart.month)} · ` +
        "Past results not yet finalized";
    }

    const movement = document.createElement(
      "span"
    );

    if (!previous.available) {
      movement.textContent =
        "Monthly movement: comparison unavailable";
    } else if (previous.ranking.length === 0) {
      movement.textContent =
        "Monthly movement: no previous-month votes";
    } else {
      movement.textContent =
        `Compared with ${monthLabel(previous.month)}`;
    }

    container.replaceChildren(
      label,
      description,
      movement
    );
  }

  // =========================================
  // ARTWORK CACHE
  // =========================================

  async function loadArtwork() {
    try {
      const response = await fetch(
        "images/artwork-map.json",
        { cache: "no-cache" }
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();

      if (
        result &&
        typeof result === "object" &&
        !Array.isArray(result)
      ) {
        state.artwork = result;
      }
    } catch (error) {
      console.warn(
        "[AFTERHOURS] Artwork unavailable:",
        error
      );
    }
  }

  function createArtwork(track) {
    const container = document.createElement(
      "div"
    );

    container.className = "artwork";
    container.textContent = String(
      track.title || "?"
    ).charAt(0).toUpperCase();

    const saved = state.artwork[track.id];

    if (!saved) {
      return container;
    }

    if (
      normalize(saved.title) !==
        normalize(track.title) ||
      normalize(saved.artist) !==
        normalize(track.artist)
    ) {
      return container;
    }

    const url = safeHttpsUrl(saved.image);

    if (!url) {
      return container;
    }

    const image = document.createElement(
      "img"
    );

    image.alt = `${track.title} artwork`;
    image.loading = "lazy";
    image.decoding = "async";

    image.onload = () => {
      if (container.isConnected) {
        container.replaceChildren(image);
      }
    };

    image.src = url;

    return container;
  }

  // =========================================
  // SUPABASE DATABASE
  // =========================================

  async function callRpc(name, params) {
    const { data, error } = await state.db.rpc(
      name,
      params
    );

    if (error) {
      throw error;
    }

    return data;
  }

  function voteTotals(rows) {
    const totals = new Map();

    for (const row of rows || []) {
      const count = Number(row.votes);

      if (
        typeof row.track_id === "string" &&
        Number.isSafeInteger(count) &&
        count > 0
      ) {
        totals.set(row.track_id, count);
      }
    }

    return totals;
  }

  function rankLiveTracks(genre, totals) {
    return getTracks(genre)
      .map(track => ({
        track,
        votes: totals.get(track.id) || 0
      }))
      .filter(item => item.votes > 0)
      .sort((a, b) => {
        if (a.votes !== b.votes) {
          return b.votes - a.votes;
        }

        return a.track.id.localeCompare(
          b.track.id
        );
      })
      .slice(0, 50)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }

  function rankArchivedTracks(genre, rows) {
    const tracks = new Map(
      getTracks(genre).map(
        track => [track.id, track]
      )
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

  async function getMonthlyChart(month, genre) {
    const finalized = await callRpc(
      "is_chart_month_finalized",
      { p_month: month }
    );

    // Never replace an archived result with
    // a recalculated live vote count.
    if (finalized === true) {
      const rows = await callRpc(
        "get_archived_chart",
        { p_month: month }
      );

      return {
        month,
        status: "FINAL",
        ranking: rankArchivedTracks(
          genre,
          rows
        )
      };
    }

    if (finalized !== false) {
      throw new Error(
        "Invalid archive status response."
      );
    }

    const rows = await callRpc(
      "get_vote_counts",
      { p_month: month }
    );

    return {
      month,
      status: month === japanMonth()
        ? "LIVE"
        : "PROVISIONAL",
      ranking: rankLiveTracks(
        genre,
        voteTotals(rows)
      )
    };
  }

  // =========================================
  // PREVIOUS MONTH MOVEMENT
  // =========================================

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
      const oldRank = positions.get(
        item.track.id
      );

      if (oldRank === undefined) {
        return {
          ...item,
          movement: {
            type: "new",
            label: "NEW"
          }
        };
      }

      const difference = oldRank - item.rank;

      if (difference > 0) {
        return {
          ...item,
          movement: {
            type: "up",
            label: `↑ UP ${difference}`
          }
        };
      }

      if (difference < 0) {
        return {
          ...item,
          movement: {
            type: "down",
            label: `↓ DOWN ${Math.abs(difference)}`
          }
        };
      }

      return {
        ...item,
        movement: {
          type: "same",
          label: "— SAME"
        }
      };
    });
  }

  // =========================================
  // RENDER RANKING
  // =========================================

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
      const movement = document.createElement(
        "span"
      );

      movement.className =
        `ah-movement ${item.movement.type}`;

      movement.textContent =
        item.movement.label;

      info.append(movement);
    }

    const votes = document.createElement(
      "div"
    );

    votes.className = "votes";

    const amount = document.createElement(
      "span"
    );

    amount.textContent =
      item.votes.toLocaleString("en-US");

    const label = document.createElement(
      "small"
    );

    label.textContent = "VOTES";

    votes.append(amount, label);

    row.append(
      rank,
      createArtwork(item.track),
      info,
      votes
    );

    return row;
  }

  function renderRanking(chart, rows) {
    const signature = JSON.stringify({
      genre: state.genre,
      month: chart.month,
      status: chart.status,
      rows: rows.map(item => [
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

    for (const item of rows) {
      fragment.append(createRow(item));
    }

    ui.list.replaceChildren(fragment);
    ui.empty.hidden = rows.length !== 0;

    if (rows.length === 0) {
      ui.empty.textContent =
        chart.status === "FINAL"
          ? "No votes were recorded for this genre in the finalized month."
          : "No votes have been recorded for this genre and month yet.";
    }

    state.signature = signature;
    state.loaded = true;
  }

  // =========================================
  // SYNC WITH DATABASE
  // =========================================

  async function loadRanking(reason = "manual") {
    if (!state.ready || !state.db) {
      return;
    }

    if (reason === "auto" && document.hidden) {
      return;
    }

    if (reason === "auto" && state.loading) {
      return;
    }

    checkMonthChange();

    const requestId = ++state.requestId;
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
      // The selected month must load successfully.
      // A failed comparison must not hide the chart.
      const [chart, previousResult] =
        await Promise.all([
          getMonthlyChart(month, genre),
          getMonthlyChart(previousMonth, genre)
            .then(value => ({
              available: true,
              ...value
            }))
            .catch(error => {
              console.warn(
                "[AFTERHOURS] Comparison unavailable:",
                error
              );

              return {
                available: false,
                month: previousMonth,
                ranking: []
              };
            })
        ]);

      // Ignore responses from older requests.
      if (requestId !== state.requestId) {
        return;
      }

      const ranked = addMovement(
        chart.ranking,
        previousResult
      );

      renderRanking(chart, ranked);
      updateMeta(chart, previousResult);

      state.lastUpdated = Date.now();

      state.lastGoodLabel =
        `${chart.status} / ${ranked.length} TRACKS`;

      setStatus(
        `● ${state.lastGoodLabel} / ` +
        `${japanClock()} JST`
      );

      console.info(
        "[AFTERHOURS] Chart updated",
        {
          reason,
          genre,
          month,
          chartStatus: chart.status,
          tracks: ranked.length
        }
      );

    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }

      console.error(
        "[AFTERHOURS] Ranking update failed:",
        error
      );

      if (state.loaded) {
        setStatus(
          "SYNC FAILED / SHOWING LAST RESULTS",
          true
        );
      } else {
        ui.list.replaceChildren();
        ui.empty.hidden = true;

        setStatus(
          "DATABASE ERROR / PLEASE RETRY",
          true
        );
      }

    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        ui.refresh.disabled = false;
      }
    }
  }

  // =========================================
  // SUPABASE CONNECTION
  // =========================================

  async function connectSupabase() {
    if (
      !CONFIG ||
      !safeHttpsUrl(CONFIG.url) ||
      !CONFIG.publishableKey
    ) {
      throw new Error(
        "Supabase configuration missing."
      );
    }

    if (!window.supabase?.createClient) {
      throw new Error(
        "Supabase SDK failed to load."
      );
    }

    state.db = window.supabase.createClient(
      CONFIG.url,
      CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );

    const session =
      await state.db.auth.getSession();

    if (session.error) {
      throw session.error;
    }

    if (!session.data.session) {
      const login =
        await state.db.auth.signInAnonymously();

      if (login.error) {
        throw login.error;
      }
    }

    const user = await state.db.auth.getUser();

    if (user.error || !user.data.user) {
      throw user.error ||
        new Error("Authentication failed.");
    }

    state.ready = true;
  }

  // =========================================
  // AUTOMATIC REFRESH
  // =========================================

  function stopAutoRefresh() {
    if (state.timer !== null) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();

    state.timer = setInterval(() => {
      if (
        !state.ready ||
        document.hidden ||
        state.loading
      ) {
        return;
      }

      loadRanking("auto");

    }, REFRESH_INTERVAL);
  }

  // =========================================
  // USER ACTIONS
  // =========================================

  ui.hiphop.addEventListener(
    "click",
    () => {
      if (state.genre === "hiphop") {
        return;
      }

      state.genre = "hiphop";
      updateGenreTabs();
      loadRanking("genre");
    }
  );

  ui.rnb.addEventListener(
    "click",
    () => {
      if (state.genre === "rnb") {
        return;
      }

      state.genre = "rnb";
      updateGenreTabs();
      loadRanking("genre");
    }
  );

  ui.month.addEventListener(
    "change",
    () => {
      loadRanking("month");
    }
  );

  ui.refresh.addEventListener(
    "click",
    () => {
      loadRanking("manual");
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!state.ready || document.hidden) {
        return;
      }

      if (
        Date.now() - state.lastUpdated >= 10_000
      ) {
        loadRanking("return");
      }
    }
  );

  window.addEventListener(
    "pagehide",
    stopAutoRefresh
  );

  window.addEventListener(
    "pageshow",
    event => {
      if (event.persisted && state.ready) {
        startAutoRefresh();
        loadRanking("return");
      }
    }
  );

  // =========================================
  // INITIALIZE
  // =========================================

  async function start() {
    installStyles();
    populateMonths(japanMonth());
    updateGenreTabs();

    ui.refresh.disabled = true;
    setStatus("CONNECTING TO SUPABASE...");

    try {
      await Promise.all([
        connectSupabase(),
        loadArtwork()
      ]);

      await loadRanking("initial");
      startAutoRefresh();

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
