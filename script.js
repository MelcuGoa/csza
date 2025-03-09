let count = 0;
const counterElement = document.getElementById('counter');

function increment() {
    count++;
    counterElement.textContent = count;
}