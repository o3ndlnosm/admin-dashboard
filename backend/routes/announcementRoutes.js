const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');

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
const ensureDirectoryExistence = async (filePath) => {
    const dirname = path.dirname(filePath);
    try {
        await fs.access(dirname);
    } catch {
        await fs.mkdir(dirname, { recursive: true });
    }
};

// SSE 客戶端連接數組
let clients = [];

// SSE 端點
router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // 立即發送標頭

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

// 通知所有 SSE 客戶端
const notifyClients = (data) => {
    clients.forEach(client => client.write(`data: ${JSON.stringify(data)}\n\n`));
};

// 讀取公告數據
const readAnnouncementsFromFile = async (filePath) => {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        } else {
            throw new Error('讀取公告數據時出錯');
        }
    }
};

// 保存公告數據
const writeAnnouncementsToFile = async (filePath, announcements) => {
    try {
        await fs.writeFile(filePath, JSON.stringify(announcements, null, 2));
    } catch (err) {
        throw new Error('儲存公告數據時出錯');
    }
};

// 定時任務檢查和更新公告狀態
cron.schedule('* * * * *', async () => { // 每分鐘檢查一次
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    try {
        let announcements = await readAnnouncementsFromFile(filePath);
        const now = new Date();

        let updated = false;
        announcements = announcements.map(announcement => {
            let changed = false;
            if (new Date(announcement.timeOn) <= now && !announcement.enable) {
                announcement.enable = true;
                changed = true;
            }
            if (new Date(announcement.timeOff) <= now && announcement.enable) {
                announcement.enable = false;
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
            await writeAnnouncementsToFile(filePath, announcements);
            console.log('公告狀態已更新');
        }
    } catch (err) {
        console.error('Error updating announcements:', err.message);
    }
});

// 處理公告提交
router.post('/', upload.single('image'), async (req, res) => {
    const { id, title, context, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;

    const announcement = {
        id: id || Date.now().toString(),
        title,
        context,
        image,
        timeOn: timeOn || new Date().toISOString(),
        timeOff: timeOff || '2038-01-19T00:00:00Z',
        hyperlink: hyperlink || 'NIL',
        priority: 0,
        enable: false, // 新增時預設為下架狀態
        editTime: new Date().toISOString() // 新增編輯時間
    };

    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');

    try {
        await ensureDirectoryExistence(filePath);
        const announcements = await readAnnouncementsFromFile(filePath);

        announcements.push(announcement);
        await writeAnnouncementsToFile(filePath, announcements);

        notifyClients({ type: 'new-announcement', data: announcement });
        res.json({ success: true, message: '公告已成功提交並儲存為 JSON 檔案！' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 處理獲取單一公告數據的請求
router.get('/:id', async (req, res) => {
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    const { id } = req.params;

    try {
        const announcements = await readAnnouncementsFromFile(filePath);
        const announcement = announcements.find(a => a.id === id);
        if (!announcement) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }

        // 自動將公告下架
        announcement.enable = false;
        announcement.editTime = new Date().toISOString();

        await writeAnnouncementsToFile(filePath, announcements);

        notifyClients({ type: 'update-announcement', data: announcement });

        res.json(announcement);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 處理公告更新
router.put('/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { title, context, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;

    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');

    try {
        const announcements = await readAnnouncementsFromFile(filePath);
        const announcementIndex = announcements.findIndex(a => a.id === id);
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
        await writeAnnouncementsToFile(filePath, announcements);

        notifyClients({ type: 'update-announcement', data: updatedAnnouncement });

        res.json({ success: true, message: '公告已成功更新！' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 處理公告上下架狀態切換
router.patch('/:id/enable', async (req, res) => {
    const { id } = req.params;
    const { enable } = req.body;

    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');

    try {
        const announcements = await readAnnouncementsFromFile(filePath);
        const announcementIndex = announcements.findIndex(a => a.id === id);
        if (announcementIndex === -1) {
            return res.status(404).json({ success: false, message: '公告不存在' });
        }

        announcements[announcementIndex].enable = enable;
        await writeAnnouncementsToFile(filePath, announcements);

        notifyClients({ type: 'update-announcement', data: announcements[announcementIndex] });

        res.json({ success: true, message: '公告上下架狀態已更新！' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 處理獲取公告數據的請求，支援分頁
router.get('/', async (req, res) => {
    const filePath = path.join(__dirname, '..', 'data', 'businessNews.json');
    const page = parseInt(req.query.page) || 1; // 默認頁碼為1
    const pageSize = 10; // 每頁顯示10條數據
    const forManagement = req.query.forManagement === 'true'; // 是否為管理頁面請求

    try {
        let announcements = await readAnnouncementsFromFile(filePath);

        // 如果不是管理頁面請求，過濾已下架的公告
        if (!forManagement) {
            announcements = announcements.filter(a => a.enable);
        }

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
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: '解析公告數據時出錯' });
    }
});

module.exports = router;
