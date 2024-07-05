let currentPage = 1;
let editedReports = JSON.parse(localStorage.getItem("editedReports")) || [];
let reportsData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (reportId, newAutoEnable, newEnable) => {
  const response = await fetch(`http://localhost:3001/api/reports/${reportId}/enable`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
  });
  return response.ok;
};

// 切換自動上架
const toggleAutoEnable = async (reportId, currentAutoEnable, timeOn, timeOff, isDown) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    alert("此報導已下架，請重新編輯文章以重新上架。");
    document.getElementById(`switch-${reportId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  let action, additionalMessage;

  if (newAutoEnable) {
    action = "開啟自動上架";
    additionalMessage = new Date(timeOn) <= now
      ? "此報導的上架時間已到，開啟自動上架功能將立即上架此報導，是否繼續？"
      : "開啟自動上架功能將在上架時間到達時自動上架此報導，是否繼續？";
  } else {
    action = "關閉自動上架";
    additionalMessage = isCurrentlyUp
      ? "此報導目前已上架，關閉自動上架功能將會下架此報導，是否繼續？"
      : "此報導目前尚未上架，關閉自動上架功能將取消其自動上架，是否繼續？";
  }

  if (!confirm(`${action} ${additionalMessage}`)) {
    document.getElementById(`switch-${reportId}`).checked = currentAutoEnable;
    return;
  }

  const newEnable = newAutoEnable ? true : false;

  try {
    const success = await updateAutoEnableAndStatus(reportId, newAutoEnable, newEnable);
    if (success) {
      loadReports(currentPage);
      if (!newAutoEnable && isCurrentlyUp) {
        showAlert("報導已下架");
      } else if (!newAutoEnable && !isCurrentlyUp) {
        showAlert("報導的自動上架功能已關閉");
      } else if (newAutoEnable && new Date(timeOn) <= now) {
        showAlert("報導已立即上架");
      }
    } else {
      throw new Error("Network response was not ok");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新自動上架狀態時出錯");
    document.getElementById(`switch-${reportId}`).checked = currentAutoEnable;
  }
};

// 保存已編輯的報導
const saveEditedReport = (reportId) => {
  if (!editedReports.includes(reportId)) {
    editedReports.push(reportId);
    localStorage.setItem("editedReports", JSON.stringify(editedReports));
  }
};

// 渲染報導行
const renderReportRow = (report) => {
  const row = document.createElement("tr");

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
    toggleAutoEnable(
      report.id,
      report.autoEnable,
      report.timeOn,
      report.timeOff,
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
    report.autoEnable = false;
  } else if (!report.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 未排定自動上架";
  } else if (report.autoEnable && timeOnDate > now) {
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = " 未上架";
  } else if (report.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 已上架";
  }
  statusCell.appendChild(statusSpan);

  if (report.enable || (report.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (report.pinned) {
      pinButton.classList.add("pinned");
    }
    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinReport(report.id, pinButton);
    statusCell.appendChild(pinButton);
  }

  row.appendChild(statusCell);

  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `report-form.html?id=${report.id}`;
  titleLink.textContent = report.title;
  titleLink.onclick = (event) => {
    event.preventDefault();
    if (report.autoEnable) {
      updateAutoEnableAndStatus(report.id, false, false)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          loadReports(currentPage);
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("關閉自動上架狀態時出錯");
        });
    }

    saveEditedReport(report.id);

    window.location.href = titleLink.href;
  };
  titleCell.appendChild(titleLink);
  row.appendChild(titleCell);

  const timeOnCell = document.createElement("td");
  timeOnCell.textContent = report.timeOn;
  row.appendChild(timeOnCell);

  const timeOffCell = document.createElement("td");
  timeOffCell.textContent = report.timeOff;
  row.appendChild(timeOffCell);

  const imageCell = document.createElement("td");
  if (report.image) {
    const img = document.createElement("img");
    img.src = `http://localhost:3001/uploads/reports/${report.image}`;
    imageCell.appendChild(img);
  }
  row.appendChild(imageCell);

  const contextCell = document.createElement("td");
  contextCell.textContent = report.context;
  row.appendChild(contextCell);

  return row;
};

// 置頂報導
const pinReport = async (reportId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(`http://localhost:3001/api/reports/${reportId}/pin`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinned }),
    });
    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadReports(currentPage); // 重新加載報導列表，以反映更改
    } else {
      alert("更新置頂狀態時出錯");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新置頂狀態時出錯");
  }
};

// 加載報導
const loadReports = async (page = 1) => {
  try {
    const response = await fetch(`http://localhost:3001/api/reports?page=${page}&forManagement=true`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
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

    const now = new Date();
    editedReports = JSON.parse(localStorage.getItem("editedReports")) || [];
    editedReports = editedReports.filter((id) => {
      const report = reportsData.find((r) => r.id === id);
      return report && new Date(report.timeOff) > now;
    });
    localStorage.setItem("editedReports", JSON.stringify(editedReports));

    if (editedReports.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";

    for (let i = 1; i <= data.totalPages; i++) {
      const button = document.createElement("button");
      button.textContent = i;
      button.onclick = () => loadReports(i);
      if (i === data.currentPage) {
        button.classList.add("current-page");
      }
      pagination.appendChild(button);
    }
  } catch (error) {
    console.error("Error:", error);
    alert("加載報導時出錯");
  }
};

// 一鍵上架
const publishAll = async () => {
  if (!confirm("您確定要一鍵安排上架所有編輯過的報導嗎？")) {
    return;
  }

  const now = new Date();
  const reportsToPublish = editedReports.filter((id) => {
    const report = reportsData.find((r) => r.id === id);
    return report && new Date(report.timeOff) > now;
  });

  try {
    const response = await fetch("http://localhost:3001/api/reports/schedule-all", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: reportsToPublish, autoEnable: true }),
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const numberOfPublishedReports = reportsToPublish.length;
    editedReports = [];
    localStorage.removeItem("editedReports");
    document.getElementById("publish-all-button").style.display = "none";
    showAlert(`已排定 ${numberOfPublishedReports} 報導自動上架！`);
    loadReports(currentPage);
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
  loadReports(currentPage);

  const eventSource = new EventSource("http://localhost:3001/api/reports/events");

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-report" || data.type === "new-report") {
      loadReports(currentPage);
    }
  };
});
