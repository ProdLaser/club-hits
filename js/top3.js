
"use strict";

/*
 * AFTERHOURS STEP 25
 * TOP 3 SPOTLIGHT
 *
 * Works with the existing community.js.
 * No Supabase or voting changes required.
 *
 * Reads the currently displayed chart rows.
 * Automatically follows:
 * - Genre changes
 * - Month changes
 * - 30-second refreshes
 * - Finalized monthly rankings
 */

(() => {
  const LIST_ID = "community-list";
  const SPOTLIGHT_ID = "ah-top3";
  const STYLE_ID = "ah-top3-style";

  const list = document.getElementById(LIST_ID);

  if (!list) {
    console.warn(
      "[AFTERHOURS TOP3] Ranking list not found."
    );
    return;
  }

  // =====================================
  // ADD DESIGN
  // =====================================

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      #ah-top3 {
        margin: 0 0 45px;
      }

      #ah-top3[hidden] {
        display: none !important;
      }

      .ah-top3-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 22px;
        flex-wrap: wrap;
      }

      .ah-top3-kicker {
        display: block;
        margin-bottom: 10px;
        color: #40e5ed;
        font: 700 11px "Space Grotesk", sans-serif;
        letter-spacing: 2.5px;
      }

      .ah-top3-title {
        margin: 0;
        font: 700 clamp(28px, 5vw, 47px)
          "Space Grotesk", sans-serif;
        letter-spacing: -1.8px;
        line-height: 1.05;
        color: #f5f7ff;
      }

      .ah-top3-description {
        margin: 0;
        max-width: 290px;
        color: #98a6bd;
        font-size: 12px;
        line-height: 1.7;
      }

      .ah-top3-grid {
        display: grid;
        grid-template-columns:
          minmax(0, 1.45fr)
          minmax(0, 1fr);
        grid-template-rows: repeat(2, auto);
        gap: 15px;
      }

      .ah-top3-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 20px;
        min-width: 0;
        overflow: hidden;
        padding: 20px;
        border: 1px solid #29354d;
        border-radius: 16px;
        background:
          linear-gradient(
            130deg,
            #17233b 0%,
            #101729 70%
          );
        isolation: isolate;
      }

      .ah-top3-card::before {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(
          circle at 80% 15%,
          #40e5ed12,
          transparent 55%
        );
        z-index: -1;
      }

      .ah-top3-card.first {
        grid-row: span 2;
        flex-direction: column;
        align-items: stretch;
        padding: 26px;
        border-color: #40e5ed78;
        background:
          radial-gradient(
            circle at 80% 20%,
            #173c4c,
            transparent 57%
          ),
          linear-gradient(
            140deg,
            #14243b,
            #101629
          );
      }

      .ah-top3-card.second {
        border-color: #657d9b66;
      }

      .ah-top3-card.third {
        border-color: #b77e8d66;
      }

      .ah-top3-cover {
        position: relative;
        flex: 0 0 112px;
        width: 112px;
        height: 112px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border-radius: 10px;
        background:
          linear-gradient(135deg, #164955, #452559);
        color: #f5f7ff;
        font: 800 48px "Space Grotesk", sans-serif;
      }

      .ah-top3-card.first .ah-top3-cover {
        width: 100%;
        height: auto;
        aspect-ratio: 1 / 1;
        max-height: 340px;
        flex: none;
        border-radius: 12px;
      }

      .ah-top3-cover img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .ah-top3-info {
        flex: 1;
        min-width: 0;
      }

      .ah-top3-position {
        margin-bottom: 10px;
        color: #40e5ed;
        font: 700 12px "Space Grotesk", sans-serif;
        letter-spacing: 1.5px;
      }

      .ah-top3-card.second .ah-top3-position {
        color: #c0d3e8;
      }

      .ah-top3-card.third .ah-top3-position {
        color: #edb5c3;
      }

      .ah-top3-song {
        margin: 0 0 7px;
        color: #ffffff;
        font: 700 clamp(17px, 2vw, 26px)
          "Space Grotesk", sans-serif;
        letter-spacing: -.5px;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .ah-top3-card.first .ah-top3-song {
        font-size: clamp(24px, 3vw, 37px);
      }

      .ah-top3-artist {
        margin: 0 0 14px;
        color: #a5b4c9;
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .ah-top3-vote-count {
        color: #40e5ed;
        font: 700 21px "Space Grotesk", sans-serif;
      }

      .ah-top3-vote-count small {
        margin-left: 7px;
        color: #98a6bd;
        font-size: 10px;
        letter-spacing: 1px;
      }

      .ah-top3-movement {
        display: inline-flex;
        margin-top: 12px;
        padding: 5px 9px;
        border: 1px solid #65738d;
        border-radius: 6px;
        color: #b7c7df;
        font-size: 10px;
        font-weight: 800;
      }

      .ah-top3-movement.up {
        color: #48f3bc;
        border-color: #48f3bc65;
      }

      .ah-top3-movement.down {
        color: #ff92a1;
        border-color: #ff92a165;
      }

      .ah-top3-movement.new {
        color: #eaa4ff;
        border-color: #eaa4ff65;
      }

      .ah-top3-footer {
        margin: 14px 0 0;
        color: #8190a9;
        font-size: 11px;
        line-height: 1.6;
      }

      @media (max-width: 850px) {
        .ah-top3-grid {
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto auto;
        }

        .ah-top3-card.first {
          grid-column: 1 / -1;
          grid-row: auto;
          flex-direction: row;
          align-items: center;
        }

        .ah-top3-card.first .ah-top3-cover {
          width: min(42%, 260px);
          height: auto;
          flex: 0 0 min(42%, 260px);
        }

        .ah-top3-card.second,
        .ah-top3-card.third {
          flex-direction: column;
          align-items: stretch;
        }

        .ah-top3-card.second .ah-top3-cover,
        .ah-top3-card.third .ah-top3-cover {
          width: 100%;
          height: auto;
          aspect-ratio: 1;
          flex: none;
        }
      }

      @media (max-width: 580px) {
        .ah-top3-grid {
          grid-template-columns: 1fr;
        }

        .ah-top3-card,
        .ah-top3-card.first,
        .ah-top3-card.second,
        .ah-top3-card.third {
          grid-column: auto;
          grid-row: auto;
          flex-direction: row;
          align-items: center;
          padding: 14px;
          gap: 13px;
        }

        .ah-top3-cover,
        .ah-top3-card.first .ah-top3-cover,
        .ah-top3-card.second .ah-top3-cover,
        .ah-top3-card.third .ah-top3-cover {
          width: 100px;
          height: 100px;
          flex: 0 0 100px;
          aspect-ratio: 1 / 1;
          border-radius: 8px;
        }

        .ah-top3-card.first {
          border-color: #40e5ed78;
        }

        .ah-top3-card.first .ah-top3-song {
          font-size: 21px;
        }

        .ah-top3-song {
          font-size: 17px;
        }

        .ah-top3-vote-count {
          font-size: 17px;
        }

        .ah-top3-heading {
          align-items: start;
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .ah-top3-card {
          transition:
            transform .2s ease,
            border-color .2s ease;
        }

        .ah-top3-card:hover {
          transform: translateY(-3px);
          border-color: #40e5ed;
        }
      }
    `;

    document.head.append(style);
  }

  // =====================================
  // CREATE SPOTLIGHT AREA
  // =====================================

  function createSpotlight() {
    const section = document.createElement("section");

    section.id = SPOTLIGHT_ID;
    section.hidden = true;
    section.setAttribute(
      "aria-label",
      "Top three community tracks"
    );

    const heading = document.createElement("div");
    heading.className = "ah-top3-heading";

    const headingLeft = document.createElement("div");

    const kicker = document.createElement("span");
    kicker.className = "ah-top3-kicker";
    kicker.textContent = "AFTERHOURS / MOST VOTED";

    const title = document.createElement("h2");
    title.className = "ah-top3-title";
    title.textContent = "TOP 3 SPOTLIGHT.";

    headingLeft.append(kicker, title);

    const description = document.createElement("p");
    description.className = "ah-top3-description";
    description.textContent =
      "The tracks leading the community vote.";

    heading.append(headingLeft, description);

    const grid = document.createElement("div");
    grid.className = "ah-top3-grid";
    grid.id = "ah-top3-grid";

    const footer = document.createElement("p");
    footer.className = "ah-top3-footer";
    footer.textContent =
      "Based on the selected genre and month. " +
      "Full rankings remain below.";

    section.append(heading, grid, footer);

    const boardHeading =
      document.querySelector(".board-heading");

    if (!boardHeading || !boardHeading.parentNode) {
      console.warn(
        "[AFTERHOURS TOP3] Chart heading not found."
      );
      return null;
    }

    boardHeading.parentNode.insertBefore(
      section,
      boardHeading
    );

    return section;
  }

  // =====================================
  // READ DISPLAYED RANKING
  // =====================================

  function readTrackRows() {
    const rows = Array.from(
      list.children
    ).filter(element =>
      element.classList.contains("chart-row")
    );

    return rows.slice(0, 3).map(row => {
      const title = row.querySelector(
        ".song-info h3"
      );

      const artist = row.querySelector(
        ".song-info p"
      );

      const rank = row.querySelector(
        ".rank"
      );

      const voteCount = row.querySelector(
        ".votes span"
      );

      const artwork = row.querySelector(
        ".artwork"
      );

      const image = artwork?.querySelector(
        "img"
      );

      const movement = row.querySelector(
        ".ah-movement"
      );

      return {
        title: title?.textContent?.trim() || "",
        artist: artist?.textContent?.trim() || "",
        rank: rank?.textContent?.trim() || "",
        votes: voteCount?.textContent?.trim() || "0",
        image: image?.getAttribute("src") || "",
        fallback:
          artwork?.textContent?.trim()?.slice(0, 1) ||
          "?",
        movement:
          movement?.textContent?.trim() || "",
        movementType:
          movement?.classList.contains("up")
            ? "up"
            : movement?.classList.contains("down")
              ? "down"
              : movement?.classList.contains("new")
                ? "new"
                : "same"
      };
    }).filter(item =>
      item.title && item.artist
    );
  }

  // =====================================
  // BUILD TOP 3 CARDS
  // =====================================

  function makeElement(tag, className, value) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (value !== undefined) {
      element.textContent = value;
    }

    return element;
  }

  function createCard(track, index) {
    const positions = [
      "first",
      "second",
      "third"
    ];

    const card = makeElement(
      "article",
      `ah-top3-card ${positions[index]}`
    );

    const cover = makeElement(
      "div",
      "ah-top3-cover"
    );

    const fallback = makeElement(
      "span",
      "",
      track.fallback
    );

    if (track.image) {
      const image = document.createElement("img");

      image.alt = `${track.title} artwork`;
      image.loading = index === 0
        ? "eager"
        : "lazy";

      image.decoding = "async";
      image.onerror = () => {
        cover.replaceChildren(fallback);
      };

      image.src = track.image;
      cover.append(image);
    } else {
      cover.append(fallback);
    }

    const info = makeElement(
      "div",
      "ah-top3-info"
    );

    const position = makeElement(
      "div",
      "ah-top3-position",
      `#${String(index + 1).padStart(2, "0")} / ` +
      (index === 0 ? "MOST VOTED" : "TOP TRACK")
    );

    const song = makeElement(
      "h3",
      "ah-top3-song",
      track.title
    );

    const artist = makeElement(
      "p",
      "ah-top3-artist",
      track.artist
    );

    const votes = makeElement(
      "div",
      "ah-top3-vote-count",
      track.votes
    );

    const voteLabel = makeElement(
      "small",
      "",
      "VOTES"
    );

    votes.append(voteLabel);

    info.append(
      position,
      song,
      artist,
      votes
    );

    if (track.movement) {
      const movement = makeElement(
        "span",
        `ah-top3-movement ${track.movementType}`,
        track.movement
      );

      info.append(movement);
    }

    card.append(cover, info);

    return card;
  }

  // =====================================
  // SYNC WITH CURRENT CHART
  // =====================================

  const spotlight = createSpotlight();

  if (!spotlight) {
    return;
  }

  const grid = document.getElementById(
    "ah-top3-grid"
  );

  let lastSignature = "";

  function updateSpotlight() {
    const tracks = readTrackRows();

    if (tracks.length === 0) {
      spotlight.hidden = true;
      grid.replaceChildren();
      lastSignature = "";
      return;
    }

    const signature = JSON.stringify(tracks);

    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;

    const fragment =
      document.createDocumentFragment();

    tracks.forEach((track, index) => {
      fragment.append(
        createCard(track, index)
      );
    });

    grid.replaceChildren(fragment);
    spotlight.hidden = false;
  }

  // Listen only for chart-row replacements.
  // Avoid observing our own spotlight DOM.
  const observer = new MutationObserver(
    updateSpotlight
  );

  observer.observe(list, {
    childList: true
  });

  updateSpotlight();

  console.info(
    "[AFTERHOURS] TOP3 SPOTLIGHT enabled."
  );
})();
