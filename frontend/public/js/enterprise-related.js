let currentPage = 1;

function toggleEnable(announcementId, currentEnable) {
    const newEnable = !currentEnable;
    const action = newEnable ? '上架' : '下架';
    
    if (!confirm(`您確定要${action}這個公告嗎？`)) {
        return; // 用戶取消操作
    }

    fetch(`http://localhost:3001/api/announcements/${announcementId}/enable`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enable: newEnable }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        loadAnnouncements(currentPage); // 重新加載公告列表
    })
    .catch(error => {
        console.error('Error:', error);
        alert('更新上架狀態時出錯');
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
            tbody.innerHTML = ''; // 清空現有的公告

            data.announcements.forEach(announcement => {
                const row = document.createElement('tr');

                const enableCell = document.createElement('td');
                const switchLabel = document.createElement('label');
                switchLabel.classList.add('switch');
                const enableSwitch = document.createElement('input');
                enableSwitch.type = 'checkbox';
                enableSwitch.checked = announcement.enable;
                enableSwitch.onchange = () => toggleEnable(announcement.id, announcement.enable);
                const sliderSpan = document.createElement('span');
                sliderSpan.classList.add('slider');
                switchLabel.appendChild(enableSwitch);
                switchLabel.appendChild(sliderSpan);
                enableCell.appendChild(switchLabel);
                row.appendChild(enableCell);

                const titleCell = document.createElement('td');
                const titleLink = document.createElement('a');
                titleLink.href = `announcement-form.html?id=${announcement.id}`;
                titleLink.textContent = announcement.title;
                titleCell.appendChild(titleLink);
                row.appendChild(titleCell);

                const timeOnCell = document.createElement('td');
                timeOnCell.textContent = announcement.timeOn;
                row.appendChild(timeOnCell);

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

document.addEventListener('DOMContentLoaded', function() {
    loadAnnouncements(currentPage);
});

