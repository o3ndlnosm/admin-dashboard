const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

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

router.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

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

// 讀取影片數據
const readVideos = (callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'videos.json');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                callback(null, []);
            } else {
                callback(err);
            }
        } else {
            try {
                const videos = JSON.parse(data);
                callback(null, videos);
            } catch (parseErr) {
                callback(parseErr);
            }
        }
    });
};

// 寫入影片數據
const writeVideos = (videos, callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'videos.json');
    fs.writeFile(filePath, JSON.stringify(videos, null, 2), callback);
};

// 新增影片
router.post('/', upload.single('image'), (req, res) => {
    const { title, videoLink, timeOn, timeOff } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    const video = {
        id: Date.now().toString(),
        title,
        videoLink,
        image,
        timeOn: timeOn || now.toISOString(),
        timeOff: timeOff || '2038-01-19 00:00:00',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        enable: false,
        autoEnable: false,
        pinned: false
    };

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        videos.push(video);

        writeVideos(videos, (err) => {
            if (err) {
                console.error('Error saving video:', err);
                return res.status(500).json({ success: false, message: '儲存影片時出錯' });
            }

            notifyClients({ type: 'new-video', data: video });

            res.json({ success: true, message: '影片已成功提交並儲存為 JSON 檔案！' });
        });
    });
});

// 獲取所有影片
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const pageSize = 10;
    const forManagement = req.query.forManagement === 'true';

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        if (!forManagement) {
            videos = videos.filter(v => v.enable);
        }

        videos = videos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;   
        const paginatedVideos = videos.slice(startIndex, endIndex);

        res.json({
            currentPage: page,
            totalPages: Math.ceil(videos.length / pageSize),
            videos: paginatedVideos
        });
    });
});

// 獲取單個影片詳情
router.get('/:id', (req, res) => {
    const { id } = req.params;

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        const video = videos.find(v => v.id === id);
        if (!video) {
            return res.status(404).json({ success: false, message: '影片不存在' });
        }

        res.json(video);
    });
});

// 更新影片
router.put('/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, videoLink, timeOn, timeOff, autoEnable } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        let videoIndex = videos.findIndex(v => v.id === id);
        if (videoIndex === -1) {
            return res.status(404).json({ success: false, message: '影片不存在' });
        }

        const updatedVideo = {
            ...videos[videoIndex],
            title,
            videoLink,
            timeOn: timeOn || videos[videoIndex].timeOn,
            timeOff: timeOff || videos[videoIndex].timeOff,
            autoEnable: autoEnable !== undefined ? autoEnable : videos[videoIndex].autoEnable,
            image: image || videos[videoIndex].image,
            updatedAt: now.toISOString()
        };

        if (autoEnable === 'true' && new Date(updatedVideo.timeOn) <= now) {
            updatedVideo.enable = true;
        }

        videos[videoIndex] = updatedVideo;

        writeVideos(videos, (err) => {
            if (err) {
                console.error('Error saving video:', err);
                return res.status(500).json({ success: false, message: '儲存影片時出錯' });
            }

            notifyClients({ type: 'update-video', data: updatedVideo });

            res.json({ success: true, message: '影片已成功更新！' });
        });
    });
});

module.exports = router;
