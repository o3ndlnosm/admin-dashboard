const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const announcementRoutes = require('./routes/announcementRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const videoRoutes = require('./routes/videoRoutes');
const reportRoutes = require('./routes/reportRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const teacherReports = require('./routes/teacherReports');
const studentReports = require('./routes/studentReports');
const productRoutes = require('./routes/productRoutes');

const app = express();
const port = 3001;

// 確保必要的文件夾存在
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 設置API路由
app.use('/api/announcements', announcementRoutes);
app.use('/api', uploadRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/teacher-reports', teacherReports);
app.use('/api/student-reports', studentReports);
app.use('/api/products', productRoutes);

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
});
