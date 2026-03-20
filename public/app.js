const form = document.getElementById('lead-form');
const statusEl = document.getElementById('form-status');

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    statusEl.textContent = 'Submitting your enquiry...';
    statusEl.className = 'form-status';

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = result.message || 'We were unable to submit your enquiry. Please try again.';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }

      form.reset();
      statusEl.textContent = result.message || 'Thank you. Our team will be in touch shortly.';
      statusEl.className = 'form-status success';
    } catch (error) {
      statusEl.textContent = error.message || 'Submission failed. Please contact us directly.';
      statusEl.className = 'form-status error';
    }
  });
}
