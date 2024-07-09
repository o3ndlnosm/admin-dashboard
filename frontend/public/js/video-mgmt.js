let currentPage = 1;
let editedVideos = JSON.parse(localStorage.getItem("editedVideos")) || [];
let videosData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (videoId, newAutoEnable, newEnable) => {
  try {
    const response = await fetch(`http://localhost:3001/api/videos/${videoId}/enable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    console.log("更新成功:", videoId, newAutoEnable, newEnable);
    showNotification("更新成功", "success");
    return true;
  } catch (error) {
    console.error("更新失敗:", videoId, newAutoEnable, newEnable, error);
    showNotification("更新失敗", "error");
    return false;
  }
};

// 切換自動上架狀態
const toggleAutoEnable = async (videoId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    showNotification("此影片已下架，請重新編輯影片以重新上架。", "warning");
    document.getElementById(`switch-${videoId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  const newEnable = newAutoEnable ? true : false;

  const success = await updateAutoEnableAndStatus(videoId, newAutoEnable, newEnable);
  if (success) {
    if (!newAutoEnable) {
      removeEditedVideo(videoId); // 移除已编辑的影片ID
    }
    handleAutoEnableChange(videoId, newAutoEnable, isCurrentlyUp, now, timeOn);
  } else {
    document.getElementById(`switch-${videoId}`).checked = currentAutoEnable;
  }
};

// 處理自動上架變更
const handleAutoEnableChange = (videoId, newAutoEnable, isCurrentlyUp, now, timeOn) => {
  loadVideos(currentPage);
  showAlertBasedOnAutoEnable(newAutoEnable, isCurrentlyUp, now, timeOn);
};

// 顯示根據自動上架狀態的提示訊息
const showAlertBasedOnAutoEnable = (newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (!newAutoEnable && isCurrentlyUp) {
    showNotification("影片已下架", "info");
  } else if (!newAutoEnable && !isCurrentlyUp) {
    showNotification("影片的自動上架功能已關閉", "info");
  } else if (newAutoEnable && new Date(timeOn) <= now) {
    showNotification("影片已立即上架", "success");
  }
};

// 保存已編輯的影片
const saveEditedVideo = (videoId) => {
  if (!editedVideos.includes(videoId)) {
    editedVideos.push(videoId);
    localStorage.setItem("editedVideos", JSON.stringify(editedVideos));
  }
};

// 移除已編輯的影片
const removeEditedVideo = (videoId) => {
  editedVideos = editedVideos.filter(id => id !== videoId);
  localStorage.setItem("editedVideos", JSON.stringify(editedVideos));
};

// 渲染影片行
const renderVideoRow = (video) => {
  const row = document.createElement("tr");

  row.appendChild(createAutoEnableCell(video));
  row.appendChild(createStatusCell(video));
  row.appendChild(createTitleCell(video));
  row.appendChild(createVideoPreviewCell(video)); // 影片預覽按鈕放在標題後面
  row.appendChild(createTimeCell(video.timeOn));
  row.appendChild(createTimeCell(video.timeOff));

  return row;
};

// 創建自動上架單元格
const createAutoEnableCell = (video) => {
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
    toggleAutoEnable(video.id, video.autoEnable, video.timeOn, video.timeOff, isDown);

  const sliderSpan = document.createElement("span");
  sliderSpan.classList.add("slider");

  switchLabel.appendChild(autoEnableSwitch);
  switchLabel.appendChild(sliderSpan);
  autoEnableCell.appendChild(switchLabel);

  return autoEnableCell;
};

// 創建狀態單元格
const createStatusCell = (video) => {
  const statusCell = document.createElement("td");
  const statusSpan = document.createElement("span");
  statusSpan.classList.add("status-box");

  const now = new Date();
  const timeOnDate = new Date(video.timeOn);
  const timeOffDate = new Date(video.timeOff);

  if (timeOffDate <= now) {
    statusSpan.classList.add("status-unpublished");
    statusSpan.textContent = " 已下架";
    video.autoEnable = false;
  } else if (!video.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = "待確認";
  } else if (video.autoEnable && timeOnDate > now) {
    const formattedDate = formatDate(timeOnDate);
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = ` ${formattedDate} 上架`;
  } else if (video.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = "上架中";
  }
  statusCell.appendChild(statusSpan);

  if (video.enable || (video.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (video.pinned) pinButton.classList.add("pinned");

    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinVideo(video.id, pinButton);
    statusCell.appendChild(pinButton);
  }

  return statusCell;
};

// 格式化日期為 mm/dd 格式
const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份從 0 開始，因此需要 +1
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
};

// 創建標題單元格
const createTitleCell = (video) => {
  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `video-form.html?id=${video.id}`;
  titleLink.textContent = video.title;

  titleLink.onclick = async (event) => {
    event.preventDefault();
    try {
      if (video.autoEnable) {
        const success = await updateAutoEnableAndStatus(video.id, false, false);
        if (!success) throw new Error("關閉自動上架狀態時出錯");
      }
      saveEditedVideo(video.id);
      window.location.href = titleLink.href;
    } catch (error) {
      console.error("錯誤:", error);
      showNotification("關閉自動上架狀態時出錯", "error");
    }
  };

  titleCell.appendChild(titleLink);
  return titleCell;
};

// 創建時間單元格
const createTimeCell = (time) => {
  const timeCell = document.createElement("td");
  timeCell.textContent = time;
  return timeCell;
};

// 創建影片預覽單元格
const createVideoPreviewCell = (video) => {
  const videoPreviewCell = document.createElement("td");
  const playButton = document.createElement("button");
  playButton.textContent = "播放";
  playButton.onclick = () => showVideoModal(video.videoLink);
  videoPreviewCell.appendChild(playButton);
  return videoPreviewCell;
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
      showNotification("更新置頂狀態成功", "success");
    } else {
      showNotification("更新置頂狀態時出錯", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("更新置頂狀態時出錯", "error");
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
    showNotification("加載影片時出錯", "error");
  }
};

// 一鍵上架
const publishAll = async () => {
  const now = new Date();
  const videosToPublish = editedVideos.filter((id) => {
    const video = videosData.find((v) => v.id === id);
    return video && new Date(video.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/videos/schedule-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: videosToPublish, autoEnable: true }),
    });
    if (!response.ok) throw new Error("Network response was not ok");

    const numberOfPublishedVideos = videosToPublish.length;
    editedVideos = [];
    localStorage.removeItem("editedVideos");
    document.getElementById("publish-all-button").style.display = "none";
    showNotification(`已排定 ${numberOfPublishedVideos} 影片自動上架！`, "success");
    loadVideos(currentPage);
  } catch (error) {
    console.error("Error:", error);
    showNotification("一鍵安排上架時出錯", "error");
  }
};

// 顯示提示訊息
const showNotification = (message, type = "info") => {
  // 移除已有的通知（如果存在）
  const existingNotification = document.querySelector(".notification.show");
  if (existingNotification) {
    existingNotification.classList.remove('show');
    setTimeout(() => existingNotification.remove(), 500);
  }

  // 創建新的通知
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // 延時顯示動畫
  setTimeout(() => notification.classList.add('show'), 10);

  // 延時移除通知
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 500); // 等待動畫結束再移除
  }, 3000);
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
