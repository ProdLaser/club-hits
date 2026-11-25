
"use strict";

/*
 * AFTERHOURS - STEP 27
 * Mobile navigation and accessibility.
 *
 * No changes to voting, ranking, or Supabase.
 */

(() => {
  const STYLE_ID = "ah-site-enhancements-style";
  const NAV_ID = "ah-mobile-navigation";

  const pages = [
    {
      id: "home",
      label: "HOME",
      href: "index.html",
      icon: "home"
    },
    {
      id: "hiphop",
      label: "HIP-HOP",
      href: "hiphop.html",
      icon: "disc"
    },
    {
      id: "rnb",
      label: "R&B",
      href: "RnB.html",
      icon: "music"
    },
    {
      id: "community",
      label: "VOTE",
      href: "community.html",
      icon: "users"
    }
  ];

  function getCurrentPage() {
    const filename = decodeURIComponent(
      window.location.pathname.split("/").pop() || ""
    ).toLowerCase();

    switch (filename) {
      case "":
      case "index.html":
        return "home";
      case "hiphop.html":
        return "hiphop";
      case "rnb.html":
        return "rnb";
      case "community.html":
        return "community";
      default:
        return null;
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function icon(name) {
    const paths = {
      home: [
        "M3 10.5 12 3l9 7.5",
        "M5 9.5V21h14V9.5",
        "M9 21v-7h6v7"
      ],
      disc: [
        "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
        "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      ],
      music: [
        "M9 18V5l12-2v13",
        "M9 18c0 1.7-1.6 3-3.5 3S2 19.7 2 18s1.6-3 3.5-3S9 16.3 9 18Z",
        "M21 16c0 1.7-1.6 3-3.5 3S14 17.7 14 16s1.6-3 3.5-3S21 14.3 21 16Z"
      ],
      users: [
        "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
        "M22 21v-2a4 4 0 0 0-3-3.87",
        "M16 3.13a4 4 0 0 1 0 7.75"
      ]
    };

    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "21");
    svg.setAttribute("height", "21");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    for (const definition of paths[name] || []) {
      const path = document.createElementNS(
        namespace,
        "path"
      );

      path.setAttribute("d", definition);
      svg.append(path);
    }

    return svg;
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      #ah-mobile-navigation {
        display: none;
      }

      #ah-skip-link {
        position: fixed;
        top: -100px;
        left: 12px;
        z-index: 2147483647;
        padding: 12px 18px;
        border-radius: 8px;
        background: #40e5ed;
        color: #07111d;
        font: 800 13px Arial, sans-serif;
        text-decoration: none;
      }

      #ah-skip-link:focus {
        top: 12px;
      }

      @media (max-width: 700px) {
        body {
          padding-bottom: calc(
            76px + env(safe-area-inset-bottom, 0px)
          ) !important;
        }

        #ah-mobile-navigation {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99999;

          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 3px;

          padding:
            9px
            max(8px, env(safe-area-inset-right, 0px))
            calc(8px + env(safe-area-inset-bottom, 0px))
            max(8px, env(safe-area-inset-left, 0px));

          border-top: 1px solid #30445a;
          background: #0b1422;
          box-shadow: 0 -12px 35px #00000055;
          font-family: Arial, sans-serif;
        }

        #ah-mobile-navigation .ah-mobile-link {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-width: 0;
          min-height: 54px;

          border: 1px solid transparent;
          border-radius: 10px;
          padding: 5px 2px;

          color: #9baec4;
          background: transparent;
          font: 800 10px Arial, sans-serif;
          letter-spacing: .3px;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
        }

        #ah-mobile-navigation .ah-mobile-link.active {
          border-color: #40e5ed35;
          background: #173346;
          color: #40e5ed;
        }

        #ah-mobile-navigation .ah-mobile-link:focus-visible {
          outline: 2px solid #40e5ed;
          outline-offset: 2px;
        }

        #ah-mobile-navigation svg {
          flex: none;
        }
      }

      @media (max-width: 340px) {
        #ah-mobile-navigation .ah-mobile-link {
          font-size: 9px;
        }
      }
    `;

    document.head.append(style);
  }

  function installSkipLink() {
    const main = document.querySelector("main");

    if (!main || document.getElementById("ah-skip-link")) {
      return;
    }

    if (!main.id) {
      main.id = "ah-main-content";
    }

    const link = createElement(
      "a",
      "",
      "Skip to main content"
    );

    link.id = "ah-skip-link";
    link.href = "#" + main.id;

    document.body.prepend(link);
  }

  function installMobileNavigation() {
    if (document.getElementById(NAV_ID)) {
      return;
    }

    const current = getCurrentPage();

    if (!current) {
      return;
    }

    const nav = document.createElement("nav");
    nav.id = NAV_ID;
    nav.setAttribute(
      "aria-label",
      "AFTERHOURS mobile navigation"
    );

    for (const page of pages) {
      const link = createElement(
        "a",
        "ah-mobile-link"
      );

      link.href = page.href;
      link.append(icon(page.icon));

      const label = createElement(
        "span",
        "",
        page.label
      );

      link.append(label);

      if (page.id === current) {
        link.classList.add("active");
        link.setAttribute(
          "aria-current",
          "page"
        );
      }

      nav.append(link);
    }

    document.body.append(nav);
  }

  function improveExistingImages() {
    // Only update images already present at startup.
    // Do not touch images inserted later by rankings.
    const images = document.querySelectorAll("img");

    images.forEach((img, index) => {
      if (!img.hasAttribute("decoding")) {
        img.decoding = "async";
      }

      // Keep early images eager for fast initial display.
      if (
        index >= 3 &&
        !img.hasAttribute("loading") &&
        !img.hasAttribute("fetchpriority")
      ) {
        img.loading = "lazy";
      }
    });
  }

  function start() {
    installStyles();
    installSkipLink();
    installMobileNavigation();
    improveExistingImages();

    console.info(
      "[AFTERHOURS] STEP 27 enhancements enabled"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
