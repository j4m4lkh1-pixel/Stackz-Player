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

  // small delay so transition works
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

function normalizeProfileAvatarPath(path) {
  if (!path) return "images/Profile 1.jpg";
  if (path.startsWith("images/")) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("data:")) return path;
  return "images/" + path;
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
    avatar.src = normalizeProfileAvatarPath(activeProfile && activeProfile.avatar);
  }
}

    function loadProfileIcon() {
      const profile = JSON.parse(localStorage.getItem("activeProfile") || "null");
            document.getElementById("profileIcon").src = normalizeProfileAvatarPath(profile && profile.avatar);
    }

    function toggleProfileMenu() {
      const menu = document.getElementById("profileDropdown");
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    }

function toggleProfileMenu() {
  const menu = document.getElementById("profileDropdown");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function openProfileCard() {
  const profile = JSON.parse(localStorage.getItem("activeProfile") || "null");

  document.getElementById("profileDropdown").style.display = "none";
    document.getElementById("profileCardImage").src = normalizeProfileAvatarPath(profile && profile.avatar);
  document.getElementById("profileCardName").textContent = (profile && profile.name) ? profile.name : "Profile";

  document.getElementById("profileCardOverlay").style.display = "flex";
}

function closeProfileCard() {
  document.getElementById("profileCardOverlay").style.display = "none";
}

function switchProfiles() {
  window.location.href = "profiles.html";
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

    function play(url, mode = "direct", startAt = 0, externalSubs = []) {
      const overlay = document.getElementById("playerOverlay");
      const video = document.getElementById("video");
      const liveBadge = document.getElementById("liveBadge");

            currentPlaybackMode = mode;
      overlay.style.display = "block";
      liveBadge.style.display = mode === "live" ? "block" : "none";
      showPlayerLoading(mode === "live" ? "Loading live stream..." : "Loading video...");

      video.pause();
      video.removeAttribute("src");
      video.load();

      if (currentHls) {
        currentHls.destroy();
        currentHls = null;
      }

      bindPlayerControls();
      updatePlayerTitle();
      updateEpisodeNavButtons();
      showPlayerControls(true);

            video.controls = false;
video.volume = 1;
video.muted = false;
updateVolumeUI();

      video.onwaiting = () => {
  if (isUserSeeking) return;
  showPlayerLoading(mode === "live" ? "Loading live stream..." : "Loading video...");
};

      video.onplaying = () => {
        hidePlayerLoading();
      };

      video.oncanplay = () => {
        hidePlayerLoading();
      };

      video.onerror = () => {
        hidePlayerLoading();
      };

      if ((mode === "live" || mode === "hls") && Hls.isSupported()) {
        const hls = new Hls({
          startPosition: -1,
          liveSyncMode: "edge",
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          liveDurationInfinity: true,
          backBufferLength: 0,
          lowLatencyMode: true,
          enableWorker: true
        });

        currentHls = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
  applyStartTimeWhenReady(video, startAt);
  video.play().catch(() => {});
  updatePlayPauseButton();
  updatePlayerProgressUI();
  scheduleHidePlayerControls();
  setupSubtitles(hls, externalSubs);
});

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", data);
        });
      } else {
        video.src = url;
setupSubtitles(null, externalSubs);
applyStartTimeWhenReady(video, startAt);
video.play().catch(() => {});
updatePlayPauseButton();
updatePlayerProgressUI();
scheduleHidePlayerControls();
      }

      setupProgressTracking(video, mode);
    }

    function setupProgressTracking(video, mode) {
      const syncProgress = () => {
        updatePlayerProgressUI();

        if (mode === "live" || !selectedItem) return;

        const duration = video.duration;
        const currentTime = video.currentTime;

        if (!duration || !isFinite(duration) || duration <= 0) return;
        if (!currentTime || currentTime < 5) return;

        const progressList = JSON.parse(localStorage.getItem("continueWatching") || "[]");

        const id = selectedItem.stream_id || selectedItem.id;
        const type = selectedItem.type;

        const itemData = {
          id,
          type,
          name: selectedItem.name || "Untitled",
          poster: selectedItem.stream_icon || selectedItem.cover || "",
          currentTime,
          duration,
          container_extension: selectedItem.container_extension || "mp4",
          series_id: selectedItem.series_id || null,
          stream_id: selectedItem.stream_id || null
        };

        const existingIndex = progressList.findIndex(x => x.id === id && x.type === type);

        if (existingIndex >= 0) {
          progressList[existingIndex] = itemData;
        } else {
          progressList.push(itemData);
        }

        localStorage.setItem("continueWatching", JSON.stringify(progressList));
      };

      video.ontimeupdate = syncProgress;
      video.onplay = () => {
  updatePlayPauseButton();
  updateVolumeUI();
  scheduleHidePlayerControls();
};
      video.onpause = () => {
  updatePlayPauseButton();
  updateVolumeUI();
  showPlayerControls(true);
};
      video.onloadedmetadata = updatePlayerProgressUI;
      video.ondurationchange = updatePlayerProgressUI;
      video.onended = () => {
  updatePlayPauseButton();
  showPlayerControls(true);

  if (selectedItem?.type === "series_episode") {
    showAutoplayNext();
  }
};
    }

    function closePlayer() {
cancelAutoplayNext(false);

      const overlay = document.getElementById("playerOverlay");
      const video = document.getElementById("video");

            overlay.style.display = "none";
      document.getElementById("liveBadge").style.display = "none";
      hidePlayerLoading();
      showPlayerControls(true);

      video.pause();
      video.removeAttribute("src");
      video.load();
      video.controls = false;

      if (currentHls) {
        currentHls.destroy();
        currentHls = null;
      }

      if (playerControlsHideTimer) {
        clearTimeout(playerControlsHideTimer);
        playerControlsHideTimer = null;
      }
    }

    function formatPlayerTime(seconds) {
      if (!isFinite(seconds) || seconds < 0) return "0:00";
      const total = Math.floor(seconds);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const secs = total % 60;

      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      }
      return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    function updatePlayerTitle() {
      const titleEl = document.getElementById("playerTitle");
      if (!titleEl) return;
      titleEl.textContent = selectedItem?.name || currentSeriesData?.info?.name || "Now Playing";
    }

    function updatePlayPauseButton() {
      const video = document.getElementById("video");
      const btn = document.getElementById("playPauseBtn");
      if (!video || !btn) return;
      btn.textContent = video.paused ? "▶" : "⏸";
    }

    function updatePlayerProgressUI() {
      const video = document.getElementById("video");
      const seek = document.getElementById("playerSeek");
      const current = document.getElementById("playerCurrentTime");
      const duration = document.getElementById("playerDuration");

      if (!video || !seek || !current || !duration) return;

      const isLive = currentPlaybackMode === "live";
      const dur = video.duration;

      current.textContent = formatPlayerTime(video.currentTime || 0);
      duration.textContent = !isLive && isFinite(dur) ? formatPlayerTime(dur) : "LIVE";

      seek.disabled = isLive || !isFinite(dur) || dur <= 0;
      if (seek.disabled) {
        seek.value = 0;
      } else {
        seek.value = Math.min(100, Math.max(0, (video.currentTime / dur) * 100));
      }
    }

    function showPlayerControls(forceVisible = false) {
      const ui = document.getElementById("playerUI");
      if (!ui) return;
      ui.classList.remove("hidden");
      if (forceVisible) {
        scheduleHidePlayerControls();
      }
    }

    function scheduleHidePlayerControls() {
      const video = document.getElementById("video");
      const ui = document.getElementById("playerUI");
      if (!video || !ui) return;

      if (playerControlsHideTimer) {
        clearTimeout(playerControlsHideTimer);
      }

      if (video.paused || currentPlaybackMode === "live" && !document.fullscreenElement) {
        return;
      }

      playerControlsHideTimer = setTimeout(() => {
        if (!video.paused) {
          ui.classList.add("hidden");
        }
      }, 2500);
    }
function toggleMute() {
  const video = document.getElementById("video");
  const muteBtn = document.getElementById("muteBtn");
  const volumeSlider = document.getElementById("volumeSlider");
  if (!video || !muteBtn || !volumeSlider) return;

  video.muted = !video.muted;

  if (!video.muted && video.volume === 0) {
    video.volume = 1;
    volumeSlider.value = 1;
  }

  updateVolumeUI();
}

function updateVolumeUI() {
  const video = document.getElementById("video");
  const muteBtn = document.getElementById("muteBtn");
  const volumeSlider = document.getElementById("volumeSlider");
  if (!video || !muteBtn || !volumeSlider) return;

  if (video.muted || video.volume === 0) {
    muteBtn.textContent = "🔇";
  } else if (video.volume < 0.5) {
    muteBtn.textContent = "🔉";
  } else {
    muteBtn.textContent = "🔊";
  }

  if (!video.muted) {
    volumeSlider.value = video.volume;
  }
}

function setVolume(value) {
  const video = document.getElementById("video");
  if (!video) return;

  video.volume = Number(value);
  video.muted = Number(value) === 0;
  updateVolumeUI();
}

function toggleFullscreen() {
  const overlay = document.getElementById("playerOverlay");
  if (!overlay) return;

  if (!document.fullscreenElement) {
    overlay.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}
async function loadExternalSubtitles(video, subtitles) {
  const oldTracks = video.querySelectorAll("track");
  oldTracks.forEach(track => track.remove());

  subtitles.forEach((sub, index) => {
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = sub.label || sub.lang || `Subtitle ${index + 1}`;
    track.srclang = sub.lang || "en";
    track.src = sub.url;
    track.default = index === 0;
    video.appendChild(track);
  });

  await new Promise(resolve => setTimeout(resolve, 150));
}

function setupSubtitles(hls, externalSubs = []) {
  const subtitleOptions = document.getElementById("subtitleOptions");
  const video = document.getElementById("video");
  if (!subtitleOptions || !video) return;

  subtitleOptions.innerHTML = "";

  const off = document.createElement("div");
  off.textContent = "Off";
  off.style.cursor = "pointer";
  off.style.padding = "6px 0";
  off.onclick = () => {
    if (hls) {
      hls.subtitleTrack = -1;
    }
    Array.from(video.textTracks || []).forEach(track => {
      track.mode = "disabled";
    });
    showPopup("Subtitles Off");
  };
  subtitleOptions.appendChild(off);

  let foundAny = false;

  if (hls && hls.subtitleTracks && hls.subtitleTracks.length) {
    hls.subtitleTracks.forEach((track, index) => {
      const option = document.createElement("div");
      option.textContent = track.name || track.lang || `Track ${index + 1}`;
      option.style.cursor = "pointer";
      option.style.padding = "6px 0";

      option.onclick = () => {
        hls.subtitleTrack = index;
        showPopup(`Subtitles: ${option.textContent}`);
      };

      subtitleOptions.appendChild(option);
      foundAny = true;
    });
  }

  if (externalSubs.length) {
    externalSubs.forEach((sub, index) => {
      const option = document.createElement("div");
      option.textContent = sub.label || sub.lang || `Subtitle ${index + 1}`;
      option.style.cursor = "pointer";
      option.style.padding = "6px 0";

            option.onclick = async () => {
        await loadExternalSubtitles(video, externalSubs);

        Array.from(video.textTracks || []).forEach((track, i) => {
          track.mode = i === index ? "showing" : "disabled";
        });

        subtitleOptions.querySelectorAll("div").forEach(el => {
          el.style.color = "";
          el.style.fontWeight = "";
        });
        option.style.color = "#8fd3ff";
        option.style.fontWeight = "bold";

        showPopup(`Subtitles: ${option.textContent}`);
      };

      subtitleOptions.appendChild(option);
      foundAny = true;
    });
  }

  if (!foundAny) {
    const none = document.createElement("div");
    none.textContent = "No subtitles available";
    none.style.opacity = "0.6";
    none.style.padding = "6px 0";
    subtitleOptions.appendChild(none);
  }
}    

function togglePlayback() {
      const video = document.getElementById("video");
      if (!video) return;

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }

    function seekRelative(seconds) {
      const video = document.getElementById("video");
      if (!video) return;
      if (currentPlaybackMode === "live") return;
      const duration = isFinite(video.duration) ? video.duration : 0;
      const target = Math.max(0, Math.min(duration || Infinity, (video.currentTime || 0) + seconds));
      video.currentTime = target;
      updatePlayerProgressUI();
      showPlayerControls(true);
    }

    function playSeriesEpisodeByIndex(seasonKey, index) {
      if (!currentSeriesData || !currentSeriesData.episodes) return;
      const episodes = currentSeriesData.episodes[seasonKey] || [];
      const ep = episodes[index];
      if (!ep) return;

      const info = ep.info || {};
      selectedItem = {
        type: "series_episode",
        stream_id: ep.id,
        container_extension: ep.container_extension || "mp4",
        name: ep.title || `Episode ${ep.episode_num || ""}`.trim() || "Episode",
        cover: info.movie_image || selectedItem?.cover || currentSeriesData?.info?.cover || "",
        series_id: currentSeriesData?.info?.series_id || currentSeriesData?.series_id || null,
        episode_num: ep.episode_num || null,
        season_key: seasonKey
      };
      currentEpisodeContext = { seasonKey: String(seasonKey), index };
      refreshDetailActionButtons();
      updatePlayerTitle();
      updateEpisodeNavButtons();
      playSelected();
    }

    function updateEpisodeNavButtons() {
      const leftWrap = document.getElementById("playerEpisodeControls");
      const rightWrap = document.getElementById("playerEpisodeControlsRight");
      const prevBtn = document.getElementById("prevEpisodeBtn");
      const nextBtn = document.getElementById("nextEpisodeBtn");

      if (!leftWrap || !rightWrap || !prevBtn || !nextBtn) return;

      const isSeriesEpisode = selectedItem?.type === "series_episode" && currentSeriesData && currentEpisodeContext;
      leftWrap.classList.toggle("player-hidden", !isSeriesEpisode);
      rightWrap.classList.toggle("player-hidden", !isSeriesEpisode);

      if (!isSeriesEpisode) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }

      const seasons = Object.keys(currentSeriesData.episodes || {}).sort((a, b) => Number(a) - Number(b));
      const currentSeasonIndex = seasons.indexOf(String(currentEpisodeContext.seasonKey));
      const seasonEpisodes = currentSeriesData.episodes[String(currentEpisodeContext.seasonKey)] || [];

      let hasPrev = currentEpisodeContext.index > 0;
      let hasNext = currentEpisodeContext.index < seasonEpisodes.length - 1;

      if (!hasPrev && currentSeasonIndex > 0) {
        const prevSeasonEpisodes = currentSeriesData.episodes[seasons[currentSeasonIndex - 1]] || [];
        hasPrev = prevSeasonEpisodes.length > 0;
      }

      if (!hasNext && currentSeasonIndex >= 0 && currentSeasonIndex < seasons.length - 1) {
        const nextSeasonEpisodes = currentSeriesData.episodes[seasons[currentSeasonIndex + 1]] || [];
        hasNext = nextSeasonEpisodes.length > 0;
      }

      prevBtn.disabled = !hasPrev;
      nextBtn.disabled = !hasNext;
    }

    function playPreviousEpisode() {
  cancelAutoplayNext(false);
  if (!currentSeriesData || !currentEpisodeContext) return;

      const seasons = Object.keys(currentSeriesData.episodes || {}).sort((a, b) => Number(a) - Number(b));
      let seasonIndex = seasons.indexOf(String(currentEpisodeContext.seasonKey));
      let episodeIndex = currentEpisodeContext.index - 1;

      if (episodeIndex >= 0) {
        playSeriesEpisodeByIndex(seasons[seasonIndex], episodeIndex);
        return;
      }

      seasonIndex -= 1;
      while (seasonIndex >= 0) {
        const episodes = currentSeriesData.episodes[seasons[seasonIndex]] || [];
        if (episodes.length) {
          playSeriesEpisodeByIndex(seasons[seasonIndex], episodes.length - 1);
          return;
        }
        seasonIndex -= 1;
      }
    }

    function playNextEpisode() {
cancelAutoplayNext(false);
      if (!currentSeriesData || !currentEpisodeContext) return;

      const seasons = Object.keys(currentSeriesData.episodes || {}).sort((a, b) => Number(a) - Number(b));
      let seasonIndex = seasons.indexOf(String(currentEpisodeContext.seasonKey));
      let episodeIndex = currentEpisodeContext.index + 1;

      const currentSeasonEpisodes = currentSeriesData.episodes[seasons[seasonIndex]] || [];
      if (episodeIndex < currentSeasonEpisodes.length) {
        playSeriesEpisodeByIndex(seasons[seasonIndex], episodeIndex);
        return;
      }

      seasonIndex += 1;
      while (seasonIndex < seasons.length) {
        const episodes = currentSeriesData.episodes[seasons[seasonIndex]] || [];
        if (episodes.length) {
          playSeriesEpisodeByIndex(seasons[seasonIndex], 0);
          return;
        }
        seasonIndex += 1;
      }
    }

    function bindPlayerControls() {
      if (playerControlsBound) return;
      playerControlsBound = true;

      const overlay = document.getElementById("playerOverlay");
const seek = document.getElementById("playerSeek");
const playPauseBtn = document.getElementById("playPauseBtn");
const rewindBtn = document.getElementById("rewindBtn");
const forwardBtn = document.getElementById("forwardBtn");
const prevEpisodeBtn = document.getElementById("prevEpisodeBtn");
const nextEpisodeBtn = document.getElementById("nextEpisodeBtn");
const muteBtn = document.getElementById("muteBtn");
const volumeSlider = document.getElementById("volumeSlider");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const video = document.getElementById("video");
const subtitleBtn = document.getElementById("subtitleBtn");
const subtitleMenu = document.getElementById("subtitleMenu");
const subtitleOptions = document.getElementById("subtitleOptions");

      overlay.addEventListener("mousemove", () => showPlayerControls(true));
      overlay.addEventListener("mouseleave", () => scheduleHidePlayerControls());

      playPauseBtn.addEventListener("click", togglePlayback);
rewindBtn.addEventListener("click", () => {
  isUserSeeking = true;
  seekRelative(-10);
  setTimeout(() => { isUserSeeking = false; }, 800);
});

forwardBtn.addEventListener("click", () => {
  isUserSeeking = true;
  seekRelative(10);
  setTimeout(() => { isUserSeeking = false; }, 800);
});
prevEpisodeBtn.addEventListener("click", playPreviousEpisode);
nextEpisodeBtn.addEventListener("click", playNextEpisode);
muteBtn.addEventListener("click", toggleMute);
fullscreenBtn.addEventListener("click", toggleFullscreen);
volumeSlider.addEventListener("input", (e) => setVolume(e.target.value));
subtitleBtn.addEventListener("click", () => {
  subtitleMenu.style.display =
    subtitleMenu.style.display === "block" ? "none" : "block";
});

      seek.addEventListener("input", () => {
        if (currentPlaybackMode === "live" || !isFinite(video.duration) || video.duration <= 0) return;
        video.currentTime = (Number(seek.value) / 100) * video.duration;
        updatePlayerProgressUI();
        showPlayerControls(true);
      });

      video.addEventListener("click", togglePlayback);

            document.addEventListener("keydown", (e) => {
  if (document.getElementById("playerOverlay").style.display !== "block") return;

  if (e.key === " ") {
    e.preventDefault();
    togglePlayback();
  } else if (e.key.toLowerCase() === "f") {
    e.preventDefault();
    toggleFullscreen();
  } else if (e.key === "Escape") {
    e.preventDefault();
    closePlayer();
  }
});
    }


    function goBack() {
      showPage(lastPage);
    }

    function setDetailsUI({
      kicker = "Feature",
      title = "Untitled",
      poster = "",
      backdrop = "",
      plot = "",
      chips = []
    }) {
      document.getElementById("detailsKicker").textContent = kicker;
      document.getElementById("detailsTitle").textContent = title;
      document.getElementById("detailsPoster").src = poster;
      document.getElementById("detailsBackdrop").style.backgroundImage = backdrop ? `url("${backdrop}")` : "none";
      document.getElementById("detailsPlot").textContent = plot || "";

      const meta = document.getElementById("detailsMeta");
      meta.innerHTML = "";
      chips.forEach(chip => {
        if (!chip) return;
        const div = document.createElement("div");
        div.className = "meta-chip";
        div.textContent = chip;
        meta.appendChild(div);
      });
    }

    async function getRealExternalSubtitles(item) {
  if (!item) return [];

  try {
    const params = new URLSearchParams();
    params.set("title", item.name || "");

    if (item.season_key) {
      params.set("season", item.season_key);
    }

    if (item.episode_num) {
      params.set("episode", item.episode_num);
    }

    const res = await fetch(`/subtitles?${params.toString()}`);
    const data = await res.json();

    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Subtitle fetch failed:", e);
    return [];
  }
}

async function playSelected() {
  if (!selectedItem) return;

  const startAt = pendingStartTime || 0;
  pendingStartTime = 0;

  if (selectedItem.type === "movies") {
    const ext = selectedItem.container_extension || "mp4";
    const streamUrl = buildInternalStreamUrl("movie", selectedItem.stream_id, ext);
    const externalSubs = await getRealExternalSubtitles(selectedItem);

    play(streamUrl, "direct", startAt, externalSubs);

    } else if (selectedItem.type === "series_episode") {
    const ext = selectedItem.container_extension || "mp4";
    const streamUrl = buildInternalStreamUrl("series", selectedItem.stream_id, ext);
    const externalSubs = await getRealExternalSubtitles(selectedItem);

    play(streamUrl, "direct", startAt, externalSubs);

  } else {
    showPopup("Please select an episode first");
  }
}

    function addToWatchlist() {
      if (!selectedItem) return;

      const existing = JSON.parse(localStorage.getItem("watchlist") || "[]");
      const itemId = selectedItem.stream_id || selectedItem.series_id || selectedItem.id;

      const alreadyExists = existing.some(item => {
        const existingId = item.stream_id || item.series_id || item.id;
        return existing.type === selectedItem.type && existingId === itemId;
      });

      if (alreadyExists) {
        showPopup("Already in Watchlist");
        return;
      }

      existing.push(selectedItem);
      localStorage.setItem("watchlist", JSON.stringify(existing));
      refreshDetailActionButtons();
      renderHomeWatchlist();
      loadWatchlist();
      showPopup("Added to Watchlist");
    }

    function removeFromWatchlist() {
      if (!selectedItem) return;

      const list = JSON.parse(localStorage.getItem("watchlist") || "[]");
      const id = getItemId(selectedItem);

      const updated = list.filter(item => {
        return !(
          item.type === selectedItem.type &&
          getItemId(item) === id
        );
      });

      localStorage.setItem("watchlist", JSON.stringify(updated));
      refreshDetailActionButtons();
      renderHomeWatchlist();
      loadWatchlist();
      showPopup("Removed from Watchlist");
    }

    function removeFromContinueWatching() {
      if (!selectedItem) return;

      const list = JSON.parse(localStorage.getItem("continueWatching") || "[]");
      const id = getItemId(selectedItem);

      const updated = list.filter(item => {
        return !(
          item.type === selectedItem.type &&
          getItemId(item) === id
        );
      });

      localStorage.setItem("continueWatching", JSON.stringify(updated));
      refreshDetailActionButtons();
      renderContinueWatching();
      loadHomePage();
      showPopup("Removed from Continue Watching");
    }

    function openContinueItemDetails(item) {
  openResumePrompt(item);
}

    function loadWatchlist() {
      const list = JSON.parse(localStorage.getItem("watchlist") || "[]");
      const grid = document.getElementById("watchlistGrid");

      if (!list.length) {
        showMessage("watchlistGrid", "Your Watchlist is empty.");
        return;
      }

      grid.innerHTML = "";

      list.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(item);
        img.alt = item.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = item.name || "Untitled";

        card.appendChild(img);
        card.appendChild(label);

        card.onclick = () => {
          if (item.type === "movies") {
            openDetails(item, "movies");
          } else if (item.type === "series") {
            openDetails(item, "series");
          } else if (item.type === "series_episode") {
            openContinueItemDetails(item);
          }
        };

        grid.appendChild(card);
      });
    }

    function renderHomeWatchlist() {
      const grid = document.getElementById("homeWatchlistGrid");
      const btn = document.getElementById("viewFullWatchlistBtn");
      const items = JSON.parse(localStorage.getItem("watchlist") || "[]");

      if (!items.length) {
        showMessage("homeWatchlistGrid", "Your Watchlist is empty.");
        btn.style.display = "none";
        return;
      }

      grid.innerHTML = "";
      btn.style.display = items.length > 10 ? "inline-block" : "none";

      items.slice(0, 10).forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(item);
        img.alt = item.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = item.name || "Untitled";

        card.appendChild(img);
        card.appendChild(label);

        card.onclick = () => {
          if (item.type === "movies") {
            openDetails(item, "movies");
          } else if (item.type === "series") {
            openDetails(item, "series");
          } else if (item.type === "series_episode") {
            openContinueItemDetails(item);
          }
        };

        grid.appendChild(card);
      });
    }

    function renderContinueWatching() {
  const grid = document.getElementById("continueWatchingGrid");
  if (!grid) return;

  const items = JSON.parse(localStorage.getItem("continueWatching") || "[]");

  const filtered = items.filter(item =>
    (item.type === "movies" || item.type === "series_episode") &&
    item.currentTime > 5 &&
    item.duration > 0 &&
    item.currentTime < item.duration - 5
  );

  if (!filtered.length) {
    showMessage("continueWatchingGrid", "No items in Continue Watching yet.");
    return;
  }

  grid.innerHTML = "";

  filtered
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 10)
    .forEach(item => {
      const card = document.createElement("div");
      card.className = "card";

      const img = document.createElement("img");
      img.src = item.poster || getPosterUrl(item);
      img.alt = item.name || "";
      img.onerror = function () {
        this.onerror = null;
        this.src = "https://via.placeholder.com/300x450?text=No+Image";
      };

      const title = document.createElement("div");
      title.className = "continue-title";
      title.textContent = item.name || "Untitled";

      const meta = document.createElement("div");
      meta.className = "continue-meta";

      const badge = document.createElement("div");
      badge.className = "continue-badge";
      badge.textContent = item.type === "series_episode" ? "Episode" : "Movie";

      const percent = Math.max(
        0,
        Math.min(100, Math.round(((item.currentTime || 0) / (item.duration || 1)) * 100))
      );

      const percentText = document.createElement("div");
      percentText.className = "continue-subtext";
      percentText.style.marginTop = "0";
      percentText.textContent = `${percent}% watched`;

      const remainingMinutes = Math.max(
        1,
        Math.ceil(((item.duration || 0) - (item.currentTime || 0)) / 60)
      );

      meta.appendChild(badge);
      meta.appendChild(percentText);

      const subtext = document.createElement("div");
      subtext.className = "continue-subtext";
      subtext.textContent = `${remainingMinutes} min left`;

      const progressWrap = document.createElement("div");
      progressWrap.className = "progress-wrap";

      const progressBar = document.createElement("div");
      progressBar.className = "progress-bar";
      progressBar.style.width = `${percent}%`;

      progressWrap.appendChild(progressBar);

      card.appendChild(img);
      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(subtext);
      card.appendChild(progressWrap);

      card.onclick = () => {
        openContinueItemDetails(item);
      };

      grid.appendChild(card);
    });
}

function renderUpNext() {
  const grid = document.getElementById("upNextGrid");
  if (!grid) return;

  const continueItems = JSON.parse(localStorage.getItem("continueWatching") || "[]");

  const episodeItems = continueItems.filter(item =>
    item.type === "series_episode" &&
    item.series_id &&
    item.currentTime > 5 &&
    item.duration > 0
  );

  if (!episodeItems.length) {
    showMessage("upNextGrid", "No upcoming episodes yet.");
    return;
  }

  if (!Array.isArray(seriesData) || !seriesData.length) {
    showMessage("upNextGrid", "No upcoming episodes yet.");
    return;
  }

  const latestBySeries = new Map();

  episodeItems.forEach(item => {
    const key = String(item.series_id);
    const existing = latestBySeries.get(key);

    if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) {
      latestBySeries.set(key, item);
    }
  });

  const upNextItems = [];

  latestBySeries.forEach(item => {
    const seriesMatch = seriesData.find(series =>
      String(series.series_id || series.id || "") === String(item.series_id)
    );

    if (!seriesMatch) return;

    upNextItems.push({
      name: seriesMatch.name || item.name || "Next Episode",
      poster: seriesMatch.cover || item.poster || getPosterUrl(seriesMatch),
      type: "series",
      series_id: seriesMatch.series_id || seriesMatch.id,
      sourceContinueItem: item
    });
  });

  if (!upNextItems.length) {
    showMessage("upNextGrid", "No upcoming episodes yet.");
    return;
  }

  grid.innerHTML = "";

  upNextItems.slice(0, 10).forEach(item => {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = item.poster || "https://via.placeholder.com/300x450?text=No+Image";
    img.alt = item.name || "";
    img.onerror = function () {
      this.onerror = null;
      this.src = "https://via.placeholder.com/300x450?text=No+Image";
    };

    const title = document.createElement("div");
    title.className = "continue-title";
    title.textContent = item.name || "Untitled";

    const badgeRow = document.createElement("div");
    badgeRow.className = "continue-meta";

    const badge = document.createElement("div");
    badge.className = "continue-badge";
    badge.textContent = "Up Next";

    const sub = document.createElement("div");
    sub.className = "continue-subtext";
    sub.style.marginTop = "0";
    sub.textContent = "Next episode ready";

    badgeRow.appendChild(badge);
    badgeRow.appendChild(sub);

    card.appendChild(img);
    card.appendChild(title);
    card.appendChild(badgeRow);

    card.onclick = async () => {
      try {
        const data = await fetchJson(`/get-series-info?username=${username}&password=${password}&id=${item.series_id}`);
        currentSeriesData = data;

        const seasons = Object.keys(data.episodes || {}).sort((a, b) => Number(a) - Number(b));
        let targetSeason = null;
        let targetIndex = null;

        const previousEpisodeId = String(item.sourceContinueItem.stream_id || item.sourceContinueItem.id || "");

        outerLoop:
        for (const seasonKey of seasons) {
          const episodes = data.episodes[seasonKey] || [];
          for (let i = 0; i < episodes.length; i++) {
            const ep = episodes[i];

            if (String(ep.id) === previousEpisodeId) {
              if (i + 1 < episodes.length) {
                targetSeason = seasonKey;
                targetIndex = i + 1;
              } else {
                const currentSeasonPos = seasons.indexOf(seasonKey);
                for (let s = currentSeasonPos + 1; s < seasons.length; s++) {
                  const nextSeasonEpisodes = data.episodes[seasons[s]] || [];
                  if (nextSeasonEpisodes.length) {
                    targetSeason = seasons[s];
                    targetIndex = 0;
                    break;
                  }
                }
              }
              break outerLoop;
            }
          }
        }

        if (targetSeason !== null && targetIndex !== null) {
          const ep = data.episodes[targetSeason][targetIndex];

          selectedItem = {
            type: "series_episode",
            stream_id: ep.id,
            container_extension: ep.container_extension || "mp4",
            name: ep.title || `Episode ${ep.episode_num || ""}`.trim() || "Episode",
            cover: (ep.info && ep.info.movie_image) || item.poster || "",
            series_id: item.series_id,
            episode_num: ep.episode_num || null,
            season_key: targetSeason
          };

          currentEpisodeContext = { seasonKey: String(targetSeason), index: targetIndex };
          refreshDetailActionButtons();
          updatePlayerTitle();
          updateEpisodeNavButtons();
          playSelected();
          return;
        }

        showPopup("No next episode found.");
      } catch (err) {
        console.error("Up Next play error:", err);
        showPopup("Could not open next episode.");
      }
    };

    grid.appendChild(card);
  });
}

    function renderRandomMovies() {
      const grid = document.getElementById("randomMoviesGrid");

      if (!movies.length) {
        showMessage("randomMoviesGrid", "Movies are still loading...");
        return;
      }

      const shuffled = seededShuffle(movies, `movies-${todayKey()}`).slice(0, 10);
      grid.innerHTML = "";

      shuffled.forEach(movie => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(movie);
        img.alt = movie.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = movie.name || "Untitled Movie";

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = () => openDetails(movie, "movies");

        grid.appendChild(card);
      });
    }

    function renderRandomSeries() {
      const grid = document.getElementById("randomSeriesGrid");

      if (!seriesData.length) {
        showMessage("randomSeriesGrid", "Series are still loading...");
        return;
      }

      const shuffled = seededShuffle(seriesData, `series-${todayKey()}`).slice(0, 10);
      grid.innerHTML = "";

      shuffled.forEach(show => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(show);
        img.alt = show.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = show.name || "Untitled Series";

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = () => openDetails(show, "series");

        grid.appendChild(card);
      });
    }


    function renderTrendingNow() {
      const grid = document.getElementById("trendingGrid");
      if (!grid) return;

      const mixed = [
        ...movies.map(item => ({ ...item, _homeType: "movies" })),
        ...seriesData.map(item => ({ ...item, _homeType: "series" }))
      ];

      if (!mixed.length) {
        showMessage("trendingGrid", "Content is still loading...");
        return;
      }

      grid.innerHTML = "";
      const picks = seededShuffle(mixed, `trending-${todayKey()}`).slice(0, 10);

      picks.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(item);
        img.alt = item.name || "";
        img.onerror = function () {
          this.onerror = null;
          this.src = "https://via.placeholder.com/300x450?text=No+Image";
        };

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = item.name || "Untitled";

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = () => openDetails(item, item._homeType);

        grid.appendChild(card);
      });
    }

    function renderBecauseYouWatched() {
      const grid = document.getElementById("becauseWatchedGrid");
      if (!grid) return;

      let history = [];
      try {
        history = JSON.parse(localStorage.getItem("continueWatching") || "[]");
      } catch {
        history = [];
      }

      if (!history.length) {
        showMessage("becauseWatchedGrid", "Start watching something to get recommendations.");
        return;
      }

      const movieHistoryCount = history.filter(x => x.type === "movies").length;
      const seriesHistoryCount = history.filter(x => x.type === "series_episode").length;

      let source = [];
      let usedIds = new Set();
      let typeForOpen = "movies";

      if (seriesHistoryCount > movieHistoryCount) {
        source = seriesData;
        typeForOpen = "series";
        usedIds = new Set(
          history.filter(x => x.type === "series_episode").map(x => String(x.series_id || x.id || ""))
        );
      } else {
        source = movies;
        typeForOpen = "movies";
        usedIds = new Set(
          history.filter(x => x.type === "movies").map(x => String(x.stream_id || x.id || ""))
        );
      }

      const filtered = source.filter(item => {
        const id = String(item.stream_id || item.series_id || item.id || "");
        return id && !usedIds.has(id);
      });

      if (!filtered.length) {
        showMessage("becauseWatchedGrid", "No recommendations available yet.");
        return;
      }

      grid.innerHTML = "";
      const picks = seededShuffle(filtered, `because-${todayKey()}`).slice(0, 10);

      picks.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(item);
        img.alt = item.name || "";
        img.onerror = function () {
          this.onerror = null;
          this.src = "https://via.placeholder.com/300x450?text=No+Image";
        };

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = item.name || "Untitled";

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = () => openDetails(item, typeForOpen);

        grid.appendChild(card);
      });
    }

    function loadHomePage() {
  showPage("home");
  renderWelcomeMessage();
  loadProfileIcon();
  showHomeLoadingStates();

  renderContinueWatching();
  renderUpNext();
  renderHomeWatchlist();
  renderTrendingNow();
  renderBecauseYouWatched();
  renderRandomMovies();
  renderRandomSeries();

  Promise.all([
    ensureMovieData(),
    ensureSeriesData()
  ]).then(() => {
    renderContinueWatching();
    renderUpNext();
    renderHomeWatchlist();
    renderTrendingNow();
    renderBecauseYouWatched();
    renderRandomMovies();
    renderRandomSeries();
  }).catch(err => {
    console.error("Home page load error:", err);
    renderContinueWatching();
    renderUpNext();
  });
}

    function ensureLiveData() {
      if (liveChannels.length && liveCategories.length) return Promise.resolve();

      return Promise.all([
        fetchJson(`${window.location.origin}/get-channels?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`),
        fetchJson(`${window.location.origin}/get-live-categories?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
      ]).then(([channels, cats]) => {
        liveChannels = channels;
        liveCategories = cats;
      });
    }

    function ensureMovieData() {
      if (movies.length && movieCategories.length) return Promise.resolve();

      return Promise.all([
        fetchJson(`${window.location.origin}/get-movies?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`),
        fetchJson(`${window.location.origin}/get-movie-categories?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
      ]).then(([m, cats]) => {
        movies = m;
        movieCategories = cats;
      });
    }

    function ensureSeriesData() {
      if (seriesData.length && seriesCategories.length) return Promise.resolve();

      return Promise.all([
        fetchJson(`${window.location.origin}/get-series?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`),
        fetchJson(`${window.location.origin}/get-series-categories?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
      ]).then(([series, cats]) => {
        seriesData = series;
        seriesCategories = cats;
      });
    }

    function loadLive() {
      const sidebar = document.getElementById("liveSidebar");

      if (liveChannels.length && liveCategories.length) {
        buildLiveSidebar();
        displayLive(liveChannels);
      } else {
        showMessage("liveGrid", "Loading live channels...");
      }

      return ensureLiveData().then(() => {
        buildLiveSidebar();
        displayLive(liveChannels);
      }).catch(err => {
        console.error("Live load error:", err);
        showMessage("liveGrid", "Live TV could not load. Check backend and login details.");
      });

      function buildLiveSidebar() {
        sidebar.innerHTML = `<div class="toggle-btn" onclick="toggleSidebar('liveSidebar')">⟨</div>`;

        const all = document.createElement("div");
        all.textContent = "All";
        all.className = "category live-category active";
        all.onclick = () => {
          displayLive(liveChannels);
          setActive(all, ".live-category");
        };
        sidebar.appendChild(all);

        liveCategories.forEach(cat => {
          const div = document.createElement("div");
          div.textContent = cat.category_name;
          div.className = "category live-category";
          div.onclick = () => {
            displayLive(liveChannels.filter(c => c.category_id == cat.category_id));
            setActive(div, ".live-category");
          };
          sidebar.appendChild(div);
        });
      }
    }

    function displayLive(list) {
      const grid = document.getElementById("liveGrid");
      if (!list || !list.length) {
        showMessage("liveGrid", "No live channels found.");
        return;
      }

      grid.innerHTML = "";
      list.slice(0, 300).forEach(c => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = c.stream_icon || "";
        img.alt = c.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = c.name || "Unnamed Channel";

        card.appendChild(img);
        card.appendChild(label);

        card.onclick = () => {
  selectedItem = {
    type: "live",
    stream_id: c.stream_id,
    name: c.name || "Live Channel",
    stream_icon: c.stream_icon || ""
  };

  const streamUrl = buildLiveStreamUrl(c.stream_id);
  play(streamUrl, "live");
};

        grid.appendChild(card);
      });
    }

    function loadMovies() {
  const sidebar = document.getElementById("movieCats");

  function movieMatchesCategory(movie, categoryId) {
    const target = String(categoryId || "").trim();
    if (!target) return false;

    const direct = String(movie?.category_id || "").trim();
    if (direct === target) return true;

    const multi = String(movie?.category_ids || "").trim();
    if (multi) {
      return multi
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
        .includes(target);
    }

    return false;
  }

  function buildMovieSidebar() {
    sidebar.innerHTML = `<div class="toggle-btn" onclick="toggleSidebar('movieCats')">⟨</div>`;

    const all = document.createElement("div");
    all.textContent = "All";
    all.className = "category movie-category active";
    all.onclick = () => {
      displayMovies(movies);
      setActive(all, ".movie-category");
    };
    sidebar.appendChild(all);

    movieCategories.forEach(cat => {
      const div = document.createElement("div");
      div.textContent = cat.category_name;
      div.className = "category movie-category";
      div.onclick = () => {
        const filteredMovies = movies.filter(movie => movieMatchesCategory(movie, cat.category_id));
        displayMovies(filteredMovies);
        setActive(div, ".movie-category");
      };
      sidebar.appendChild(div);
    });
  }

  if (movies.length) {
    displayMovies(movies);
  } else {
    renderLoadingRow("movieGrid", 12);
  }

  if (movieCategories.length) {
    buildMovieSidebar();
  } else {
    sidebar.innerHTML = `<div class="toggle-btn" onclick="toggleSidebar('movieCats')">⟨</div>`;
  }

  return Promise.all([
    fetchJson(`${window.location.origin}/get-movies?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`),
    fetchJson(`${window.location.origin}/get-movie-categories?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
  ]).then(([m, cats]) => {
    movies = Array.isArray(m) ? m : [];
    movieCategories = Array.isArray(cats) ? cats : [];

    localStorage.setItem("cachedMovies", JSON.stringify(movies));
    localStorage.setItem("cachedMovieCategories", JSON.stringify(movieCategories));

    buildMovieSidebar();
    displayMovies(movies);
  }).catch(err => {
    console.error("Movie load error:", err);

    if (movies.length) {
      displayMovies(movies);
      if (movieCategories.length) {
        buildMovieSidebar();
      }
      return;
    }

    showMessage("movieGrid", "Movies could not load. Check backend and login details.");
  });
}

    function displayMovies(list) {
      const grid = document.getElementById("movieGrid");
      if (!list || !list.length) {
        showMessage("movieGrid", "No movies found.");
        return;
      }

      grid.innerHTML = "";
      list.forEach(m => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(m);
        img.alt = m.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = m.name || "Untitled Movie";

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = () => openDetails(m, "movies");

        grid.appendChild(card);
      });
    }

    function loadSeries() {
      const sidebar = document.getElementById("seriesCats");

      if (seriesData.length && seriesCategories.length) {
        buildSeriesSidebar();
        displaySeries(seriesData);
      } else {
        renderLoadingRow("seriesGrid", 12);
      }

      return ensureSeriesData().then(() => {
        buildSeriesSidebar();
        displaySeries(seriesData);
      }).catch(err => {
        console.error("Series load error:", err);
        showMessage("seriesGrid", "Series could not load. Check backend and login details.");
      });

      function buildSeriesSidebar() {
        sidebar.innerHTML = `<div class="toggle-btn" onclick="toggleSidebar('seriesCats')">⟨</div>`;

        const all = document.createElement("div");
        all.textContent = "All";
        all.className = "category series-category active";
        all.onclick = () => {
          displaySeries(seriesData);
          setActive(all, ".series-category");
        };
        sidebar.appendChild(all);

        seriesCategories.forEach(cat => {
          const div = document.createElement("div");
          div.textContent = cat.category_name;
          div.className = "category series-category";
          div.onclick = () => {
            displaySeries(seriesData.filter(s => s.category_id == cat.category_id));
            setActive(div, ".series-category");
          };
          sidebar.appendChild(div);
        });
      }
    }

    function displaySeries(list) {
      const grid = document.getElementById("seriesGrid");
      if (!list || !list.length) {
        showMessage("seriesGrid", "No series found.");
        return;
      }

      grid.innerHTML = "";
      list.forEach(s => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(s);
        img.alt = s.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = s.name || "Untitled Series";

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = () => openDetails(s, "series");

        grid.appendChild(card);
      });
    }

    document.getElementById("movieSearch").addEventListener("input", function () {
      const value = this.value.toLowerCase();
      displayMovies(movies.filter(m => (m.name || "").toLowerCase().includes(value)));
    });

    document.getElementById("seriesSearch").addEventListener("input", function () {
      const value = this.value.toLowerCase();
      displaySeries(seriesData.filter(s => (s.name || "").toLowerCase().includes(value)));
    });

    document.getElementById("liveSearch").addEventListener("input", function () {
      const value = this.value.toLowerCase();
      displayLive(liveChannels.filter(c => (c.name || "").toLowerCase().includes(value)));
    });

    function runGlobalSearch(value) {
      const results = document.getElementById("searchResults");
      results.innerHTML = "";

      const query = value.toLowerCase().trim();

      if (!query) {
        showMessage("searchResults", "Start typing to search Live TV, Movies, and Series.");
        return;
      }

      const liveMatches = liveChannels
        .filter(item => (item.name || "").toLowerCase().includes(query))
        .slice(0, 20)
        .map(item => ({ ...item, resultType: "live" }));

      const movieMatches = movies
        .filter(item => (item.name || "").toLowerCase().includes(query))
        .slice(0, 20)
        .map(item => ({ ...item, resultType: "movie" }));

      const seriesMatches = seriesData
        .filter(item => (item.name || "").toLowerCase().includes(query))
        .slice(0, 20)
        .map(item => ({ ...item, resultType: "series" }));

      const combined = [...liveMatches, ...movieMatches, ...seriesMatches];

      if (!combined.length) {
        showMessage("searchResults", "No results found.");
        return;
      }

      combined.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";

        const img = document.createElement("img");
        img.src = getPosterUrl(item);
        img.alt = item.name || "";

        const label = document.createElement("div");
        label.className = "label";
        label.textContent = `${item.name || "Untitled"} • ${item.resultType.toUpperCase()}`;

        card.appendChild(img);
        card.appendChild(label);

        if (item.resultType === "live") {
  card.onclick = () => {
    selectedItem = {
      type: "live",
      stream_id: item.stream_id,
      name: item.name || "Live Channel",
      stream_icon: item.stream_icon || ""
    };

    const streamUrl = buildLiveStreamUrl(item.stream_id);
    play(streamUrl, "live");
  };
} else if (item.resultType === "movie") {
          card.onclick = () => openDetails(item, "movies");
        } else if (item.resultType === "series") {
          card.onclick = () => openDetails(item, "series");
        }

        results.appendChild(card);
      });
    }

    document.getElementById("globalSearch").addEventListener("input", function () {
      runGlobalSearch(this.value);
    });

    function openSearchPage() {
      Promise.all([
        loadLive(),
        loadMovies(),
        loadSeries()
      ]).then(() => {
        showPage("searchPage");
        showMessage("searchResults", "Start typing to search Live TV, Movies, and Series.");
      }).catch(() => {
        showPage("searchPage");
        showMessage("searchResults", "Some content could not be loaded for search.");
      });
    }

    function renderEpisodesForSeason(seasonKey) {
      const content = document.getElementById("episodesContent");
      content.innerHTML = "";

      if (!currentSeriesData || !currentSeriesData.episodes) return;

      const episodes = currentSeriesData.episodes[seasonKey] || [];

      if (!episodes.length) {
        content.innerHTML = `<div class="message">No episodes found for this season.</div>`;
        return;
      }

      episodes.forEach((ep, index) => {
        const info = ep.info || {};

        const card = document.createElement("div");
        card.className = "episode-card";

        const number = document.createElement("div");
        number.className = "episode-number";
        number.textContent = ep.episode_num || "EP";

        const main = document.createElement("div");
        main.className = "episode-main";

        const name = document.createElement("div");
        name.className = "episode-name";
        name.textContent = ep.title || `Episode ${ep.episode_num || ""}`.trim() || "Episode";

        const meta = document.createElement("div");
        meta.className = "episode-meta";
        meta.textContent = info.duration || "No duration";

        const desc = document.createElement("div");
        desc.className = "episode-desc";
        desc.textContent = info.plot || "Play this episode.";

        main.appendChild(name);
        main.appendChild(meta);
        main.appendChild(desc);

        const playBtn = document.createElement("div");
        playBtn.className = "episode-play";
        playBtn.textContent = "Play";

        card.appendChild(number);
        card.appendChild(main);
        card.appendChild(playBtn);

        card.onclick = () => {
          playSeriesEpisodeByIndex(seasonKey, index);
        };

        content.appendChild(card);
      });
    }

    function setupSeasonSelector(data) {
      const wrap = document.getElementById("episodesWrap");
      const select = document.getElementById("seasonSelect");

      wrap.style.display = "block";
      select.innerHTML = "";
      currentEpisodeContext = null;
      updateEpisodeNavButtons();

      const seasons = Object.keys(data.episodes || {}).sort((a, b) => Number(a) - Number(b));
      if (!seasons.length) {
        document.getElementById("episodesContent").innerHTML = `<div class="message">No episodes found for this series.</div>`;
        return;
      }

      seasons.forEach(seasonKey => {
        const option = document.createElement("option");
        option.value = seasonKey;
        option.textContent = `Season ${seasonKey}`;
        select.appendChild(option);
      });

      select.onchange = function() {
        currentEpisodeContext = null;
        updateEpisodeNavButtons();
        renderEpisodesForSeason(this.value);
      };

      renderEpisodesForSeason(seasons[0]);
    }

    function openDetails(item, type) {
      lastPage = type;
      showPage("detailsPage");

      setDetailsUI({
        kicker: type === "movies" ? "Movie" : "Series",
        title: "Loading...",
        poster: "",
        backdrop: "",
        plot: "",
        chips: []
      });

      document.getElementById("episodesWrap").style.display = "none";
      document.getElementById("episodesContent").innerHTML = "";
      currentSeriesData = null;
      currentEpisodeContext = null;
      updateEpisodeNavButtons();

      if (type === "movies") {
        fetchJson(`${window.location.origin}/get-movie-info?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&id=${item.stream_id}`)
          .then(data => {
            const info = data.info || {};
            const movieData = data.movie_data || {};

            selectedItem = {
              ...item,
              type,
              container_extension: movieData.container_extension || item.container_extension || "mp4"
            };
            refreshDetailActionButtons();

            setDetailsUI({
              kicker: "Movie",
              title: info.name || item.name || "Movie",
              poster: info.movie_image || item.stream_icon || "",
              backdrop: info.backdrop_path || info.movie_image || item.stream_icon || "",
              plot: info.plot || "",
              chips: [
                info.rating ? `⭐ ${info.rating}` : "",
                info.genre || "",
                info.duration || "",
                info.releasedate || ""
              ]
            });
          })
          .catch(err => {
            console.error("Movie details error:", err);
            selectedItem = {
              ...item,
              type,
              container_extension: item.container_extension || "mp4"
            };
            refreshDetailActionButtons();

            setDetailsUI({
              kicker: "Movie",
              title: item.name || "Movie",
              poster: item.stream_icon || "",
              backdrop: item.stream_icon || "",
              plot: "Details could not load.",
              chips: []
            });
          });
      } else {
        fetchJson(`${window.location.origin}/get-series-info?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&id=${item.series_id}`)
          .then(data => {
            const info = data.info || {};
            currentSeriesData = data;

            selectedItem = { ...item, type: "series" };
            updatePlayerTitle();
            refreshDetailActionButtons();

            setDetailsUI({
              kicker: "Series",
              title: info.name || item.name || "Series",
              poster: info.cover || item.cover || "",
              backdrop: info.cover || item.cover || "",
              plot: info.plot || "",
              chips: [
                info.rating ? `⭐ ${info.rating}` : "",
                info.genre || "",
                info.releaseDate || ""
              ]
            });

            setupSeasonSelector(data);
          })
          .catch(err => {
            console.error("Series details error:", err);
            selectedItem = { ...item, type: "series" };
            updatePlayerTitle();
            refreshDetailActionButtons();

            setDetailsUI({
              kicker: "Series",
              title: item.name || "Series",
              poster: item.cover || "",
              backdrop: item.cover || "",
              plot: "Details could not load.",
              chips: []
            });
          });
      }
    }

    loadProfileIcon();
    loadHomePage();

function reloadChannels() {
  localStorage.removeItem("cachedLive");
  localStorage.removeItem("cachedLiveCategories");
  localStorage.removeItem("cachedMovies");
  localStorage.removeItem("cachedMovieCategories");
  localStorage.removeItem("cachedSeries");
  localStorage.removeItem("cachedSeriesCategories");
  window.location.href = "loading.html";
}

function toggleThemeChooser() {
  const chooser = document.getElementById("themeChooser");
  chooser.style.display = chooser.style.display === "block" ? "none" : "block";
  if (chooser.style.display === "block") {
    loadThemeOptions();
  }
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("selectedTheme");
  if (!savedTheme) return;

  document.body.classList.add("themed-bg");
  document.body.style.backgroundImage = `url('${savedTheme}')`;
}

function loadSettingsPage() {
  applySavedTheme();
}

function loadThemeOptions() {
  const grid = document.getElementById("themeGrid");
  if (!grid) return;

  const themes = [
    "theme1.jpg",
    "theme2.jpg",
    "theme3.jpg",
    "theme4.jpg",
    "theme5.jpg",
    "theme6.jpg",
    "theme7.jpg",
    "theme8.jpg",
    "theme9.jpg",
    "theme10.jpg",
    "theme11.jpg",
    "theme12.jpg",
    "theme13.jpg",
    "theme14.jpg",
    "theme15.jpg",
    "theme16.jpg",
    "theme17.jpg",
    "theme18.jpg",
    "theme19.jpg",
    "theme20.jpg",
    "theme21.jpg",
    "theme22.jpg",
    "theme23.jpg",
    "theme24.jpg",
    "theme25.jpg", 
    "theme26.jpg",
    "theme27.jpg",
    "theme28.jpg",
    "theme29.jpg", 
    "theme30.jpg"
  ];

  grid.innerHTML = "";

  themes.forEach((theme, index) => {
    const card = document.createElement("div");
    card.className = "theme-thumb";

    const img = document.createElement("img");
    img.src = theme;
    img.alt = `Theme ${index + 1}`;
    img.onerror = function () {
  this.src = theme.replace(".jpg", ".png");
};

    const label = document.createElement("div");
    label.className = "theme-thumb-label";
    label.textContent = `Theme ${index + 1}`;

    card.appendChild(img);
    card.appendChild(label);

        card.onclick = () => {
      const finalPath = img.currentSrc || img.src;
      localStorage.setItem("selectedTheme", finalPath);
      applySavedTheme();
    };

    grid.appendChild(card);
  });
}

function viewExpiry() {
  const box = document.getElementById("expiryBox");
  box.style.display = "block";
  box.textContent = "Loading expiry date...";

  fetchJson(`${window.location.origin}/get-account-info?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`)
    .then(data => {
      if (data?.user_info?.exp_date) {
        const exp = new Date(Number(data.user_info.exp_date) * 1000);
        box.textContent = `Your subscription expires on ${exp.toLocaleString()}`;
      } else {
        box.textContent = "Expiry date not available for this account.";
      }
    })
    .catch(() => {
      box.textContent = "Could not load expiry date.";
    }); 
applySavedTheme();
}
