document.addEventListener('DOMContentLoaded', function() {
    // 圖片上傳處理邏輯
    function imageHandler() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('upload', file);

                fetch('http://localhost:3001/api/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(result => {
                    if (result.uploaded) {
                        const imageUrl = result.url;
                        // 假設有一個 img 元素來顯示上傳的圖片
                        document.getElementById('thumbnailImage').src = imageUrl;
                        document.getElementById('thumbnailImage').classList.add('ready');
                        document.getElementById('thumbnailPreview').classList.remove('hidden');
                    } else {
                        alert('圖片上傳失敗');
                    }
                })
                .catch(() => alert('圖片上傳失敗'));
            }
        };
    }

    // 轉換日期格式
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

    // 設置默認時間
    function setDefaultTimes() {
        const now = new Date();
        now.setMinutes(0, 0, 0); // 將分鐘和秒設為00
        const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const timeOn = document.getElementById('timeOn');
        const timeOff = document.getElementById('timeOff');
        
        // 只對下架時間設置最小值
        timeOff.min = toDatetimeLocal(now);

        timeOn.value = toDatetimeLocal(now);
        timeOff.value = toDatetimeLocal(oneDayLater);
    }

    // 檢查時間有效性
    function checkTimeValidity() {
        const timeOn = new Date(document.getElementById('timeOn').value);
        const timeOff = new Date(document.getElementById('timeOff').value);

        if (timeOff <= timeOn) {
            alert('下架時間必須晚於上架時間。');
            document.getElementById('timeOff').focus(); // 設置焦點到下架時間輸入框
            return false;
        }

        return true;
    }

    const form = document.getElementById('report-form');
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        fetch(`http://localhost:3001/api/reports/${id}`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('title').value = data.title;
                document.getElementById('context').value = data.context;
                document.getElementById('hyperlink').value = data.hyperlink;
                document.getElementById('timeOn').value = toDatetimeLocal(new Date(data.timeOn));
                document.getElementById('timeOff').value = toDatetimeLocal(new Date(data.timeOff));
                if (data.image) {
                    document.getElementById('thumbnailImage').src = data.image;
                    document.getElementById('thumbnailImage').classList.add('ready');
                    document.getElementById('thumbnailPreview').classList.remove('hidden');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('加載報導時出錯');
            });
    } else {
        setDefaultTimes();
    }

    form.addEventListener('submit', function(event) {
        event.preventDefault();

        if (!checkTimeValidity()) {
            return; // 時間無效，阻止表單提交
        }

        const formData = new FormData(form);

        const method = id ? 'PUT' : 'POST';
        const url = id ? `http://localhost:3001/api/reports/${id}` : 'http://localhost:3001/api/reports';

        fetch(url, {
            method: method,
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('報導已成功提交並儲存為 JSON 檔案！');
                window.location.href = 'report-management.html';
            } else {
                alert('提交失敗，請重試。');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('提交失敗，請重試。');
        });
    });
});
