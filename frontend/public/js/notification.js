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
  