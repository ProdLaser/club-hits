
"use strict";

/*
 * AFTERHOURS - STEP 23
 * GLOBAL COMMUNITY CHART
 *
 * - Supabase vote rankings
 * - Previous-month rank comparison
 * - UP / DOWN / SAME / NEW indicators
 * - 30-second automatic updates
 * - Refresh when returning to the tab
 * - HIP-HOP and R&B switching
 * - Album artwork cache
 *
 * Existing voting functionality is untouched.
 */

(() => {
  const REFRESH_INTERVAL = 30_000;

  const CONFIG = window.AFTERHOURS_SUPABASE;
  const DATA = window.AFTERHOURS_DATA || {};

  const elements = {
    list: document.querySelector("#community-list"),
    status: document.querySelector("#status"),
    empty: document.querySelector("#empty-message"),
    month: document.querySelector("#chart-month"),
    hiphop: document.querySelector("#tab-hiphop"),
    rnb: document.querySelector("#tab-rnb"),
    refresh: document.querySelector("#refresh-chart")
  };

  const state = {
    db: null,
    ready: false,
    genre: "hiphop",
    artwork: {},
    requestId: 0,
    loading: false,
    timer: null,
    lastUpdated: 0,
    signature: null,
    loaded: false,
    currentMonth: ""
  };

  // ------------------------------------------
  // SAFETY CHECK
  // ------------------------------------------

  function requiredElementsExist() {
    return Object.values(elements).every(Boolean);
  }

  if (!requiredElementsExist()) {
    console.error(
      "[AFTERHOURS] Community HTML elements missing."
    );
    return;
  }

  // ------------------------------------------
  // DATE FUNCTIONS
  // ------------------------------------------

  function getJapanMonth() {
    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "2-digit",
        timeZone: "Asia/Tokyo"
      }
    ).formatToParts(new Date());

    const year = parts.find(
      item => item.type === "year"
    )?.value;

    const month = parts.find(
      item => item.type === "month"
    )?.value;

    return `${year}-${month}`;
  }

  function shiftMonth(value, monthsBack) {
    const [year, month] = value
      .split("-")
      .map(Number);

    const date = new Date(
      Date.UTC(
        year,
        month - 1 - monthsBack,
        1
      )
    );

    return date.toISOString().slice(0, 7);
  }

  function formatMonth(value) {
    const [year, month] = value
      .split("-")
      .map(Number);

    const date = new Date(
      Date.UTC(year, month - 1, 1)
    );

    return new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "long",
        timeZone: "UTC"
      }
    ).format(date).toUpperCase();
  }

  function japanTime() {
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

  function populateMonths(selectedMonth) {
    const latest = getJapanMonth();

    elements.month.replaceChildren();

    for (let i = 0; i < 12; i++) {
      const value = shiftMonth(latest, i);

      const option = document.createElement(
        "option"
      );

      option.value = value;
      option.textContent = formatMonth(value);

      elements.month.append(option);
    }

    const isAvailable = Array.from(
      elements.month.options
    ).some(option => option.value === selectedMonth);

    elements.month.value = isAvailable
      ? selectedMonth
      : latest;

    state.currentMonth = latest;
  }

  function checkMonthRollover() {
    const latest = getJapanMonth();

    if (latest === state.currentMonth) {
      return;
    }

    const wasViewingCurrent =
      elements.month.value === state.currentMonth;

    const selected = wasViewingCurrent
      ? latest
      : elements.month.value;

    populateMonths(selected);

    state.signature = null;
  }

  // ------------------------------------------
  // BASIC HELPERS
  // ------------------------------------------

  function setStatus(message, error = false) {
    elements.status.textContent = message;

    elements.status.classList.toggle(
      "error",
      error
    );
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

  function getTracks() {
    const tracks = DATA[state.genre];

    return Array.isArray(tracks)
      ? tracks.slice(0, 50)
      : [];
  }

  // ------------------------------------------
  // EXTRA STYLES
  // ------------------------------------------

  function installMovementStyles() {
    if (
      document.getElementById(
        "afterhours-movement-styles"
      )
    ) {
      return;
    }

    const css = document.createElement("style");

    css.id = "afterhours-movement-styles";

    css.textContent = `
      .ah-track-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 9px;
      }

      .ah-movement {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 9px;
        border-radius: 6px;
        font-family: "Space Grotesk", sans-serif;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.6px;
        white-space: nowrap;
      }

      .ah-movement.up {
        color: #45f5c0;
        background: rgba(69, 245, 192, 0.10);
        border: 1px solid rgba(69, 245, 192, 0.24);
      }

      .ah-movement.down {
        color: #ff8d9b;
        background: rgba(255, 141, 155, 0.10);
        border: 1px solid rgba(255, 141, 155, 0.24);
      }

      .ah-movement.same {
        color: #a5b3cc;
        background: rgba(165, 179, 204, 0.08);
        border: 1px solid rgba(165, 179, 204, 0.18);
      }

      .ah-movement.new {
        color: #f3bafa;
        background: rgba(243, 186, 250, 0.10);
        border: 1px solid rgba(243, 186, 250, 0.24);
      }

      .ah-comparison {
        margin: 0 0 18px;
        color: #98a6bd;
        font-size: 12px;
        line-height: 1.7;
      }

      .ah-comparison strong {
        color: #40e5ed;
      }
    `;

    document.head.append(css);
  }

  function ensureComparisonInfo() {
    let info = document.getElementById(
      "ah-comparison-info"
    );

    if (info) {
      return info;
    }

    info = document.createElement("p");
    info.id = "ah-comparison-info";
    info.className = "ah-comparison";
    info.setAttribute("aria-live", "polite");

    const heading = document.querySelector(
      ".board-heading"
    );

    if (heading) {
      heading.insertAdjacentElement(
        "afterend",
        info
      );
    }

    return info;
  }

  function setComparisonInfo(message) {
    const info = ensureComparisonInfo();

    info.textContent = message;
  }

  // ------------------------------------------
  // GENRE CONTROLS
  // ------------------------------------------

  function updateGenreButtons() {
    const isHipHop = state.genre === "hiphop";

    elements.hiphop.classList.toggle(
      "active",
      isHipHop
    );

    elements.rnb.classList.toggle(
      "active",
      !isHipHop
    );

    elements.hiphop.setAttribute(
      "aria-pressed",
      String(isHipHop)
    );

    elements.rnb.setAttribute(
      "aria-pressed",
      String(!isHipHop)
    );
  }

  // ------------------------------------------
  // ARTWORK
  // ------------------------------------------

  async function loadArtworkMap() {
    try {
      const response = await fetch(
        "images/artwork-map.json",
        { cache: "no-cache" }
      );

      if (!response.ok) {
        return;
      }

      const map = await response.json();

      if (
        map &&
        typeof map === "object" &&
        !Array.isArray(map)
      ) {
        state.artwork = map;
      }
    } catch (error) {
      console.warn(
        "[AFTERHOURS] Artwork unavailable",
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

  // ------------------------------------------
  // VOTE DATA
  // ------------------------------------------

  async function fetchVotes(month) {
    const { data, error } = await state.db.rpc(
      "get_vote_counts",
      { p_month: month }
    );

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  function voteMap(rows) {
    const totals = new Map();

    for (const item of rows) {
      const votes = Number(item.votes);

      if (
        typeof item.track_id === "string" &&
        Number.isSafeInteger(votes) &&
        votes > 0
      ) {
        totals.set(item.track_id, votes);
      }
    }

    return totals;
  }

  function rankTracks(tracks, totals) {
    return tracks
      .map(track => ({
        track,
        votes: totals.get(track.id) || 0
      }))
      .filter(item => item.votes > 0)
      .sort((a, b) => {
        if (b.votes !== a.votes) {
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

  // ------------------------------------------
  // MONTHLY MOVEMENT
  // ------------------------------------------

  function calculateMovement(
    currentRanking,
    previousRanking,
    hasPreviousChart
  ) {
    if (!hasPreviousChart) {
      return currentRanking.map(item => ({
        ...item,
        movement: null
      }));
    }

    const previousPositions = new Map();

    for (const item of previousRanking) {
      previousPositions.set(
        item.track.id,
        item.rank
      );
    }

    return currentRanking.map(item => {
      const previousRank = previousPositions.get(
        item.track.id
      );

      if (previousRank === undefined) {
        return {
          ...item,
          movement: {
            type: "new",
            label: "NEW"
          }
        };
      }

      const difference = previousRank - item.rank;

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

  // ------------------------------------------
  // CREATE CHART ROW
  // ------------------------------------------

  function createMovementBadge(movement) {
    const badge = document.createElement(
      "span"
    );

    badge.className =
      `ah-movement ${movement.type}`;

    badge.textContent = movement.label;

    return badge;
  }

  function createRow(item) {
    const row = document.createElement(
      "li"
    );

    row.className = "chart-row";

    const rank = document.createElement(
      "span"
    );

    rank.className = "rank";

    rank.textContent = String(
      item.rank
    ).padStart(2, "0");

    const info = document.createElement(
      "div"
    );

    info.className = "song-info";

    const title = document.createElement(
      "h3"
    );

    title.textContent = item.track.title;

    const artist = document.createElement(
      "p"
    );

    artist.textContent = item.track.artist;

    info.append(title, artist);

    if (item.movement) {
      const meta = document.createElement(
        "div"
      );

      meta.className = "ah-track-meta";

      meta.append(
        createMovementBadge(item.movement)
      );

      info.append(meta);
    }

    const count = document.createElement(
      "div"
    );

    count.className = "votes";

    const number = document.createElement(
      "span"
    );

    number.textContent =
      item.votes.toLocaleString("en-US");

    const label = document.createElement(
      "small"
    );

    label.textContent = "VOTES";

    count.append(number, label);

    row.append(
      rank,
      createArtwork(item.track),
      info,
      count
    );

    return row;
  }

  // ------------------------------------------
  // RENDER RANKING
  // ------------------------------------------

  function renderRanking(rows) {
    const signature = JSON.stringify({
      genre: state.genre,
      month: elements.month.value,
      tracks: rows.map(item => [
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

    elements.list.replaceChildren(fragment);

    elements.empty.hidden = rows.length > 0;

    state.signature = signature;
    state.loaded = true;
  }

  // ------------------------------------------
  // LOAD BOTH MONTHS
  // ------------------------------------------

  async function loadRanking(
    reason = "manual"
  ) {
    if (!state.ready || !state.db) {
      return;
    }

    if (
      reason === "auto" &&
      document.hidden
    ) {
      return;
    }

    if (
      reason === "auto" &&
      state.loading
    ) {
      return;
    }

    checkMonthRollover();

    const requestId = ++state.requestId;

    const selectedMonth = elements.month.value;
    const previousMonth = shiftMonth(
      selectedMonth,
      1
    );

    const selectedGenre = state.genre;

    state.loading = true;
    elements.refresh.disabled = true;

    if (!state.loaded) {
      setStatus("LOADING VOTES...");
    } else {
      setStatus("SYNCING VOTES...");
    }

    try {
      // The current month is required.
      // The previous month is optional:
      // current chart still works if comparison fails.
      const [currentRows, previousResult] =
        await Promise.all([
          fetchVotes(selectedMonth),
          fetchVotes(previousMonth)
            .then(rows => ({
              success: true,
              rows
            }))
            .catch(error => ({
              success: false,
              error,
              rows: []
            }))
        ]);

      if (requestId !== state.requestId) {
        return;
      }

      if (selectedGenre !== state.genre) {
        return;
      }

      const tracks = getTracks();

      const currentRanking = rankTracks(
        tracks,
        voteMap(currentRows)
      );

      let displayRows = currentRanking;

      if (previousResult.success) {
        const previousRanking = rankTracks(
          tracks,
          voteMap(previousResult.rows)
        );

        // No previous votes means no usable
        // reference ranking for this genre.
        const hasPreviousChart =
          previousRanking.length > 0;

        displayRows = calculateMovement(
          currentRanking,
          previousRanking,
          hasPreviousChart
        );

        if (hasPreviousChart) {
          setComparisonInfo(
            `MONTHLY MOVEMENT: ` +
            `${formatMonth(previousMonth)} → ` +
            `${formatMonth(selectedMonth)}`
          );
        } else {
          setComparisonInfo(
            "MONTHLY MOVEMENT: " +
            "No previous-month votes for this genre."
          );
        }

      } else {
        console.warn(
          "[AFTERHOURS] Previous month unavailable:",
          previousResult.error
        );

        setComparisonInfo(
          "MONTHLY MOVEMENT: " +
          "Previous-month comparison unavailable."
        );
      }

      renderRanking(displayRows);

      state.lastUpdated = Date.now();

      setStatus(
        `● LIVE / ${displayRows.length} TRACKS` +
        ` / ${japanTime()} JST`
      );

      console.info(
        "[AFTERHOURS] Chart synced",
        {
          genre: state.genre,
          month: selectedMonth,
          previousMonth,
          reason,
          tracks: displayRows.length
        }
      );

    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }

      console.error(
        "[AFTERHOURS] Chart sync failed:",
        error
      );

      if (state.loaded) {
        setStatus(
          "SYNC FAILED / RETRYING",
          true
        );
      } else {
        elements.list.replaceChildren();
        elements.empty.hidden = true;

        setStatus(
          "DATABASE ERROR / PLEASE RETRY",
          true
        );
      }

    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        elements.refresh.disabled = false;
      }
    }
  }

  // ------------------------------------------
  // SUPABASE LOGIN
  // ------------------------------------------

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
        "Supabase JavaScript SDK unavailable."
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
      const result =
        await state.db.auth.signInAnonymously();

      if (result.error) {
        throw result.error;
      }
    }

    const user = await state.db.auth.getUser();

    if (user.error || !user.data.user) {
      throw user.error ||
        new Error("Authentication failed.");
    }

    state.ready = true;
  }

  // ------------------------------------------
  // TIMER
  // ------------------------------------------

  function startAutoRefresh() {
    stopAutoRefresh();

    state.timer = window.setInterval(() => {
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

  function stopAutoRefresh() {
    if (state.timer !== null) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  // ------------------------------------------
  // CONTROLS
  // ------------------------------------------

  elements.hiphop.addEventListener(
    "click",
    () => {
      if (state.genre === "hiphop") {
        return;
      }

      state.genre = "hiphop";
      updateGenreButtons();
      loadRanking("genre");
    }
  );

  elements.rnb.addEventListener(
    "click",
    () => {
      if (state.genre === "rnb") {
        return;
      }

      state.genre = "rnb";
      updateGenreButtons();
      loadRanking("genre");
    }
  );

  elements.month.addEventListener(
    "change",
    () => {
      loadRanking("month");
    }
  );

  elements.refresh.addEventListener(
    "click",
    () => {
      loadRanking("manual");
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !state.ready ||
        document.hidden
      ) {
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

  // ------------------------------------------
  // INITIALIZE
  // ------------------------------------------

  async function start() {
    installMovementStyles();

    populateMonths(getJapanMonth());

    updateGenreButtons();

    setComparisonInfo(
      "Preparing previous-month comparison..."
    );

    elements.refresh.disabled = true;

    setStatus(
      "CONNECTING TO SUPABASE..."
    );

    try {
      await Promise.all([
        connectSupabase(),
        loadArtworkMap()
      ]);

      await loadRanking("initial");

      startAutoRefresh();

    } catch (error) {
      console.error(
        "[AFTERHOURS] Startup error:",
        error
      );

      setStatus(
        "CONNECTION FAILED / CHECK CONSOLE",
        true
      );

      elements.refresh.disabled = false;
    }
  }

  start();
})();
