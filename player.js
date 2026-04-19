const subtitleStyleDefaults = {
  size: 20,
  color: "#ffffff",
  background: "rgba(0,0,0,0.72)"
};

function getSubtitleStyleSettings() {
  try {
    return {
      ...subtitleStyleDefaults,
      ...JSON.parse(localStorage.getItem("subtitleStyleSettings") || "{}")
    };
  } catch {
    return { ...subtitleStyleDefaults };
  }
}

function applySubtitleStyles() {
  const settings = getSubtitleStyleSettings();
  let styleEl = document.getElementById("subtitleCueStyle");

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "subtitleCueStyle";
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    #video::cue {
      font-size: ${settings.size}px;
      color: ${settings.color};
      background: ${settings.background};
      text-shadow: 0 2px 6px rgba(0,0,0,0.65);
    }
  `;
}

function saveSubtitleStyleSettings(newSettings) {
  const merged = {
    ...getSubtitleStyleSettings(),
    ...newSettings
  };
  localStorage.setItem("subtitleStyleSettings", JSON.stringify(merged));
  applySubtitleStyles();
}

function showPopup(message) {
  const popup = document.getElementById("customPopup");
  popup.textContent = message;

  popup.style.opacity = "1";
  popup.style.transform = "translateX(-50%) translateY(0)";

  setTimeout(() => {
    popup.style.opacity = "0";
    popup.style.transform = "translateX(-50%) translateY(20px)";
  }, 2500);
}

function openResumePrompt(item) {
  pendingContinueItem = item;

  const title = item?.name || "this title";
  const minutes = item?.currentTime ? Math.floor(item.currentTime / 60) : 0;
  const seconds = item?.currentTime ? Math.floor(item.currentTime % 60) : 0;

  document.getElementById("resumePromptText").textContent =
    `Continue ${title}? Resume from ${minutes}:${String(seconds).padStart(2, "0")} or start from the beginning.`;

  document.getElementById("resumePromptOverlay").style.display = "flex";
}

function closeResumePrompt() {
  pendingContinueItem = null;
  document.getElementById("resumePromptOverlay").style.display = "none";
}

function resumeContinueItem() {
  launchContinueItem(false);
}

function startOverContinueItem() {
  launchContinueItem(true);
}

function launchContinueItem(startOver = false) {
  const item = pendingContinueItem;
  closeResumePrompt();

  if (!item) return;

  pendingStartTime = startOver ? 0 : (item.currentTime || 0);

  if (item.type === "movies") {
    selectedItem = {
      type: "movies",
      stream_id: item.stream_id || item.id,
      id: item.id || item.stream_id,
      name: item.name || "Movie",
      stream_icon: item.poster || "",
      cover: item.poster || "",
      container_extension: item.container_extension || "mp4"
    };

    playSelected();
    return;
  }

  if (item.type === "series_episode") {
    selectedItem = {
      type: "series_episode",
      stream_id: item.stream_id || item.id,
      id: item.id || item.stream_id,
      name: item.name || "Episode",
      cover: item.poster || "",
      container_extension: item.container_extension || "mp4"
    };

    playSelected();
  }
}
function applyStartTimeWhenReady(video, startAt) {
  if (!startAt || startAt <= 5) return;

  const seekToSavedTime = () => {
    try {
      video.currentTime = startAt;
    } catch {}
  };

  if (video.readyState >= 1) {
    seekToSavedTime();
  } else {
    video.addEventListener("loadedmetadata", seekToSavedTime, { once: true });
    video.addEventListener("canplay", seekToSavedTime, { once: true });
  }
}

const username = localStorage.getItem("username");
const password = localStorage.getItem("password");

let liveChannels = [];
let liveCategories = [];
let movies = [];
let movieCategories = [];
let seriesData = [];
let seriesCategories = [];

let selectedItem = null;
let lastPage = "movies";
let currentHls = null;
let currentSeriesData = null;
let currentPlaybackMode = "direct";
let currentEpisodeContext = null;
let playerControlsHideTimer = null;
let playerControlsBound = false;
let pendingContinueItem = null;
let pendingStartTime = 0;
let isUserSeeking = false;
let autoplayNextTimer = null;
let autoplayNextCountdown = 5;

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

liveChannels = readCache("cachedLive");
liveCategories = readCache("cachedLiveCategories");
movies = readCache("cachedMovies");
movieCategories = readCache("cachedMovieCategories");
seriesData = readCache("cachedSeries");
seriesCategories = readCache("cachedSeriesCategories");

applySubtitleStyles();

function showPage(page) {
  const sections = document.querySelectorAll(".section");

  sections.forEach(s => {
    s.classList.remove("active");
    s.style.display = "none";
  });

  const target = document.getElementById(page);
  if (!target) return;

  target.style.display = "block";

  setTimeout(() => {
    target.classList.add("active");
  }, 10);
}

function showMessage(targetId, text) {
  document.getElementById(targetId).innerHTML = `<div class="message">${text}</div>`;
}

function renderLoadingRow(targetId, count = 6) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = `<div class="skeleton-grid">${Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-poster"></div>
      <div class="skeleton-line medium"></div>
      <div class="skeleton-meta-row">
        <div class="skeleton-chip"></div>
        <div class="skeleton-sub"></div>
      </div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line full"></div>
    </div>
  `).join("")}</div>`;
}

function showHomeLoadingStates() {
  renderLoadingRow("continueWatchingGrid", 6);
  renderLoadingRow("upNextGrid", 6);
  renderLoadingRow("homeWatchlistGrid", 6);
  renderLoadingRow("trendingGrid", 6);
  renderLoadingRow("becauseWatchedGrid", 6);
  renderLoadingRow("randomMoviesGrid", 6);
  renderLoadingRow("randomSeriesGrid", 6);
}

function setActive(el, selector) {
  document.querySelectorAll(selector).forEach(c => c.classList.remove("active"));
  el.classList.add("active");
}

function toggleSidebar(id) {
  const sidebar = document.getElementById(id);
  sidebar.classList.toggle("collapsed");
  const btn = sidebar.querySelector(".toggle-btn");
  btn.textContent = sidebar.classList.contains("collapsed") ? "⟩" : "⟨";
}

function fetchJson(url) {
  return fetch(url).then(async r => {
    const text = await r.text();
    if (!r.ok) {
      throw new Error(text || `Request failed: ${r.status}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Server did not return valid JSON");
    }
  });
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function seededShuffle(array, seedString) {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
  }
  const arr = [...array];
  function rand() {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getItemId(item) {
  return item?.stream_id || item?.series_id || item?.id || null;
}

function setProfileList(baseKey, value) {
  localStorage.setItem(getProfileStorageKey(baseKey), JSON.stringify(value));
}

function buildProxyStreamUrl(rawUrl) {
  return `${window.location.origin}/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
}

function buildInternalStreamUrl(type, streamId, ext = "mp4") {
  return `${window.location.origin}/stream?type=${encodeURIComponent(type)}&id=${encodeURIComponent(streamId)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&ext=${encodeURIComponent(ext)}`;
}

function buildLiveStreamUrl(streamId) {
  return buildInternalStreamUrl("live", streamId, "m3u8");
}

function getPosterUrl(item) {
  return (
    item?.stream_icon ||
    item?.cover ||
    item?.poster ||
    item?.big_cover ||
    item?.movie_image ||
    "https://via.placeholder.com/300x450?text=No+Image"
  );
}

function isInWatchlist(item) {
  const list = JSON.parse(localStorage.getItem("watchlist") || "[]");
  const id = getItemId(item);
  return list.some(x => (x.type === item.type) && (getItemId(x) === id));
}

function isInContinueWatching(item) {
  const list = JSON.parse(localStorage.getItem("continueWatching") || "[]");
  const id = getItemId(item);
  return list.some(x => (x.type === item.type) && (getItemId(x) === id));
}

function refreshDetailActionButtons() {
  const watchBtn = document.getElementById("removeWatchlistBtn");
  const continueBtn = document.getElementById("removeContinueBtn");

  if (!selectedItem) {
    watchBtn.style.display = "none";
    continueBtn.style.display = "none";
    return;
  }

  watchBtn.style.display = isInWatchlist(selectedItem) ? "inline-block" : "inline-block";
  continueBtn.style.display = isInContinueWatching(selectedItem) ? "inline-block" : "none";
}

function renderWelcomeMessage() {
  const activeProfile = JSON.parse(localStorage.getItem("activeProfile") || "null");
  const welcome = document.getElementById("welcomeMessage");
  const subtext = document.getElementById("welcomeSubtext");
  const avatar = document.getElementById("welcomeAvatar");

  if (!welcome) return;

  if (activeProfile && activeProfile.name) {
    welcome.textContent = activeProfile.name;
  } else {
    welcome.textContent = "Welcome";
  }

  if (subtext) {
    subtext.textContent = "Continue where you left off.";
  }

  if (avatar) {
    avatar.src = (activeProfile && activeProfile.avatar) ? activeProfile.avatar : "Profile 1.png";
  }
}

function loadProfileIcon() {
  const profile = JSON.parse(localStorage.getItem("activeProfile") || "null");
  if (profile && profile.avatar) {
    document.getElementById("profileIcon").src = profile.avatar;
  } else {
    document.getElementById("profileIcon").src = "Profile 1.png";
  }
}

function toggleProfileMenu() {
  const menu = document.getElementById("profileDropdown");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function openProfileCard() {
  const profile = JSON.parse(localStorage.getItem("activeProfile") || "null");

  document.getElementById("profileDropdown").style.display = "none";
  document.getElementById("profileCardImage").src = (profile && profile.avatar) ? profile.avatar : "Profile 1.png";
  document.getElementById("profileCardName").textContent = (profile && profile.name) ? profile.name : "Profile";

  document.getElementById("profileCardOverlay").style.display = "flex";
}

function closeProfileCard() {
  document.getElementById("profileCardOverlay").style.display = "none";
}

function switchProfiles() {
  window.location.href = "profiles.html";
}

function logout() {
  localStorage.removeItem("activeProfile");
  localStorage.removeItem("saveLogin");
  localStorage.removeItem("username");
  localStorage.removeItem("password");
  window.location.href = "login.html";
}
window.addEventListener("click", function(e) {
  const autoplayBox = document.getElementById("autoplayOverlay");
  const menu = document.getElementById("profileDropdown");
  const profileCard = document.getElementById("profileCardOverlay");
  const resumePrompt = document.getElementById("resumePromptOverlay");

  if (!e.target.closest("#subtitleMenu") && !e.target.closest("#subtitleBtn")) {
    const subtitleMenu = document.getElementById("subtitleMenu");
    if (subtitleMenu) subtitleMenu.style.display = "none";
  }

  if (e.target === autoplayBox) {
    cancelAutoplayNext();
  }

  if (!e.target.closest(".navbar-right")) {
    menu.style.display = "none";
  }

  if (e.target === profileCard) {
    closeProfileCard();
  }

  if (e.target === resumePrompt) {
    closeResumePrompt();
  }
});

window.addEventListener("keydown", function(e) {
  const overlay = document.getElementById("playerOverlay");
  const video = document.getElementById("video");

  if (!overlay || overlay.style.display !== "block" || !video) return;

  if (document.activeElement && (
    document.activeElement.tagName === "INPUT" ||
    document.activeElement.tagName === "TEXTAREA"
  )) return;

  if (e.key === "ArrowRight") {
    e.preventDefault();
    isUserSeeking = true;
    seekRelative(10);
    setTimeout(() => { isUserSeeking = false; }, 800);
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    isUserSeeking = true;
    seekRelative(-10);
    setTimeout(() => { isUserSeeking = false; }, 800);
  }
});

function showAutoplayNext() {
  if (!(selectedItem?.type === "series_episode" && currentSeriesData && currentEpisodeContext)) {
    return;
  }

  cancelAutoplayNext(false);
  autoplayNextCountdown = 5;
  updateAutoplayText();

  const overlay = document.getElementById("autoplayOverlay");
  overlay.style.display = "block";

  autoplayNextTimer = setInterval(() => {
    autoplayNextCountdown -= 1;
    updateAutoplayText();

    if (autoplayNextCountdown <= 0) {
      cancelAutoplayNext(false);
      playNextEpisode();
    }
  }, 1000);
}

function updateAutoplayText() {
  const text = document.getElementById("autoplayText");
  if (!text) return;
  text.textContent = `Playing next episode in ${autoplayNextCountdown} second${autoplayNextCountdown === 1 ? "" : "s"}...`;
}

function cancelAutoplayNext(showMessage = true) {
  if (autoplayNextTimer) {
    clearInterval(autoplayNextTimer);
    autoplayNextTimer = null;
  }

  const overlay = document.getElementById("autoplayOverlay");
  if (overlay) {
    overlay.style.display = "none";
  }

  if (showMessage) {
    showPopup("Auto-play cancelled");
  }
}

function playNextEpisodeNow() {
  cancelAutoplayNext(false);
  playNextEpisode();
}

function showPlayerLoading(message = "Loading video...") {
  const overlay = document.getElementById("playerLoadingOverlay");
  const text = overlay ? overlay.querySelector(".player-loading-text") : null;

  if (!overlay) return;

  if (text) {
    text.textContent = message;
  }

  overlay.classList.add("active");
}

function hidePlayerLoading() {
  const overlay = document.getElementById("playerLoadingOverlay");
  if (!overlay) return;
  overlay.classList.remove("active");
}