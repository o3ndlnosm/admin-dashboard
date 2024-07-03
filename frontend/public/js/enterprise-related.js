let currentPage = 1;
let editedAnnouncements = JSON.parse(localStorage.getItem("editedAnnouncements")) || [];
let announcementsData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (announcementId, newAutoEnable, newEnable) => {
  const response = await fetch(`http://localhost:3001/api/announcements/${announcementId}/enable`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
  });
  return response.ok;
};

// 切換自動上架
const toggleAutoEnable = async (announcementId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    alert("此公告已下架，請重新編輯文章以重新上架。");
    document.getElementById(`switch-${announcementId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  let action, additionalMessage;

  if (newAutoEnable) {
    action = "開啟自動上架";
    additionalMessage = new Date(timeOn) <= now
      ? "此公告的上架時間已到，開啟自動上架功能將立即上架此公告，是否繼續？"
      : "開啟自動上架功能將在上架時間到達時自動上架此公告，是否繼續？";
  } else {
    action = "關閉自動上架";
    additionalMessage = isCurrentlyUp
      ? "此公告目前已上架，關閉自動上架功能將會下架此公告，是否繼續？"
      : "此公告目前尚未上架，關閉自動上架功能將取消其自動上架，是否繼續？";
  }

  if (!confirm(`${action} ${additionalMessage}`)) {
    document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
    return;
  }

  const newEnable = newAutoEnable ? true : false;

  try {
    const success = await updateAutoEnableAndStatus(announcementId, newAutoEnable, newEnable);
    if (success) {
      loadAnnouncements(currentPage);
      if (!newAutoEnable && isCurrentlyUp) {
        showAlert("公告已下架");
      } else if (!newAutoEnable && !isCurrentlyUp) {
        showAlert("公告的自動上架功能已關閉");
      } else if (newAutoEnable && new Date(timeOn) <= now) {
        showAlert("公告已立即上架");
      }
    } else {
      throw new Error("Network response was not ok");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新自動上架狀態時出錯");
    document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
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
    toggleAutoEnable(
      announcement.id,
      announcement.autoEnable,
      announcement.timeOn,
      announcement.timeOff,
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
    announcement.autoEnable = false;
  } else if (!announcement.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 未排定自動上架";
  } else if (announcement.autoEnable && timeOnDate > now) {
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = " 未上架";
  } else if (announcement.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 已上架";
  }
  statusCell.appendChild(statusSpan);

  if (announcement.enable || (announcement.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (announcement.pinned) {
      pinButton.classList.add("pinned");
    }
    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinAnnouncement(announcement.id, pinButton);
    statusCell.appendChild(pinButton);
  }

  row.appendChild(statusCell);

  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `announcement-form.html?id=${announcement.id}`;
  titleLink.textContent = announcement.title;
  titleLink.onclick = (event) => {
    event.preventDefault();
    if (announcement.autoEnable) {
      updateAutoEnableAndStatus(announcement.id, false, false)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          loadAnnouncements(currentPage);
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("關閉自動上架狀態時出錯");
        });
    }

    saveEditedAnnouncement(announcement.id);

    window.location.href = titleLink.href;
  };
  titleCell.appendChild(titleLink);
  row.appendChild(titleCell);

  const timeOnCell = document.createElement("td");
  timeOnCell.textContent = announcement.timeOn;
  row.appendChild(timeOnCell);

  const timeOffCell = document.createElement("td");
  timeOffCell.textContent = announcement.timeOff;
  row.appendChild(timeOffCell);

  const imageCell = document.createElement("td");
  if (announcement.image) {
    const img = document.createElement("img");
    img.src = `http://localhost:3001/uploads/${announcement.image}`;
    imageCell.appendChild(img);
  }
  row.appendChild(imageCell);

  return row;
};

// 置頂公告
const pinAnnouncement = async (announcementId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/announcements/${announcementId}/pin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinned }),
    });
    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadAnnouncements(currentPage); // 重新加載公告列表，以反映更改
    } else {
      alert("更新置頂狀態時出錯");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新置頂狀態時出錯");
  }
};

// 加載公告
const loadAnnouncements = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/announcements?page=${page}&forManagement=true`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
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

    const now = new Date();
    editedAnnouncements = JSON.parse(localStorage.getItem("editedAnnouncements")) || [];
    editedAnnouncements = editedAnnouncements.filter((id) => {
      const announcement = announcementsData.find((a) => a.id === id);
      return announcement && new Date(announcement.timeOff) > now;
    });
    localStorage.setItem("editedAnnouncements", JSON.stringify(editedAnnouncements));

    if (editedAnnouncements.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    for (let i = 1; i <= data.totalPages; i++) {
      const button = document.createElement("button");
      button.textContent = i;
      button.onclick = () => loadAnnouncements(i);
      if (i === data.currentPage) {
        button.classList.add("current-page");
      }
      pagination.appendChild(button);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("加載公告時出錯");
  }
};

// 一鍵上架
const publishAll = async () => {
  if (!confirm("您確定要一鍵安排上架所有編輯過的公告嗎？")) {
    return;
  }

  const now = new Date();
  const announcementsToPublish = editedAnnouncements.filter((id) => {
    const announcement = announcementsData.find((a) => a.id === id);
    return announcement && new Date(announcement.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/announcements/schedule-all", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: announcementsToPublish, autoEnable: true }),
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const numberOfPublishedAnnouncements = announcementsToPublish.length;
    editedAnnouncements = [];
    localStorage.removeItem("editedAnnouncements");
    document.getElementById("publish-all-button").style.display = "none";
    showAlert(`已排定 ${numberOfPublishedAnnouncements} 公告自動上架！`);
    loadAnnouncements(currentPage);
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
  loadAnnouncements(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/announcements/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-announcement" || data.type === "new-announcement") {
      loadAnnouncements(currentPage);
    }
  };
});
