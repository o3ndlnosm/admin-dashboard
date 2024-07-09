export const updateAutoEnableAndStatus = async (resourceType, resourceId, newAutoEnable, newEnable) => {
    try {
      const response = await fetch(`http://localhost:3001/api/${resourceType}/${resourceId}/enable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
      });
  
      if (!response.ok) throw new Error("Network response was not ok");
  
      console.log("更新成功:", resourceType, resourceId, newAutoEnable, newEnable);
      return response.json();
    } catch (error) {
      console.error("更新失敗:", resourceType, resourceId, newAutoEnable, newEnable, error);
      throw error;
    }
  };
  