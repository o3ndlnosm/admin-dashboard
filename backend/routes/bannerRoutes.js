const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');

// 設置 multer 以處理 Banner 圖片上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'banners');
        ensureDirectoryExistence(dir);
        cb(null, dir);
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

// 上傳圖片並返回 URL
router.post('/upload/banner', upload.single('upload'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ uploaded: false, error: 'No file uploaded' });
    }
    const filePath = `/uploads/banners/${req.file.filename}`;
    res.json({ uploaded: true, url: filePath });
});

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

// 讀取 Banner 數據
const readBanners = (callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'banners.json');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                callback(null, []);
            } else {
                callback(err);
            }
        } else {
            try {
                const banners = JSON.parse(data);
                callback(null, banners);
            } catch (parseErr) {
                callback(parseErr);
            }
        }
    });
};

// 寫入 Banner 數據
const writeBanners = (banners, callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'banners.json');
    fs.writeFile(filePath, JSON.stringify(banners, null, 2), callback);
};

// 定時任務檢查和更新 Banner 狀態
cron.schedule('* * * * *', () => { // 每分鐘檢查一次
    readBanners((err, banners) => {
        if (err) {
            console.error('Error reading banners:', err);
            return;
        }

        const now = new Date();
        let updated = false;

        banners = banners.map(banner => {
            let changed = false;
            if (new Date(banner.timeOn) <= now && banner.autoEnable && !banner.enable) {
                banner.enable = true;
                changed = true;
            }
            if (new Date(banner.timeOff) <= now && banner.enable) {
                banner.enable = false;
                banner.autoEnable = false; // 更新 autoEnable 狀態
                changed = true;
            }
            if (changed) {
                banner.editTime = now.toISOString();
                updated = true;
                notifyClients({ type: 'update-banner', data: banner });
            }
            return banner;
        });

        if (updated) {
            writeBanners(banners, (err) => {
                if (err) {
                    console.error('Error saving banners:', err);
                } else {
                    console.log('Banners updated based on schedule.');
                }
            });
        }
    });
});

// 處理 Banner 提交
router.post('/', upload.single('image'), (req, res) => {
    const { id, title, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? `/uploads/banners/${req.file.filename}` : null;
    const now = new Date();

    const banner = {
        id: id || Date.now().toString(),
        title,
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

    ensureDirectoryExistence(path.join(__dirname, '..', 'data', 'banners.json'));

    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        banners.push(banner);

        writeBanners(banners, (err) => {
            if (err) {
                console.error('Error saving banner:', err);
                return res.status(500).json({ success: false, message: '儲存 Banner 時出錯' });
            }

            notifyClients({ type: 'new-banner', data: banner });

            res.json({ success: true, message: 'Banner 已成功提交並儲存為 JSON 檔案！' });
        });
    });
});

// 處理獲取單一 Banner 數據的請求
router.get('/:id', (req, res) => {
    const { id } = req.params;

    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        const banner = banners.find(r => r.id === id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner 不存在' });
        }

        res.json(banner);
    });
});

// 處理 Banner 更新
router.put('/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, timeOn, timeOff, hyperlink, autoEnable } = req.body;
    const image = req.file ? `/uploads/banners/${req.file.filename}` : null;
    const now = new Date();

    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        let bannerIndex = banners.findIndex(r => r.id === id);
        if (bannerIndex === -1) {
            return res.status(404).json({ success: false, message: 'Banner 不存在' });
        }

        const updatedBanner = {
            ...banners[bannerIndex],
            title,
            timeOn: timeOn || banners[bannerIndex].timeOn,
            timeOff: timeOff || banners[bannerIndex].timeOff,
            hyperlink: hyperlink || banners[bannerIndex].hyperlink,
            image: image || banners[bannerIndex].image,
            autoEnable: autoEnable !== undefined ? autoEnable : banners[bannerIndex].autoEnable, // 更新自動上架狀態
            editTime: now.toISOString() // 更新編輯時間
        };

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (autoEnable === 'true' && new Date(updatedBanner.timeOn) <= now) {
            updatedBanner.enable = true;
        }

        banners[bannerIndex] = updatedBanner;

        writeBanners(banners, (err) => {
            if (err) {
                console.error('Error saving banner:', err);
                return res.status(500).json({ success: false, message: '儲存 Banner 時出錯' });
            }

            notifyClients({ type: 'update-banner', data: updatedBanner });

            res.json({ success: true, message: 'Banner 已成功更新！' });
        });
    });
});

// 處理 Banner 上下架狀態切換
router.patch('/:id/enable', (req, res) => {
    const { id } = req.params;
    const { enable } = req.body;

    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        let bannerIndex = banners.findIndex(r => r.id === id);
        if (bannerIndex === -1) {
            return res.status(404).json({ success: false, message: 'Banner 不存在' });
        }

        banners[bannerIndex].autoEnable = enable;

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (enable && new Date(banners[bannerIndex].timeOn) <= new Date()) {
            banners[bannerIndex].enable = true;
        } else if (!enable && banners[bannerIndex].enable) {
            // 當關閉自動上架且 Banner 已上架時，將其下架
            banners[bannerIndex].enable = false;
            banners[bannerIndex].pinned = false; // 下架時取消置頂
        }

        writeBanners(banners, (err) => {
            if (err) {
                console.error('Error updating banner autoEnable status:', err);
                return res.status(500).json({ success: false, message: '更新 Banner 自動上架狀態時出錯' });
            }

            notifyClients({ type: 'update-banner', data: banners[bannerIndex] });

            res.json({ success: true, message: 'Banner 自動上架狀態已更新！' });
        });
    });
});

// 處理一鍵安排上架請求
router.patch('/schedule-all', (req, res) => {
    const { ids, autoEnable } = req.body;
    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        let updated = false;
        const now = new Date();

        banners = banners.map(banner => {
            if (ids.includes(banner.id)) {
                banner.autoEnable = autoEnable; // 設置自動上架
                // 如果上架時間已到，設置為已上架
                if (new Date(banner.timeOn) <= now) {
                    banner.enable = true;
                }
                updated = true;
            }
            return banner;
        });

        if (updated) {
            writeBanners(banners, (err) => {
                if (err) {
                    console.error('Error saving banners:', err);
                    return res.status(500).json({ success: false, message: '儲存 Banner 時出錯' });
                }

                // 發送 SSE 通知
                banners.forEach(banner => {
                    if (ids.includes(banner.id)) {
                        notifyClients({ type: 'update-banner', data: banner });
                    }
                });

                res.json({ success: true, message: '所有 Banner 已排定自動上架！' });
            });
        } else {
            res.json({ success: true, message: '沒有 Banner 需要更新。' });
        }
    });
});

// 處理 Banner 置頂狀態切換
router.patch('/:id/pin', (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;

    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        let bannerIndex = banners.findIndex(r => r.id === id);
        if (bannerIndex === -1) {
            return res.status(404).json({ success: false, message: 'Banner 不存在' });
        }

        banners[bannerIndex].pinned = pinned;

        writeBanners(banners, (err) => {
            if (err) {
                console.error('Error updating banner pinned status:', err);
                return res.status(500).json({ success: false, message: '更新 Banner 置頂狀態時出錯' });
            }

            notifyClients({ type: 'update-banner', data: banners[bannerIndex] });

            res.json({ success: true, message: 'Banner 置頂狀態已更新！' });
        });
    });
});

// 處理獲取 Banner 數據的請求，支援分頁
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1; // 默認頁碼為 1
    const pageSize = 10; // 每頁顯示 10 條數據
    const forManagement = req.query.forManagement === 'true'; // 是否為管理頁面請求

    readBanners((err, banners) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取 Banner 數據時出錯' });
        }

        // 如果不是管理頁面請求，過濾已下架的 Banner
        if (!forManagement) {
            banners = banners.filter(r => r.enable);
        }

        // 按置頂和編輯時間排序，置頂的在最上面，然後最新的在最上面
        banners = banners.sort((a, b) => {
            if (a.pinned === b.pinned) {
                return new Date(b.editTime) - new Date(a.editTime);
            }
            return b.pinned - a.pinned;
        });

        // 分頁處理
        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;
        const paginatedBanners = banners.slice(startIndex, endIndex);

        res.json({
            currentPage: page,
            totalPages: Math.ceil(banners.length / pageSize),
            banners: paginatedBanners
        });
    });
});

module.exports = router;

