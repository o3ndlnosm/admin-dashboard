let currentPage = 1;
let editedAnnouncements = JSON.parse(localStorage.getItem('editedAnnouncements')) || []; // 紀錄被編輯的公告ID
let announcementsData = []; // 儲存公告數據的全局變量

const updateAutoEnable = (announcementId, newAutoEnable) => {
    return fetch(`http://localhost:3001/api/announcements/${announcementId}/enable`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enable: newAutoEnable }),
    });
};

const toggleAutoEnable = (announcementId, currentAutoEnable, timeOn, timeOff, isDown) => {
    console.log(`toggleAutoEnable - ID: ${announcementId}, Current: ${currentAutoEnable}, IsDown: ${isDown}`);
    if (isDown) {
        alert('此公告已下架，請重新編輯文章以重新上架。');
        document.getElementById(`switch-${announcementId}`).checked = false;
        return;
    }

    const newAutoEnable = !currentAutoEnable;
    const action = newAutoEnable ? '開啟自動上架' : '關閉自動上架';

    if (!confirm(`您確定要${action}這個公告嗎？`)) {
        document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
        return;
    }

    updateAutoEnable(announcementId, newAutoEnable)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            loadAnnouncements(currentPage);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('更新自動上架狀態時出錯');
            document.getElementById(`switch-${announcementId}`).checked = currentAutoEnable;
        });
};

const renderAnnouncementRow = (announcement) => {
    const row = document.createElement('tr');

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
    autoEnableSwitch.onchange = () => toggleAutoEnable(announcement.id, announcement.autoEnable, announcement.timeOn, announcement.timeOff, isDown);
    const sliderSpan = document.createElement('span');
    sliderSpan.classList.add('slider');
    switchLabel.appendChild(autoEnableSwitch);
    switchLabel.appendChild(sliderSpan);
    autoEnableCell.appendChild(switchLabel);
    row.appendChild(autoEnableCell);

    const statusCell = document.createElement('td');
    const statusSpan = document.createElement('span');
    statusSpan.classList.add('status-box');

    if (timeOffDate <= now) {
        statusSpan.classList.add('status-unpublished');
        statusSpan.textContent = " 已下架";
        announcement.autoEnable = false;
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

    const titleCell = document.createElement('td');
    const titleLink = document.createElement('a');
    titleLink.href = `announcement-form.html?id=${announcement.id}`;
    titleLink.textContent = announcement.title;
    titleLink.onclick = (event) => {
        event.preventDefault();
        console.log(`Editing announcement - ID: ${announcement.id}`);
        if (announcement.autoEnable) {
            updateAutoEnable(announcement.id, false)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    loadAnnouncements(currentPage);
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('關閉自動上架狀態時出錯');
                });
        }

        if (!editedAnnouncements.includes(announcement.id)) {
            editedAnnouncements.push(announcement.id);
            localStorage.setItem('editedAnnouncements', JSON.stringify(editedAnnouncements));
            console.log('被編輯的公告ID (增加後):', editedAnnouncements);
        } else {
            console.log('被編輯的公告ID (已存在):', editedAnnouncements);
        }

        window.location.href = titleLink.href;
    };
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

    return row;
};

const loadAnnouncements = (page = 1) => {
    console.log(`loadAnnouncements - Page: ${page}`);
    fetch(`http://localhost:3001/api/announcements?page=${page}&forManagement=true`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            announcementsData = data.announcements;
            console.log('Announcements data loaded:', data);
            const tbody = document.getElementById('announcements-body');
            const publishAllButton = document.getElementById('publish-all-button');
            tbody.innerHTML = '';

            data.announcements.forEach(announcement => {
                console.log(`Processing announcement - ID: ${announcement.id}`);
                const row = renderAnnouncementRow(announcement);
                tbody.appendChild(row);
            });

            if (editedAnnouncements.length > 0) {
                publishAllButton.style.display = 'block';
            } else {
                publishAllButton.style.display = 'none';
            }

            console.log(`publishAllButton display style: ${publishAllButton.style.display}`);

            const pagination = document.getElementById('pagination');
            pagination.innerHTML = '';

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
};

const publishAll = () => {
    if (!confirm('您確定要一鍵安排上架所有編輯過的公告嗎？')) {
        return;
    }

    const now = new Date().toISOString();
    const announcementsToPublish = editedAnnouncements.filter(id => {
        const announcement = announcementsData.find(a => a.id === id);
        return announcement && new Date(announcement.timeOn) <= new Date(now);
    });

    fetch('http://localhost:3001/api/announcements/schedule-all', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: announcementsToPublish }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        console.log('Publish all successful');
        editedAnnouncements = [];
        localStorage.removeItem('editedAnnouncements');
        document.getElementById('publish-all-button').style.display = 'none';
        console.log('publish-all-button hidden');
        loadAnnouncements(currentPage);
    })
    .catch(error => {
        console.error('Error:', error);
        alert('一鍵安排上架時出錯');
    });
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded');
    loadAnnouncements(currentPage);
});
