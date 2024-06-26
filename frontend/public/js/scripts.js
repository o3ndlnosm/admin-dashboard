const correctPassword = "0000";

function login() {
    const password = document.getElementById('password').value;
    const message = document.getElementById('message');
    if (password === correctPassword) {
        alert ('登入成功');
        window.location.href = 'dashboard.html';
    } else {
        message.style.display = 'block';
    }
}