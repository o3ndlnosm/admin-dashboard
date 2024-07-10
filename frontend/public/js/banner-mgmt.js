let currentPage = 1;
let editedBanners = JSON.parse(localStorage.getItem("editedBanners")) || [];
let bannersData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (bannerId, newAutoEnable, newEnable) => {
  try {
    const response = await fetch(`http://localhost:3001/api/banners/${bannerId}/enable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    console.log("更新成功:", bannerId, newAutoEnable, newEnable);
    showNotification("更新成功", "success");
    return true;
  } catch (error) {
    console.error("更新失敗:", bannerId, newAutoEnable, newEnable, error);
    showNotification("更新失敗", "error");
    return false;
  }
};

// 切換自動上架狀態
const toggleAutoEnable = async (bannerId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    showNotification("此 Banner 已下架，請重新編輯以重新上架。", "warning");
    document.getElementById(`switch-${bannerId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  const newEnable = newAutoEnable ? true : false;

  const success = await updateAutoEnableAndStatus(bannerId, newAutoEnable, newEnable);
  if (success) {
    handleAutoEnableChange(bannerId, newAutoEnable, isCurrentlyUp, now, timeOn);
  } else {
    document.getElementById(`switch-${bannerId}`).checked = currentAutoEnable;
  }
};

// 處理自動上架變更
const handleAutoEnableChange = (bannerId, newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (newAutoEnable) {
    editedBanners = editedBanners.filter(id => id !== bannerId);
    localStorage.setItem("editedBanners", JSON.stringify(editedBanners));
  } else {
    removeEditedBanner(bannerId);
  }
  loadBanners(currentPage);
  showAlertBasedOnAutoEnable(newAutoEnable, isCurrentlyUp, now, timeOn);
};

// 顯示根據自動上架狀態的提示訊息
const showAlertBasedOnAutoEnable = (newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (!newAutoEnable && isCurrentlyUp) {
    showNotification("Banner 已下架", "info");
  } else if (!newAutoEnable && !isCurrentlyUp) {
    showNotification("Banner 的自動上架功能已關閉", "info");
  } else if (newAutoEnable && new Date(timeOn) <= now) {
    showNotification("Banner 已立即上架", "success");
  }
};

// 保存已編輯的 Banner
const saveEditedBanner = (bannerId) => {
  if (!editedBanners.includes(bannerId)) {
    editedBanners.push(bannerId);
    localStorage.setItem("editedBanners", JSON.stringify(editedBanners));
  }
};

// 移除已編輯的 Banner
const removeEditedBanner = (bannerId) => {
  editedBanners = editedBanners.filter(id => id !== bannerId);
  localStorage.setItem("editedBanners", JSON.stringify(editedBanners));
};

// 渲染 Banner 行
const renderBannerRow = (banner) => {
  const row = document.createElement("tr");

  row.appendChild(createAutoEnableCell(banner));
  row.appendChild(createStatusCell(banner));
  row.appendChild(createTitleCell(banner));
  row.appendChild(createTimeCell(banner.timeOn));
  row.appendChild(createTimeCell(banner.timeOff));
  row.appendChild(createImageCell(banner));

  return row;
};

// 創建自動上架單元格
const createAutoEnableCell = (banner) => {
  const autoEnableCell = document.createElement("td");
  const switchLabel = document.createElement("label");
  switchLabel.classList.add("switch");

  const autoEnableSwitch = document.createElement("input");
  autoEnableSwitch.type = "checkbox";
  autoEnableSwitch.checked = banner.autoEnable;
  autoEnableSwitch.id = `switch-${banner.id}`;

  const now = new Date();
  const timeOnDate = new Date(banner.timeOn);
  const timeOffDate = new Date(banner.timeOff);
  const isDown = timeOffDate <= now;

  autoEnableSwitch.onchange = () =>
    toggleAutoEnable(banner.id, banner.autoEnable, banner.timeOn, banner.timeOff, isDown);

  const sliderSpan = document.createElement("span");
  sliderSpan.classList.add("slider");

  switchLabel.appendChild(autoEnableSwitch);
  switchLabel.appendChild(sliderSpan);
  autoEnableCell.appendChild(switchLabel);

  return autoEnableCell;
};

// 創建狀態單元格
const createStatusCell = (banner) => {
  const statusCell = document.createElement("td");
  const statusSpan = document.createElement("span");
  statusSpan.classList.add("status-box");

  const now = new Date();
  const timeOnDate = new Date(banner.timeOn);
  const timeOffDate = new Date(banner.timeOff);

  if (timeOffDate <= now) {
    statusSpan.classList.add("status-unpublished");
    statusSpan.textContent = " 已下架";
    banner.autoEnable = false;
  } else if (!banner.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 待確認";
  } else if (banner.autoEnable && timeOnDate > now) {
    const formattedDate = formatDate(timeOnDate);
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = ` ${formattedDate} 上架`;
  } else if (banner.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 上架中";
  }
  statusCell.appendChild(statusSpan);

  if (banner.enable || (banner.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (banner.pinned) pinButton.classList.add("pinned");

    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinBanner(banner.id, pinButton);
    statusCell.appendChild(pinButton);
  }

  return statusCell;
};

// 創建標題單元格
const createTitleCell = (banner) => {
  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `banner-form.html?id=${banner.id}`;
  titleLink.textContent = banner.title;

  titleLink.onclick = async (event) => {
    event.preventDefault();
    try {
      if (banner.autoEnable) {
        const success = await updateAutoEnableAndStatus(banner.id, false, false);
        if (!success) throw new Error("關閉自動上架狀態時出錯");
      }
      saveEditedBanner(banner.id);
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
const createImageCell = (banner) => {
  const imageCell = document.createElement("td");
  if (banner.image) {
    const img = document.createElement("img");
    img.src = `http://localhost:3001${banner.image}`;
    imageCell.appendChild(img);
  }
  return imageCell;
};

// 置頂 Banner
const pinBanner = async (bannerId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/banners/${bannerId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadBanners(currentPage); // 重新加載 Banner 列表，以反映更改
      showNotification("更新置頂狀態成功", "success");
    } else {
      showNotification("更新置頂狀態時出錯", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("更新置頂狀態時出錯", "error");
  }
};

const loadBanners = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/banners?page=${page}&forManagement=true`);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Loaded data:", data); // 增加日誌

    if (!data.banners || !Array.isArray(data.banners)) {
      throw new Error("Invalid data format: banners data is missing or not an array");
    }

    bannersData = data.banners;
    const tbody = document.getElementById("banners-body");
    const publishAllButton = document.getElementById("publish-all-button");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();
    data.banners.forEach((banner) => {
      const row = renderBannerRow(banner);
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);

    updateEditedBanners();

    if (editedBanners.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    renderPagination(data.totalPages, data.currentPage);
  } catch (error) {
    console.error("加載 Banner 時出錯:", error);
    showNotification(`加載 Banner 時出錯: ${error.message}`, "error");
  }
};

// 更新已編輯 Banners
const updateEditedBanners = () => {
  const now = new Date();
  editedBanners = JSON.parse(localStorage.getItem("editedBanners")) || [];
  editedBanners = editedBanners.filter((id) => {
    const banner = bannersData.find((r) => r.id === id);
    return banner && new Date(banner.timeOff) > now;
  });
  localStorage.setItem("editedBanners", JSON.stringify(editedBanners));
};

// 渲染分頁
const renderPagination = (totalPages, currentPage) => {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.onclick = () => loadBanners(i);
    if (i === currentPage) button.classList.add("current-page");
    pagination.appendChild(button);
  }
};

// 一鍵上架
const publishAll = async () => {
  console.log("Publish All function called"); // 添加日志
  const now = new Date();
  const bannersToPublish = editedBanners.filter((id) => {
    const banner = bannersData.find((r) => r.id === id);
    return banner && new Date(banner.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/banners/schedule-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: bannersToPublish, autoEnable: true }),
    });
    if (!response.ok) throw new Error("Network response was not ok");

    const numberOfPublishedBanners = bannersToPublish.length;
    editedBanners = [];
    localStorage.removeItem("editedBanners");
    document.getElementById("publish-all-button").style.display = "none";
    showNotification(`已排定 ${numberOfPublishedBanners} Banner 自動上架！`, "success");
    loadBanners(currentPage);
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

// 日期格式化函數
const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份從 0 開始，因此需要 +1
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
};

// DOM 加載後初始化
document.addEventListener("DOMContentLoaded", () => {
  loadBanners(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/banners/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-banner" || data.type === "new-banner") {
      loadBanners(currentPage);
    }
  };
});


// 關閉模態窗口
const closeModal = () => {
  const alertModal = document.getElementById("alert-modal");
  alertModal.style.display = "none";
};
