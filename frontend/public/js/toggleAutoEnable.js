// toggleAutoEnable.js

import { updateAutoEnableAndStatus, showAlert, saveEditedItem } from './utils.js';

export const toggleAutoEnable = async (type, id, currentAutoEnable, timeOn, timeOff, isDown, loadItems) => {
  const now = new Date();
  const isCurrentlyUp = new Date(timeOn) <= now && new Date(timeOff) > now;

  if (isDown) {
    alert(`此 ${type} 已下架，請重新編輯以重新上架。`);
    document.getElementById(`switch-${id}`).checked = false;
    return;
  }

  const newAutoEnable = !currentAutoEnable;
  let action, additionalMessage;

  if (newAutoEnable) {
    action = `開啟自動上架`;
    additionalMessage = new Date(timeOn) <= now
      ? `此 ${type} 的上架時間已到，開啟自動上架功能將立即上架此 ${type}，是否繼續？`
      : `開啟自動上架功能將在上架時間到達時自動上架此 ${type}，是否繼續？`;
  } else {
    action = `關閉自動上架`;
    additionalMessage = isCurrentlyUp
      ? `此 ${type} 目前已上架，關閉自動上架功能將會下架此 ${type}，是否繼續？`
      : `此 ${type} 目前尚未上架，關閉自動上架功能將取消其自動上架，是否繼續？`;
  }

  if (!confirm(`${action} ${additionalMessage}`)) {
    document.getElementById(`switch-${id}`).checked = currentAutoEnable;
    return;
  }

  const newEnable = newAutoEnable ? true : false;

  try {
    const success = await updateAutoEnableAndStatus(type, id, newAutoEnable, newEnable);
    if (success) {
      loadItems();
      if (!newAutoEnable && isCurrentlyUp) {
        showAlert(`${type} 已下架`);
      } else if (!newAutoEnable && !isCurrentlyUp) {
        showAlert(`${type} 的自動上架功能已關閉`);
      } else if (newAutoEnable && new Date(timeOn) <= now) {
        showAlert(`${type} 已立即上架`);
      }
    } else {
      throw new Error("Network response was not ok");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("更新自動上架狀態時出錯");
    document.getElementById(`switch-${id}`).checked = currentAutoEnable;
  }
};
