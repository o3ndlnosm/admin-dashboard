import { fetchData, updateAutoEnableAndStatus, pinItem } from './fetchUtils.js';
import { renderTable } from './renderUtils.js';

export const toggleAutoEnable = async (id, currentAutoEnable, timeOn, timeOff, isDown, type) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    alert("此項目已下架，請重新編輯文章以重新上架。");
    document.getElementById(`switch-${id}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  let action, additionalMessage;

  if (newAutoEnable) {
    action = "開啟自動上架";
    additionalMessage = new Date(timeOn) <= now
      ? "此項目的上架時間已到，開啟自動上架功能將立即上架此項目，是否繼續？"
      : "開啟自動上架功能將在上架時間到達時自動上架此項目，是否繼續？";
  } else {
    action = "關閉自動上架";
    additionalMessage = isCurrentlyUp
      ? "此項目目前已上架，關閉自動上架功能將會下架此項目，是否繼續？"
      : "此項目目前尚未上架，關閉自動上架功能將取消其自動上架，是否繼續？";
  }

  if (!confirm(`${action} ${additionalMessage}`)) {
    document.getElementById(`switch-${id}`).checked = currentAutoEnable;
    return;
  }

  const newEnable = newAutoEnable ? true : false;
  const success = await updateAutoEnableAndStatus(id, newAutoEnable, newEnable, type);
  if (success) {
    loadData(currentPage, type);
    if (!newAutoEnable && isCurrentlyUp) {
      showAlert("項目已下架");
    } else if (!newAutoEnable && !isCurrentlyUp) {
      showAlert("項目的自動上架功能已關閉");
    } else if (newAutoEnable && new Date(timeOn) <= now) {
      showAlert("項目已立即上架");
    }
  } else {
    document.getElementById(`switch-${id}`).checked = currentAutoEnable;
  }
};

export const saveEditedItem = (id, type) => {
  let editedItems = JSON.parse(localStorage.getItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}`)) || [];
  if (!editedItems.includes(id)) {
    editedItems.push(id);
    localStorage.setItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}`, JSON.stringify(editedItems));
  }
};

export const loadData = async (page = 1, type) => {
  const data = await fetchData(`http://localhost:3001/api/${type}?page=${page}&forManagement=true`);
  if (!data) return;

  renderTable(data[type], type);

  const now = new Date();
  let editedItems = JSON.parse(localStorage.getItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}`)) || [];
  editedItems = editedItems.filter((id) => {
    const item = data[type].find((i) => i.id === id);
    return item && new Date(item.timeOff) > now;
  });
  localStorage.setItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}`, JSON.stringify(editedItems));

  const publishAllButton = document.getElementById("publish-all-button");
  publishAllButton.style.display = editedItems.length > 0 ? "block" : "none";

  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";
  for (let i = 1; i <= data.totalPages; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.onclick = () => loadData(i, type);
    if (i === data.currentPage) {
      button.classList.add("current-page");
    }
    pagination.appendChild(button);
  }
};

export const publishAll = async (type) => {
  if (!confirm("您確定要一鍵安排上架所有編輯過的項目嗎？")) {
    return;
  }

  const now = new Date();
  const data = await fetchData(`http://localhost:3001/api/${type}?forManagement=true`);
  if (!data) return;

  const editedItems = JSON.parse(localStorage.getItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}`)) || [];
  const itemsToPublish = editedItems.filter((id) => {
    const item = data[type].find((i) => i.id === id);
    return item && new Date(item.timeOff) > now;
  });

  const response = await fetchData(`http://localhost:3001/api/${type}/schedule-all`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: itemsToPublish, autoEnable: true }),
  });

  if (response) {
    localStorage.removeItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}`);
    document.getElementById("publish-all-button").style.display = "none";
    showAlert(`已排定 ${itemsToPublish.length} 項目自動上架！`);
    loadData(currentPage, type);
  } else {
    alert("一鍵安排上架時出錯");
  }
};

export const showAlert = (message) => {
  const alertModal = document.getElementById("alert-modal");
  const alertMessage = document.getElementById("alert-message");
  alertMessage.textContent = message;
  alertModal.style.display = "block";
};

export const closeModal = () => {
  const alertModal = document.getElementById("alert-modal");
  alertModal.style.display = "none";
};
