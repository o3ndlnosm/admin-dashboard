const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const announcementRoutes = require('./routes/announcementRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const port = 3001;

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

app.use('/api/announcements', announcementRoutes);
app.use('/api', uploadRoutes);

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
});
