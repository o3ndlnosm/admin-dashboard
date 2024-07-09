let currentPage = 1;
let editedAnnouncements = JSON.parse(localStorage.getItem("editedAnnouncements")) || [];
let announcementsData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (announcementId, newAutoEnable, newEnable) => {
  try {
    const response = await fetch(`http://localhost:3001/api/announcements/${announcementId}/enable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    console.log("更新成功:", announcementId, newAutoEnable, newEnable);
    showNotification("更新成功", "success");
    return true;
  } catch (error) {
    console.error("更新失敗:", announcementId, newAutoEnable, newEnable, error);
    showNotification("更新失敗", "error");
    return false;
  }
};

// 切換自動上架狀態
const toggleAutoEnable = async (announcementId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    showNotification("此公告已下架，請重新編輯文章以重新上架。", "warning");
    document.getElementById(`switch-${announcementId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  const newEnable = newAutoEnable ? true : false;

  const success = await updateAutoEnableAndStatus(announcementId, newAutoEnable, newEnable);
  if (success) {
    handleAutoEnableChange(announcementId, newAutoEnable, isCurrentlyUp, now, timeOn);
  } else {
    document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
  }
};

// 處理自動上架變更
const handleAutoEnableChange = (announcementId, newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (newAutoEnable) {
    editedAnnouncements = editedAnnouncements.filter(id => id !== announcementId);
    localStorage.setItem("editedAnnouncements", JSON.stringify(editedAnnouncements));
  } else {
    saveEditedAnnouncement(announcementId);
  }
  loadAnnouncements(currentPage);
  showAlertBasedOnAutoEnable(newAutoEnable, isCurrentlyUp, now, timeOn);
};

// 顯示根據自動上架狀態的提示訊息
const showAlertBasedOnAutoEnable = (newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (!newAutoEnable && isCurrentlyUp) {
    showNotification("公告已下架", "info");
  } else if (!newAutoEnable && !isCurrentlyUp) {
    showNotification("公告的自動上架功能已關閉", "info");
  } else if (newAutoEnable && new Date(timeOn) <= now) {
    showNotification("公告已立即上架", "success");
  }
};

// 保存已編輯的公告
const saveEditedAnnouncement = (announcementId) => {
  if (!editedAnnouncements.includes(announcementId)) {
    editedAnnouncements.push(announcementId);
    localStorage.setItem("editedAnnouncements", JSON.stringify(editedAnnouncements));
  }
};

// 渲染公告行
const renderAnnouncementRow = (announcement) => {
  const row = document.createElement("tr");

  row.appendChild(createAutoEnableCell(announcement));
  row.appendChild(createStatusCell(announcement));
  row.appendChild(createTitleCell(announcement));
  row.appendChild(createTimeCell(announcement.timeOn));
  row.appendChild(createTimeCell(announcement.timeOff));
  row.appendChild(createImageCell(announcement));

  return row;
};

// 創建自動上架單元格
const createAutoEnableCell = (announcement) => {
  const autoEnableCell = document.createElement("td");
  const switchLabel = document.createElement("label");
  switchLabel.classList.add("switch");

  const autoEnableSwitch = document.createElement("input");
  autoEnableSwitch.type = "checkbox";
  autoEnableSwitch.checked = announcement.autoEnable;
  autoEnableSwitch.id = `switch-${announcement.id}`;

  const now = new Date();
  const timeOnDate = new Date(announcement.timeOn);
  const timeOffDate = new Date(announcement.timeOff);
  const isDown = timeOffDate <= now;

  autoEnableSwitch.onchange = () =>
    toggleAutoEnable(announcement.id, announcement.autoEnable, announcement.timeOn, announcement.timeOff, isDown);

  const sliderSpan = document.createElement("span");
  sliderSpan.classList.add("slider");

  switchLabel.appendChild(autoEnableSwitch);
  switchLabel.appendChild(sliderSpan);
  autoEnableCell.appendChild(switchLabel);

  return autoEnableCell;
};

// 創建狀態單元格
const createStatusCell = (announcement) => {
  const statusCell = document.createElement("td");
  const statusSpan = document.createElement("span");
  statusSpan.classList.add("status-box");

  const now = new Date();
  const timeOnDate = new Date(announcement.timeOn);
  const timeOffDate = new Date(announcement.timeOff);

  if (timeOffDate <= now) {
    statusSpan.classList.add("status-unpublished");
    statusSpan.textContent = " 已下架";
    announcement.autoEnable = false;
  } else if (!announcement.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 待確認";
  } else if (announcement.autoEnable && timeOnDate > now) {
    const formattedDate = formatDate(timeOnDate);
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = ` ${formattedDate} 上架`;
  } else if (announcement.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 上架中";
  }
  statusCell.appendChild(statusSpan);

  if (announcement.enable || (announcement.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (announcement.pinned) pinButton.classList.add("pinned");

    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinAnnouncement(announcement.id, pinButton);
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
const createTitleCell = (announcement) => {
  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `ann-form.html?id=${announcement.id}`;
  titleLink.textContent = announcement.title;

  titleLink.onclick = async (event) => {
    event.preventDefault();
    try {
      if (announcement.autoEnable) {
        const success = await updateAutoEnableAndStatus(announcement.id, false, false);
        if (!success) throw new Error("關閉自動上架狀態時出錯");
      }
      saveEditedAnnouncement(announcement.id);
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

// 創建圖片單元格
const createImageCell = (announcement) => {
  const imageCell = document.createElement("td");
  if (announcement.image) {
    const img = document.createElement("img");
    img.src = `http://localhost:3001/uploads/announcements/${announcement.image}`;
    img.alt = announcement.title;
    imageCell.appendChild(img);
  }
  return imageCell;
};

// 置頂公告
const pinAnnouncement = async (announcementId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/announcements/${announcementId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadAnnouncements(currentPage); // 重新加載公告列表，以反映更改
      showNotification("更新置頂狀態成功", "success");
    } else {
      showNotification("更新置頂狀態時出錯", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("更新置頂狀態時出錯", "error");
  }
};

// 加載公告
const loadAnnouncements = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/announcements?page=${page}&forManagement=true`);
    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    announcementsData = data.announcements;

    const tbody = document.getElementById("announcements-body");
    const publishAllButton = document.getElementById("publish-all-button");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();
    data.announcements.forEach((announcement) => {
      const row = renderAnnouncementRow(announcement);
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);

    updateEditedAnnouncements();

    if (editedAnnouncements.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    renderPagination(data.totalPages, data.currentPage);
  } catch (error) {
    console.error("Error:", error);
    showNotification("加載公告時出錯", "error");
  }
};

// 更新已編輯公告
const updateEditedAnnouncements = () => {
  const now = new Date();
  editedAnnouncements = JSON.parse(localStorage.getItem("editedAnnouncements")) || [];
  editedAnnouncements = editedAnnouncements.filter((id) => {
    const announcement = announcementsData.find((a) => a.id === id);
    return announcement && new Date(announcement.timeOff) > now;
  });
  localStorage.setItem("editedAnnouncements", JSON.stringify(editedAnnouncements));
};

// 渲染分頁
const renderPagination = (totalPages, currentPage) => {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.onclick = () => loadAnnouncements(i);
    if (i === currentPage) button.classList.add("current-page");
    pagination.appendChild(button);
  }
};

// 一鍵上架
const publishAll = async () => {
  const now = new Date();
  const announcementsToPublish = editedAnnouncements.filter((id) => {
    const announcement = announcementsData.find((a) => a.id === id);
    return announcement && new Date(announcement.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/announcements/schedule-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: announcementsToPublish, autoEnable: true }),
    });
    if (!response.ok) throw new Error("Network response was not ok");

    const numberOfPublishedAnnouncements = announcementsToPublish.length;
    editedAnnouncements = [];
    localStorage.removeItem("editedAnnouncements");
    document.getElementById("publish-all-button").style.display = "none";
    showNotification(`已排定 ${numberOfPublishedAnnouncements} 公告自動上架！`, "success");
    loadAnnouncements(currentPage);
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
  loadAnnouncements(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/announcements/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-announcement" || data.type === "new-announcement") {
      loadAnnouncements(currentPage);
    }
  };
});
