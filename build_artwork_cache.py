
"""
AFTERHOURS
STEP 17 - ARTWORK CACHE GENERATOR

Run:
    python3 build_artwork_cache.py
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


ROOT = Path(__file__).resolve().parent

SOURCE = ROOT / "js" / "data.js"

DESTINATION = ROOT / "images" / "artwork-map.json"

REQUEST_INTERVAL = 3.3


PATTERN = re.compile(
    r'\bsong\s*\(\s*"(?P<id>(?:hh|rb)\d+)"\s*,\s*'
    r'"(?P<title>(?:\\.|[^"\\])*)"\s*,\s*'
    r'"(?P<artist>(?:\\.|[^"\\])*)"',
    flags=re.IGNORECASE | re.DOTALL,
)


def normalize(value: str) -> str:
    value = unicodedata.normalize(
        "NFKD",
        value
    ).lower()

    return "".join(
        char for char in value
        if char.isalnum()
    )


def clean(value: str) -> str:
    return (
        value.replace('\\"', '"')
             .replace('\\\\', '\\')
    )


def get_tracks() -> list[dict]:
    if not SOURCE.exists():
        raise SystemExit(
            f"ERROR: {SOURCE} does not exist"
        )

    source = SOURCE.read_text(
        encoding="utf-8"
    )

    tracks = []

    for match in PATTERN.finditer(source):
        tracks.append({
            "id": match["id"],
            "title": clean(match["title"]),
            "artist": clean(match["artist"]),
        })

    if len(tracks) < 50:
        raise SystemExit(
            f"ERROR: only {len(tracks)} tracks found. "
            "Please check js/data.js."
        )

    unique_tracks = {
        track["id"]: track
        for track in tracks
    }

    return list(unique_tracks.values())


def get_existing() -> dict:
    try:
        previous = json.loads(
            DESTINATION.read_text(
                encoding="utf-8"
            )
        )

        return (
            previous
            if isinstance(previous, dict)
            else {}
        )

    except (
        OSError,
        json.JSONDecodeError
    ):
        return {}


def is_matching(
    entry: object,
    track: dict
) -> bool:

    return (
        isinstance(entry, dict)
        and normalize(
            str(entry.get("title", ""))
        ) == normalize(track["title"])
        and normalize(
            str(entry.get("artist", ""))
        ) == normalize(track["artist"])
        and str(
            entry.get("image", "")
        ).startswith("https://")
    )


def save(cache: dict) -> None:
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

    temporary.replace(
        DESTINATION
    )


def search(track: dict) -> dict | None:
    params = urlencode({
        "term": (
            f'{track["title"]} '
            f'{track["artist"]}'
        ),
        "country": "US",
        "media": "music",
        "entity": "song",
        "limit": 25,
    })

    request = Request(
        "https://itunes.apple.com/search?"
        + params,
        headers={
            "User-Agent":
                "AFTERHOURS-Chart-Cache/1.0"
        }
    )

    try:
        with urlopen(
            request,
            timeout=20
        ) as response:
            data = json.load(response)

    except (
        HTTPError,
        URLError,
        TimeoutError,
        ValueError
    ) as error:
        print(
            f"  API error: {error}"
        )
        return None

    title = normalize(
        track["title"]
    )

    primary_artist = normalize(
        re.split(
            r',|&|\bfeat\.?\b|\bft\.?\b',
            track["artist"],
            flags=re.I
        )[0]
    )

    for item in data.get(
        "results",
        []
    ):
        found_title = normalize(
            str(item.get(
                "trackName",
                ""
            ))
        )

        found_artist = normalize(
            str(item.get(
                "artistName",
                ""
            ))
        )

        artwork = item.get(
            "artworkUrl100",
            ""
        )

        matching = (
            (
                found_title == title
                or found_title.startswith(title)
            )
            and primary_artist in found_artist
            and isinstance(artwork, str)
            and artwork.startswith("https://")
        )

        if not matching:
            continue

        image = re.sub(
            r"\b\d+x\d+bb(?=\.)",
            "300x300bb",
            artwork
        )

        return {
            "title": track["title"],
            "artist": track["artist"],
            "image": image,
            "link": item.get(
                "trackViewUrl",
                ""
            )
        }

    return None


def main() -> None:
    tracks = get_tracks()

    cached = get_existing()

    save(cached)

    already = sum(
        is_matching(
            cached.get(track["id"]),
            track
        )
        for track in tracks
    )

    print(
        "AFTERHOURS ARTWORK CACHE"
    )

    print(
        f"TRACKS: {len(tracks)}"
    )

    print(
        f"ALREADY SAVED: {already}"
    )

    last_call = 0.0

    for index, track in enumerate(
        tracks,
        1
    ):
        if is_matching(
            cached.get(track["id"]),
            track
        ):
            continue

        delay = max(
            0,
            REQUEST_INTERVAL -
            (time.monotonic() - last_call)
        )

        if delay:
            time.sleep(delay)

        last_call = time.monotonic()

        print(
            f"[{index}/{len(tracks)}] "
            f"{track['title']} / "
            f"{track['artist']}",
            flush=True
        )

        result = search(track)

        if result:
            cached[
                track["id"]
            ] = result

            save(cached)

            print(
                "  OK",
                flush=True
            )

        else:
            print(
                "  NOT FOUND",
                flush=True
            )

    saved = sum(
        is_matching(
            cached.get(track["id"]),
            track
        )
        for track in tracks
    )

    print(
        f"FINISHED: {saved}/{len(tracks)} "
        "artwork links saved to "
        "images/artwork-map.json"
    )


if __name__ == "__main__":
    main()
