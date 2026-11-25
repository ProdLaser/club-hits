
"use strict";

/*
 * AFTERHOURS STEP 26
 * HOME TRENDING NOW
 *
 * Adds community-voted music picks to HOME.
 * Existing pages and voting code are unchanged.
 */

(() => {
  const SECTION_ID = "ah-home-trending";
  const STYLE_ID = "ah-home-trending-css";

  const DATABASE_SCRIPT =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  const state = {
    db: null,
    genre: "hiphop",
    busy: false,
    artwork: {},
    tracks: {},
    currentRequest: 0
  };

  function japanMonth() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit"
    }).formatToParts(new Date());

    const year = parts.find(
      part => part.type === "year"
    ).value;

    const month = parts.find(
      part => part.type === "month"
    ).value;

    return `${year}-${month}`;
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function httpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:"
        ? url.href
        : null;
    } catch {
      return null;
    }
  }

  function scriptLoad(url, check) {
    if (check()) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = url;
      script.async = true;

      script.onload = () => {
        if (check()) {
          resolve();
        } else {
          reject(
            new Error("Script loaded without expected API")
          );
        }
      };

      script.onerror = () => {
        reject(new Error(`Cannot load ${url}`));
      };

      document.head.append(script);
    });
  }

  function make(tag, className, value) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (value !== undefined) {
      node.textContent = value;
    }

    return node;
  }

  // =====================================
  // STYLES
  // =====================================

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      #ah-home-trending {
        box-sizing: border-box;
        width: min(1120px, calc(100% - 36px));
        margin: 70px auto;
        color: #f4f7ff;
        font-family: "DM Sans", Arial, sans-serif;
      }

      #ah-home-trending * {
        box-sizing: border-box;
      }

      .aht-header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 20px;
        margin-bottom: 25px;
      }

      .aht-kicker {
        margin-bottom: 12px;
        color: #40e5ed;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 2.5px;
      }

      .aht-title {
        margin: 0;
        color: #f4f7ff;
        font-size: clamp(32px, 6vw, 64px);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -2px;
      }

      .aht-description {
        margin: 12px 0 0;
        max-width: 550px;
        color: #9babc2;
        font-size: 13px;
        line-height: 1.8;
      }

      .aht-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .aht-tab {
        border: 1px solid #2c3c50;
        border-radius: 8px;
        padding: 12px 17px;
        background: #151f30;
        color: #e9f2ff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
      }

      .aht-tab.active {
        background: #40e5ed;
        border-color: #40e5ed;
        color: #09121d;
      }

      .aht-panel {
        padding: 24px;
        border: 1px solid #253449;
        border-radius: 18px;
        background:
          radial-gradient(
            circle at 75% 5%,
            #162e43 0,
            transparent 42%
          ),
          #101728;
      }

      .aht-status {
        min-height: 20px;
        margin-bottom: 20px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #40e5ed;
      }

      .aht-status.error {
        color: #ff91a3;
      }

      .aht-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 15px;
      }

      .aht-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
        padding: 13px;
        border: 1px solid #293a53;
        border-radius: 12px;
        background: #131f32;
      }

      .aht-card:first-child {
        border-color: #40e5ed70;
      }

      .aht-image {
        display: grid;
        place-items: center;
        width: 100%;
        aspect-ratio: 1 / 1;
        overflow: hidden;
        border-radius: 9px;
        color: #f5f8ff;
        background: linear-gradient(
          135deg,
          #164c5d,
          #4c285c
        );
        font-size: 50px;
        font-weight: 800;
      }

      .aht-image img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .aht-rank {
        color: #40e5ed;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
      }

      .aht-song {
        margin: 0;
        color: #f4f7ff;
        font-size: 20px;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .aht-artist {
        margin: 0;
        color: #a5b4c9;
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .aht-votes {
        margin-top: auto;
        padding-top: 8px;
        color: #40e5ed;
        font-size: 16px;
        font-weight: 800;
      }

      .aht-votes small {
        margin-left: 6px;
        color: #98a6bd;
        font-size: 10px;
        letter-spacing: 1px;
      }

      .aht-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 18px;
        margin-top: 24px;
      }

      .aht-note {
        margin: 0;
        color: #899ab2;
        font-size: 11px;
        line-height: 1.7;
      }

      .aht-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 13px 20px;
        border: 1px solid #40e5ed;
        border-radius: 8px;
        background: #40e5ed;
        color: #09121d !important;
        text-decoration: none !important;
        font-size: 12px;
        font-weight: 800;
        transition: opacity .2s;
      }

      .aht-link:hover {
        opacity: .82;
      }

      .aht-empty {
        padding: 25px 0;
        color: #a5b4c9;
        font-size: 14px;
        line-height: 1.8;
      }

      @media (max-width: 720px) {
        .aht-grid {
          grid-template-columns: 1fr;
        }

        .aht-card {
          display: grid;
          grid-template-columns: 105px minmax(0, 1fr);
          align-items: center;
          column-gap: 15px;
        }

        .aht-image {
          grid-row: span 4;
        }

        .aht-song {
          font-size: 17px;
        }

        .aht-panel {
          padding: 15px;
        }
      }
    `;

    document.head.append(style);
  }

  // =====================================
  // CREATE SECTION
  // =====================================

  function buildSection() {
    const existing = document.getElementById(
      SECTION_ID
    );

    if (existing) {
      return existing;
    }

    const section = make(
      "section",
      "",
      undefined
    );

    section.id = SECTION_ID;
    section.setAttribute(
      "aria-label",
      "Community trending songs"
    );

    const header = make("div", "aht-header");
    const left = make("div");

    left.append(
      make(
        "div",
        "aht-kicker",
        "GLOBAL COMMUNITY / CURRENT MONTH"
      ),
      make(
        "h2",
        "aht-title",
        "TRENDING NOW."
      ),
      make(
        "p",
        "aht-description",
        "Discover the most-voted HIP-HOP and R&B " +
        "tracks from the AFTERHOURS community."
      )
    );

    const tabs = make("div", "aht-tabs");

    for (const [genre, title] of [
      ["hiphop", "HIP-HOP"],
      ["rnb", "R&B"]
    ]) {
      const button = make(
        "button",
        "aht-tab",
        title
      );

      button.type = "button";
      button.dataset.genre = genre;

      button.addEventListener("click", () => {
        if (state.genre === genre) {
          return;
        }

        state.genre = genre;
        syncTabs(section);
        loadTrending(section);
      });

      tabs.append(button);
    }

    header.append(left, tabs);

    const panel = make("div", "aht-panel");

    const status = make(
      "div",
      "aht-status",
      "CONNECTING..."
    );

    status.setAttribute("role", "status");

    const grid = make("div", "aht-grid");

    const footer = make("div", "aht-footer");

    const note = make(
      "p",
      "aht-note",
      "Based on actual community votes. " +
      "This is not an official streaming chart."
    );

    const link = make(
      "a",
      "aht-link",
      "EXPLORE COMMUNITY CHART ↗"
    );

    link.href = "community.html";

    footer.append(note, link);
    panel.append(status, grid, footer);
    section.append(header, panel);

    const main = document.querySelector("main");
    const pageFooter = document.querySelector(
      "body > footer"
    );

    if (main) {
      main.append(section);
    } else if (pageFooter) {
      pageFooter.before(section);
    } else {
      document.body.append(section);
    }

    return section;
  }

  function syncTabs(section) {
    section.querySelectorAll(
      ".aht-tab"
    ).forEach(button => {
      const active =
        button.dataset.genre === state.genre;

      button.classList.toggle("active", active);
      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });
  }

  function setStatus(section, message, isError = false) {
    const label = section.querySelector(
      ".aht-status"
    );

    label.textContent = message;
    label.classList.toggle("error", isError);
  }

  // =====================================
  // MUSIC DATA AND ARTWORK
  // =====================================

  async function prepareMusic() {
    if (!window.AFTERHOURS_DATA) {
      await scriptLoad(
        "js/data.js",
        () => Boolean(window.AFTERHOURS_DATA)
      );
    }

    state.tracks = window.AFTERHOURS_DATA || {};

    try {
      const response = await fetch(
        "images/artwork-map.json",
        { cache: "no-cache" }
      );

      if (response.ok) {
        const artwork = await response.json();

        if (
          artwork &&
          typeof artwork === "object" &&
          !Array.isArray(artwork)
        ) {
          state.artwork = artwork;
        }
      }
    } catch (error) {
      console.warn(
        "[AFTERHOURS] Artwork cache unavailable:",
        error
      );
    }
  }

  function artworkFor(track) {
    const box = make("div", "aht-image");

    const fallback = make(
      "span",
      "",
      String(track.title || "?")
        .slice(0, 1)
        .toUpperCase()
    );

    const saved = state.artwork[track.id];

    if (
      !saved ||
      normalize(saved.title) !==
        normalize(track.title) ||
      normalize(saved.artist) !==
        normalize(track.artist)
    ) {
      box.append(fallback);
      return box;
    }

    const src = httpsUrl(saved.image);

    if (!src) {
      box.append(fallback);
      return box;
    }

    const img = document.createElement("img");
    img.alt = `${track.title} artwork`;
    img.loading = "lazy";
    img.decoding = "async";

    img.onerror = () => {
      box.replaceChildren(fallback);
    };

    img.src = src;
    box.append(img);

    return box;
  }

  // =====================================
  // DATABASE
  // =====================================

  async function connect() {
    if (!window.AFTERHOURS_SUPABASE) {
      await scriptLoad(
        "js/supabase-config.js",
        () => Boolean(window.AFTERHOURS_SUPABASE)
      );
    }

    if (!window.supabase?.createClient) {
      await scriptLoad(
        DATABASE_SCRIPT,
        () => Boolean(window.supabase?.createClient)
      );
    }

    const config = window.AFTERHOURS_SUPABASE;

    if (
      !config ||
      !httpsUrl(config.url) ||
      !config.publishableKey
    ) {
      throw new Error("Supabase configuration missing");
    }

    state.db = window.supabase.createClient(
      config.url,
      config.publishableKey
    );

    const session = await state.db.auth.getSession();

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

    const result = await state.db.auth.getUser();

    if (result.error || !result.data.user) {
      throw result.error ||
        new Error("Unable to authenticate");
    }
  }

  async function getVotes() {
    const { data, error } = await state.db.rpc(
      "get_vote_counts",
      { p_month: japanMonth() }
    );

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  // =====================================
  // RANKING
  // =====================================

  function calculateTop3(votes) {
    const totals = new Map();

    for (const row of votes) {
      const count = Number(row.votes);

      if (
        typeof row.track_id === "string" &&
        Number.isSafeInteger(count) &&
        count > 0
      ) {
        totals.set(row.track_id, count);
      }
    }

    const tracks = state.tracks[state.genre] || [];

    if (!Array.isArray(tracks)) {
      return [];
    }

    return tracks
      .slice(0, 50)
      .map(track => ({
        track,
        votes: totals.get(track.id) || 0
      }))
      .filter(item => item.votes > 0)
      .sort((a, b) =>
        b.votes - a.votes ||
        a.track.id.localeCompare(b.track.id)
      )
      .slice(0, 3);
  }

  function cardFor(item, rank) {
    const card = make("article", "aht-card");

    const track = item.track;

    const info = make("div");

    info.append(
      make(
        "div",
        "aht-rank",
        `#${String(rank).padStart(2, "0")} / COMMUNITY`
      ),
      make(
        "h3",
        "aht-song",
        track.title
      ),
      make(
        "p",
        "aht-artist",
        track.artist
      )
    );

    const votes = make(
      "div",
      "aht-votes",
      item.votes.toLocaleString("en-US")
    );

    votes.append(
      make("small", "", "VOTES")
    );

    card.append(
      artworkFor(track),
      info,
      votes
    );

    return card;
  }

  async function loadTrending(section) {
    if (!state.db) {
      return;
    }

    const requestId = ++state.currentRequest;

    setStatus(section, "UPDATING COMMUNITY PICKS...");

    try {
      const votes = await getVotes();

      if (requestId !== state.currentRequest) {
        return;
      }

      const top3 = calculateTop3(votes);
      const grid = section.querySelector(
        ".aht-grid"
      );

      const fragment = document.createDocumentFragment();

      if (top3.length === 0) {
        fragment.append(
          make(
            "p",
            "aht-empty",
            "No community votes for this genre yet. " +
            "Be the first to vote!"
          )
        );
      } else {
        top3.forEach((item, index) => {
          fragment.append(
            cardFor(item, index + 1)
          );
        });
      }

      grid.replaceChildren(fragment);

      setStatus(
        section,
        `● LIVE COMMUNITY / ${japanMonth()}`
      );

    } catch (error) {
      console.error(
        "[AFTERHOURS] Home trending failed:",
        error
      );

      setStatus(
        section,
        "COMMUNITY DATA UNAVAILABLE",
        true
      );
    }
  }

  // =====================================
  // START
  // =====================================

  async function start() {
    installStyles();

    const section = buildSection();
    syncTabs(section);

    try {
      await prepareMusic();
      await connect();
      await loadTrending(section);

      // Refresh when returning to HOME.
      document.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) {
            loadTrending(section);
          }
        }
      );

    } catch (error) {
      console.error(
        "[AFTERHOURS] Home setup failed:",
        error
      );

      setStatus(
        section,
        "COMMUNITY PICKS TEMPORARILY UNAVAILABLE",
        true
      );
    }
  }

  start();
})();
