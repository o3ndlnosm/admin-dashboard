const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 設置multer以處理封面縮圖上傳
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

// 處理公告提交
router.post('/', upload.single('image'), (req, res) => {
    const { id, title, context, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;

    const announcement = {
        id: id || Date.now().toString(),
        title,
        context,
        image,
        timeOn: timeOn || new Date().toISOString(),
        timeOff: timeOff || '2038-01-19 00:00:00',
        hyperlink: hyperlink || 'NIL',
        priority: 0,
        enable: true,
        editTime: new Date().toISOString() // 新增編輯時間
    };

    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');

    ensureDirectoryExistence(filePath);

    fs.readFile(filePath, (err, data) => {
        let announcements = [];
        if (!err) {
            try {
                announcements = JSON.parse(data);
            } catch (e) {
                return res.status(500).json({ success: false, message: '解析公告數據時出錯' });
            }
        } else if (err.code === 'ENOENT') {
            // 如果文件不存在，初始化一個空數組
            announcements = [];
        } else {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        announcements.push(announcement);

        fs.writeFile(filePath, JSON.stringify(announcements, null, 2), (err) => {
            if (err) {
                console.error('Error saving announcement:', err);
                return res.status(500).json({ success: false, message: '儲存公告時出錯' });
            }

            res.json({ success: true, message: '公告已成功提交並儲存為 JSON 檔案！' });
        });
    });
});

// 處理獲取單一公告數據的請求
router.get('/:id', (req, res) => {
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    const { id } = req.params;

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 如果文件不存在，返回 404
                return res.status(404).json({ success: false, message: '公告不存在' });
            } else {
                console.error('Error reading announcements:', err);
                return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
            }
        }

        try {
            const announcements = JSON.parse(data);
            const announcement = announcements.find(a => a.id === id);
            if (!announcement) {
                return res.status(404).json({ success: false, message: '公告不存在' });
            }
            res.json(announcement);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            return res.status(500).json({ success: false, message: '解析公告數據時出錯' });
        }
    });
});

// 處理公告更新
router.put('/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, context, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;

    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');

    fs.readFile(filePath, (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取公告數據時出錯' });
        }

        try {
            let announcements = JSON.parse(data);
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
                editTime: new Date().toISOString() // 更新編輯時間
            };

            announcements[announcementIndex] = updatedAnnouncement;

            fs.writeFile(filePath, JSON.stringify(announcements, null, 2), (err) => {
                if (err) {
                    console.error('Error saving announcement:', err);
                    return res.status(500).json({ success: false, message: '儲存公告時出錯' });
                }

                res.json({ success: true, message: '公告已成功更新！' });
            });
        } catch (e) {
            console.error('Error parsing JSON:', e);
            return res.status(500).json({ success: false, message: '解析公告數據時出錯' });
        }
    });
});

// 處理獲取公告數據的請求，支援分頁
router.get('/', (req, res) => {
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    const page = parseInt(req.query.page) || 1; // 默認頁碼為1
    const pageSize = 10; // 每頁顯示10條數據

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 如果文件不存在，返回一個空數組
                return res.json([]);
            } else {
                console.error('Error reading announcements:', err);
                return res.status(404).json({ success: false, message: '讀取公告時出錯' });
            }
        }
        try {
            let announcements = JSON.parse(data);
            // 按編輯時間排序，最新的在最上面
            announcements = announcements.sort((a, b) => new Date(b.editTime) - new Date(a.editTime));

            // 分頁處理
            const startIndex = (page - 1) * pageSize;
            const endIndex = page * pageSize;
            const paginatedAnnouncements = announcements.slice(startIndex, endIndex);

            res.json({
                currentPage: page,
                totalPages: Math.ceil(announcements.length / pageSize),
                announcements: paginatedAnnouncements
            });
        } catch (e) {
            console.error('Error parsing JSON:', e);
            return res.status(500).json({ success: false, message: '解析公告數據時出錯' });
        }
    });
});

module.exports = router;
