
"use strict";

/*
  AFTERHOURS STEP 20
  GLOBAL COMMUNITY VOTING CHART

  - Supabase vote counts
  - HIP-HOP / R&B switching
  - Monthly ranking
  - Artwork cache
  - Refresh button
*/

(() => {
  const CONFIG = window.AFTERHOURS_SUPABASE;
  const DATA = window.AFTERHOURS_DATA || {};

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

  let db = null;
  let genre = "hiphop";
  let artworkMap = {};
  let requestNumber = 0;
  let isReady = false;

  // ====================================
  // DATE
  // ====================================

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

  const CURRENT_MONTH = currentMonthJapan();

  function initializeMonths() {
    for (let i = 0; i < 12; i++) {
      const value = monthBefore(
        CURRENT_MONTH,
        i
      );

      const option = document.createElement(
        "option"
      );

      option.value = value;
      option.textContent = monthLabel(value);

      monthSelect.append(option);
    }

    monthSelect.value = CURRENT_MONTH;
  }

  // ====================================
  // COMMON FUNCTIONS
  // ====================================

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

  // ====================================
  // ARTWORK
  // ====================================

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
        "Artwork unavailable:",
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

    // Verify this cover belongs to this song.
    if (
      normalize(saved.title) !==
        normalize(track.title) ||
      normalize(saved.artist) !==
        normalize(track.artist)
    ) {
      return box;
    }

    const imageUrl = safeUrl(
      saved.image
    );

    if (!imageUrl) {
      return box;
    }

    const img = document.createElement(
      "img"
    );

    img.alt = `${track.title} album artwork`;
    img.loading = "lazy";
    img.decoding = "async";

    img.onload = () => {
      if (box.isConnected) {
        box.replaceChildren(img);
      }
    };

    img.src = imageUrl;

    return box;
  }

  // ====================================
  // RANKING DISPLAY
  // ====================================

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

  function renderRanking(rows) {
    list.replaceChildren();

    empty.hidden = rows.length !== 0;

    rows.forEach((item, index) => {
      list.append(
        createRow(
          item.track,
          item.votes,
          index + 1
        )
      );
    });
  }

  // ====================================
  // SUPABASE VOTE COUNT
  // ====================================

  async function loadRanking() {
    if (!isReady || !db) {
      return;
    }

    const thisRequest = ++requestNumber;

    const selectedMonth = monthSelect.value;

    setStatus("LOADING VOTES...");
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

      // Prevent an old request replacing new results.
      if (thisRequest !== requestNumber) {
        return;
      }

      const totals = new Map();

      for (const item of data || []) {
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

      const ranked = getTracks()
        .map(track => ({
          track,
          votes: totals.get(track.id) || 0
        }))
        .filter(item => item.votes > 0)
        .sort((a, b) => {
          if (b.votes !== a.votes) {
            return b.votes - a.votes;
          }

          // Use track ID to break tied votes.
          return a.track.id.localeCompare(
            b.track.id
          );
        })
        .slice(0, 50);

      renderRanking(ranked);

      setStatus(
        `${ranked.length} TRACKS / ` +
        monthLabel(selectedMonth)
      );

    } catch (error) {
      if (thisRequest !== requestNumber) {
        return;
      }

      console.error(
        "Community ranking error:",
        error
      );

      list.replaceChildren();
      empty.hidden = true;

      setStatus(
        "DATABASE ERROR / PLEASE RETRY",
        true
      );

    } finally {
      if (thisRequest === requestNumber) {
        refreshButton.disabled = false;
      }
    }
  }

  // ====================================
  // DATABASE CONNECTION
  // ====================================

  async function connectSupabase() {
    if (
      !CONFIG ||
      !safeUrl(CONFIG.url) ||
      !CONFIG.publishableKey
    ) {
      throw new Error(
        "Supabase configuration not found."
      );
    }

    if (!window.supabase?.createClient) {
      throw new Error(
        "Supabase SDK not loaded."
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

    // Same anonymous session as voting pages.
    if (!session.data.session) {
      const signIn = await db.auth
        .signInAnonymously();

      if (signIn.error) {
        throw signIn.error;
      }
    }

    const user = await db.auth.getUser();

    if (user.error || !user.data.user) {
      throw user.error ||
        new Error("Authentication failed.");
    }

    isReady = true;
  }

  // ====================================
  // CONTROLS
  // ====================================

  hiphopTab.addEventListener(
    "click",
    () => {
      genre = "hiphop";
      updateTabs();
      loadRanking();
    }
  );

  rnbTab.addEventListener(
    "click",
    () => {
      genre = "rnb";
      updateTabs();
      loadRanking();
    }
  );

  monthSelect.addEventListener(
    "change",
    loadRanking
  );

  refreshButton.addEventListener(
    "click",
    loadRanking
  );

  // ====================================
  // START
  // ====================================

  async function start() {
    initializeMonths();
    updateTabs();

    setStatus(
      "CONNECTING TO SUPABASE..."
    );

    refreshButton.disabled = true;

    try {
      await Promise.all([
        connectSupabase(),
        loadArtworkMap()
      ]);

      await loadRanking();

    } catch (error) {
      console.error(
        "Community startup failed:",
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
