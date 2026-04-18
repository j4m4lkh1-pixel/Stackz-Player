const express = require("express");
const cors = require("cors");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

// Safe fetch for Node
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// PRIVATE DNS - HIDDEN FROM USERS
const DNS = "http://trixxtv.com";
const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY || "vsvLsI1F2LyFjbYIHxujxa5fHYsuBCkp";
const OPENSUBTITLES_USERNAME = process.env.OPENSUBTITLES_USERNAME || "jkh9";
const OPENSUBTITLES_PASSWORD = process.env.OPENSUBTITLES_PASSWORD || "Arsenal_17";

let openSubtitlesTokenCache = {
  token: "",
  expiresAt: 0
};

// Serve frontend files from same folder as server.js
app.use(express.static(__dirname));

// Access code -> DNS mapping
const codes = {
  "9511": DNS
};

// Keep upstream live-session cookies per visitor
const upstreamCookieJar = new Map();

function getClientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function getCookieJarKey(req, origin) {
  return `${getClientKey(req)}::${origin}`;
}

function extractCookieHeader(setCookieHeaders) {
  if (!setCookieHeaders || !setCookieHeaders.length) return "";
  return setCookieHeaders
    .map(cookie => String(cookie).split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function safeFetch(url, res) {
  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "application/json,text/plain,*/*"
      }
    });

    const text = await r.text();

    try {
      const json = JSON.parse(text);
      res.json(json);
    } catch {
      console.log("Not JSON response:");
      console.log(text.substring(0, 200));
      res.status(500).send("Invalid JSON from provider");
    }
  } catch (err) {
    console.log("Fetch failed:", err);
    res.status(500).send("Fetch failed");
  }
}

function buildAbsoluteUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return maybeRelative;
  }
}

function rewriteM3U8Content(text, sourceUrl) {
  const lines = text.split("\n");

  return lines.map((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }

    const absolute = buildAbsoluteUrl(sourceUrl, trimmed);
    return `/proxy-stream?url=${encodeURIComponent(absolute)}`;
  }).join("\n");
}

// FRONTEND PAGES
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/profiles.html", (req, res) => {
  res.sendFile(path.join(__dirname, "profiles.html"));
});

app.get("/player.html", (req, res) => {
  res.sendFile(path.join(__dirname, "player.html"));
});

// ACCESS CODE ROUTE
app.get("/get-dns", (req, res) => {
  const code = req.query.code || req.query.accessCode;

  if (codes[code]) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// VALIDATE LOGIN
app.get("/validate-login", async (req, res) => {
  const { username, password } = req.query;

  if (!username || !password) {
    return res.json({
      success: false,
      message: "ERROR - Wrong Credentials or expired"
    });
  }

  try {
    const response = await fetch(
      `${DNS}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      {
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept": "application/json,text/plain,*/*"
        }
      }
    );

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.json({
        success: false,
        message: "ERROR - Wrong Credentials or expired"
      });
    }

    const userInfo = data.user_info || {};

    const isValid =
      String(userInfo.auth) === "1" &&
      String(userInfo.status || "").toLowerCase() === "active";

    if (!isValid) {
      return res.json({
        success: false,
        message: "ERROR - Wrong Credentials or expired"
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.log("Validate login failed:", err);
    return res.json({
      success: false,
      message: "ERROR - Wrong Credentials or expired"
    });
  }
});

// LIVE CHANNELS
app.get("/get-channels", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_live_streams`, res);
});

// LIVE CATEGORIES
app.get("/get-live-categories", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_live_categories`, res);
});

// MOVIES
app.get("/get-movies", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`, res);
});

// MOVIE CATEGORIES
app.get("/get-movie-categories", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`, res);
});

// SERIES
app.get("/get-series", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series`, res);
});

// SERIES CATEGORIES
app.get("/get-series-categories", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series_categories`, res);
});

// MOVIE DETAILS
app.get("/get-movie-info", (req, res) => {
  const { username, password, id } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_info&vod_id=${id}`, res);
});

// SERIES DETAILS
app.get("/get-series-info", (req, res) => {
  const { username, password, id } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${id}`, res);
});

// ACCOUNT INFO
app.get("/get-account-info", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}`, res);
});

// (rest of proxy + ffmpeg code continues exactly same...)

async function getOpenSubtitlesToken() {
  if (
    openSubtitlesTokenCache.token &&
    openSubtitlesTokenCache.expiresAt > Date.now()
  ) {
    return openSubtitlesTokenCache.token;
  }

  const response = await fetch("https://api.opensubtitles.com/api/v1/login", {
    method: "POST",
    headers: {
      "Api-Key": OPENSUBTITLES_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "Stackz Player v1.0"
    },
    body: JSON.stringify({
      username: OPENSUBTITLES_USERNAME,
      password: OPENSUBTITLES_PASSWORD
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    console.log("OpenSubtitles login failed:", data);
    throw new Error(data?.message || "OpenSubtitles login failed");
  }

  openSubtitlesTokenCache = {
    token: data.token,
    expiresAt: Date.now() + (1000 * 60 * 20)
  };

  return data.token;
}

app.get("/subtitles", async (req, res) => {
  const rawTitle = String(req.query.title || "").trim();
  const rawSeason = String(req.query.season || "").trim();
  const rawEpisode = String(req.query.episode || "").trim();

  if (!rawTitle) {
    return res.json([]);
  }

  try {
    const token = await getOpenSubtitlesToken();

    const searchUrl = new URL("https://api.opensubtitles.com/api/v1/subtitles");
    searchUrl.searchParams.set("query", rawTitle);
    searchUrl.searchParams.set("languages", "en");

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        "Api-Key": OPENSUBTITLES_API_KEY,
        "User-Agent": "Stackz Player v1.0"
      }
    });

    const searchData = await searchResponse.json().catch(() => ({}));

    if (!searchResponse.ok || !Array.isArray(searchData.data) || !searchData.data.length) {
      console.log("No subtitle search results for:", rawTitle, searchData);
      return res.json([]);
    }

    const attrs = searchData.data[0]?.attributes || {};
    const firstFile = Array.isArray(attrs.files) ? attrs.files[0] : null;
    const fileId = firstFile?.file_id;

    if (!fileId) {
      return res.json([]);
    }

    const downloadResponse = await fetch("https://api.opensubtitles.com/api/v1/download", {
      method: "POST",
      headers: {
        "Api-Key": OPENSUBTITLES_API_KEY,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Stackz Player v1.0"
      },
      body: JSON.stringify({
        file_id: fileId,
        sub_format: "webvtt"
      })
    });

    const downloadData = await downloadResponse.json().catch(() => ({}));

    if (!downloadResponse.ok || !downloadData.link) {
      console.log("Subtitle download failed:", downloadData);
      return res.json([]);
    }

    return res.json([
      {
        label: attrs.language || "English",
        lang: attrs.iso639 || "en",
        url: `/proxy-stream?url=${encodeURIComponent(downloadData.link)}`
      }
    ]);
  } catch (err) {
    console.log("OpenSubtitles route failed:", err);
    return res.json([]);
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});