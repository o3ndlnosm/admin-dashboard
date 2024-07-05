const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');

// 設置 multer 以處理封面縮圖上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/reports/';
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

// 讀取報導數據
const readReports = (callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'reports.json');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                callback(null, []);
            } else {
                callback(err);
            }
        } else {
            try {
                const reports = JSON.parse(data);
                callback(null, reports);
            } catch (parseErr) {
                callback(parseErr);
            }
        }
    });
};

// 寫入報導數據
const writeReports = (reports, callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'reports.json');
    fs.writeFile(filePath, JSON.stringify(reports, null, 2), callback);
};

// 定時任務檢查和更新報導狀態
cron.schedule('* * * * *', () => { // 每分鐘檢查一次
    readReports((err, reports) => {
        if (err) {
            console.error('Error reading reports:', err);
            return;
        }

        const now = new Date();
        let updated = false;

        reports = reports.map(report => {
            let changed = false;
            if (new Date(report.timeOn) <= now && report.autoEnable && !report.enable) {
                report.enable = true;
                changed = true;
            }
            if (new Date(report.timeOff) <= now && report.enable) {
                report.enable = false;
                report.autoEnable = false; // 更新 autoEnable 狀態
                changed = true;
            }
            if (changed) {
                report.editTime = now.toISOString();
                updated = true;
                notifyClients({ type: 'update-report', data: report });
            }
            return report;
        });

        if (updated) {
            writeReports(reports, (err) => {
                if (err) {
                    console.error('Error saving reports:', err);
                } else {
                    console.log('Reports updated based on schedule.');
                }
            });
        }
    });
});

// 處理報導提交
router.post('/', upload.single('image'), (req, res) => {
    const { id, title, context, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    const report = {
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

    ensureDirectoryExistence(path.join(__dirname, '..', 'data', 'reports.json'));

    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        reports.push(report);

        writeReports(reports, (err) => {
            if (err) {
                console.error('Error saving report:', err);
                return res.status(500).json({ success: false, message: '儲存報導時出錯' });
            }

            notifyClients({ type: 'new-report', data: report });

            res.json({ success: true, message: '報導已成功提交並儲存為 JSON 檔案！' });
        });
    });
});

// 處理獲取單一報導數據的請求
router.get('/:id', (req, res) => {
    const { id } = req.params;

    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        const report = reports.find(r => r.id === id);
        if (!report) {
            return res.status(404).json({ success: false, message: '報導不存在' });
        }

        // 自動將報導下架
        report.enable = false;
        report.editTime = new Date().toISOString();

        writeReports(reports, (err) => {
            if (err) {
                console.error('Error updating report status:', err);
                return res.status(500).json({ success: false, message: '更新報導狀態時出錯' });
            }

            notifyClients({ type: 'update-report', data: report });

            res.json(report);
        });
    });
});

// 處理報導更新
router.put('/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, context, timeOn, timeOff, hyperlink, autoEnable } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        let reportIndex = reports.findIndex(r => r.id === id);
        if (reportIndex === -1) {
            return res.status(404).json({ success: false, message: '報導不存在' });
        }

        const updatedReport = {
            ...reports[reportIndex],
            title,
            context,
            timeOn: timeOn || reports[reportIndex].timeOn,
            timeOff: timeOff || reports[reportIndex].timeOff,
            hyperlink: hyperlink || reports[reportIndex].hyperlink,
            image: image || reports[reportIndex].image,
            autoEnable: autoEnable !== undefined ? autoEnable : reports[reportIndex].autoEnable, // 更新自動上架狀態
            editTime: now.toISOString() // 更新編輯時間
        };

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (autoEnable === 'true' && new Date(updatedReport.timeOn) <= now) {
            updatedReport.enable = true;
        }

        reports[reportIndex] = updatedReport;

        writeReports(reports, (err) => {
            if (err) {
                console.error('Error saving report:', err);
                return res.status(500).json({ success: false, message: '儲存報導時出錯' });
            }

            notifyClients({ type: 'update-report', data: updatedReport });

            res.json({ success: true, message: '報導已成功更新！' });
        });
    });
});

// 處理報導上下架狀態切換
router.patch('/:id/enable', (req, res) => {
    const { id } = req.params;
    const { enable } = req.body;

    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        let reportIndex = reports.findIndex(r => r.id === id);
        if (reportIndex === -1) {
            return res.status(404).json({ success: false, message: '報導不存在' });
        }

        reports[reportIndex].autoEnable = enable;

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (enable && new Date(reports[reportIndex].timeOn) <= new Date()) {
            reports[reportIndex].enable = true;
        } else if (!enable && reports[reportIndex].enable) {
            // 當關閉自動上架且報導已上架時，將其下架
            reports[reportIndex].enable = false;
            reports[reportIndex].pinned = false; // 下架時取消置頂
        }

        writeReports(reports, (err) => {
            if (err) {
                console.error('Error updating report autoEnable status:', err);
                return res.status(500).json({ success: false, message: '更新報導自動上架狀態時出錯' });
            }

            notifyClients({ type: 'update-report', data: reports[reportIndex] });

            res.json({ success: true, message: '報導自動上架狀態已更新！' });
        });
    });
});

// 處理一鍵安排上架請求
router.patch('/schedule-all', (req, res) => {
    const { ids, autoEnable } = req.body;
    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        let updated = false;
        const now = new Date();

        reports = reports.map(report => {
            if (ids.includes(report.id)) {
                report.autoEnable = autoEnable; // 設置自動上架
                // 如果上架時間已到，設置為已上架
                if (new Date(report.timeOn) <= now) {
                    report.enable = true;
                }
                updated = true;
            }
            return report;
        });

        if (updated) {
            writeReports(reports, (err) => {
                if (err) {
                    console.error('Error saving reports:', err);
                    return res.status(500).json({ success: false, message: '儲存報導時出錯' });
                }

                // 發送 SSE 通知
                reports.forEach(report => {
                    if (ids.includes(report.id)) {
                        notifyClients({ type: 'update-report', data: report });
                    }
                });

                res.json({ success: true, message: '所有報導已排定自動上架！' });
            });
        } else {
            res.json({ success: true, message: '沒有報導需要更新。' });
        }
    });
});

// 處理報導置頂狀態切換
router.patch('/:id/pin', (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;

    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        let reportIndex = reports.findIndex(r => r.id === id);
        if (reportIndex === -1) {
            return res.status(404).json({ success: false, message: '報導不存在' });
        }

        reports[reportIndex].pinned = pinned;

        writeReports(reports, (err) => {
            if (err) {
                console.error('Error updating report pinned status:', err);
                return res.status(500).json({ success: false, message: '更新報導置頂狀態時出錯' });
            }

            notifyClients({ type: 'update-report', data: reports[reportIndex] });

            res.json({ success: true, message: '報導置頂狀態已更新！' });
        });
    });
});

// 處理獲取報導數據的請求，支援分頁
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1; // 默認頁碼為 1
    const pageSize = 10; // 每頁顯示 10 條數據
    const forManagement = req.query.forManagement === 'true'; // 是否為管理頁面請求

    readReports((err, reports) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取報導數據時出錯' });
        }

        // 如果不是管理頁面請求，過濾已下架的報導
        if (!forManagement) {
            reports = reports.filter(r => r.enable);
        }

        // 按置頂和編輯時間排序，置頂的在最上面，然後最新的在最上面
        reports = reports.sort((a, b) => {
            if (a.pinned === b.pinned) {
                return new Date(b.editTime) - new Date(a.editTime);
            }
            return b.pinned - a.pinned;
        });

        // 分頁處理
        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;
        const paginatedReports = reports.slice(startIndex, endIndex);

        res.json({
            currentPage: page,
            totalPages: Math.ceil(reports.length / pageSize),
            reports: paginatedReports
        });
    });
});

module.exports = router;

