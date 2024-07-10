const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cron = require('node-cron');

// 設置 multer 以處理產品圖片上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/products/';
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

// 讀取產品數據
const readProducts = (callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'products.json');
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                callback(null, []);
            } else {
                callback(err);
            }
        } else {
            try {
                const products = JSON.parse(data);
                callback(null, products);
            } catch (parseErr) {
                callback(parseErr);
            }
        }
    });
};

// 寫入產品數據
const writeProducts = (products, callback) => {
    const filePath = path.join(__dirname, '..', 'data', 'products.json');
    fs.writeFile(filePath, JSON.stringify(products, null, 2), callback);
};

// 定時任務檢查和更新產品狀態
cron.schedule('* * * * *', () => { // 每分鐘檢查一次
    readProducts((err, products) => {
        if (err) {
            console.error('Error reading products:', err);
            return;
        }

        const now = new Date();
        let updated = false;

        products = products.map(product => {
            let changed = false;
            if (new Date(product.timeOn) <= now && product.autoEnable && !product.enable) {
                product.enable = true;
                changed = true;
            }
            if (new Date(product.timeOff) <= now && product.enable) {
                product.enable = false;
                product.autoEnable = false; // 更新 autoEnable 狀態
                changed = true;
            }
            if (changed) {
                product.editTime = now.toISOString();
                updated = true;
                notifyClients({ type: 'update-product', data: product });
            }
            return product;
        });

        if (updated) {
            writeProducts(products, (err) => {
                if (err) {
                    console.error('Error saving products:', err);
                } else {
                    console.log('Products updated based on schedule.');
                }
            });
        }
    });
});

// 處理產品提交
router.post('/', upload.single('image'), (req, res) => {
    const { id, title, description, timeOn, timeOff, hyperlink } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    const product = {
        id: id || Date.now().toString(),
        title,
        description,
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

    ensureDirectoryExistence(path.join(__dirname, '..', 'data', 'products.json'));

    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        products.push(product);

        writeProducts(products, (err) => {
            if (err) {
                console.error('Error saving product:', err);
                return res.status(500).json({ success: false, message: '儲存產品時出錯' });
            }

            notifyClients({ type: 'new-product', data: product });

            res.json({ success: true, message: '產品已成功提交並儲存為 JSON 檔案！' });
        });
    });
});

// 處理獲取單一產品數據的請求
router.get('/:id', (req, res) => {
    const { id } = req.params;

    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        const product = products.find(a => a.id === id);
        if (!product) {
            return res.status(404).json({ success: false, message: '產品不存在' });
        }

        res.json(product);
    });
});

// 處理產品更新
router.put('/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description, timeOn, timeOff, hyperlink, autoEnable, removeImage } = req.body;
    const image = req.file ? req.file.filename : null;
    const now = new Date();

    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        let productIndex = products.findIndex(a => a.id === id);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: '產品不存在' });
        }

        const oldImage = products[productIndex].image;

        const updatedProduct = {
            ...products[productIndex],
            title,
            description,
            timeOn: timeOn || products[productIndex].timeOn,
            timeOff: timeOff || products[productIndex].timeOff,
            hyperlink: hyperlink || products[productIndex].hyperlink,
            image: image || (removeImage === 'true' ? null : products[productIndex].image),
            autoEnable: autoEnable !== undefined ? autoEnable : products[productIndex].autoEnable, // 更新自動上架狀態
            editTime: now.toISOString() // 更新編輯時間
        };

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (autoEnable === 'true' && new Date(updatedProduct.timeOn) <= now) {
            updatedProduct.enable = true;
        }

        products[productIndex] = updatedProduct;

        writeProducts(products, (err) => {
            if (err) {
                console.error('Error saving product:', err);
                return res.status(500).json({ success: false, message: '儲存產品時出錯' });
            }

            // 刪除舊的圖片文件
            if (removeImage === 'true' && oldImage) {
                fs.unlink(path.join(__dirname, '..', 'uploads', 'products', oldImage), (err) => {
                    if (err) {
                        console.error('Error deleting image:', err);
                    }
                });
            }

            notifyClients({ type: 'update-product', data: updatedProduct });

            res.json({ success: true, message: '產品已成功更新！' });
        });
    });
});

// 處理產品上下架狀態切換
router.patch('/:id/enable', (req, res) => {
    const { id } = req.params;
    const { enable } = req.body;

    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        let productIndex = products.findIndex(a => a.id === id);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: '產品不存在' });
        }

        products[productIndex].autoEnable = enable;

        // 如果設置了自動上架且上架時間已到，則立即上架
        if (enable && new Date(products[productIndex].timeOn) <= new Date()) {
            products[productIndex].enable = true;
        } else if (!enable && products[productIndex].enable) {
            // 當關閉自動上架且產品已上架時，將其下架
            products[productIndex].enable = false;
            products[productIndex].pinned = false; // 下架時取消置頂
        }

        writeProducts(products, (err) => {
            if (err) {
                console.error('Error updating product autoEnable status:', err);
                return res.status(500).json({ success: false, message: '更新產品自動上架狀態時出錯' });
            }

            notifyClients({ type: 'update-product', data: products[productIndex] });

            res.json({ success: true, message: '產品自動上架狀態已更新！' });
        });
    });
});

// 處理一鍵安排上架請求
router.patch('/schedule-all', (req, res) => {
    const { ids, autoEnable } = req.body;
    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        let updated = false;
        const now = new Date();

        products = products.map(product => {
            if (ids.includes(product.id)) {
                product.autoEnable = autoEnable; // 設置自動上架
                // 如果上架時間已到，設置為已上架
                if (new Date(product.timeOn) <= now) {
                    product.enable = true;
                }
                updated = true;
            }
            return product;
        });

        if (updated) {
            writeProducts(products, (err) => {
                if (err) {
                    console.error('Error saving products:', err);
                    return res.status(500).json({ success: false, message: '儲存產品時出錯' });
                }

                // 發送 SSE 通知
                products.forEach(product => {
                    if (ids.includes(product.id)) {
                        notifyClients({ type: 'update-product', data: product });
                    }
                });

                res.json({ success: true, message: '所有產品已排定自動上架！' });
            });
        } else {
            res.json({ success: true, message: '沒有產品需要更新。' });
        }
    });
});

// 處理產品置頂狀態切換
router.patch('/:id/pin', (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;

    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        let productIndex = products.findIndex(a => a.id === id);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: '產品不存在' });
        }

        products[productIndex].pinned = pinned;

        writeProducts(products, (err) => {
            if (err) {
                console.error('Error updating product pinned status:', err);
                return res.status(500).json({ success: false, message: '更新產品置頂狀態時出錯' });
            }

            notifyClients({ type: 'update-product', data: products[productIndex] });

            res.json({ success: true, message: '產品置頂狀態已更新！' });
        });
    });
});

// 處理獲取產品數據的請求，支援分頁
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1; // 默認頁碼為 1
    const pageSize = 10; // 每頁顯示 10 條數據
    const forManagement = req.query.forManagement === 'true'; // 是否為管理頁面請求

    readProducts((err, products) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取產品數據時出錯' });
        }

        // 如果不是管理頁面請求，過濾已下架的產品
        if (!forManagement) {
            products = products.filter(a => a.enable);
        }

        // 按置頂和編輯時間排序，置頂的在最上面，然後最新的在最上面
        products = products.sort((a, b) => {
            if (a.pinned === b.pinned) {
                return new Date(b.editTime) - new Date(a.editTime);
            }
            return b.pinned - a.pinned;
        });

        // 分頁處理
        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;
        const paginatedProducts = products.slice(startIndex, endIndex);

        res.json({
            currentPage: page,
            totalPages: Math.ceil(products.length / pageSize),
            products: paginatedProducts
        });
    });
});

module.exports = router;
