document.addEventListener('DOMContentLoaded', function() {
    var quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline'],
                ['image', 'code-block']
            ]
        }
    });

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
                        const range = quill.getSelection();
                        quill.insertEmbed(range.index, 'image', result.url);
                    } else {
                        alert('圖片上傳失敗');
                    }
                })
                .catch(() => alert('圖片上傳失敗'));
            }
        };
    }

    quill.getModule('toolbar').addHandler('image', imageHandler);

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

        const timeOn = document.getElementById('timeOn');
        const timeOff = document.getElementById('timeOff');
        
        // 只對下架時間設置最小值
        timeOff.min = toDatetimeLocal(now);

        timeOn.value = toDatetimeLocal(now);
        timeOff.value = toDatetimeLocal(oneDayLater);
    }

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

    const form = document.getElementById('product-form');
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        fetch(`http://localhost:3001/api/products/${id}`)
            .then(response => response.json())
            .then(data => {
                document.getElementById('title').value = data.title;
                quill.root.innerHTML = data.description;
                document.getElementById('hyperlink').value = data.hyperlink;
                document.getElementById('timeOn').value = toDatetimeLocal(new Date(data.timeOn));
                document.getElementById('timeOff').value = toDatetimeLocal(new Date(data.timeOff));
                if (data.image) {
                    document.getElementById('image-preview').src = `http://localhost:3001/uploads/products/${data.image}`;
                    document.getElementById('image-upload-section').style.display = 'none';
                    document.getElementById('image-preview-section').style.display = 'block';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('加載產品信息時出錯');
            });
    } else {
        setDefaultTimes();
    }

    document.getElementById('remove-image').addEventListener('click', function() {
        document.getElementById('image-upload-section').style.display = 'block';
        document.getElementById('image-preview-section').style.display = 'none';
        document.getElementById('image').value = '';
        document.getElementById('image-preview').src = '';
        document.getElementById('removeImage').value = 'true';
    });

    document.getElementById('image').addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('image-preview').src = e.target.result;
                document.getElementById('image-upload-section').style.display = 'none';
                document.getElementById('image-preview-section').style.display = 'block';
                document.getElementById('removeImage').value = 'false';
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault();

        if (!checkTimeValidity()) {
            return; // 時間無效，阻止表單提交
        }

        const formData = new FormData(form);
        const editorContent = quill.root.innerHTML;
        formData.set('description', editorContent);

        const method = id ? 'PUT' : 'POST';
        const url = id ? `http://localhost:3001/api/products/${id}` : 'http://localhost:3001/api/products';

        fetch(url, {
            method: method,
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('產品信息已成功提交並儲存為 JSON 檔案！');
                window.location.href = 'prod-mgmt.html';
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
