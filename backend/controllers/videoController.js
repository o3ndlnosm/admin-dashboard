// controllers/videoController.js
const { readVideos, writeVideos } = require('../utils/fileUtils');

exports.createVideo = (req, res) => {
    const { title, videoLink, image, timeOn, timeOff } = req.body;
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

            // 通知 SSE 客戶端
            notifyClients({ type: 'new-video', data: video });

            res.json({ success: true, message: '影片已成功提交並儲存為 JSON 檔案！' });
        });
    });
};

exports.getVideos = (req, res) => {
    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        res.json(videos);
    });
};

exports.getVideo = (req, res) => {
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
};

exports.updateVideo = (req, res) => {
    const { id } = req.params;
    const { title, videoLink, image, timeOn, timeOff, autoEnable } = req.body;
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
            image,
            timeOn: timeOn || videos[videoIndex].timeOn,
            timeOff: timeOff || videos[videoIndex].timeOff,
            autoEnable: autoEnable !== undefined ? autoEnable : videos[videoIndex].autoEnable,
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

            // 通知 SSE 客戶端
            notifyClients({ type: 'update-video', data: updatedVideo });

            res.json({ success: true, message: '影片已成功更新！' });
        });
    });
};

exports.deleteVideo = (req, res) => {
    const { id } = req.params;

    readVideos((err, videos) => {
        if (err) {
            return res.status(500).json({ success: false, message: '讀取影片數據時出錯' });
        }

        const updatedVideos = videos.filter(v => v.id !== id);

        writeVideos(updatedVideos, (err) => {
            if (err) {
                console.error('Error deleting video:', err);
                return res.status(500).json({ success: false, message: '刪除影片時出錯' });
            }

            // 通知 SSE 客戶端
            notifyClients({ type: 'delete-video', data: { id } });

            res.json({ success: true, message: '影片已成功刪除！' });
        });
    });
};
