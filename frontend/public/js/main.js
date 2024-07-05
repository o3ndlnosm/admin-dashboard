import { loadData, toggleAutoEnable, saveEditedItem, publishAll, showAlert, closeModal } from './modules/eventHandlers.js';

document.addEventListener("DOMContentLoaded", () => {
  const type = document.body.dataset.type;  // 假設你在body標籤上設置了data-type屬性來區分頁面類型

  loadData(1, type);

  const eventSource = new EventSource(`http://localhost:3001/api/${type}/events`);

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === `update-${type}` || data.type === `new-${type}`) {
      loadData(currentPage, type);
    }
  };

  document.getElementById("publish-all-button").onclick = () => publishAll(type);
  document.getElementById("close-modal").onclick = closeModal;
});

window.toggleAutoEnable = toggleAutoEnable;
window.saveEditedItem = saveEditedItem;
window.showAlert = showAlert;
window.closeModal = closeModal;
