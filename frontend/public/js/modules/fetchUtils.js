export const fetchData = async (url, options) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return await response.json();
    } catch (error) {
      console.error("Error:", error);
      alert("發送請求時出錯");
      return null;
    }
  };
  
  export const updateAutoEnableAndStatus = async (id, newAutoEnable, newEnable, type) => {
    const url = `http://localhost:3001/api/${type}/${id}/enable`;
    const options = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ autoEnable: newAutoEnable, enable: newEnable }),
    };
    return await fetchData(url, options);
  };
  
  export const pinItem = async (id, pinned, type) => {
    const url = `http://localhost:3001/api/${type}/${id}/pin`;
    const options = {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pinned }),
    };
    return await fetchData(url, options);
  };
  