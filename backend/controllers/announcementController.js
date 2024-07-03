// const fs = require('fs');
// const path = require('path');

// const filePath = path.join(__dirname, '..', 'businessNews.json');

// exports.createAnnouncement = (req, res) => {
//     const id = new Date().toISOString().replace(/[-:.TZ]/g, '').substring(0, 17);
//     const title = req.body.title;
//     const context = req.body.context;
//     const image = req.file ? req.file.filename : '';
//     const timeOn = req.body.timeOn || new Date().toISOString().replace('T', ' ').substring(0, 19);
//     const timeOff = req.body.timeOff || '2038-01-19 03:14:07';
//     const hyperlink = req.body.hyperlink || null;

//     const announcement = {
//         id,
//         title,
//         context,
//         image,
//         timeOn,
//         timeOff,
//         hyperlink,
//         priority: 0,  // 默認為 0
//         enable: false // 默認為不啟用
//     };

//     fs.readFile(filePath, 'utf8', (err, data) => {
//         if (err && err.code !== 'ENOENT') {
//             return res.status(500).send({ success: false, message: '讀取JSON文件失敗' });
//         }
        
//         let jsonData;
//         try {
//             jsonData = data ? JSON.parse(data) : [];
//         } catch (parseErr) {
//             jsonData = [];
//         }

//         jsonData.push(announcement);

//         fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (writeErr) => {
//             if (writeErr) {
//                 return res.status(500).send({ success: false, message: '寫入JSON文件失敗' });
//             }
//             res.send({ success: true, message: '公告已成功提交' });
//         });
//     });
// };

