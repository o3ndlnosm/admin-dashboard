const fs = require('fs');
const path = require('path');

const videoFilePath = path.join(__dirname, '..', 'data', 'videos.json');

const readVideos = (callback) => {
    fs.readFile(videoFilePath, (err, data) => {
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

const writeVideos = (videos, callback) => {
    fs.writeFile(videoFilePath, JSON.stringify(videos, null, 2), callback);
};

module.exports = { readVideos, writeVideos };
