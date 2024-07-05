export const renderRow = (item, type) => {
    const now = new Date();
    const timeOnDate = new Date(item.timeOn);
    const timeOffDate = new Date(item.timeOff);
    const isDown = timeOffDate <= now;
    const isCurrentlyUp = timeOnDate <= now && timeOffDate > now;
  
    return `
      <tr>
        <td>
          <label class="switch">
            <input type="checkbox" id="switch-${item.id}" ${item.autoEnable ? 'checked' : ''} onchange="toggleAutoEnable(${item.id}, ${item.autoEnable}, '${item.timeOn}', '${item.timeOff}', ${isDown}, '${type}')">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <span class="status-box ${timeOffDate <= now ? 'status-unpublished' : !item.autoEnable ? 'status-default' : item.autoEnable && timeOnDate > now ? 'status-scheduled' : item.enable && timeOffDate > now ? 'status-published' : ''}">
            ${timeOffDate <= now ? '已下架' : !item.autoEnable ? '未排定自動上架' : item.autoEnable && timeOnDate > now ? '未上架' : item.enable && timeOffDate > now ? '已上架' : ''}
          </span>
          ${(item.enable || (item.autoEnable && timeOnDate > now)) ? `
            <button class="pin-button ${item.pinned ? 'pinned' : ''}" onclick="pinItem(${item.id}, this, '${type}')">
              <i class="fas fa-thumbtack"></i>
            </button>
          ` : ''}
        </td>
        <td>
          <a href="${type}-form.html?id=${item.id}" onclick="saveEditedItem(${item.id}, '${type}')">${item.title}</a>
        </td>
        <td>${item.timeOn}</td>
        <td>${item.timeOff}</td>
        <td>${item.image ? `<img src="http://localhost:3001/uploads/${type}/${item.image}">` : ''}</td>
        <td>${item.context}</td>
      </tr>
    `;
  };
  
  export const renderTable = (data, type) => {
    const tbody = document.getElementById(`${type}-body`);
    tbody.innerHTML = "";
  
    const fragment = document.createDocumentFragment();
    data.forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = renderRow(item, type);
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);
  };
  