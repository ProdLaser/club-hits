
"""
AFTERHOURS STEP 18
Missing Album Artwork Recovery

Run:
    python3 build_artwork_cache.py

Sources:
    Deezer
    Apple iTunes Search API

Existing artwork entries are preserved.
"""

from __future__ import annotations

import json
import re
import time
import unicodedata

from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


# ==========================================
# 01. FILE SETTINGS
# ==========================================

ROOT = Path(__file__).resolve().parent

SOURCE = ROOT / "js" / "data.js"

DESTINATION = (
    ROOT / "images" / "artwork-map.json"
)

REQUEST_INTERVAL = 1.5


TRACK_PATTERN = re.compile(
    r'\bsong\s*\(\s*"(?P<id>(?:hh|rb)\d+)"\s*,\s*'
    r'"(?P<title>(?:\\.|[^"\\])*)"\s*,\s*'
    r'"(?P<artist>(?:\\.|[^"\\])*)"',
    flags=re.IGNORECASE | re.DOTALL,
)


# ==========================================
# 02. TEXT NORMALIZATION
# ==========================================

def normalize(value):
    text = unicodedata.normalize(
        "NFKD",
        str(value or "")
    ).casefold()

    return "".join(
        char for char in text
        if char.isalnum()
    )


def decode_js_string(raw):
    return (
        raw.replace(r'\"', '"')
           .replace(r'\\', '\\')
    )


def primary_artist(track):
    artist = re.split(
        r",|&|\bfeat\.?\b|\bft\.?\b|\bwith\b",
        track["artist"],
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]

    return normalize(artist)


# ==========================================
# 03. LOAD TRACKS
# ==========================================

def load_tracks():
    if not SOURCE.is_file():
        raise SystemExit(
            f"ERROR: {SOURCE} が見つかりません"
        )

    source = SOURCE.read_text(
        encoding="utf-8"
    )

    tracks = {}

    for match in TRACK_PATTERN.finditer(source):
        track = {
            "id": match["id"],
            "title": decode_js_string(
                match["title"]
            ),
            "artist": decode_js_string(
                match["artist"]
            ),
        }

        tracks[track["id"]] = track

    if len(tracks) < 50:
        raise SystemExit(
            f"ERROR: {len(tracks)}曲しか"
            "見つかりません。"
            "js/data.jsを確認してください"
        )

    return list(tracks.values())


# ==========================================
# 04. LOAD ARTWORK CACHE
# ==========================================

def read_cache():
    if not DESTINATION.exists():
        return {}

    try:
        data = json.loads(
            DESTINATION.read_text(
                encoding="utf-8"
            )
        )

    except (OSError, ValueError) as error:
        raise SystemExit(
            "ERROR: artwork-map.jsonの"
            "読み込みに失敗しました。\n"
            "安全のため上書きしません。\n"
            f"{error}"
        ) from error

    if not isinstance(data, dict):
        raise SystemExit(
            "ERROR: artwork-map.jsonの"
            "形式が正しくありません"
        )

    return data


def is_saved(entry, track):
    return (
        isinstance(entry, dict)
        and normalize(
            entry.get("title")
        ) == normalize(track["title"])
        and normalize(
            entry.get("artist")
        ) == normalize(track["artist"])
        and str(
            entry.get("image", "")
        ).startswith("https://")
    )


# ==========================================
# 05. SAVE CACHE
# ==========================================

def save_cache(cache):
    DESTINATION.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    temporary = DESTINATION.with_suffix(
        ".json.tmp"
    )

    temporary.write_text(
        json.dumps(
            cache,
            ensure_ascii=False,
            indent=2,
            sort_keys=True
        ) + "\n",
        encoding="utf-8"
    )

    temporary.replace(DESTINATION)


# ==========================================
# 06. API REQUEST
# ==========================================

last_request = 0.0


def fetch_json(url):
    global last_request

    delay = (
        REQUEST_INTERVAL
        - (time.monotonic() - last_request)
    )

    if delay > 0:
        time.sleep(delay)

    last_request = time.monotonic()

    request = Request(
        url,
        headers={
            "User-Agent":
                "Mozilla/5.0 AFTERHOURS-artwork/1.0",
            "Accept": "application/json"
        }
    )

    try:
        with urlopen(
            request,
            timeout=18
        ) as response:
            data = json.load(response)

        if isinstance(data, dict):
            return data

        return None

    except (
        HTTPError,
        URLError,
        TimeoutError,
        ValueError,
        OSError
    ) as error:
        print(
            f"  APIへの接続失敗: {error}"
        )

        return None


# ==========================================
# 07. DEEZER ARTWORK SEARCH
# ==========================================

def search_deezer(track):
    artist_query = track["artist"].split(
        " & "
    )[0]

    queries = [
        (
            f'track:"{track["title"]}" '
            f'artist:"{artist_query}"'
        ),
        (
            f'{track["title"]} '
            f'{artist_query}'
        )
    ]

    target_title = normalize(
        track["title"]
    )

    target_artist = primary_artist(
        track
    )

    for query in queries:
        params = urlencode({
            "q": query,
            "limit": 50
        })

        url = (
            "https://api.deezer.com/"
            "search/track?"
            + params
        )

        payload = fetch_json(url)

        if not payload:
            continue

        for item in payload.get("data", []):
            if not isinstance(item, dict):
                continue

            candidate_title = normalize(
                item.get("title_short")
                or item.get("title")
            )

            candidate_artist = normalize(
                (
                    item.get("artist") or {}
                ).get("name")
            )

            album = item.get("album") or {}

            image = (
                album.get("cover_big")
                or album.get("cover_medium")
            )

            link = item.get("link")

            if (
                candidate_title == target_title
                and candidate_artist == target_artist
                and isinstance(image, str)
                and image.startswith("https://")
                and isinstance(link, str)
                and link.startswith("https://")
            ):
                return {
                    "title": track["title"],
                    "artist": track["artist"],
                    "image": image,
                    "link": link,
                    "source": "Deezer"
                }

    return None


# ==========================================
# 08. APPLE ITUNES SEARCH
# ==========================================

def search_itunes(track):
    target_title = normalize(
        track["title"]
    )

    target_artist = primary_artist(
        track
    )

    for country in ["GB", "JP", "US"]:
        params = urlencode({
            "term": (
                f'{track["title"]} '
                f'{track["artist"]}'
            ),
            "country": country,
            "media": "music",
            "entity": "song",
            "limit": 100
        })

        url = (
            "https://itunes.apple.com/"
            "search?"
            + params
        )

        payload = fetch_json(url)

        if not payload:
            continue

        for item in payload.get(
            "results",
            []
        ):
            if not isinstance(item, dict):
                continue

            candidate_title = normalize(
                item.get("trackName")
            )

            candidate_artist = normalize(
                item.get("artistName")
            )

            image = item.get(
                "artworkUrl100"
            )

            link = item.get(
                "trackViewUrl"
            )

            if (
                candidate_title == target_title
                and target_artist in candidate_artist
                and isinstance(image, str)
                and image.startswith("https://")
                and isinstance(link, str)
                and link.startswith("https://")
            ):
                image = re.sub(
                    r"\b\d+x\d+bb(?=\.)",
                    "300x300bb",
                    image
                )

                return {
                    "title": track["title"],
                    "artist": track["artist"],
                    "image": image,
                    "link": link,
                    "source": "iTunes"
                }

    return None


# ==========================================
# 09. MAIN PROCESS
# ==========================================

def main():
    tracks = load_tracks()

    cache = read_cache()

    existing_count = sum(
        is_saved(
            cache.get(track["id"]),
            track
        )
        for track in tracks
    )

    missing = [
        track for track in tracks
        if not is_saved(
            cache.get(track["id"]),
            track
        )
    ]

    print(
        "AFTERHOURS STEP 18"
    )

    print(
        "MISSING ARTWORK RECOVERY"
    )

    print(
        f"TOTAL: {len(tracks)}"
    )

    print(
        f"ALREADY SAVED: {existing_count}"
    )

    print(
        f"MISSING: {len(missing)}"
    )

    if not missing:
        print(
            "ALL ARTWORK ENTRIES ALREADY SAVED"
        )
        return

    # Backup existing artwork data

    if DESTINATION.is_file():
        backup = DESTINATION.with_name(
            "artwork-map.backup.json"
        )

        backup.write_bytes(
            DESTINATION.read_bytes()
        )

        print(
            f"BACKUP: {backup.name}"
        )

    found = 0

    for index, track in enumerate(
        missing,
        1
    ):
        print(
            f'[{index}/{len(missing)}] '
            f'{track["title"]} / '
            f'{track["artist"]}',
            flush=True
        )

        result = (
            search_deezer(track)
            or search_itunes(track)
        )

        if result:
            cache[
                track["id"]
            ] = result

            save_cache(cache)

            found += 1

            print(
                f'  OK ({result["source"]})',
                flush=True
            )

        else:
            print(
                "  NOT FOUND",
                flush=True
            )

    total = sum(
        is_saved(
            cache.get(track["id"]),
            track
        )
        for track in tracks
    )

    print()
    print(
        f"NEW ARTWORK: {found}"
    )

    print(
        f"TOTAL ARTWORK: {total}/{len(tracks)}"
    )

    print(
        "SAVED: images/artwork-map.json"
    )

    if total < len(tracks):
        print(
            "Some covers are still unavailable."
        )


if __name__ == "__main__":
    main()
