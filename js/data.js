
"use strict";

/* =========================================
   AFTERHOURS
   GLOBAL HIP-HOP & R&B TOP 50
   DEMO MUSIC DATA
========================================= */

// 楽曲データを作成する関数
function song(id, title, artist) {
  return {
    id: id,
    title: title,
    artist: artist
  };
}

// ランキングデータ
window.AFTERHOURS_DATA = {

  // 実際の集計結果ではなくデモデータ
  edition: "DEMO",
  source: "EDITORIAL SAMPLE",

  /* =====================================
     HIP-HOP TOP 50
  ===================================== */

  hiphop: [

    song("hh01", "Not Like Us", "Kendrick Lamar"),
    song("hh02", "NOKIA", "Drake"),
    song("hh03", "Anxiety", "Doechii"),
    song("hh04", "Sticky", "Tyler, The Creator"),
    song("hh05", "Like That", "Future, Metro Boomin & Kendrick Lamar"),

    song("hh06", "FE!N", "Travis Scott & Playboi Carti"),
    song("hh07", "tv off", "Kendrick Lamar"),
    song("hh08", "squabble up", "Kendrick Lamar"),
    song("hh09", "Rich Baby Daddy", "Drake, Sexyy Red & SZA"),
    song("hh10", "Type Shit", "Future, Metro Boomin, Travis Scott & Playboi Carti"),

    song("hh11", "redrum", "21 Savage"),
    song("hh12", "MELTDOWN", "Travis Scott & Drake"),
    song("hh13", "HISS", "Megan Thee Stallion"),
    song("hh14", "BAND4BAND", "Central Cee & Lil Baby"),
    song("hh15", "TGIF", "GloRilla"),

    song("hh16", "HUMBLE.", "Kendrick Lamar"),
    song("hh17", "SICKO MODE", "Travis Scott"),
    song("hh18", "goosebumps", "Travis Scott"),
    song("hh19", "BUTTERFLY EFFECT", "Travis Scott"),
    song("hh20", "Mask Off", "Future"),

    song("hh21", "Life Is Good", "Future & Drake"),
    song("hh22", "WAIT FOR U", "Future, Drake & Tems"),
    song("hh23", "Low Life", "Future & The Weeknd"),
    song("hh24", "Jimmy Cooks", "Drake & 21 Savage"),
    song("hh25", "Rich Flex", "Drake & 21 Savage"),

    song("hh26", "First Person Shooter", "Drake & J. Cole"),
    song("hh27", "Nonstop", "Drake"),
    song("hh28", "God's Plan", "Drake"),
    song("hh29", "In My Feelings", "Drake"),
    song("hh30", "Knife Talk", "Drake, 21 Savage & Project Pat"),

    song("hh31", "No Role Modelz", "J. Cole"),
    song("hh32", "MIDDLE CHILD", "J. Cole"),
    song("hh33", "a lot", "21 Savage & J. Cole"),
    song("hh34", "Bank Account", "21 Savage"),
    song("hh35", "Runnin", "21 Savage & Metro Boomin"),

    song("hh36", "Superhero (Heroes & Villains)", "Metro Boomin, Future & Chris Brown"),
    song("hh37", "Creepin'", "Metro Boomin, The Weeknd & 21 Savage"),
    song("hh38", "Too Many Nights", "Metro Boomin & Don Toliver"),
    song("hh39", "Trance", "Metro Boomin, Travis Scott & Young Thug"),
    song("hh40", "Praise The Lord (Da Shine)", "A$AP Rocky & Skepta"),

    song("hh41", "Sundress", "A$AP Rocky"),
    song("hh42", "fukumean", "Gunna"),
    song("hh43", "pushin P", "Gunna, Future & Young Thug"),
    song("hh44", "Drip Too Hard", "Lil Baby & Gunna"),
    song("hh45", "Freestyle", "Lil Baby"),

    song("hh46", "Sum 2 Prove", "Lil Baby"),
    song("hh47", "XO TOUR Llif3", "Lil Uzi Vert"),
    song("hh48", "Just Wanna Rock", "Lil Uzi Vert"),
    song("hh49", "Magnolia", "Playboi Carti"),
    song("hh50", "Sky", "Playboi Carti")

  ],

  /* =====================================
     R&B TOP 50
  ===================================== */

  rnb: [

    song("rb01", "luther", "Kendrick Lamar & SZA"),
    song("rb02", "Timeless", "The Weeknd & Playboi Carti"),
    song("rb03", "Snooze", "SZA"),
    song("rb04", "Residuals", "Chris Brown"),
    song("rb05", "Water", "Tyla"),

    song("rb06", "Little Things", "Jorja Smith"),
    song("rb07", "Saturn", "SZA"),
    song("rb08", "Burning Blue", "Mariah the Scientist"),
    song("rb09", "30 For 30", "SZA & Kendrick Lamar"),
    song("rb10", "Superpowers", "Daniel Caesar"),

    song("rb11", "ICU", "Coco Jones"),
    song("rb12", "Made For Me", "Muni Long"),
    song("rb13", "Heartbreak Anniversary", "Giveon"),
    song("rb14", "On My Mama", "Victoria Monét"),
    song("rb15", "Best Part", "Daniel Caesar & H.E.R."),

    song("rb16", "Kill Bill", "SZA"),
    song("rb17", "Good Days", "SZA"),
    song("rb18", "Nobody Gets Me", "SZA"),
    song("rb19", "The Weekend", "SZA"),
    song("rb20", "Love Galore", "SZA & Travis Scott"),

    song("rb21", "Broken Clocks", "SZA"),
    song("rb22", "All The Stars", "Kendrick Lamar & SZA"),
    song("rb23", "Die For You", "The Weeknd"),
    song("rb24", "Out of Time", "The Weeknd"),
    song("rb25", "Earned It", "The Weeknd"),

    song("rb26", "Call Out My Name", "The Weeknd"),
    song("rb27", "After Hours", "The Weeknd"),
    song("rb28", "I Feel It Coming", "The Weeknd & Daft Punk"),
    song("rb29", "Get You", "Daniel Caesar & Kali Uchis"),
    song("rb30", "Japanese Denim", "Daniel Caesar"),

    song("rb31", "Always", "Daniel Caesar"),
    song("rb32", "Freudian", "Daniel Caesar"),
    song("rb33", "Focus", "H.E.R."),
    song("rb34", "Damage", "H.E.R."),
    song("rb35", "Could've Been", "H.E.R. & Bryson Tiller"),

    song("rb36", "Come Through", "H.E.R. & Chris Brown"),
    song("rb37", "Exchange", "Bryson Tiller"),
    song("rb38", "Don't", "Bryson Tiller"),
    song("rb39", "Persian Rugs", "PARTYNEXTDOOR"),
    song("rb40", "Come and See Me", "PARTYNEXTDOOR & Drake"),

    song("rb41", "Recognize", "PARTYNEXTDOOR & Drake"),
    song("rb42", "Break from Toronto", "PARTYNEXTDOOR"),
    song("rb43", "BEST INTEREST", "Tyler, The Creator"),
    song("rb44", "Pink + White", "Frank Ocean"),
    song("rb45", "Thinkin Bout You", "Frank Ocean"),

    song("rb46", "Nights", "Frank Ocean"),
    song("rb47", "Ivy", "Frank Ocean"),
    song("rb48", "Lost", "Frank Ocean"),
    song("rb49", "Crew", "GoldLink, Brent Faiyaz & Shy Glizzy"),
    song("rb50", "Clouded", "Brent Faiyaz")

  ],

  /* =====================================
     前月のランキング履歴

     実際の履歴がないため未登録。
     順位変動はデータ取得後に実装する。
  ===================================== */

  previousMonth: {
    hiphop: [],
    rnb: []
  }

};
