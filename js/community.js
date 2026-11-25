
"use strict";

/*
  AFTERHOURS STEP 22
  GLOBAL COMMUNITY CHART

  Features:
  - HIP-HOP / R&B rankings
  - Monthly vote totals
  - Supabase authentication
  - Automatic refresh every 30 seconds
  - Refresh on tab return
  - Manual refresh
  - No unnecessary visual rerender
  - Safe error handling

  Existing charts and voting system
  remain unchanged.
*/

(() => {
  // ========================================
  // SETTINGS
  // ========================================

  const REFRESH_INTERVAL = 30_000;

  const CONFIG = window.AFTERHOURS_SUPABASE;
  const DATA = window.AFTERHOURS_DATA || {};

  // ========================================
  // HTML ELEMENTS
  // ========================================

  const list = document.querySelector(
    "#community-list"
  );

  const status = document.querySelector(
    "#status"
  );

  const empty = document.querySelector(
    "#empty-message"
  );

  const monthSelect = document.querySelector(
    "#chart-month"
  );

  const hiphopTab = document.querySelector(
    "#tab-hiphop"
  );

  const rnbTab = document.querySelector(
    "#tab-rnb"
  );

  const refreshButton = document.querySelector(
    "#refresh-chart"
  );

  // ========================================
  // APPLICATION STATE
  // ========================================

  let db = null;
  let genre = "hiphop";
  let artworkMap = {};

  let isReady = false;
  let requestNumber = 0;

  let refreshTimer = null;
  let lastRenderSignature = null;

  let lastSuccessfulUpdate = 0;
  let hasLoadedRanking = false;

  // ========================================
  // DATE FUNCTIONS
  // ========================================

  function currentMonthJapan() {
    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "2-digit",
        timeZone: "Asia/Tokyo"
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

  function monthBefore(value, amount) {
    const [year, month] = value
      .split("-")
      .map(Number);

    const date = new Date(
      Date.UTC(year, month - 1 - amount, 1)
    );

    return date.toISOString().slice(0, 7);
  }

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

  function japanTimeLabel() {
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

  function initializeMonths() {
    const current = currentMonthJapan();

    monthSelect.replaceChildren();

    for (let i = 0; i < 12; i++) {
      const value = monthBefore(
        current,
        i
      );

      const option = document.createElement(
        "option"
      );

      option.value = value;
      option.textContent = monthLabel(value);

      monthSelect.append(option);
    }

    monthSelect.value = current;
  }

  // ========================================
  // UTILITIES
  // ========================================

  function setStatus(message, error = false) {
    status.textContent = message;

    status.classList.toggle(
      "error",
      error
    );
  }

  function safeUrl(value) {
    try {
      const parsed = new URL(value);

      return parsed.protocol === "https:"
        ? parsed.href
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
    const tracks = DATA[genre];

    return Array.isArray(tracks)
      ? tracks.slice(0, 50)
      : [];
  }

  // ========================================
  // GENRE TABS
  // ========================================

  function updateTabs() {
    const isHiphop = genre === "hiphop";

    hiphopTab.classList.toggle(
      "active",
      isHiphop
    );

    rnbTab.classList.toggle(
      "active",
      !isHiphop
    );

    hiphopTab.setAttribute(
      "aria-pressed",
      String(isHiphop)
    );

    rnbTab.setAttribute(
      "aria-pressed",
      String(!isHiphop)
    );
  }

  // ========================================
  // ARTWORK CACHE
  // ========================================

  async function loadArtworkMap() {
    try {
      const response = await fetch(
        "images/artwork-map.json",
        {
          cache: "no-cache"
        }
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
        artworkMap = result;
      }

    } catch (error) {
      console.warn(
        "Artwork cache unavailable:",
        error
      );
    }
  }

  function createArtwork(track) {
    const box = document.createElement(
      "div"
    );

    box.className = "artwork";

    box.textContent = String(
      track.title || "?"
    ).charAt(0).toUpperCase();

    const saved = artworkMap[track.id];

    if (!saved) {
      return box;
    }

    // Check artwork belongs to the song.
    if (
      normalize(saved.title) !==
        normalize(track.title) ||
      normalize(saved.artist) !==
        normalize(track.artist)
    ) {
      return box;
    }

    const imageUrl = safeUrl(saved.image);

    if (!imageUrl) {
      return box;
    }

    const image = document.createElement(
      "img"
    );

    image.alt = `${track.title} album artwork`;
    image.loading = "lazy";
    image.decoding = "async";

    image.onload = () => {
      if (box.isConnected) {
        box.replaceChildren(image);
      }
    };

    image.src = imageUrl;

    return box;
  }

  // ========================================
  // CREATE RANKING ROW
  // ========================================

  function createRow(track, votes, rank) {
    const row = document.createElement(
      "li"
    );

    row.className = "chart-row";

    const number = document.createElement(
      "span"
    );

    number.className = "rank";

    number.textContent = String(
      rank
    ).padStart(2, "0");

    const info = document.createElement(
      "div"
    );

    info.className = "song-info";

    const title = document.createElement(
      "h3"
    );

    title.textContent = track.title;

    const artist = document.createElement(
      "p"
    );

    artist.textContent = track.artist;

    info.append(title, artist);

    const count = document.createElement(
      "div"
    );

    count.className = "votes";

    const amount = document.createElement(
      "span"
    );

    amount.textContent =
      votes.toLocaleString("en-US");

    const label = document.createElement(
      "small"
    );

    label.textContent = "VOTES";

    count.append(amount, label);

    row.append(
      number,
      createArtwork(track),
      info,
      count
    );

    return row;
  }

  // ========================================
  // RENDER RANKING
  // ========================================

  function renderRanking(rows) {
    const signature = JSON.stringify({
      genre,
      month: monthSelect.value,
      rows: rows.map(item => [
        item.track.id,
        item.votes
      ])
    });

    // Avoid unnecessary DOM and artwork reloads
    // when the ranking has not changed.
    if (
      signature === lastRenderSignature &&
      hasLoadedRanking
    ) {
      return;
    }

    lastRenderSignature = signature;

    const fragment =
      document.createDocumentFragment();

    rows.forEach((item, index) => {
      fragment.append(
        createRow(
          item.track,
          item.votes,
          index + 1
        )
      );
    });

    list.replaceChildren(fragment);

    empty.hidden = rows.length !== 0;

    hasLoadedRanking = true;
  }

  // ========================================
  // VOTE DATA PROCESSING
  // ========================================

  function createRanking(voteData) {
    const totals = new Map();

    for (const item of voteData || []) {
      const votes = Number(item.votes);

      if (
        typeof item.track_id === "string" &&
        Number.isSafeInteger(votes) &&
        votes > 0
      ) {
        totals.set(
          item.track_id,
          votes
        );
      }
    }

    return getTracks()
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
      .slice(0, 50);
  }

  // ========================================
  // LOAD RANKING FROM SUPABASE
  // ========================================

  async function loadRanking(
    reason = "manual"
  ) {
    if (!isReady || !db) {
      return;
    }

    // Do not automatically query a hidden tab.
    if (
      reason === "auto" &&
      document.hidden
    ) {
      return;
    }

    const thisRequest = ++requestNumber;
    const selectedMonth = monthSelect.value;

    if (reason === "auto") {
      setStatus("SYNCING VOTES...");
    } else {
      setStatus("LOADING VOTES...");
    }

    refreshButton.disabled = true;

    try {
      const { data, error } = await db.rpc(
        "get_vote_counts",
        {
          p_month: selectedMonth
        }
      );

      if (error) {
        throw error;
      }

      // Another request has started.
      // Ignore outdated response.
      if (thisRequest !== requestNumber) {
        return;
      }

      const ranked = createRanking(data);

      renderRanking(ranked);

      lastSuccessfulUpdate = Date.now();

      const time = japanTimeLabel();

      setStatus(
        `● LIVE / ${ranked.length} TRACKS` +
        ` / ${time} JST`
      );

      console.info(
        "[AFTERHOURS] Community chart updated",
        {
          reason,
          genre,
          month: selectedMonth,
          tracks: ranked.length,
          updatedAt: time
        }
      );

    } catch (error) {
      if (thisRequest !== requestNumber) {
        return;
      }

      console.error(
        "[AFTERHOURS] Ranking sync failed:",
        error
      );

      // Preserve the existing ranking on failure.
      // Next automatic update will retry.
      if (hasLoadedRanking) {
        setStatus(
          "SYNC FAILED / RETRYING",
          true
        );
      } else {
        list.replaceChildren();

        empty.hidden = true;

        setStatus(
          "DATABASE ERROR / PLEASE RETRY",
          true
        );
      }

    } finally {
      if (thisRequest === requestNumber) {
        refreshButton.disabled = false;
      }
    }
  }

  // ========================================
  // SUPABASE CONNECTION
  // ========================================

  async function connectSupabase() {
    if (
      !CONFIG ||
      !safeUrl(CONFIG.url) ||
      !CONFIG.publishableKey
    ) {
      throw new Error(
        "Supabase configuration is missing."
      );
    }

    if (!window.supabase?.createClient) {
      throw new Error(
        "Supabase SDK failed to load."
      );
    }

    db = window.supabase.createClient(
      CONFIG.url,
      CONFIG.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );

    const session = await db.auth.getSession();

    if (session.error) {
      throw session.error;
    }

    // Reuse voting-page session.
    // Create an anonymous user only if needed.
    if (!session.data.session) {
      const result = await db.auth
        .signInAnonymously();

      if (result.error) {
        throw result.error;
      }
    }

    const user = await db.auth.getUser();

    if (user.error || !user.data.user) {
      throw user.error ||
        new Error("Authentication failed.");
    }

    isReady = true;
  }

  // ========================================
  // AUTOMATIC UPDATES
  // ========================================

  function startAutoRefresh() {
    // Prevent multiple timers.
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(() => {
      if (
        !isReady ||
        document.hidden
      ) {
        return;
      }

      // Skip this cycle while a request
      // is already running.
      if (refreshButton.disabled) {
        return;
      }

      loadRanking("auto");

    }, REFRESH_INTERVAL);

    console.info(
      "[AFTERHOURS] Auto refresh enabled:",
      REFRESH_INTERVAL / 1000,
      "seconds"
    );
  }

  function stopAutoRefresh() {
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  // ========================================
  // TAB VISIBILITY
  // ========================================

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!isReady || document.hidden) {
        return;
      }

      const elapsed = (
        Date.now() - lastSuccessfulUpdate
      );

      // Refresh immediately when returning
      // after at least 10 seconds.
      if (
        !lastSuccessfulUpdate ||
        elapsed >= 10_000
      ) {
        loadRanking("return");
      }
    }
  );

  // ========================================
  // USER CONTROLS
  // ========================================

  hiphopTab.addEventListener(
    "click",
    () => {
      if (genre === "hiphop") {
        return;
      }

      genre = "hiphop";

      updateTabs();
      loadRanking("genre");
    }
  );

  rnbTab.addEventListener(
    "click",
    () => {
      if (genre === "rnb") {
        return;
      }

      genre = "rnb";

      updateTabs();
      loadRanking("genre");
    }
  );

  monthSelect.addEventListener(
    "change",
    () => {
      loadRanking("month");
    }
  );

  refreshButton.addEventListener(
    "click",
    () => {
      loadRanking("manual");
    }
  );

  // ========================================
  // PAGE CLEANUP
  // ========================================

  window.addEventListener(
    "pagehide",
    () => {
      stopAutoRefresh();
    }
  );

  window.addEventListener(
    "pageshow",
    (event) => {
      // Restore timer after back/forward
      // cache navigation.
      if (event.persisted && isReady) {
        startAutoRefresh();
        loadRanking("return");
      }
    }
  );

  // ========================================
  // START APPLICATION
  // ========================================

  async function start() {
    initializeMonths();
    updateTabs();

    refreshButton.disabled = true;

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
        "[AFTERHOURS] Startup failed:",
        error
      );

      setStatus(
        "CONNECTION FAILED / CHECK CONSOLE",
        true
      );

      refreshButton.disabled = false;
    }
  }

  start();
})();
