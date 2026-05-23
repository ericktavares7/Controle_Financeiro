export function showToast({
  type = 'success',
  title = 'Sucesso',
  message = ''
}) {
  const container = document.getElementById('toast-container');

  if (!container) return;

  const toast = document.createElement('div');

  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
    <div class="toast-icon">
      <i class="ph ${
        type === 'success'
          ? 'ph-check-circle'
          : 'ph-warning-circle'
      }"></i>
    </div>

    <div class="toast-content">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');

    setTimeout(() => {
      toast.remove();
    }, 280);
  }, 4000);
}