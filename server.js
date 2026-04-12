const express = require("express");
const cors = require("cors");
const path = require("path");

// Safe fetch for Node
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// Serve frontend files from same folder as server.js
app.use(express.static(__dirname));

// Access code -> DNS mapping
const codes = {
  "1111": "http://trixxtv.com"
};

async function safeFetch(url, res) {
  try {
    const r = await fetch(url);
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

  const rewritten = lines.map((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }

    const absolute = buildAbsoluteUrl(sourceUrl, trimmed);
    return `/proxy-stream?url=${encodeURIComponent(absolute)}`;
  });

  return rewritten.join("\n");
}

async function proxyBinary(url, req, res) {
  try {
    const headers = {
      "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
      "accept": req.headers["accept"] || "*/*"
    };

    if (req.headers.range) {
      headers.range = req.headers.range;
    }

    const upstream = await fetch(url, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text();
      return res.status(upstream.status).send(text || "Upstream stream error");
    }

    res.status(upstream.status);

    const passHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified"
    ];

    passHeaders.forEach((headerName) => {
      const value = upstream.headers.get(headerName);
      if (value) {
        res.setHeader(headerName, value);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.body) {
      return res.end();
    }

    upstream.body.pipe(res);
  } catch (err) {
    console.log("Proxy binary failed:", err);
    res.status(500).send("Proxy binary failed");
  }
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
  const code = req.query.code;

  if (codes[code]) {
    res.json({ success: true, dns: codes[code] });
  } else {
    res.json({ success: false });
  }
});

// LIVE CHANNELS
app.get("/get-channels", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_live_streams`, res);
});

// LIVE CATEGORIES
app.get("/get-live-categories", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_live_categories`, res);
});

// MOVIES
app.get("/get-movies", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`, res);
});

// MOVIE CATEGORIES
app.get("/get-movie-categories", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`, res);
});

// SERIES
app.get("/get-series", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_series`, res);
});

// SERIES CATEGORIES
app.get("/get-series-categories", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_series_categories`, res);
});

// MOVIE DETAILS
app.get("/get-movie-info", (req, res) => {
  const { dns, username, password, id } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_vod_info&vod_id=${id}`, res);
});

// SERIES DETAILS
app.get("/get-series-info", (req, res) => {
  const { dns, username, password, id } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${id}`, res);
});

// UNIVERSAL STREAM PROXY
app.get("/proxy-stream", async (req, res) => {
  const sourceUrl = req.query.url;

  if (!sourceUrl) {
    return res.status(400).send("Missing url");
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: {
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        "accept": req.headers["accept"] || "*/*",
        ...(req.headers.range ? { range: req.headers.range } : {})
      }
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text();
      return res.status(upstream.status).send(text || "Upstream stream error");
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (
      sourceUrl.includes(".m3u8") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegURL")
    ) {
      const text = await upstream.text();
      const rewritten = rewriteM3U8Content(text, sourceUrl);

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store");
      return res.send(rewritten);
    }

    res.status(upstream.status);

    const passHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified"
    ];

    passHeaders.forEach((headerName) => {
      const value = upstream.headers.get(headerName);
      if (value) {
        res.setHeader(headerName, value);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.body) {
      return res.end();
    }

    upstream.body.pipe(res);
  } catch (err) {
    console.log("Universal proxy failed:", err);
    res.status(500).send("Universal proxy failed");
  }
});

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

app.get("/proxy-stream", async (req, res) => {
  const sourceUrl = req.query.url;

  if (!sourceUrl) {
    return res.status(400).send("Missing url");
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: {
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        "accept": req.headers["accept"] || "*/*",
        ...(req.headers.range ? { range: req.headers.range } : {})
      }
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text();
      return res.status(upstream.status).send(text || "Upstream stream error");
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (
      sourceUrl.includes(".m3u8") ||
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegURL")
    ) {
      const text = await upstream.text();
      const rewritten = rewriteM3U8Content(text, sourceUrl);

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-store");
      return res.send(rewritten);
    }

    res.status(upstream.status);

    const passHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified"
    ];

    passHeaders.forEach((headerName) => {
      const value = upstream.headers.get(headerName);
      if (value) {
        res.setHeader(headerName, value);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.body) {
      return res.end();
    }

    upstream.body.pipe(res);
  } catch (err) {
    console.log("Universal proxy failed:", err);
    res.status(500).send("Universal proxy failed");
  }
});

app.get("/get-account-info", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}`, res);
});
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});