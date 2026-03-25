/* ============================================
   Event Invitation - App Logic
   ============================================ */

(function () {
  'use strict';

  let config = {};
  let lightboxIndex = 0;

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    try {
      const res = await fetch('config.json');
      config = await res.json();
    } catch (e) {
      console.error('Failed to load config.json:', e);
      config = {};
    }

    applyTheme();
    populateDetails();
    setupEnvelope();
    startCountdown();
    setupRSVP();
    setupGallery();
    setupParticles();
    setupScrollObserver();
  }

  // ---- Theme ----
  function applyTheme() {
    if (config.theme) {
      document.documentElement.setAttribute('data-theme', config.theme);
    }
    // Update OG tags
    if (config.eventName) {
      document.title = config.eventName + ' | ご招待';
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.content = config.eventName + ' へのご招待';
    }
  }

  // ---- Populate Details ----
  function populateDetails() {
    setText('event-title', config.eventName || 'イベント');
    setText('event-subtitle', config.eventSubtitle || '');
    setHTML('event-message', (config.message || '').replace(/\n/g, '<br>'));

    // Date formatting
    if (config.eventDate) {
      const d = new Date(config.eventDate);
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekDays[d.getDay()]}） ${padZero(d.getHours())}:${padZero(d.getMinutes())} 開始`;
      const durationStr = config.duration ? `（${config.duration}）` : '';
      setText('detail-date', dateStr + durationStr);
    } else if (config.candidateDates && config.candidateDates.length > 0) {
      // Show candidate dates
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      const dateLabels = config.candidateDates.map(ds => {
        const d = new Date(ds + 'T00:00:00');
        return `${d.getMonth() + 1}/${d.getDate()}（${weekDays[d.getDay()]}）`;
      });
      setText('detail-date', '候補日：' + dateLabels.join('、'));
    }

    // Venue
    let venueText = config.venue || '';
    if (config.venueNote) venueText += `（${config.venueNote}）`;
    setText('detail-venue', venueText);

    setText('detail-fee', config.fee || '');

    // Guest - show only if set
    if (config.guest) {
      const guestContainer = document.getElementById('detail-guest-container');
      if (guestContainer) guestContainer.style.display = '';
      setText('detail-guest', config.guest);
    }

    // Organizer - show only if set
    if (config.organizer) {
      const orgContainer = document.getElementById('detail-organizer-container');
      if (orgContainer) orgContainer.style.display = '';
      let orgText = config.organizer;
      if (config.organizerDepartment) orgText = `${config.organizerDepartment} ${orgText}`;
      setText('detail-organizer', orgText);
    }

    // Map
    if (config.mapUrl) {
      const mapContainer = document.getElementById('detail-map-container');
      const mapLink = document.getElementById('detail-map');
      if (mapContainer && mapLink) {
        mapContainer.style.display = '';
        mapLink.href = config.mapUrl;
      }
    }

    // RSVP deadline
    if (config.rsvpDeadline) {
      const dl = new Date(config.rsvpDeadline + 'T00:00:00');
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      setText('rsvp-deadline', `回答期限：${dl.getMonth() + 1}月${dl.getDate()}日（${weekDays[dl.getDay()]}）まで`);
    }

    setText('rsvp-notes', config.additionalNotes || '');
    setText('footer-text', config.eventName || '');

    // Google Calendar button - only show if eventDate is set
    if (config.eventDate) {
      const btn = document.getElementById('btn-calendar');
      if (btn) btn.style.display = '';
      setupCalendarButton();
    }

    // Populate candidate date checkboxes
    setupCandidateDates();
  }

  // ---- Candidate Dates ----
  function setupCandidateDates() {
    if (!config.candidateDates || config.candidateDates.length === 0) return;

    const group = document.getElementById('candidate-dates-group');
    const container = document.getElementById('candidate-dates-container');
    if (!group || !container) return;

    // Keep hidden initially - will be shown when '参加する' is selected

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    config.candidateDates.forEach((dateStr, index) => {
      const d = new Date(dateStr + 'T00:00:00');
      const label = `${d.getMonth() + 1}月${d.getDate()}日（${weekDays[d.getDay()]}）`;

      const checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'checkbox-label';
      checkboxLabel.innerHTML = `
        <input type="checkbox" name="preferredDates" value="${escapeHTML(dateStr)}">
        <span class="checkbox-custom"></span>
        <span class="checkbox-text">${label}</span>
      `;
      container.appendChild(checkboxLabel);
    });
  }

  // ---- Google Calendar ----
  function setupCalendarButton() {
    const btn = document.getElementById('btn-calendar');
    if (!btn || !config.eventDate) return;

    const start = new Date(config.eventDate);
    // Default duration: 2 hours
    const durationMs = 2 * 60 * 60 * 1000;
    const end = new Date(start.getTime() + durationMs);

    const formatGCalDate = (d) => {
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const title = config.eventName || 'イベント';
    const location = config.venue ? (config.address ? `${config.venue}, ${config.address}` : config.venue) : '';
    const details = config.message ? config.message.substring(0, 200) : '';

    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${formatGCalDate(start)}/${formatGCalDate(end)}` +
      `&location=${encodeURIComponent(location)}` +
      `&details=${encodeURIComponent(details)}`;

    btn.href = calUrl;
  }

  // ---- Envelope ----
  function setupEnvelope() {
    const envelope = document.getElementById('envelope');
    if (!envelope) return;

    envelope.addEventListener('click', () => {
      if (envelope.classList.contains('opened')) return;
      envelope.classList.add('opened');

      // After animation, show all other sections
      setTimeout(() => {
        showConfetti();
        setTimeout(() => {
          fadeOutSection('envelope-section');
          showSection('details-section');

          // Only show countdown if eventDate is set
          if (config.eventDate) {
            showSection('countdown-section');
          }

          showSection('rsvp-section');
          showSection('footer');

          if (config.showGallery && config.photos && config.photos.length > 0) {
            showSection('gallery-section');
          }

          // Trigger animate-in after sections are visible
          setTimeout(() => {
            document.querySelectorAll('.animate-in').forEach(el => {
              el.classList.add('visible');
            });
          }, 100);
        }, 800);
      }, 600);
    });
  }

  // ---- Confetti ----
  function showConfetti() {
    const colors = ['#f5a623', '#e8567f', '#4ade80', '#a855f7', '#06b6d4', '#facc15', '#f472b6'];
    const shapes = ['square', 'circle'];

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const size = Math.random() * 8 + 6;
      const left = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const duration = Math.random() * 2 + 2;

      piece.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: ${shape === 'circle' ? '50%' : '2px'};
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
      `;
      document.body.appendChild(piece);

      setTimeout(() => piece.remove(), (delay + duration) * 1000 + 500);
    }
  }

  // ---- Countdown ----
  function startCountdown() {
    if (!config.eventDate) return;
    const target = new Date(config.eventDate).getTime();

    function update() {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        // Event has passed
        const cdEl = document.getElementById('countdown');
        const pastEl = document.getElementById('countdown-past');
        if (cdEl) cdEl.classList.add('hidden');
        if (pastEl) pastEl.classList.remove('hidden');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      animateNumber('cd-days', padZero(days));
      animateNumber('cd-hours', padZero(hours));
      animateNumber('cd-minutes', padZero(minutes));
      animateNumber('cd-seconds', padZero(seconds));

      requestAnimationFrame(() => setTimeout(update, 1000));
    }

    update();
  }

  function animateNumber(id, value) {
    const el = document.getElementById(id);
    if (!el || el.textContent === value) return;
    el.textContent = value;
    el.style.transform = 'scale(1.1)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 150);
  }

  // ---- RSVP ----
  function setupRSVP() {
    const form = document.getElementById('rsvp-form');
    const btnRetry = document.getElementById('btn-retry');
    if (!form) return;

    // Show/hide candidate dates based on attendance selection
    const attendanceRadios = form.querySelectorAll('input[name="attendance"]');
    const datesGroup = document.getElementById('candidate-dates-group');

    attendanceRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (datesGroup && config.candidateDates && config.candidateDates.length > 0) {
          if (radio.value === '参加') {
            datesGroup.style.display = '';
          } else {
            datesGroup.style.display = 'none';
            // Uncheck all candidate dates when declining
            const checkboxes = datesGroup.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => { cb.checked = false; });
          }
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const attendance = document.querySelector('input[name="attendance"]:checked')?.value || '';

      // Validate: if attending and candidate dates exist, at least one must be selected
      if (attendance === '参加' && config.candidateDates && config.candidateDates.length > 0) {
        const checkedDates = form.querySelectorAll('input[name="preferredDates"]:checked');
        if (checkedDates.length === 0) {
          alert('参加される場合は、希望日を1つ以上選択してください。');
          return;
        }
      }

      const btn = document.getElementById('btn-submit');
      const btnText = btn.querySelector('.btn-text');
      const btnLoader = btn.querySelector('.btn-loader');

      // Show loading
      btn.disabled = true;
      btnText.classList.add('hidden');
      btnLoader.classList.remove('hidden');

      // Gather preferred dates
      const preferredDates = [];
      form.querySelectorAll('input[name="preferredDates"]:checked').forEach(cb => {
        preferredDates.push(cb.value);
      });

      const formData = {
        name: document.getElementById('rsvp-name').value.trim(),
        attendance: attendance,
        preferredDates: preferredDates,
        message: document.getElementById('rsvp-message').value.trim(),
        timestamp: new Date().toISOString()
      };

      try {
        if (!config.gasUrl) {
          // No GAS URL configured - simulate success for demo
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('RSVP data (demo mode):', formData);
        } else {
          await fetch(config.gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        }

        form.classList.add('hidden');
        const successEl = document.getElementById('rsvp-success');
        if (formData.attendance === '不参加') {
          successEl.querySelector('.result-text').textContent = 'ご回答ありがとうございます！';
          successEl.querySelector('.result-sub').textContent = 'またの機会にぜひご参加ください🙏';
        }
        successEl.classList.remove('hidden');
      } catch (err) {
        console.error('RSVP submission failed:', err);
        form.classList.add('hidden');
        document.getElementById('rsvp-error').classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    });

    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        document.getElementById('rsvp-error').classList.add('hidden');
        form.classList.remove('hidden');
      });
    }
  }

  // ---- Gallery ----
  function setupGallery() {
    if (!config.showGallery || !config.photos || config.photos.length === 0) return;

    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    config.photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'gallery-item';
      item.innerHTML = `
        <img src="${escapeHTML(photo.src)}" alt="${escapeHTML(photo.caption || '')}" loading="lazy">
        ${photo.caption ? `<div class="gallery-caption">${escapeHTML(photo.caption)}</div>` : ''}
      `;
      item.addEventListener('click', () => openLightbox(index));
      grid.appendChild(item);
    });

    setupLightbox();
  }

  function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');

    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateLightbox(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateLightbox(1));

    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (!lightbox || lightbox.classList.contains('hidden')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });
  }

  function openLightbox(index) {
    lightboxIndex = index;
    updateLightbox();
    document.getElementById('lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function navigateLightbox(dir) {
    const photos = config.photos || [];
    lightboxIndex = (lightboxIndex + dir + photos.length) % photos.length;
    updateLightbox();
  }

  function updateLightbox() {
    const photos = config.photos || [];
    if (photos.length === 0) return;
    const photo = photos[lightboxIndex];
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    if (img) img.src = photo.src;
    if (img) img.alt = photo.caption || '';
    if (caption) caption.textContent = photo.caption || '';
  }

  // ---- Particles ----
  function setupParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const accents = getComputedStyle(document.documentElement);
    const color1 = accents.getPropertyValue('--accent-1').trim() || '#f5a623';
    const color2 = accents.getPropertyValue('--accent-2').trim() || '#e8567f';
    const colors = [color1, color2, color1 + '80', color2 + '80'];

    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 4 + 2;
      const color = colors[Math.floor(Math.random() * colors.length)];
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        animation-delay: ${Math.random() * 8}s;
        animation-duration: ${Math.random() * 6 + 5}s;
      `;
      container.appendChild(p);
    }
  }

  // ---- Scroll Observer ----
  function setupScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    // Re-observe when sections become visible
    const mutationObserver = new MutationObserver(() => {
      document.querySelectorAll('.animate-in:not(.visible)').forEach(el => {
        observer.observe(el);
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // ---- Helpers ----
  function showSection(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  }

  function fadeOutSection(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.95)';
    setTimeout(() => { el.classList.add('hidden'); }, 500);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function padZero(n) {
    return String(n).padStart(2, '0');
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
