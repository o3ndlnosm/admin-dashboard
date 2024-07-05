document.addEventListener('DOMContentLoaded', function() {
    const videoLinkInput = document.getElementById('videoLink');
    const youtubePreview = document.getElementById('youtubePreview');
    const videoPreview = document.getElementById('videoPreview');
    const imageInput = document.getElementById('image');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const thumbnailImage = document.getElementById('thumbnailImage');
    const imageUploadContainer = document.getElementById('imageUploadContainer');
    const removeThumbnailButton = document.getElementById('removeThumbnailButton');

    videoLinkInput.addEventListener('input', updateVideoPreview);
    imageInput.addEventListener('change', handleImageUpload);
    removeThumbnailButton.addEventListener('click', removeThumbnail);
    document.getElementById('video-form').addEventListener('submit', handleSubmit);

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (id) {
        fetchVideoData(id);
    } else {
        setDefaultTimes();
    }

    function updateVideoPreview() {
        const url = videoLinkInput.value;
        const embedUrl = convertToYouTubeEmbedUrl(url);
        if (embedUrl) {
            youtubePreview.src = embedUrl;
            videoPreview.classList.remove('hidden');
            youtubePreview.classList.add('ready');
        } else {
            youtubePreview.src = '';
            videoPreview.classList.add('hidden');
            youtubePreview.classList.remove('ready');
        }
    }

    function handleImageUpload() {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                thumbnailImage.src = e.target.result;
                thumbnailPreview.classList.remove('hidden');
                thumbnailImage.classList.add('ready');
                imageUploadContainer.classList.add('hidden');
                removeThumbnailButton.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            thumbnailPreview.classList.add('hidden');
            thumbnailImage.classList.remove('ready');
            imageUploadContainer.classList.remove('hidden');
            removeThumbnailButton.classList.add('hidden');
        }
    }

    function removeThumbnail() {
        thumbnailPreview.classList.add('hidden');
        thumbnailImage.classList.remove('ready');
        thumbnailImage.src = '';
        imageUploadContainer.classList.remove('hidden');
        removeThumbnailButton.classList.add('hidden');
        imageInput.value = ''; // 清除文件输入的值
    }

    function toDatetimeLocal(date) {
        const ten = function (i) {
            return (i < 10 ? '0' : '') + i;
        };
        const YYYY = date.getFullYear();
        const MM = ten(date.getMonth() + 1);
        const DD = ten(date.getDate());
        const HH = ten(date.getHours());
        const II = ten(date.getMinutes());
        return YYYY + '-' + MM + '-' + DD + 'T' + HH + ':' + II;
    }

    function setDefaultTimes() {
        const now = new Date();
        now.setMinutes(0, 0, 0); // 將分鐘和秒設為00
        const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        document.getElementById('timeOn').value = toDatetimeLocal(now);
        document.getElementById('timeOff').value = toDatetimeLocal(oneDayLater);
    }

    function checkTimeValidity() {
        const timeOn = new Date(document.getElementById('timeOn').value);
        const timeOff = new Date(document.getElementById('timeOff').value);

        if (timeOff <= timeOn) {
            alert('下架時間必須晚於上架時間。');
            document.getElementById('timeOff').focus();
            return false;
        }

        return true;
    }

    function fetchVideoData(id) {
        fetch(`http://localhost:3001/api/videos/${id}`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('title').value = data.title;
                document.getElementById('videoLink').value = data.videoLink;
                document.getElementById('timeOn').value = toDatetimeLocal(new Date(data.timeOn));
                document.getElementById('timeOff').value = toDatetimeLocal(new Date(data.timeOff));

                if (data.videoLink) {
                    const embedUrl = convertToYouTubeEmbedUrl(data.videoLink);
                    if (embedUrl) {
                        youtubePreview.src = embedUrl;
                        videoPreview.classList.remove('hidden');
                        youtubePreview.classList.add('ready');
                    }
                }

                if (data.image) {
                    thumbnailImage.src = `http://localhost:3001/uploads/${data.image}`;
                    thumbnailPreview.classList.remove('hidden');
                    thumbnailImage.classList.add('ready');
                    imageUploadContainer.classList.add('hidden');
                    removeThumbnailButton.classList.remove('hidden');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('加載影片時出錯');
            });
    }

    function handleSubmit(event) {
        event.preventDefault();

        if (!checkTimeValidity()) {
            return; // 時間無效，阻止表單提交
        }

        const formData = new FormData(event.target);
        const method = id ? 'PUT' : 'POST';
        const url = id ? `http://localhost:3001/api/videos/${id}` : 'http://localhost:3001/api/videos';

        fetch(url, {
            method: method,
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('影片已成功提交並儲存為 JSON 檔案！');
                window.location.href = 'video-management.html';
            } else {
                alert('提交失敗，請重試。');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('提交失敗，請重試。');
        });
    }

    function convertToYouTubeEmbedUrl(url) {
        const youtubeWatchRegex = /https:\/\/www\.youtube\.com\/watch\?v=([^&]+)/;
        const youtubeShortRegex = /https:\/\/youtu\.be\/([^?]+)/;
        const youtubeEmbedRegex = /https:\/\/www\.youtube\.com\/embed\/([^?]+)/;

        let match = url.match(youtubeWatchRegex);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }

        match = url.match(youtubeShortRegex);
        if (match) {
            return `https://www.youtube.com/embed/${match[1]}`;
        }

        match = url.match(youtubeEmbedRegex);
        if (match) {
            return url; // Already in embed format
        }

        return null; // Not a valid YouTube URL
    }
});
