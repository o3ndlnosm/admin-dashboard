document.getElementById('announcement-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const title = document.getElementById('title').value
    const context = CKEDITOR.instances.context.getData();
    const image = document.getElementById('image').files[0];
    const timeOn = document.getElementById('timeOn').value;
    const timeOff = document.getElementById('timeOff').value;
    const hyperlink = document.getElementById('hyperlink').value;
})