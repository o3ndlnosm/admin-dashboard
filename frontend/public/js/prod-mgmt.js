let currentPage = 1;
let editedProducts = JSON.parse(localStorage.getItem("editedProducts")) || [];
let productsData = [];

// 更新自動上架和狀態
const updateAutoEnableAndStatus = async (
  productId,
  newAutoEnable,
  newEnable
) => {
  try {
    const response = await fetch(
      `http://localhost:3001/api/products/${productId}/enable`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
      }
    );

    if (!response.ok) throw new Error("Network response was not ok");

    console.log("更新成功:", productId, newAutoEnable, newEnable);
    showNotification("更新成功", "success");
    return true;
  } catch (error) {
    console.error("更新失敗:", productId, newAutoEnable, newEnable, error);
    showNotification("更新失敗", "error");
    return false;
  }
};
// 切換自動上架狀態
const toggleAutoEnable = async (
  productId,
  currentAutoEnable,
  timeOn,
  timeOff,
  isDown
) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    showNotification("此產品已下架，請重新編輯以重新上架。", "warning");
    document.getElementById(`switch-${productId}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  const newEnable = newAutoEnable ? true : false;

  const success = await updateAutoEnableAndStatus(
    productId,
    newAutoEnable,
    newEnable
  );
  if (success) {
    handleAutoEnableChange(
      productId,
      newAutoEnable,
      isCurrentlyUp,
      now,
      timeOn,
      true
    );
  } else {
    document.getElementById(`switch-${productId}`).checked = currentAutoEnable;
  }
};

// 處理自動上架變更
const handleAutoEnableChange = (
  productId,
  newAutoEnable,
  isCurrentlyUp,
  now,
  timeOn,
  isManualToggle = false
) => {
  if (newAutoEnable) {
    editedProducts = editedProducts.filter((id) => id !== productId);
    localStorage.setItem("editedProducts", JSON.stringify(editedProducts));
  } else if (!isManualToggle) {
    // 只有在不是手動關閉時才保存
    saveEditedProduct(productId);
  }
  loadProducts(currentPage);
  showAlertBasedOnAutoEnable(newAutoEnable, isCurrentlyUp, now, timeOn);
};

// 顯示根據自動上架狀態的提示訊息
const showAlertBasedOnAutoEnable = (
  newAutoEnable,
  isCurrentlyUp,
  now,
  timeOn
) => {
  if (!newAutoEnable && isCurrentlyUp) {
    showNotification("產品已下架", "info");
  } else if (!newAutoEnable && !isCurrentlyUp) {
    showNotification("產品的自動上架功能已關閉", "info");
  } else if (newAutoEnable && new Date(timeOn) <= now) {
    showNotification("產品已立即上架", "success");
  }
};

// 保存已編輯的產品
const saveEditedProduct = (productId) => {
  if (!editedProducts.includes(productId)) {
    editedProducts.push(productId);
    localStorage.setItem("editedProducts", JSON.stringify(editedProducts));
  }
};

// 渲染產品行
const renderProductRow = (product) => {
  const row = document.createElement("tr");

  row.appendChild(createAutoEnableCell(product));
  row.appendChild(createStatusCell(product));
  row.appendChild(createTitleCell(product));
  row.appendChild(createTimeCell(product.timeOn));
  row.appendChild(createTimeCell(product.timeOff));
  row.appendChild(createImageCell(product));

  return row;
};

// 創建自動上架單元格
const createAutoEnableCell = (product) => {
  const autoEnableCell = document.createElement("td");
  const switchLabel = document.createElement("label");
  switchLabel.classList.add("switch");

  const autoEnableSwitch = document.createElement("input");
  autoEnableSwitch.type = "checkbox";
  autoEnableSwitch.checked = product.autoEnable;
  autoEnableSwitch.id = `switch-${product.id}`;

  const now = new Date();
  const timeOnDate = new Date(product.timeOn);
  const timeOffDate = new Date(product.timeOff);
  const isDown = timeOffDate <= now;

  autoEnableSwitch.onchange = () =>
    toggleAutoEnable(
      product.id,
      product.autoEnable,
      product.timeOn,
      product.timeOff,
      isDown
    );

  const sliderSpan = document.createElement("span");
  sliderSpan.classList.add("slider");

  switchLabel.appendChild(autoEnableSwitch);
  switchLabel.appendChild(sliderSpan);
  autoEnableCell.appendChild(switchLabel);

  return autoEnableCell;
};

// 創建狀態單元格
const createStatusCell = (product) => {
  const statusCell = document.createElement("td");
  const statusSpan = document.createElement("span");
  statusSpan.classList.add("status-box");

  const now = new Date();
  const timeOnDate = new Date(product.timeOn);
  const timeOffDate = new Date(product.timeOff);

  if (timeOffDate <= now) {
    statusSpan.classList.add("status-unpublished");
    statusSpan.textContent = " 已下架";
    product.autoEnable = false;
  } else if (!product.autoEnable) {
    statusSpan.classList.add("status-default");
    statusSpan.textContent = " 待確認";
  } else if (product.autoEnable && timeOnDate > now) {
    const formattedDate = formatDate(timeOnDate);
    statusSpan.classList.add("status-scheduled");
    statusSpan.textContent = ` ${formattedDate} 上架`;
  } else if (product.enable && timeOffDate > now) {
    statusSpan.classList.add("status-published");
    statusSpan.textContent = " 上架中";
  }
  statusCell.appendChild(statusSpan);

  if (product.enable || (product.autoEnable && timeOnDate > now)) {
    const pinButton = document.createElement("button");
    pinButton.classList.add("pin-button");
    if (product.pinned) pinButton.classList.add("pinned");

    const pinIcon = document.createElement("i");
    pinIcon.classList.add("fas", "fa-thumbtack");
    pinButton.appendChild(pinIcon);
    pinButton.onclick = () => pinProduct(product.id, pinButton);
    statusCell.appendChild(pinButton);
  }

  return statusCell;
};

// 格式化日期為 mm/dd 格式
const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0"); // 月份從 0 開始，因此需要 +1
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
};

// 創建標題單元格
const createTitleCell = (product) => {
  const titleCell = document.createElement("td");
  const titleLink = document.createElement("a");
  titleLink.href = `prod-form.html?id=${product.id}`;
  titleLink.textContent = product.title;

  titleLink.onclick = async (event) => {
    event.preventDefault();
    try {
      if (product.autoEnable) {
        const success = await updateAutoEnableAndStatus(
          product.id,
          false,
          false
        );
        if (!success) throw new Error("關閉自動上架狀態時出錯");
      }
      saveEditedProduct(product.id);
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
const createImageCell = (product) => {
  const imageCell = document.createElement("td");
  if (product.image) {
    const img = document.createElement("img");
    img.src = `http://localhost:3001/uploads/products/${product.image}`;
    img.alt = product.title;
    imageCell.appendChild(img);
  }
  return imageCell;
};

// 置頂產品
const pinProduct = async (productId, pinButton) => {
  const pinned = !pinButton.classList.contains("pinned");

  try {
    const response = await fetch(
      `http://localhost:3001/api/products/${productId}/pin`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      }
    );

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    if (data.success) {
      pinButton.classList.toggle("pinned", pinned);
      loadProducts(currentPage); // 重新加載產品列表，以反映更改
      showNotification("更新置頂狀態成功", "success");
    } else {
      showNotification("更新置頂狀態時出錯", "error");
    }
  } catch (error) {
    console.error("Error:", error);
    showNotification("更新置頂狀態時出錯", "error");
  }
};

// 加載產品
const loadProducts = async (page = 1) => {
  try {
    const response = await fetch(
      `http://localhost:3001/api/products?page=${page}&forManagement=true`
    );
    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    productsData = data.products;

    const tbody = document.getElementById("products-body");
    const publishAllButton = document.getElementById("publish-all-button");
    tbody.innerHTML = "";

    const fragment = document.createDocumentFragment();
    data.products.forEach((product) => {
      const row = renderProductRow(product);
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);

    updateEditedProducts();

    if (editedProducts.length > 0) {
      publishAllButton.style.display = "block";
    } else {
      publishAllButton.style.display = "none";
    }

    renderPagination(data.totalPages, data.currentPage);
  } catch (error) {
    console.error("Error:", error);
    showNotification("加載產品時出錯", "error");
  }
};

// 更新已編輯產品
const updateEditedProducts = () => {
  const now = new Date();
  editedProducts = JSON.parse(localStorage.getItem("editedProducts")) || [];
  editedProducts = editedProducts.filter((id) => {
    const product = productsData.find((p) => p.id === id);
    return product && new Date(product.timeOff) > now;
  });
  localStorage.setItem("editedProducts", JSON.stringify(editedProducts));
};

// 渲染分頁
const renderPagination = (totalPages, currentPage) => {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.onclick = () => loadProducts(i);
    if (i === currentPage) button.classList.add("current-page");
    pagination.appendChild(button);
  }
};

// 一鍵上架
const publishAll = async () => {
  const now = new Date();
  const productsToPublish = editedProducts.filter((id) => {
    const product = productsData.find((p) => p.id === id);
    return product && new Date(product.timeOff) > now;
  });

  try {
    const response = await fetch(
      "http://localhost:3001/api/products/schedule-all",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: productsToPublish, autoEnable: true }),
      }
    );
    if (!response.ok) throw new Error("Network response was not ok");

    const numberOfPublishedProducts = productsToPublish.length;
    editedProducts = [];
    localStorage.removeItem("editedProducts");
    document.getElementById("publish-all-button").style.display = "none";
    showNotification(
      `已排定 ${numberOfPublishedProducts} 產品自動上架！`,
      "success"
    );
    loadProducts(currentPage);
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
    existingNotification.classList.remove("show");
    setTimeout(() => existingNotification.remove(), 500);
  }

  // 創建新的通知
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // 延時顯示動畫
  setTimeout(() => notification.classList.add("show"), 10);

  // 延時移除通知
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 500); // 等待動畫結束再移除
  }, 3000);
};

// DOM 加載後初始化
document.addEventListener("DOMContentLoaded", () => {
  loadProducts(currentPage);

  const eventSource = new EventSource(
    "http://localhost:3001/api/products/events"
  );

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === "update-product" || data.type === "new-product") {
      loadProducts(currentPage);
    }
  };
});
