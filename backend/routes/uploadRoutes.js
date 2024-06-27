const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 設置multer以處理圖片上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

router.post('/upload', upload.single('upload'), (req, res) => {
    if (req.file) {
        res.json({
            uploaded: true,
            url: `http://localhost:3001/uploads/${req.file.filename}`
        });
    } else {
        res.status(400).json({ uploaded: false, error: { message: '上傳失敗' } });
    }
});

module.exports = router;
