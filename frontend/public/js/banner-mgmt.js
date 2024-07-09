let currentPage = 1;
let editedBanners = JSON.parse(localStorage.getItem("editedBanners")) || [];
let bannersData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (bannerId, newAutoEnable, newEnable) => {
  const response = await fetch(`http://localhost:3001/api/banners/${bannerId}/enable`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
  });
  return response.ok;
};

// 切換自動上架
const toggleAutoEnable = async (bannerId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    alert("此 Banner 已下架，請重新編輯以重新上架。");
    document.getElementById(`switch-${bannerId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  let action, additionalMessage;

  if (newAutoEnable) {
    action = "開啟自動上架";
    additionalMessage = new Date(timeOn) <= now
      ? "此 Banner 的上架時間已到，開啟自動上架功能將立即上架此 Banner，是否繼續？"
      : "開啟自動上架功能將在上架時間到達時自動上架此 Banner，是否繼續？";
  } else {
    action = "關閉自動上架";
    additionalMessage = isCurrentlyUp
      ? "此 Banner 目前已上架，關閉自動上架功能將會下架此 Banner，是否繼續？"
      : "此 Banner 目前尚未上架，關閉自動上架功能將取消其自動上架，是否繼續？";
  }

  if (!confirm(`${action} ${additionalMessage}`)) {
    document.getElementById(`switch-${bannerId}`).checked = currentAutoEnable;
    return;
  }

  const newEnable = newAutoEnable ? true : false;

  try {
    const success = await updateAutoEnableAndStatus(bannerId, newAutoEnable, newEnable);
    if (success) {
      loadBanners(currentPage);
      if (!newAutoEnable && isCurrentlyUp) {
        showAlert("Banner 已下架");
      } else if (!newAutoEnable && !isCurrentlyUp) {
        showAlert("Banner 的自動上架功能已關閉");
      } else if (newAutoEnable && new Date(timeOn) <= now) {
        showAlert("Banner 已立即上架");
      }
    } else {
      throw new Error("Network response was not ok");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新自動上架狀態時出錯");
    document.getElementById(`switch-${bannerId}`).checked = currentAutoEnable;
  }
};

// 保存已編輯的 Banner
const saveEditedBanner = (bannerId) => {
  if (!editedBanners.includes(bannerId)) {
    editedBanners.push(bannerId);
    localStorage.setItem("editedBanners", JSON.stringify(editedBanners));
  }
};

// 渲染 Banner 行
const renderBannerRow = (banner) => {
    const row = document.createElement("tr");
  
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
      toggleAutoEnable(
        banner.id,
        banner.autoEnable,
        banner.timeOn,
        banner.timeOff,
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
      banner.autoEnable = false;
    } else if (!banner.autoEnable) {
      statusSpan.classList.add("status-default");
      statusSpan.textContent = " 未排定自動上架";
    } else if (banner.autoEnable && timeOnDate > now) {
      statusSpan.classList.add("status-scheduled");
      statusSpan.textContent = " 未上架";
    } else if (banner.enable && timeOffDate > now) {
      statusSpan.classList.add("status-published");
      statusSpan.textContent = " 已上架";
    }
    statusCell.appendChild(statusSpan);
  
    if (banner.enable || (banner.autoEnable && timeOnDate > now)) {
      const pinButton = document.createElement("button");
      pinButton.classList.add("pin-button");
      if (banner.pinned) {
        pinButton.classList.add("pinned");
      }
      const pinIcon = document.createElement("i");
      pinIcon.classList.add("fas", "fa-thumbtack");
      pinButton.appendChild(pinIcon);
      pinButton.onclick = () => pinBanner(banner.id, pinButton);
      statusCell.appendChild(pinButton);
    }
  
    row.appendChild(statusCell);
  
    const titleCell = document.createElement("td");
    const titleLink = document.createElement("a");
    titleLink.href = `banner-form.html?id=${banner.id}`;
    titleLink.textContent = banner.title;
    titleLink.onclick = (event) => {
      event.preventDefault();
      if (banner.autoEnable) {
        updateAutoEnableAndStatus(banner.id, false, false)
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }
            loadBanners(currentPage);
          })
          .catch((error) => {
            console.error("Error:", error);
            alert("關閉自動上架狀態時出錯");
          });
      }
  
      saveEditedBanner(banner.id);
  
      window.location.href = titleLink.href;
    };
    titleCell.appendChild(titleLink);
    row.appendChild(titleCell);
  
    const timeOnCell = document.createElement("td");
    timeOnCell.textContent = banner.timeOn;
    row.appendChild(timeOnCell);
  
    const timeOffCell = document.createElement("td");
    timeOffCell.textContent = banner.timeOff;
    row.appendChild(timeOffCell);
  
    const imageCell = document.createElement("td");
    if (banner.image) {
      const img = document.createElement("img");
      img.src = `http://localhost:3001${banner.image}`;
      imageCell.appendChild(img);
    }
    row.appendChild(imageCell);
  
    return row;
  };
  

// 置頂 Banner
const pinBanner = async (bannerId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/banners/${bannerId}/pin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinned }),
    });
    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadBanners(currentPage); // 重新加載 Banner 列表，以反映更改
    } else {
      alert("更新置頂狀態時出錯");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新置頂狀態時出錯");
  }
};

// 加載 Banners
const loadBanners = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/banners?page=${page}&forManagement=true`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
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

    const now = new Date();
    editedBanners = JSON.parse(localStorage.getItem("editedBanners")) || [];
    editedBanners = editedBanners.filter((id) => {
      const banner = bannersData.find((r) => r.id === id);
      return banner && new Date(banner.timeOff) > now;
    });
    localStorage.setItem("editedBanners", JSON.stringify(editedBanners));

    if (editedBanners.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    for (let i = 1; i <= data.totalPages; i++) {
      const button = document.createElement("button");
      button.textContent = i;
      button.onclick = () => loadBanners(i);
      if (i === data.currentPage) {
        button.classList.add("current-page");
      }
      pagination.appendChild(button);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("加載 Banner 時出錯");
  }
};

// 一鍵上架
const publishAll = async () => {
  if (!confirm("您確定要一鍵安排上架所有編輯過的 Banner 嗎？")) {
    return;
  }

  const now = new Date();
  const bannersToPublish = editedBanners.filter((id) => {
    const banner = bannersData.find((r) => r.id === id);
    return banner && new Date(banner.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/banners/schedule-all", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: bannersToPublish, autoEnable: true }),
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const numberOfPublishedBanners = bannersToPublish.length;
    editedBanners = [];
    localStorage.removeItem("editedBanners");
    document.getElementById("publish-all-button").style.display = "none";
    showAlert(`已排定 ${numberOfPublishedBanners} Banner 自動上架！`);
    loadBanners(currentPage);
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
  loadBanners(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/banners/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-banner" || data.type === "new-banner") {
      loadBanners(currentPage);
    }
  };
});
