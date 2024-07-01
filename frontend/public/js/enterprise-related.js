let currentPage = 1;

function toggleAutoEnable(announcementId, currentAutoEnable, timeOff, isDown) {
    if (isDown) {
        alert('此公告已下架，請重新編輯文章以重新上架。');
        // 重新設置開關狀態以保持一致
        document.getElementById(`switch-${announcementId}`).checked = false;
        return; // 已下架的公告不允許重新開啟自動上架
    }

    const newAutoEnable = !currentAutoEnable;
    const action = newAutoEnable ? '開啟自動上架' : '關閉自動上架';
    
    if (!confirm(`您確定要${action}這個公告嗎？`)) {
        // 重新設置開關狀態以保持一致
        document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
        return; // 用戶取消操作
    }

    fetch(`http://localhost:3001/api/announcements/${announcementId}/enable`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enable: newAutoEnable }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        loadAnnouncements(currentPage); // 重新加載公告列表
    })
    .catch(error => {
        console.error('Error:', error);
        alert('更新自動上架狀態時出錯');
        // 重新設置開關狀態以保持一致
        document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
    });
}

function loadAnnouncements(page = 1) {
    fetch(`http://localhost:3001/api/announcements?page=${page}&forManagement=true`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const tbody = document.getElementById('announcements-body');
            const publishAllButton = document.getElementById('publish-all-button');
            let hasEdited = false;

            tbody.innerHTML = ''; // 清空現有的公告

            data.announcements.forEach(announcement => {
                if (!announcement.enable && announcement.editTime) {
                    hasEdited = true;
                }

                const row = document.createElement('tr');

                // 上架欄位
                const autoEnableCell = document.createElement('td');
                const switchLabel = document.createElement('label');
                switchLabel.classList.add('switch');
                const autoEnableSwitch = document.createElement('input');
                autoEnableSwitch.type = 'checkbox';
                autoEnableSwitch.checked = announcement.autoEnable;
                autoEnableSwitch.id = `switch-${announcement.id}`;
                const now = new Date();
                const timeOnDate = new Date(announcement.timeOn);
                const timeOffDate = new Date(announcement.timeOff);
                const isDown = timeOffDate <= now;
                autoEnableSwitch.onchange = () => toggleAutoEnable(announcement.id, announcement.autoEnable, announcement.timeOff, isDown);
                const sliderSpan = document.createElement('span');
                sliderSpan.classList.add('slider');
                switchLabel.appendChild(autoEnableSwitch);
                switchLabel.appendChild(sliderSpan);
                autoEnableCell.appendChild(switchLabel);
                row.appendChild(autoEnableCell);

                // 狀態欄位
                const statusCell = document.createElement('td');
                const statusSpan = document.createElement('span');
                statusSpan.classList.add('status-box');

                if (timeOffDate <= now) {
                    statusSpan.classList.add('status-unpublished');
                    statusSpan.textContent = " 已下架";
                    announcement.autoEnable = false; // 自動將公告下架
                } else if (!announcement.autoEnable) {
                    statusSpan.classList.add('status-default');
                    statusSpan.textContent = " 未排定自動上架";
                } else if (announcement.autoEnable && timeOnDate > now) {
                    statusSpan.classList.add('status-scheduled');
                    statusSpan.textContent = " 未上架";
                } else if (announcement.enable && timeOffDate > now) {
                    statusSpan.classList.add('status-published');
                    statusSpan.textContent = " 已上架";
                }
                statusCell.appendChild(statusSpan);
                row.appendChild(statusCell);

                // 公告標題欄位
                const titleCell = document.createElement('td');
                const titleLink = document.createElement('a');
                titleLink.href = `announcement-form.html?id=${announcement.id}`;
                titleLink.textContent = announcement.title;
                titleLink.onclick = () => {
                    // 在編輯公告時，自動關閉自動上架功能
                    if (announcement.autoEnable) {
                        fetch(`http://localhost:3001/api/announcements/${announcement.id}/enable`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ enable: false }),
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            loadAnnouncements(currentPage); // 重新加載公告列表
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            alert('關閉自動上架狀態時出錯');
                        });
                    }
                };
                titleCell.appendChild(titleLink);
                row.appendChild(titleCell);

                // 上架時間欄位
                const timeOnCell = document.createElement('td');
                timeOnCell.textContent = announcement.timeOn;
                row.appendChild(timeOnCell);

                // 下架時間欄位
                const timeOffCell = document.createElement('td');
                timeOffCell.textContent = announcement.timeOff;
                row.appendChild(timeOffCell);

                const imageCell = document.createElement('td');
                if (announcement.image) {
                    const img = document.createElement('img');
                    img.src = `http://localhost:3001/uploads/${announcement.image}`;
                    imageCell.appendChild(img);
                }
                row.appendChild(imageCell);

                tbody.appendChild(row);
            });

            if (hasEdited) {
                publishAllButton.style.display = 'block';
            } else {
                publishAllButton.style.display = 'none';
            }

            const pagination = document.getElementById('pagination');
            pagination.innerHTML = ''; // 清空現有的分頁按鈕

            for (let i = 1; i <= data.totalPages; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                button.onclick = () => loadAnnouncements(i);
                if (i === data.currentPage) {
                    button.classList.add('current-page');
                }
                pagination.appendChild(button);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('加載公告時出錯');
        });
}

function publishAll() {
    if (!confirm('您確定要一鍵上架所有編輯過的公告嗎？')) {
        return; // 用戶取消操作
    }

    fetch('http://localhost:3001/api/announcements/enable-all', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        loadAnnouncements(currentPage); // 重新加載公告列表
    })
    .catch(error => {
        console.error('Error:', error);
        alert('一鍵上架時出錯');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadAnnouncements(currentPage);
});

