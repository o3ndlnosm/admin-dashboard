const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');

// 設置 multer 以處理封面縮圖上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/videos/';
        ensureDirectoryExistence(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage, limits: { fieldSize: 25 * 1024 * 1024 } });

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

// 定時任務檢查和更新影片狀態
cron.schedule('* * * * *', () => { // 每分鐘檢查一次
    readVideos((err, videos) => {
        if (err) {
            console.error('Error reading videos:', err);
            return;
        }

        const now = new Date();
        let updated = false;

        videos = videos.map(video => {
            let changed = false;
            if (new Date(video.timeOn) <= now && video.autoEnable && !video.enable) {
                video.enable = true;
                changed = true;
            }
            if (new Date(video.timeOff) <= now && video.enable) {
                video.enable = false;
                video.autoEnable = false; // 更新 autoEnable 狀態
                changed = true;
            }
            if (changed) {
                video.updatedAt = now.toISOString();
                updated = true;
                notifyClients({ type: 'update-video', data: video });
            }
            return video;
        });

        if (updated) {
            writeVideos(videos, (err) => {
                if (err) {
                    console.error('Error saving videos:', err);
                } else {
                    console.log('Videos updated based on schedule.');
                }
            });
        }
    });
});

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

// 處理影片上下架狀態切換
router.patch('/:id/enable', (req, res) => {
    const { id } = req.params;
    const { autoEnable, enable } = req.body;

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        let videoIndex = videos.findIndex(v => v.id === id);
        if (videoIndex === -1) {
            return res.status(404).json({ success: false, message: '影片不存在' });
        }

        videos[videoIndex].autoEnable = autoEnable;
        videos[videoIndex].enable = enable;

        writeVideos(videos, (err) => {
            if (err) {
                console.error('Error updating video autoEnable status:', err);
                return res.status(500).json({ success: false, message: '更新影片自動上架狀態時出錯' });
            }

            notifyClients({ type: 'update-video', data: videos[videoIndex] });

            res.json({ success: true, message: '影片自動上架狀態已更新！' });
        });
    });
});

// 處理一鍵安排上架請求
router.patch('/schedule-all', (req, res) => {
    const { ids, autoEnable } = req.body;
    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        let updated = false;
        const now = new Date();

        videos = videos.map(video => {
            if (ids.includes(video.id)) {
                video.autoEnable = autoEnable; // 設置自動上架
                if (new Date(video.timeOn) <= now) {
                    video.enable = true;
                }
                updated = true;
            }
            return video;
        });

        if (updated) {
            writeVideos(videos, (err) => {
                if (err) {
                    console.error('Error saving videos:', err);
                    return res.status(500).json({ success: false, message: '儲存影片時出錯' });
                }

                // 發送 SSE 通知
                videos.forEach(video => {
                    if (ids.includes(video.id)) {
                        notifyClients({ type: 'update-video', data: video });
                    }
                });

                res.json({ success: true, message: '所有影片已排定自動上架！' });
            });
        } else {
            res.json({ success: true, message: '沒有影片需要更新。' });
        }
    });
});

// 處理影片置頂狀態切換
router.patch('/:id/pin', (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        let videoIndex = videos.findIndex(v => v.id === id);
        if (videoIndex === -1) {
            return res.status(404).json({ success: false, message: '影片不存在' });
        }

        videos[videoIndex].pinned = pinned;

        writeVideos(videos, (err) => {
            if (err) {
                console.error('Error updating video pinned status:', err);
                return res.status(500).json({ success: false, message: '更新影片置頂狀態時出錯' });
            }

            notifyClients({ type: 'update-video', data: videos[videoIndex] });

            res.json({ success: true, message: '影片置頂狀態已更新！' });
        });
    });
});

module.exports = router;
