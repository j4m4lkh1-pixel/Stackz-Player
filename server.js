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

async function proxyStream(url, req, res) {
  try {
    const upstream = await fetch(url, {
      headers: {
        "user-agent": req.headers["user-agent"] || "Mozilla/5.0",
        accept: "*/*"
      }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).send(text || "Upstream stream error");
    }

    const contentType = upstream.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    const body = await upstream.arrayBuffer();
    res.send(Buffer.from(body));
  } catch (err) {
    console.log("Proxy stream failed:", err);
    res.status(500).send("Proxy stream failed");
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

// PROXY LIVE STREAM
app.get("/proxy/live/:username/:password/:streamId.m3u8", (req, res) => {
  const dns = req.query.dns;
  const { username, password, streamId } = req.params;
  proxyStream(`${dns}/live/${username}/${password}/${streamId}.m3u8`, req, res);
});

// PROXY MOVIE STREAM
app.get("/proxy/movie/:username/:password/:streamId.:ext", (req, res) => {
  const dns = req.query.dns;
  const { username, password, streamId, ext } = req.params;
  proxyStream(`${dns}/movie/${username}/${password}/${streamId}.${ext}`, req, res);
});

// PROXY SERIES EPISODE STREAM
app.get("/proxy/series/:username/:password/:streamId.:ext", (req, res) => {
  const dns = req.query.dns;
  const { username, password, streamId, ext } = req.params;
  proxyStream(`${dns}/series/${username}/${password}/${streamId}.${ext}`, req, res);
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});