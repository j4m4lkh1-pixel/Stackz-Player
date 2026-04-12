const express = require("express");
const cors = require("cors");
const path = require("path");

// Safe fetch for Node
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Serve frontend files
app.use(express.static(__dirname));

// Access code -> DNS mapping
const codes = {
  "1111": "http://trixxtv.com"
};

// ==================== HELPERS ====================

async function safeFetch(url, res) {
  try {
    const r = await fetch(url);
    const text = await r.text();

    try {
      const json = JSON.parse(text);
      res.json(json);
    } catch {
      console.log("Not JSON response:", text.substring(0, 200));
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
  return text.split("\n").map((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) return line;

    const absolute = buildAbsoluteUrl(sourceUrl, trimmed);
    return `/proxy-stream?url=${encodeURIComponent(absolute)}`;
  }).join("\n");
}

// ==================== ROUTES ====================

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/login.html", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/profiles.html", (req, res) => res.sendFile(path.join(__dirname, "profiles.html")));
app.get("/player.html", (req, res) => res.sendFile(path.join(__dirname, "player.html")));

// ==================== FIXED ACCESS CODE ====================

app.all("/get-dns", (req, res) => {
  try {
    const code =
      req.query.accessCode ||
      req.query.code ||
      req.body.accessCode ||
      req.body.code;

    console.log("GET-DNS:", {
      method: req.method,
      code,
      query: req.query,
      body: req.body
    });

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "No access code"
      });
    }

    if (!codes[code]) {
      return res.status(404).json({
        success: false,
        error: "Invalid code"
      });
    }

    return res.json({
      success: true,
      dns: codes[code]
    });

  } catch (err) {
    console.error("GET-DNS ERROR:", err);
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

// ==================== API ====================

app.get("/get-channels", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_live_streams`, res);
});

app.get("/get-live-categories", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_live_categories`, res);
});

app.get("/get-movies", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`, res);
});

app.get("/get-movie-categories", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`, res);
});

app.get("/get-series", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_series`, res);
});

app.get("/get-series-categories", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_series_categories`, res);
});

app.get("/get-movie-info", (req, res) => {
  const { dns, username, password, id } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_vod_info&vod_id=${id}`, res);
});

app.get("/get-series-info", (req, res) => {
  const { dns, username, password, id } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${id}`, res);
});

app.get("/get-account-info", (req, res) => {
  const { dns, username, password } = req.query;
  safeFetch(`${dns}/player_api.php?username=${username}&password=${password}`, res);
});

// ==================== STREAM PROXY ====================

app.get("/proxy-stream", async (req, res) => {
  const sourceUrl = req.query.url;

  if (!sourceUrl) return res.status(400).send("Missing url");

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
      return res.status(upstream.status).send(text || "Upstream error");
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (
      sourceUrl.includes(".m3u8") ||
      contentType.includes("mpegurl")
    ) {
      const text = await upstream.text();
      const rewritten = rewriteM3U8Content(text, sourceUrl);

      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.send(rewritten);
    }

    res.status(upstream.status);

    [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges"
    ].forEach(h => {
      const val = upstream.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    res.setHeader("Access-Control-Allow-Origin", "*");

    upstream.body.pipe(res);

  } catch (err) {
    console.log("Proxy error:", err);
    res.status(500).send("Proxy failed");
  }
});

// ==================== START ====================

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});