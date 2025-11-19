// Создаем кнопку
const button = document.createElement('button');
button.className = 'arc-save-button';
button.innerText = 'Сохранить в ARC';
document.body.appendChild(button);

let currentImage = null;
let hideTimeout = null;

function showButton(img) {
  currentImage = img;
  
  const rect = img.getBoundingClientRect();
  
  // Минимальный размер изображения, чтобы не показывать кнопку на иконках
  if (rect.width < 100 || rect.height < 100) return;

  // Позиционируем кнопку в левом верхнем углу изображения (с учетом скролла)
  const top = rect.top + window.scrollY + 20;
  const left = rect.left + window.scrollX + 20;
  
  button.style.top = `${top}px`;
  button.style.left = `${left}px`;
  button.classList.add('visible');
  
  clearTimeout(hideTimeout);
}

function hideButton() {
  hideTimeout = setTimeout(() => {
    button.classList.remove('visible');
    currentImage = null;
  }, 100); // Небольшая задержка, чтобы успеть перевести курсор на кнопку
}

// Обработчики событий для изображений
document.addEventListener('mouseover', (e) => {
  if (e.target.tagName === 'IMG') {
    showButton(e.target);
  }
}, true);

document.addEventListener('mouseout', (e) => {
  if (e.target.tagName === 'IMG') {
    hideButton();
  }
}, true);

// Обработчики для самой кнопки, чтобы она не исчезала при наведении
button.addEventListener('mouseover', () => {
  clearTimeout(hideTimeout);
  button.classList.add('visible');
});

button.addEventListener('mouseout', () => {
  hideButton();
});

// Клик по кнопке
button.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (currentImage && currentImage.src) {
    const imageUrl = currentImage.src;
    const pageUrl = window.location.href;
    const title = document.title;
    
    // Формируем deep link
    // arc://import?url=...&source=...&title=...
    const deepLink = `arc://import?url=${encodeURIComponent(imageUrl)}&source=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(title)}`;
    
    console.log('ARC Import:', deepLink);
    
    // Открываем ссылку
    window.location.href = deepLink;
    
    // Визуальный фидбек
    const originalText = button.innerText;
    button.innerText = 'Отправлено!';
    button.style.backgroundColor = '#10B981'; // Green-500
    
    setTimeout(() => {
      button.innerText = originalText;
      button.style.backgroundColor = '';
      hideButton();
    }, 2000);
  }
});

