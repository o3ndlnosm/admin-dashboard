const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');

// 設置 multer 以處理封面縮圖上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage, limits: { fieldSize: 25 * 1024 * 1024 } });

// 確保文件夾存在
const ensureDirectoryExistence = (filePath) => {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
};

// SSE 客戶端連接數組
const clients = new Set();

// SSE 端點
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // 立即發送標頭

    clients.add(res);

    req.on('close', () => {
        clients.delete(res);
    });
});

// 通知所有 SSE 客戶端
const notifyClients = (data) => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => client.write(message));
};

// 讀取公告數據
const readAnnouncements = (callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                callback(null, []);
            } else {
                callback(err);
            }
        } else {
            try {
                const announcements = JSON.parse(data);
                callback(null, announcements);
            } catch (parseErr) {
                callback(parseErr);
            }
        }
    });
};

// 寫入公告數據
const writeAnnouncements = (announcements, callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    fs.writeFile(filePath, JSON.stringify(announcements, null, 2), callback);
};

// 定時任務檢查和更新公告狀態
cron.schedule('* * * * *', () => { // 每分鐘檢查一次
    readAnnouncements((err, announcements) => {
        if (err) {
            console.error('Error reading announcements:', err);
            return;
        }

        const now = new Date();
        let updated = false;

        announcements = announcements.map(announcement => {
            let changed = false;
            if (new Date(announcement.timeOn) <= now && announcement.autoEnable && !announcement.enable) {
                announcement.enable = true;
                changed = true;
            }
            if (new Date(announcement.timeOff) <= now && announcement.enable) {
                announcement.enable = false;
                announcement.autoEnable = false; // 更新 autoEnable 狀態
                changed = true;
            }
            if (changed) {
                announcement.editTime = now.toISOString();
                updated = true;
                notifyClients({ type: 'update-announcement', data: announcement });
            }
            return announcement;
        });

        if (updated) {
            writeAnnouncements(announcements, (err) => {
                if (err) {
                    console.error('Error saving announcements:', err);
                } else {
                    console.log('Announcements updated based on schedule.');
                }
            });
        }
    });
});

// 處理公告提交
router.post('/', upload.single('image'), (req, res) => {
    const { id, title, context, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    const announcement = {
        id: id || Date.now().toString(),
        title,
        context,
        image,
        timeOn: timeOn || now.toISOString(),
        timeOff: timeOff || '2038-01-19 00:00:00',
        hyperlink: hyperlink || 'NIL',
        priority: 0,
        enable: false, // 新增時預設為下架狀態
        autoEnable: false, // 新增時預設不自動上架
        editTime: now.toISOString(), // 新增編輯時間
        pinned: false // 新增時預設不置頂
    };

    ensureDirectoryExistence(path.join(__dirname, '..', 'data', 'businessNews.json'));

    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        announcements.push(announcement);

        writeAnnouncements(announcements, (err) => {
            if (err) {
                console.error('Error saving announcement:', err);
                return res.status(500).json({ success: false, message: '儲存公告時出錯' });
            }

            notifyClients({ type: 'new-announcement', data: announcement });

            res.json({ success: true, message: '公告已成功提交並儲存為 JSON 檔案！' });
        });
    });
});

// 處理獲取單一公告數據的請求
router.get('/:id', (req, res) => {
    const { id } = req.params;

    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        const announcement = announcements.find(a => a.id === id);
        if (!announcement) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }

        // 自動將公告下架
        announcement.enable = false;
        announcement.editTime = new Date().toISOString();

        writeAnnouncements(announcements, (err) => {
            if (err) {
                console.error('Error updating announcement status:', err);
                return res.status(500).json({ success: false, message: '更新公告狀態時出錯' });
            }

            notifyClients({ type: 'update-announcement', data: announcement });

            res.json(announcement);
        });
    });
});

// 處理公告更新
router.put('/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, context, timeOn, timeOff, hyperlink, autoEnable } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        let announcementIndex = announcements.findIndex(a => a.id === id);
        if (announcementIndex === -1) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }

        const updatedAnnouncement = {
            ...announcements[announcementIndex],
            title,
            context,
            timeOn: timeOn || announcements[announcementIndex].timeOn,
            timeOff: timeOff || announcements[announcementIndex].timeOff,
            hyperlink: hyperlink || announcements[announcementIndex].hyperlink,
            image: image || announcements[announcementIndex].image,
            autoEnable: autoEnable !== undefined ? autoEnable : announcements[announcementIndex].autoEnable, // 更新自動上架狀態
            editTime: now.toISOString() // 更新編輯時間
        };

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (autoEnable === 'true' && new Date(updatedAnnouncement.timeOn) <= now) {
            updatedAnnouncement.enable = true;
        }

        announcements[announcementIndex] = updatedAnnouncement;

        writeAnnouncements(announcements, (err) => {
            if (err) {
                console.error('Error saving announcement:', err);
                return res.status(500).json({ success: false, message: '儲存公告時出錯' });
            }

            notifyClients({ type: 'update-announcement', data: updatedAnnouncement });

            res.json({ success: true, message: '公告已成功更新！' });
        });
    });
});

// 處理公告上下架狀態切換
router.patch('/:id/enable', (req, res) => {
    const { id } = req.params;
    const { enable } = req.body;

    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        let announcementIndex = announcements.findIndex(a => a.id === id);
        if (announcementIndex === -1) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }

        announcements[announcementIndex].autoEnable = enable;

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (enable && new Date(announcements[announcementIndex].timeOn) <= new Date()) {
            announcements[announcementIndex].enable = true;
        } else if (!enable && announcements[announcementIndex].enable) {
            // 當關閉自動上架且公告已上架時，將其下架
            announcements[announcementIndex].enable = false;
            announcements[announcementIndex].pinned = false; // 下架時取消置頂
        }

        writeAnnouncements(announcements, (err) => {
            if (err) {
                console.error('Error updating announcement autoEnable status:', err);
                return res.status(500).json({ success: false, message: '更新公告自動上架狀態時出錯' });
            }

            notifyClients({ type: 'update-announcement', data: announcements[announcementIndex] });

            res.json({ success: true, message: '公告自動上架狀態已更新！' });
        });
    });
});

// 處理一鍵安排上架請求
router.patch('/schedule-all', (req, res) => {
    const { ids, autoEnable } = req.body;
    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        let updated = false;
        const now = new Date();

        announcements = announcements.map(announcement => {
            if (ids.includes(announcement.id)) {
                announcement.autoEnable = autoEnable; // 設置自動上架
                // 如果上架時間已到，設置為已上架
                if (new Date(announcement.timeOn) <= now) {
                    announcement.enable = true;
                }
                updated = true;
            }
            return announcement;
        });

        if (updated) {
            writeAnnouncements(announcements, (err) => {
                if (err) {
                    console.error('Error saving announcements:', err);
                    return res.status(500).json({ success: false, message: '儲存公告時出錯' });
                }

                // 發送 SSE 通知
                announcements.forEach(announcement => {
                    if (ids.includes(announcement.id)) {
                        notifyClients({ type: 'update-announcement', data: announcement });
                    }
                });

                res.json({ success: true, message: '所有公告已排定自動上架！' });
            });
        } else {
            res.json({ success: true, message: '沒有公告需要更新。' });
        }
    });
});

// 處理公告置頂狀態切換
router.patch('/:id/pin', (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;

    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        let announcementIndex = announcements.findIndex(a => a.id === id);
        if (announcementIndex === -1) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }

        announcements[announcementIndex].pinned = pinned;

        writeAnnouncements(announcements, (err) => {
            if (err) {
                console.error('Error updating announcement pinned status:', err);
                return res.status(500).json({ success: false, message: '更新公告置頂狀態時出錯' });
            }

            notifyClients({ type: 'update-announcement', data: announcements[announcementIndex] });

            res.json({ success: true, message: '公告置頂狀態已更新！' });
        });
    });
});

// 處理獲取公告數據的請求，支援分頁
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1; // 默認頁碼為 1
    const pageSize = 10; // 每頁顯示 10 條數據
    const forManagement = req.query.forManagement === 'true'; // 是否為管理頁面請求

    readAnnouncements((err, announcements) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        // 如果不是管理頁面請求，過濾已下架的公告
        if (!forManagement) {
            announcements = announcements.filter(a => a.enable);
        }

        // 按置頂和編輯時間排序，置頂的在最上面，然後最新的在最上面
        announcements = announcements.sort((a, b) => {
            if (a.pinned === b.pinned) {
                return new Date(b.editTime) - new Date(a.editTime);
            }
            return b.pinned - a.pinned;
        });

        // 分頁處理
        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;
        const paginatedAnnouncements = announcements.slice(startIndex, endIndex);

        res.json({
            currentPage: page,
            totalPages: Math.ceil(announcements.length / pageSize),
            announcements: paginatedAnnouncements
        });
    });
});

module.exports = router;
