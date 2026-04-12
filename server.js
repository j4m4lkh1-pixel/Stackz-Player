const express = require("express");
const cors = require("cors");
const path = require("path");

// Safe fetch for Node
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// PRIVATE DNS (ONLY HERE)
const DNS = "http://trixxtv.com";

app.use(express.static(__dirname));

// 🔐 STREAM ROUTE (NO DNS EXPOSED)
app.get("/stream", async (req, res) => {
  const { type, id, username, password, ext } = req.query;

  if (!type || !id || !username || !password) {
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

  try {
    const response = await fetch(url);

    res.setHeader("Access-Control-Allow-Origin", "*");

    response.body.pipe(res);
  } catch (err) {
    console.log("Stream error:", err);
    res.status(500).send("Stream failed");
  }
});

// API ROUTES (NO DNS FROM FRONTEND)

app.get("/get-channels", (req, res) => {
  const { username, password } = req.query;
  fetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_live_streams`)
    .then(r => r.json()).then(d => res.json(d));
});

app.get("/get-movies", (req, res) => {
  const { username, password } = req.query;
  fetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`)
    .then(r => r.json()).then(d => res.json(d));
});

app.get("/get-series", (req, res) => {
  const { username, password } = req.query;
  fetch(`${DNS}/player_api.php?username=${username}&password=${password}&action=get_series`)
    .then(r => r.json()).then(d => res.json(d));
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});