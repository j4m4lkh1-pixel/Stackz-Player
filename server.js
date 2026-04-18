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

// Serve frontend files
app.use(express.static(__dirname));

// Access code
const codes = {
  "9511": DNS
};

// ---------- OPEN SUBTITLES ----------

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
    throw new Error("OpenSubtitles login failed");
  }

  openSubtitlesTokenCache = {
    token: data.token,
    expiresAt: Date.now() + (1000 * 60 * 20)
  };

  return data.token;
}

app.get("/subtitles", async (req, res) => {
  const title = String(req.query.title || "").trim();
  const season = String(req.query.season || "").trim();
  const episode = String(req.query.episode || "").trim();

  if (!title) return res.json([]);

  try {
    const token = await getOpenSubtitlesToken();

    const searchUrl = new URL("https://api.opensubtitles.com/api/v1/subtitles");
    searchUrl.searchParams.set("query", title);
    searchUrl.searchParams.set("languages", "en");

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        "Api-Key": OPENSUBTITLES_API_KEY,
        "User-Agent": "Stackz Player v1.0"
      }
    });

    const searchData = await searchResponse.json().catch(() => ({}));

    if (!searchData?.data?.length) {
      console.log("No subtitles found for:", title);
      return res.json([]);
    }

    const fileId = searchData.data[0]?.attributes?.files?.[0]?.file_id;
    if (!fileId) return res.json([]);

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

    if (!downloadData.link) {
      console.log("Subtitle download failed:", downloadData);
      return res.json([]);
    }

    return res.json([
      {
        label: "English",
        lang: "en",
        url: `/proxy-stream?url=${encodeURIComponent(downloadData.link)}`
      }
    ]);

  } catch (err) {
    console.log("Subtitle error:", err);
    return res.json([]);
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});