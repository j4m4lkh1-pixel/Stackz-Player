const express = require("express");
const cors = require("cors");
const path = require("path");

// Safe fetch
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔒 PRIVATE DNS (HIDDEN FROM USERS)
const DNS = "http://trixxtv.com";

// Serve frontend
app.use(express.static(__dirname));

// ---------- SAFE FETCH ----------
async function safeFetch(url, res) {
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.log("Fetch failed:", err);
    res.status(500).send("Fetch failed");
  }
}

// ---------- API ROUTES (DNS REMOVED FROM FRONTEND) ----------

app.get("/get-channels", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_live_streams`, res);
});

app.get("/get-live-categories", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_live_categories`, res);
});

app.get("/get-movies", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`, res);
});

app.get("/get-movie-categories", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`, res);
});

app.get("/get-series", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series`, res);
});

app.get("/get-series-categories", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series_categories`, res);
});

app.get("/get-movie-info", (req, res) => {
  const { username, password, id } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_info&vod_id=${id}`, res);
});

app.get("/get-series-info", (req, res) => {
  const { username, password, id } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${id}`, res);
});

app.get("/get-account-info", (req, res) => {
  const { username, password } = req.query;
  safeFetch(`${DNS}/player_api.php?username=${username}&password=${password}`, res);
});

// ---------- STREAM (HIDES DNS) ----------
app.get("/stream", async (req, res) => {
  try {
    const { type, id, username, password, ext } = req.query;

    if (!type || !id) {
      return res.status(400).send("Missing params");
    }

    let url = "";

    if (type === "live") {
      url = `${DNS}/live/${username}/${password}/${id}.m3u8`;
    } else if (type === "movie") {
      url = `${DNS}/movie/${username}/${password}/${id}.${ext || "mp4"}`;
    } else if (type === "series") {
      url = `${DNS}/series/${username}/${password}/${id}.${ext || "mp4"}`;
    }

    const response = await fetch(url);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", response.headers.get("content-type") || "video/mp4");

    response.body.pipe(res);

  } catch (err) {
    console.log("Stream error:", err);
    res.status(500).send("Stream failed");
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});