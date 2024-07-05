let currentPage = 1;
let editedVideos = JSON.parse(localStorage.getItem("editedVideos")) || [];
let videosData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (videoId, newAutoEnable, newEnable) => {
  const response = await fetch(`http://localhost:3001/api/videos/${videoId}/enable`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
  });
  return response;
};

// 切換自動上架
const toggleAutoEnable = async (videoId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    alert("此影片已下架，請重新編輯影片以重新上架。");
    document.getElementById(`switch-${videoId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  let action, additionalMessage;

  if (newAutoEnable) {
    action = "開啟自動上架";
    additionalMessage = new Date(timeOn) <= now
      ? "此影片的上架時間已到，開啟自動上架功能將立即上架此影片，是否繼續？"
      : "開啟自動上架功能將在上架時間到達時自動上架此影片，是否繼續？";
  } else {
    action = "關閉自動上架";
    additionalMessage = isCurrentlyUp
      ? "此影片目前已上架，關閉自動上架功能將會下架此影片，是否繼續？"
      : "此影片目前尚未上架，關閉自動上架功能將取消其自動上架，是否繼續？";
  }

  if (!confirm(`${action} ${additionalMessage}`)) {
    document.getElementById(`switch-${videoId}`).checked = currentAutoEnable;
    return;
  }

  const newEnable = newAutoEnable ? true : false;

  try {
    const success = await updateAutoEnableAndStatus(videoId, newAutoEnable, newEnable);
    if (success) {
      loadVideos(currentPage);
      if (!newAutoEnable && isCurrentlyUp) {
        showAlert("影片已下架");
      } else if (!newAutoEnable && !isCurrentlyUp) {
        showAlert("影片的自動上架功能已關閉");
      } else if (newAutoEnable && new Date(timeOn) <= now) {
        showAlert("影片已立即上架");
      }
    } else {
      throw new Error("Network response was not ok");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新自動上架狀態時出錯");
    document.getElementById(`switch-${videoId}`).checked = currentAutoEnable;
  }
};

// 保存已編輯的影片
const saveEditedVideo = (videoId) => {
  if (!editedVideos.includes(videoId)) {
    editedVideos.push(videoId);
    localStorage.setItem("editedVideos", JSON.stringify(editedVideos));
  }
};

// 渲染影片行
const renderVideoRow = (video) => {
  const row = document.createElement("tr");

  const autoEnableCell = document.createElement("td");
  const switchLabel = document.createElement("label");
  switchLabel.classList.add("switch");
  const autoEnableSwitch = document.createElement("input");
  autoEnableSwitch.type = "checkbox";
  autoEnableSwitch.checked = video.autoEnable;
  autoEnableSwitch.id = `switch-${video.id}`;
  const now = new Date();
  const timeOnDate = new Date(video.timeOn);
  const timeOffDate = new Date(video.timeOff);
  const isDown = timeOffDate <= now;
  autoEnableSwitch.onchange = () =>
    toggleAutoEnable(
      video.id,
      video.autoEnable,
      video.timeOn,
      video.timeOff,
      isDown
    );
  const sliderSpan = document.createElement("span");
  sliderSpan.classList.add("slider");
  switchLabel.appendChild(autoEnableSwitch);
  switchLabel.appendChild(sliderSpan);
  autoEnableCell.appendChild(switchLabel);
  row.appendChild(autoEnableCell);

  const statusCell = document.createElement("td");
  const statusSpan = document.createElement("span");
  statusSpan.classList.add("status-box");

  if (timeOffDate <= now) {
    statusSpan.classList.add("status-unpublished");
    statusSpan.textContent = " 已下架";
    video.autoEnable = false;
  } else if (!video.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 未排定自動上架";
  } else if (video.autoEnable && timeOnDate > now) {
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = " 未上架";
  } else if (video.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 已上架";
  }
  statusCell.appendChild(statusSpan);

  if (video.enable || (video.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (video.pinned) {
      pinButton.classList.add("pinned");
    }
    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinVideo(video.id, pinButton);
    statusCell.appendChild(pinButton);
  }

  row.appendChild(statusCell);

  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `video-form.html?id=${video.id}`;
  titleLink.textContent = video.title;
  titleLink.onclick = async (event) => {
    event.preventDefault();
    if (video.autoEnable) {
      try {
        const response = await updateAutoEnableAndStatus(video.id, false, false);
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        loadVideos(currentPage);
      } catch (error) {
        console.error("Error:", error);
        alert("關閉自動上架狀態時出錯");
      }
    }

    saveEditedVideo(video.id);

    window.location.href = titleLink.href;
  };
  titleCell.appendChild(titleLink);
  row.appendChild(titleCell);

  const videoPreviewCell = document.createElement("td");
  const playButton = document.createElement("button");
  playButton.textContent = "播放";
  playButton.onclick = () => showVideoModal(video.videoLink);
  videoPreviewCell.appendChild(playButton);
  row.appendChild(videoPreviewCell);

  const timeOnCell = document.createElement("td");
  timeOnCell.textContent = video.timeOn;
  row.appendChild(timeOnCell);

  const timeOffCell = document.createElement("td");
  timeOffCell.textContent = video.timeOff;
  row.appendChild(timeOffCell);

  return row;
};

// 顯示視頻模態窗口
const showVideoModal = (videoLink) => {
  const modal = document.getElementById("video-modal");
  const iframe = document.getElementById("video-iframe");
  iframe.src = convertToYouTubeEmbedUrl(videoLink);
  modal.style.display = "block";
};

// 關閉視頻模態窗口
const closeVideoModal = () => {
  const modal = document.getElementById("video-modal");
  const iframe = document.getElementById("video-iframe");
  iframe.src = "";
  modal.style.display = "none";
};

// 置頂影片
const pinVideo = async (videoId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/videos/${videoId}/pin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinned }),
    });
    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadVideos(currentPage); // 重新加載影片列表，以反映更改
    } else {
      alert("更新置頂狀態時出錯");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新置頂狀態時出錯");
  }
};

// 加載影片
const loadVideos = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/videos?page=${page}&forManagement=true`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    videosData = data.videos;
    const tbody = document.getElementById("videos-body");
    const publishAllButton = document.getElementById("publish-all-button");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();
    data.videos.forEach((video) => {
      const row = renderVideoRow(video);
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);

    const now = new Date();
    editedVideos = JSON.parse(localStorage.getItem("editedVideos")) || [];
    editedVideos = editedVideos.filter((id) => {
      const video = videosData.find((v) => v.id === id);
      return video && new Date(video.timeOff) > now;
    });
    localStorage.setItem("editedVideos", JSON.stringify(editedVideos));

    if (editedVideos.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    for (let i = 1; i <= data.totalPages; i++) {
      const button = document.createElement("button");
      button.textContent = i;
      button.onclick = () => loadVideos(i);
      if (i === data.currentPage) {
        button.classList.add("current-page");
      }
      pagination.appendChild(button);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("加載影片時出錯");
  }
};

// 一鍵上架
const publishAll = async () => {
  if (!confirm("您確定要一鍵安排上架所有編輯過的影片嗎？")) {
    return;
  }

  const now = new Date();
  const videosToPublish = editedVideos.filter((id) => {
    const video = videosData.find((v) => v.id === id);
    return video && new Date(video.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/videos/schedule-all", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: videosToPublish, autoEnable: true }),
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const numberOfPublishedVideos = videosToPublish.length;
    editedVideos = [];
    localStorage.removeItem("editedVideos");
    document.getElementById("publish-all-button").style.display = "none";
    showAlert(`已排定 ${numberOfPublishedVideos} 影片自動上架！`);
    loadVideos(currentPage);
  } catch (error) {
    console.error("Error:", error);
    alert("一鍵安排上架時出錯");
  }
};

// 顯示提示訊息
const showAlert = (message) => {
  const alertModal = document.getElementById("alert-modal");
  const alertMessage = document.getElementById("alert-message");
  alertMessage.textContent = message;
  alertModal.style.display = "block";
};

// 關閉模態窗口
const closeModal = () => {
  const alertModal = document.getElementById("alert-modal");
  alertModal.style.display = "none";
};

// DOM 加載後初始化
document.addEventListener("DOMContentLoaded", () => {
  loadVideos(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/videos/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-video" || data.type === "new-video") {
      loadVideos(currentPage);
    }
  };
});

function convertToYouTubeEmbedUrl(url) {
  const youtubeWatchRegex = /https:\/\/www\.youtube\.com\/watch\?v=([^&]+)/;
  const youtubeShortRegex = /https:\/\/youtu\.be\/([^?]+)/;
  const youtubeEmbedRegex = /https:\/\/www\.youtube\.com\/embed\/([^?]+)/;

  let match = url.match(youtubeWatchRegex);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }

  match = url.match(youtubeShortRegex);
  if (match) {
    return `https://www.youtube.com/embed/${match[1]}`;
  }

  match = url.match(youtubeEmbedRegex);
  if (match) {
    return url; // Already in embed format
  }

  return url; // If it's not a YouTube URL, return as is
}
