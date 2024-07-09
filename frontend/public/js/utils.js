export const saveEditedItem = (type, itemId) => {
    const storageKey = `edited${type.charAt(0).toUpperCase() + type.slice(1)}s`;
    let editedItems = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    if (!editedItems.includes(itemId)) {
      editedItems.push(itemId);
      localStorage.setItem(storageKey, JSON.stringify(editedItems));
    }
  };
  export const publishAllItems = async (type, itemsData, editedItems, endpoint, loadItems, showAlert) => {
    const now = new Date();
    const itemsToPublish = editedItems.filter((id) => {
      const item = itemsData.find((i) => i.id === id);
      return item && new Date(item.timeOff) > now;
    });
  
    try {
      const response = await fetch(`http://localhost:3001/api/${endpoint}/schedule-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: itemsToPublish, autoEnable: true }),
      });
      if (!response.ok) throw new Error("Network response was not ok");
  
      const numberOfPublishedItems = itemsToPublish.length;
      editedItems.length = 0; // Clear the array without reassigning
      localStorage.removeItem(`edited${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      document.getElementById("publish-all-button").style.display = "none";
      showAlert(`已排定 ${numberOfPublishedItems} ${type === 'video' ? '影片' : '公告'}自動上架！`, "success");
      loadItems();
    } catch (error) {
      console.error("Error:", error);
      showAlert("一鍵安排上架時出錯", "error");
    }
  };
  