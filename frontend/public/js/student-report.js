let currentPage = 1;
let editedReports = JSON.parse(localStorage.getItem("editedStudentReports")) || [];
let reportsData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (reportId, newAutoEnable, newEnable) => {
  try {
    const response = await fetch(`http://localhost:3001/api/student-reports/${reportId}/enable`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    console.log("更新成功:", reportId, newAutoEnable, newEnable);
    showNotification("更新成功", "success");
    return true;
  } catch (error) {
    console.error("更新失敗:", reportId, newAutoEnable, newEnable, error);
    showNotification("更新失敗", "error");
    return false;
  }
};

// 切換自動上架狀態
const toggleAutoEnable = async (reportId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    showNotification("此報導已下架，請重新編輯文章以重新上架。", "warning");
    document.getElementById(`switch-${reportId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  const newEnable = newAutoEnable ? true : false;

  const success = await updateAutoEnableAndStatus(reportId, newAutoEnable, newEnable);
  if (success) {
    handleAutoEnableChange(reportId, newAutoEnable, isCurrentlyUp, now, timeOn);
  } else {
    document.getElementById(`switch-${reportId}`).checked = currentAutoEnable;
  }
};

// 處理自動上架變更
const handleAutoEnableChange = (reportId, newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (newAutoEnable) {
    editedReports = editedReports.filter(id => id !== reportId);
    localStorage.setItem("editedStudentReports", JSON.stringify(editedReports));
  } else {
    removeEditedReport(reportId);
  }
  loadReports(currentPage);
  showAlertBasedOnAutoEnable(newAutoEnable, isCurrentlyUp, now, timeOn);
};

// 顯示根據自動上架狀態的提示訊息
const showAlertBasedOnAutoEnable = (newAutoEnable, isCurrentlyUp, now, timeOn) => {
  if (!newAutoEnable && isCurrentlyUp) {
    showNotification("報導已下架", "info");
  } else if (!newAutoEnable && !isCurrentlyUp) {
    showNotification("報導的自動上架功能已關閉", "info");
  } else if (newAutoEnable && new Date(timeOn) <= now) {
    showNotification("報導已立即上架", "success");
  }
};

// 保存已編輯的報導
const saveEditedReport = (reportId) => {
  if (!editedReports.includes(reportId)) {
    editedReports.push(reportId);
    localStorage.setItem("editedStudentReports", JSON.stringify(editedReports));
  }
};

// 移除已編輯的報導
const removeEditedReport = (reportId) => {
  editedReports = editedReports.filter(id => id !== reportId);
  localStorage.setItem("editedStudentReports", JSON.stringify(editedReports));
};

// 渲染報導行
const renderReportRow = (report) => {
  const row = document.createElement("tr");

  row.appendChild(createAutoEnableCell(report));
  row.appendChild(createStatusCell(report));
  row.appendChild(createTitleCell(report));
  row.appendChild(createTimeCell(report.timeOn));
  row.appendChild(createTimeCell(report.timeOff));
  row.appendChild(createImageCell(report));

  return row;
};

// 創建自動上架單元格
const createAutoEnableCell = (report) => {
  const autoEnableCell = document.createElement("td");
  const switchLabel = document.createElement("label");
  switchLabel.classList.add("switch");

  const autoEnableSwitch = document.createElement("input");
  autoEnableSwitch.type = "checkbox";
  autoEnableSwitch.checked = report.autoEnable;
  autoEnableSwitch.id = `switch-${report.id}`;

  const now = new Date();
  const timeOnDate = new Date(report.timeOn);
  const timeOffDate = new Date(report.timeOff);
  const isDown = timeOffDate <= now;

  autoEnableSwitch.onchange = () =>
    toggleAutoEnable(report.id, report.autoEnable, report.timeOn, report.timeOff, isDown);

  const sliderSpan = document.createElement("span");
  sliderSpan.classList.add("slider");

  switchLabel.appendChild(autoEnableSwitch);
  switchLabel.appendChild(sliderSpan);
  autoEnableCell.appendChild(switchLabel);

  return autoEnableCell;
};

// 創建狀態單元格
const createStatusCell = (report) => {
  const statusCell = document.createElement("td");
  const statusSpan = document.createElement("span");
  statusSpan.classList.add("status-box");

  const now = new Date();
  const timeOnDate = new Date(report.timeOn);
  const timeOffDate = new Date(report.timeOff);

  if (timeOffDate <= now) {
    statusSpan.classList.add("status-unpublished");
    statusSpan.textContent = " 已下架";
    report.autoEnable = false;
  } else if (!report.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 待確認";
  } else if (report.autoEnable && timeOnDate > now) {
    const formattedDate = formatDate(timeOnDate);
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = ` ${formattedDate} 上架`;
  } else if (report.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 上架中";
  }
  statusCell.appendChild(statusSpan);

  if (report.enable || (report.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (report.pinned) pinButton.classList.add("pinned");

    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinReport(report.id, pinButton);
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
const createTitleCell = (report) => {
  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `student-report-form.html?id=${report.id}`;
  titleLink.textContent = report.title;

  titleLink.onclick = async (event) => {
    event.preventDefault();
    try {
      if (report.autoEnable) {
        const success = await updateAutoEnableAndStatus(report.id, false, false);
        if (!success) throw new Error("關閉自動上架狀態時出錯");
      }
      saveEditedReport(report.id);
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
const createImageCell = (report) => {
  const imageCell = document.createElement("td");
  if (report.image) {
    const img = document.createElement("img");
    img.src = `http://localhost:3001/uploads/student-reports/${report.image}`;
    img.alt = report.title;
    imageCell.appendChild(img);
  }
  return imageCell;
};

// 置頂報導
const pinReport = async (reportId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/student-reports/${reportId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadReports(currentPage); // 重新加載報導列表，以反映更改
      showNotification("更新置頂狀態成功", "success");
    } else {
      showNotification("更新置頂狀態時出錯", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("更新置頂狀態時出錯", "error");
  }
};

const loadReports = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/student-reports?page=${page}&forManagement=true`);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Loaded data:", data); // 增加日誌

    if (!data.reports || !Array.isArray(data.reports)) {
      throw new Error("Invalid data format: reports data is missing or not an array");
    }

    reportsData = data.reports;
    const tbody = document.getElementById("reports-body");
    const publishAllButton = document.getElementById("publish-all-button");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();
    data.reports.forEach((report) => {
      const row = renderReportRow(report);
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);

    updateEditedReports();

    if (editedReports.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    renderPagination(data.totalPages, data.currentPage);
  } catch (error) {
    console.error("加載報導時出錯:", error);
    showNotification(`加載報導時出錯: ${error.message}`, "error");
  }
};

// 更新已編輯報導
const updateEditedReports = () => {
  const now = new Date();
  editedReports = JSON.parse(localStorage.getItem("editedStudentReports")) || [];
  editedReports = editedReports.filter((id) => {
    const report = reportsData.find((r) => r.id === id);
    return report && new Date(report.timeOff) > now;
  });
  localStorage.setItem("editedStudentReports", JSON.stringify(editedReports));
};

// 渲染分頁
const renderPagination = (totalPages, currentPage) => {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.onclick = () => loadReports(i);
    if (i === currentPage) button.classList.add("current-page");
    pagination.appendChild(button);
  }
};

// 一鍵上架
const publishAll = async () => {
  const now = new Date();
  const reportsToPublish = editedReports.filter((id) => {
    const report = reportsData.find((r) => r.id === id);
    return report && new Date(report.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/student-reports/schedule-all", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reportsToPublish, autoEnable: true }),
    });
    if (!response.ok) throw new Error("Network response was not ok");

    const numberOfPublishedReports = reportsToPublish.length;
    editedReports = [];
    localStorage.removeItem("editedStudentReports");
    document.getElementById("publish-all-button").style.display = "none";
    showNotification(`已排定 ${numberOfPublishedReports} 報導自動上架！`, "success");
    loadReports(currentPage);
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
  loadReports(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/student-reports/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-student-report" || data.type === "new-student-report") {
      loadReports(currentPage);
    }
  };
});
