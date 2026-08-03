class App {
  constructor() {
    this.supabase = null;
    this.isRegisterMode = false;
    this.currentUser = null;
    this.currentProfile = null;
    this.menus = [];
    this.members = [];
    this.products = [];
    this.iuranHistory = [];
    this.touringParticipants = [];
    this.tourings = [];
    this.boardMembers = [];
    this.galleryPhotos = [];
    this.baseKas = 0;
    this.approvedKasTotal = 0;
    this.adminWANumber = "6282146511484";
    this.selectedTouringId = null;
    this.initSupabase();
  }

  initSupabase() {
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      }
    } catch (e) {
      console.error('Init Supabase Client Error:', e);
    }
  }

  async init() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const dateInput = document.getElementById('iuran-tanggal');
    if (dateInput) dateInput.value = now.toISOString().slice(0,16);

    const savedKas = localStorage.getItem('itora_base_kas');
    if (savedKas) this.baseKas = parseFloat(savedKas);

    const savedWA = localStorage.getItem('itora_admin_wa');
    if (savedWA) this.adminWANumber = savedWA;
    this.updateWAUI();

    const colorInput = document.getElementById('menu-bg-color');
    const colorText = document.getElementById('menu-bg-color-text');
    if (colorInput && colorText) {
      colorInput.addEventListener('input', (e) => colorText.value = e.target.value);
      colorText.addEventListener('input', (e) => colorInput.value = e.target.value);
    }

    const iconColorInput = document.getElementById('menu-icon-color');
    const iconColorText = document.getElementById('menu-icon-color-text');
    if (iconColorInput && iconColorText) {
      iconColorInput.addEventListener('input', (e) => iconColorText.value = e.target.value);
      iconColorText.addEventListener('input', (e) => iconColorInput.value = e.target.value);
    }

    setTimeout(() => {
      const splash = document.getElementById('splash-screen');
      if (splash) splash.style.display = 'none';
      this.checkSession();
      this.checkScanUrl();
      this.updateUnreadCountBadge();
    }, 1000);
  }

  async checkScanUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const verifyId = urlParams.get('verify');

    if (verifyId && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('members')
          .select('*')
          .or(`id.eq.${verifyId},member_number.eq.${verifyId}`)
          .single();

        if (data && !error) {
          document.getElementById('scan-member-name').innerText = data.full_name || 'Anggota ITORA';
          document.getElementById('scan-member-nia').innerText = data.member_number || 'ITORA-BSN-0000';
          document.getElementById('scan-member-role').innerText = data.role || 'Anggota Resmi';
          document.getElementById('scan-member-bike').innerText = `${data.bike || 'Motor BSN'} (${data.plate || '-'})`;

          this.openModal('modal-scanned-member');
        } else {
          this.showToast('Data Anggota Tidak Ditemukan!', 'error');
        }
      } catch (e) {
        console.error('Scan error:', e);
      }
    }
  }

  updateWAUI() {
    const adminWAInput = document.getElementById('admin-wa-input');
    if (adminWAInput) adminWAInput.value = this.adminWANumber;

    const displayWA = document.getElementById('contact-wa-display');
    if (displayWA) displayWA.innerText = `+${this.adminWANumber}`;
  }

  adminUpdateWANumber() {
    const input = document.getElementById('admin-wa-input');
    if (!input) return;

    const val = input.value.trim();
    if (!val) {
      this.showToast('Nomor WA tidak boleh kosong!', 'error');
      return;
    }

    this.adminWANumber = val;
    localStorage.setItem('itora_admin_wa', val);
    this.updateWAUI();
    this.showToast('Nomor WhatsApp Berhasil Disimpan!', 'success');
  }

  async loadGalleryFromSupabase() {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase
        .from('gallery_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        this.galleryPhotos = data;
      } else {
        this.galleryPhotos = [];
      }
      this.renderGalleryUI();
    } catch (e) {
      console.error("Gallery load error:", e);
    }
  }

  renderGalleryUI() {
    const container = document.getElementById('gallery-grouped-container');
    if (!container) return;

    if (this.galleryPhotos.length === 0) {
      this.galleryPhotos = [
        { id: '1', touring_name: 'Touring Bromo Sunrise', image_url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800', caption: 'Kuda besi di lautan pasir Bromo' },
        { id: '2', touring_name: 'Touring Bromo Sunrise', image_url: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800', caption: 'Kebersamaan rombongan ITORA' },
        { id: '3', touring_name: 'Touring Batu Malang', image_url: 'https://images.unsplash.com/photo-1558980664-3a031cf67ea8?w=800', caption: 'Rest area Jalibar Batu' }
      ];
    }

    const grouped = {};
    this.galleryPhotos.forEach(p => {
      const groupName = p.touring_name || 'Kegiatan Umum';
      if (!grouped[groupName]) grouped[groupName] = [];
      grouped[groupName].push(p);
    });

    const isSuperAdmin = (this.currentUser && this.currentUser.email === 'mastrisnobpb@gmail.com');
    const isAdmin = (this.currentProfile?.role === 'Admin' || isSuperAdmin);

    container.innerHTML = Object.keys(grouped).map(groupTitle => `
      <div class="gallery-group">
        <div class="gallery-group-title">
          <i class="fa-solid fa-folder-open"></i> ${groupTitle} (${grouped[groupTitle].length} Foto)
        </div>

        <div class="gallery-compact-grid">
          ${grouped[groupTitle].map(img => `
            <div class="gallery-photo-item" onclick="app.openZoomPhoto('${img.image_url}', '${img.caption || ''}', '${img.touring_name}')">
              <img src="${img.image_url}" alt="${img.caption || 'Foto ITORA'}">
              
              <div class="gallery-watermark">
                <i class="fa-solid fa-shield"></i> ITORA BSN
              </div>

              ${isAdmin ? `
                <button type="button" class="btn btn-sm btn-danger" style="position:absolute; top:4px; right:4px; width:22px; height:22px; padding:0; font-size:0.6rem; border-radius:50%;" onclick="event.stopPropagation(); app.deleteGalleryPhoto('${img.id}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  openZoomPhoto(url, caption, touringName) {
    document.getElementById('zoom-photo-img').src = url;
    document.getElementById('zoom-photo-caption').innerText = caption || 'Dokumentasi Resmi ITORA BSN SURABAYA';
    document.getElementById('zoom-photo-touring').innerText = touringName || 'Kegiatan Komunitas';
    this.openModal('modal-zoom-photo');
  }

  openAddPhotoModal() {
    const selectEl = document.getElementById('photo-touring-name');
    if (!selectEl) return;

    const now = new Date();
    const pastTourings = this.tourings.filter(t => new Date(t.event_date) < now);

    let optionsHTML = '';

    if (pastTourings.length > 0) {
      optionsHTML += pastTourings.map(t => `<option value="${t.title}">${t.title}</option>`).join('');
    }

    optionsHTML += `
      <option value="Kopdar & Doa Bersama">Kopdar & Doa Bersama</option>
      <option value="Kegiatan Umum">Kegiatan Umum</option>
    `;

    selectEl.innerHTML = optionsHTML;
    this.openModal('modal-add-photo');
  }

  async handleSaveGalleryPhoto(e) {
    e.preventDefault();
    if (!this.supabase) return;

    const btnSave = document.getElementById('btn-save-photo');
    btnSave.disabled = true;

    const touringName = document.getElementById('photo-touring-name').value;
    const caption = document.getElementById('photo-caption-input').value.trim();
    const fileInput = document.getElementById('photo-file-input').files[0];

    try {
      if (!fileInput) throw new Error('Silakan pilih foto terlebih dahulu!');

      const compressed = await this.compressImage(fileInput, 300);
      const fileName = `gallery_${Date.now()}_${compressed.name}`;

      const { error: uploadErr } = await this.supabase.storage
        .from('gallery-images')
        .upload(fileName, compressed, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = this.supabase.storage.from('gallery-images').getPublicUrl(fileName);
      const imageUrl = urlData ? urlData.publicUrl : '';

      const { error: dbErr } = await this.supabase.from('gallery_photos').insert([{
        touring_name: touringName,
        image_url: imageUrl,
        caption: caption
      }]);

      if (dbErr) throw dbErr;

      this.showToast('Foto dokumentasi berhasil diupload!', 'success');
      this.closeModal('modal-add-photo');
      this.loadGalleryFromSupabase();

    } catch (err) {
      this.showToast('Gagal mengupload foto: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  async deleteGalleryPhoto(id) {
    if (!confirm('Hapus foto dokumentasi ini?')) return;
    if (!this.supabase) return;

    try {
      await this.supabase.from('gallery_photos').delete().eq('id', id);
      this.showToast('Foto berhasil dihapus!', 'info');
      this.loadGalleryFromSupabase();
    } catch (e) {
      this.showToast('Gagal menghapus foto.', 'error');
    }
  }

  async loadTouringsFromSupabase() {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase
        .from('tourings')
        .select('*')
        .order('event_date', { ascending: true });

      if (!error && data) {
        this.tourings = data;
      } else {
        this.tourings = [];
      }
      await this.loadTouringParticipants();
      this.renderTouringsUI();
    } catch (e) {
      console.error("Load tourings error:", e);
    }
  }

  renderTouringsUI() {
    const currentDate = new Date();
    
    const upcomingList = this.tourings.filter(t => new Date(t.event_date) >= currentDate);
    const historyList = this.tourings.filter(t => new Date(t.event_date) < currentDate);

    const statTouringEl = document.getElementById('stat-touring-count');
    if (statTouringEl) statTouringEl.innerText = upcomingList.length;

    const homeTitle = document.getElementById('home-touring-title');
    const homeSchedule = document.getElementById('home-touring-schedule');
    const homeMeeting = document.getElementById('home-touring-meeting');
    const homeJoinedBadge = document.getElementById('home-touring-joined-badge');

    if (upcomingList.length > 0) {
      const mainEvent = upcomingList[0];
      if (homeTitle) homeTitle.innerText = mainEvent.title;
      if (homeSchedule) homeSchedule.innerText = mainEvent.schedule_text || mainEvent.event_date;
      if (homeMeeting) homeMeeting.innerText = mainEvent.meeting_point || 'Surabaya';

      if (homeJoinedBadge) {
        const joinedCount = this.touringParticipants.filter(
          p => p.touring_id === mainEvent.id && (p.status === 'Ikut' || p.status === '✓ Ikut')
        ).length;
        homeJoinedBadge.innerHTML = `<i class="fa-solid fa-users"></i> ${joinedCount} Member Join`;
      }
    } else {
      if (homeTitle) homeTitle.innerText = "Belum Ada Agenda Mendatang";
      if (homeSchedule) homeSchedule.innerText = "-";
      if (homeMeeting) homeMeeting.innerText = "-";
      if (homeJoinedBadge) homeJoinedBadge.innerHTML = `<i class="fa-solid fa-users"></i> 0 Member Join`;
    }

    const isSuperAdmin = (this.currentUser && this.currentUser.email === 'mastrisnobpb@gmail.com');
    const isAdmin = (this.currentProfile?.role === 'Admin' || isSuperAdmin);

    const upcomingContainer = document.getElementById('touring-upcoming-list');
    if (upcomingContainer) {
      if (upcomingList.length === 0) {
        upcomingContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 15px; background: #fff; border-radius: 12px; border: 1px solid var(--border-dark);">Belum ada agenda touring mendatang.</p>';
      } else {
        upcomingContainer.innerHTML = upcomingList.map(t => {
          const participants = this.touringParticipants.filter(p => p.touring_id === t.id);
          const myParticipant = this.currentUser ? participants.find(p => p.user_id === this.currentUser.id) : null;
          const myStatus = myParticipant ? myParticipant.status : 'Belum Konfirmasi';
          const ikutCount = participants.filter(p => p.status === 'Ikut' || p.status === '✓ Ikut').length;

          return `
            <div class="touring-card">
              <div class="touring-card-header">
                <span class="badge badge-gold">Destinasi Utama</span>
                ${isAdmin ? `
                  <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn btn-sm btn-gold" style="padding: 4px 8px;" onclick="app.openEditTouringModal('${t.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button type="button" class="btn btn-sm btn-danger" style="padding: 4px 8px;" onclick="app.adminDeleteTouring('${t.id}')"><i class="fa-solid fa-trash"></i></button>
                  </div>
                ` : ''}
              </div>

              <div class="touring-title">${t.title}</div>

              <div class="touring-grid-info">
                <div class="touring-info-item">
                  <i class="fa-regular fa-calendar-check"></i>
                  <span>${t.schedule_text}</span>
                  <small>Jadwal</small>
                </div>
                <div class="touring-info-item">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${t.meeting_point}</span>
                  <small>Titik Kumpul</small>
                </div>
                <div class="touring-info-item">
                  <i class="fa-solid fa-gauge-high"></i>
                  <span>${t.distance}</span>
                  <small>Jarak</small>
                </div>
              </div>

              <button type="button" class="btn btn-primary btn-sm" onclick="window.open('${t.maps_url}', '_blank')">
                <i class="fa-solid fa-map-location-dot"></i> Buka Rute Google Maps
              </button>

              <div class="touring-actions">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="text-muted" style="font-size:0.75rem;">Status Anda: <strong style="color:${myStatus.includes('Ikut') ? '#059669' : myStatus === 'Absen' ? '#DC2626' : '#D97706'}">${myStatus}</strong></span>
                  <span class="badge badge-primary" style="font-size:0.65rem;">${ikutCount} Member Join</span>
                </div>
                <button type="button" class="btn btn-gold btn-sm" onclick="app.openAgendaRSVPModal('${t.id}')">
                  <i class="fa-solid fa-users-gear"></i> Konfirmasi Kehadiran / Lihat Peserta
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const historyContainer = document.getElementById('touring-history-list');
    if (historyContainer) {
      if (historyList.length === 0) {
        historyContainer.innerHTML = '<p class="text-muted" style="text-align:center; padding: 15px; background: #fff; border-radius: 12px; border: 1px solid var(--border-dark);">Belum ada riwayat touring terdahulu.</p>';
      } else {
        historyContainer.innerHTML = historyList.map(t => `
          <div class="touring-card" style="border-left: 4px solid var(--accent-gold);">
            <div class="touring-card-header">
              <span class="badge badge-warning">Selesai</span>
              ${isAdmin ? `
                <button type="button" class="btn btn-sm btn-danger" style="padding: 4px 8px;" onclick="app.adminDeleteTouring('${t.id}')"><i class="fa-solid fa-trash"></i></button>
              ` : ''}
            </div>

            <div class="touring-title" style="font-size: var(--font-base);">${t.title}</div>

            <div class="touring-grid-info">
              <div class="touring-info-item">
                <i class="fa-regular fa-calendar"></i>
                <span>${t.schedule_text}</span>
                <small>Tanggal</small>
              </div>
              <div class="touring-info-item">
                <i class="fa-solid fa-location-dot"></i>
                <span>${t.meeting_point}</span>
                <small>Lokasi</small>
              </div>
              <div class="touring-info-item">
                <i class="fa-solid fa-gauge-high"></i>
                <span>${t.distance}</span>
                <small>Jarak</small>
              </div>
            </div>
          </div>
        `).join('');
      }
    }
  }

  async loadAdminBoardList() {
    const container = document.getElementById('admin-board-list');
    if (!container || !this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('board_members')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data) {
        this.boardMembers = data;
        if (data.length === 0) {
          container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada data pengurus. Klik tombol "Tambah" di atas.</p>';
          return;
        }

        container.innerHTML = data.map(m => `
          <div class="menu-admin-item" style="padding:12px; border-radius:12px;">
            <div class="menu-admin-info">
              ${m.photo_url ? `<img src="${m.photo_url}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : `<i class="fa-solid fa-user-circle" style="font-size:32px; color:var(--primary);"></i>`}
              <div>
                <strong style="font-size:var(--font-base); font-weight:700;">${m.name}</strong>
                <span class="text-muted" style="display:block;">${m.title} (${m.role_category})</span>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-gold" style="width:auto;" onclick="app.editBoardModal('${m.id}')"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-danger" style="width:auto;" onclick="app.deleteBoardMember('${m.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `).join('');
      }
    } catch(e) {
      container.innerHTML = '<p class="text-muted" style="text-align:center; color:#EF4444;">Gagal memuat data pengurus.</p>';
    }
  }

  openAddBoardModal() {
    document.getElementById('form-board').reset();
    document.getElementById('board-id').value = '';
    this.openModal('modal-add-board');
  }

  editBoardModal(id) {
    const item = this.boardMembers.find(m => m.id === id);
    if (!item) return;

    document.getElementById('board-id').value = item.id;
    document.getElementById('board-name').value = item.name;
    document.getElementById('board-title').value = item.title;
    document.getElementById('board-role-category').value = item.role_category;
    document.getElementById('board-sort-order').value = item.sort_order || 1;

    this.openModal('modal-add-board');
  }

  async handleSaveBoardMember(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save-board');
    btn.disabled = true;

    const id = document.getElementById('board-id').value;
    const file = document.getElementById('board-photo-file').files[0];
    let photoUrl = '';

    try {
      if (file) {
        const compressed = await this.compressImage(file, 200);
        const fileName = `board_${Date.now()}_${compressed.name}`;
        const { error: uploadErr } = await this.supabase.storage.from('gallery-images').upload(fileName, compressed, { upsert: true });
        
        if (!uploadErr) {
          const { data: urlData } = this.supabase.storage.from('gallery-images').getPublicUrl(fileName);
          photoUrl = urlData ? urlData.publicUrl : '';
        }
      }

      const payload = {
        name: document.getElementById('board-name').value.trim(),
        title: document.getElementById('board-title').value.trim(),
        role_category: document.getElementById('board-role-category').value,
        sort_order: parseInt(document.getElementById('board-sort-order').value) || 1
      };

      if (photoUrl) payload.photo_url = photoUrl;

      let err;
      if (id) {
        ({ error: err } = await this.supabase.from('board_members').update(payload).eq('id', id));
      } else {
        ({ error: err } = await this.supabase.from('board_members').insert([payload]));
      }

      if (err) throw err;

      this.showToast('Data Pengurus Berhasil Disimpan!', 'success');
      this.closeModal('modal-add-board');
      document.getElementById('form-board').reset();
      this.loadAdminBoardList();

    } catch (error) {
      this.showToast('Gagal menyimpan pengurus: ' + error.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async deleteBoardMember(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data pengurus ini?')) return;
    try {
      await this.supabase.from('board_members').delete().eq('id', id);
      this.showToast('Pengurus berhasil dihapus!', 'success');
      this.loadAdminBoardList();
    } catch (e) {
      this.showToast('Gagal menghapus pengurus.', 'error');
    }
  }

  openAgendaRSVPModal(touringId) {
    this.selectedTouringId = touringId;
    const agenda = this.tourings.find(t => t.id === touringId);
    const titleEl = document.getElementById('rsvp-modal-agenda-title');
    if (titleEl) titleEl.innerText = agenda ? agenda.title : '-';

    this.renderTouringParticipantsList();
    this.openModal('modal-touring-rsvp');
  }

  openAddTouringModal() {
    document.getElementById('admin-touring-id').value = '';
    document.getElementById('admin-touring-title').value = '';
    document.getElementById('admin-touring-date-picker').value = '';
    document.getElementById('admin-touring-schedule-text').value = '';
    document.getElementById('admin-touring-meeting').value = '';
    document.getElementById('admin-touring-distance').value = '';
    document.getElementById('admin-touring-maps').value = '';
    this.openModal('modal-admin-touring');
  }

  openEditTouringModal(id) {
    const item = this.tourings.find(t => t.id === id);
    if (!item) return;

    document.getElementById('admin-touring-id').value = item.id;
    document.getElementById('admin-touring-title').value = item.title;
    document.getElementById('admin-touring-date-picker').value = item.event_date ? new Date(item.event_date).toISOString().split('T')[0] : '';
    document.getElementById('admin-touring-schedule-text').value = item.schedule_text;
    document.getElementById('admin-touring-meeting').value = item.meeting_point;
    document.getElementById('admin-touring-distance').value = item.distance;
    document.getElementById('admin-touring-maps').value = item.maps_url;

    this.openModal('modal-admin-touring');
  }

  async handleSaveTouring(e) {
    e.preventDefault();
    if (!this.supabase) return;

    const btnSave = document.getElementById('btn-save-touring');
    btnSave.disabled = true;

    const id = document.getElementById('admin-touring-id').value;
    const title = document.getElementById('admin-touring-title').value.trim();
    const datePicker = document.getElementById('admin-touring-date-picker').value;
    const scheduleText = document.getElementById('admin-touring-schedule-text').value.trim();
    const meeting = document.getElementById('admin-touring-meeting').value.trim();
    const distance = document.getElementById('admin-touring-distance').value.trim();
    const maps = document.getElementById('admin-touring-maps').value.trim();

    const payload = {
      title,
      event_date: new Date(datePicker).toISOString(),
      schedule_text: scheduleText,
      meeting_point: meeting,
      distance,
      maps_url: maps
    };

    try {
      let err;
      if (id) {
        ({ error: err } = await this.supabase.from('tourings').update(payload).eq('id', id));
      } else {
        ({ error: err } = await this.supabase.from('tourings').insert([payload]));
      }

      if (err) throw err;

      this.showToast('Agenda Touring Berhasil Disimpan!', 'success');
      this.closeModal('modal-admin-touring');
      
      if (!id) {
        await this.createNotification(
          null,
          "Jadwal Touring Baru! 📍",
          `Agenda Baru: ${title} (${scheduleText}) telah ditambahkan. Cek detail & rutenya sekarang!`,
          "touring"
        );
      }

      this.loadTouringsFromSupabase();

    } catch (error) {
      this.showToast('Gagal menyimpan touring: ' + error.message, 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  async adminDeleteTouring(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus agenda touring ini?')) return;
    if (!this.supabase) return;

    try {
      const { error } = await this.supabase.from('tourings').delete().eq('id', id);
      if (error) throw error;
      this.showToast('Agenda touring berhasil dihapus!', 'info');
      this.loadTouringsFromSupabase();
    } catch (e) {
      this.showToast('Gagal menghapus touring.', 'error');
    }
  }

  async loadTouringParticipants() {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('touring_participants')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        this.touringParticipants = data;
      } else {
        this.touringParticipants = [];
      }
    } catch (e) {
      console.error('Error load participants:', e);
    }
  }

  renderTouringParticipantsList() {
    const container = document.getElementById('touring-participants-list');
    const countBadge = document.getElementById('touring-count-badge');

    if (!container) return;

    const filtered = this.touringParticipants.filter(p => p.touring_id === this.selectedTouringId);
    const ikutCount = filtered.filter(d => d.status === 'Ikut' || d.status === '✓ Ikut').length;
    
    if (countBadge) countBadge.innerText = `${ikutCount} Anggota Ikut`;

    if (filtered.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada konfirmasi kehadiran dari anggota untuk agenda ini.</p>';
      return;
    }

    container.innerHTML = filtered.map(item => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border-dark);">
        <div>
          <strong style="font-size: var(--font-base);">${item.member_name}</strong>
          <span class="text-muted" style="display:block; font-size: var(--font-xs);">${item.plate || '-'}</span>
        </div>
        <span class="badge ${item.status.includes('Ikut') ? 'badge-success' : 'badge-danger'}">
          ${item.status.includes('Ikut') ? '✓ Ikut' : '✕ Tidak Ikut'}
        </span>
      </div>
    `).join('');
  }

  async submitTouringRSVP(status) {
    if (!this.currentUser || !this.supabase) {
      this.showToast('Silakan login terlebih dahulu!', 'error');
      return;
    }

    if (!this.selectedTouringId) {
      this.showToast('Agenda touring belum dipilih!', 'error');
      return;
    }

    const name = this.currentProfile?.full_name || 'Anggota ITORA';
    const plate = this.currentProfile?.plate || '-';
    const agenda = this.tourings.find(t => t.id === this.selectedTouringId);
    const agendaTitle = agenda ? agenda.title : 'Touring';

    try {
      const { error } = await this.supabase
        .from('touring_participants')
        .upsert([{
          user_id: this.currentUser.id,
          touring_id: this.selectedTouringId,
          member_name: name,
          plate: plate,
          status: status
        }], { onConflict: 'user_id,touring_id' });

      if (error) throw error;

      this.showToast(`Konfirmasi berhasil untuk agenda ${agendaTitle}: Anda memilih "${status}"`, 'success');
      
      await this.createNotification(
        this.currentUser.id,
        `Konfirmasi Touring ${agendaTitle} 🏍️`,
        `Status kehadiran Anda telah berhasil dicatat sebagai: ${status.toUpperCase()}.`,
        "touring"
      );

      await this.loadTouringParticipants();
      this.renderTouringParticipantsList();
      this.renderTouringsUI();

      if (status === 'Ikut') {
        const targetWA = this.adminWANumber || "6281234567890";
        const msg = `Halo Admin ITORA,%0ASaya *${name}* (${plate}) mengonfirmasi *IKUT* pada kegiatan Touring: *${agendaTitle}*.`;
        setTimeout(() => window.open(`https://wa.me/${targetWA}?text=${msg}`, '_blank'), 1000);
      }

    } catch (e) {
      this.showToast('Gagal menyimpan konfirmasi: ' + e.message, 'error');
    }
  }

  compressImage(file, maxKB = 200) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const maxDimension = 1200;
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);

          while (dataUrl.length / 1024 > maxKB && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
              const compressedFile = new File([blob], `compressed_${file.name.split('.')[0]}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            })
            .catch(err => reject(err));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  async checkSession() {
    if (!this.supabase) {
      this.hideDashboard();
      return;
    }

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session && session.user) {
        this.currentUser = session.user;
        await this.validateUserFlow();
      } else {
        this.hideDashboard();
      }

      this.supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && session.user) {
          this.currentUser = session.user;
          await this.validateUserFlow();
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.hideDashboard();
        }
      });
    } catch (err) {
      this.hideDashboard();
    }
  }

  async validateUserFlow() {
    if (!this.currentUser) return;
    const email = this.currentUser.email;

    if (email === 'mastrisnobpb@gmail.com') {
      this.showDashboard();
      return;
    }

    await this.loadUserProfileDetails();

    if (!this.currentProfile || !this.currentProfile.full_name || this.currentProfile.full_name === email.split('@')[0]) {
      this.showCompleteDataScreen();
      return;
    }

    if (this.currentProfile.approval_status === 'Approved') {
      this.showDashboard();
    } else {
      this.showPendingApprovalScreen();
    }
  }

  showCompleteDataScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('pending-approval-screen').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('complete-data-screen').style.display = 'flex';
  }

  showPendingApprovalScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('complete-data-screen').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('pending-approval-screen').style.display = 'flex';

    const titleEl = document.getElementById('approval-status-title');
    const badgeEl = document.getElementById('approval-status-badge');
    const descEl = document.getElementById('approval-status-desc');
    const iconEl = document.getElementById('approval-status-icon');

    if (this.currentProfile && this.currentProfile.approval_status === 'Rejected') {
      if (titleEl) titleEl.innerText = 'Pendaftaran Ditolak';
      if (badgeEl) {
        badgeEl.innerText = 'Status: Ditolak (Rejected)';
        badgeEl.className = 'badge badge-danger';
      }
      if (descEl) descEl.innerHTML = 'Mohon maaf, pengajuan pendaftaran anggota Anda ditolak oleh pengurus/admin. Silakan hubungi pengurus untuk konfirmasi lebih lanjut.';
      if (iconEl) {
        iconEl.className = 'fa-solid fa-circle-xmark auth-icon';
        iconEl.style.color = '#EF4444';
      }
    } else {
      if (titleEl) titleEl.innerText = 'Menunggu Persetujuan';
      if (badgeEl) {
        badgeEl.innerText = 'Status: Pending Approval';
        badgeEl.className = 'badge badge-warning';
      }
      if (descEl) descEl.innerHTML = 'Data diri Anda telah dikirim. Akun Anda sedang ditinjau oleh <strong>Pengurus / Super Admin ITORA BSN SURABAYA</strong>.';
      if (iconEl) {
        iconEl.className = 'fa-solid fa-clock-rotate-left auth-icon';
        iconEl.style.color = '#F59E0B';
      }
    }
  }

  showDashboard() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('complete-data-screen').style.display = 'none';
    document.getElementById('pending-approval-screen').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'block';

    this.loadMenusFromSupabase();
    this.loadProductsFromSupabase();
    this.updateUserUI();
    this.loadMembersFromSupabase();
    this.loadIuranHistory();
    this.calculateTotalKas();
    this.loadBreakingNewsText();
    this.loadTouringsFromSupabase();
    this.loadGalleryFromSupabase();

    this.checkRealtimeNotifications();
    this.subscribeToRealtimeChanges();
  }

  hideDashboard() {
    document.getElementById('app-dashboard').style.display = 'none';
    document.getElementById('complete-data-screen').style.display = 'none';
    document.getElementById('pending-approval-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  }

  toggleAuthMode() {
    this.isRegisterMode = !this.isRegisterMode;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleBtn = document.getElementById('auth-toggle-btn');

    if (this.isRegisterMode) {
      title.innerText = 'Daftar Anggota Baru';
      subtitle.innerText = 'Lengkapi data akun anggota ITORA Anda';
      submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Daftar Sekarang';
      toggleBtn.innerText = 'Sudah Memiliki Akun? Masuk Disini';
    } else {
      title.innerText = 'Masuk Anggota';
      subtitle.innerText = 'Gunakan email & kata sandi akun ITORA Anda';
      submitBtn.innerHTML = '<i class="fa-solid fa-motorcycle"></i> Masuk Sekarang';
      toggleBtn.innerText = 'Belum Memiliki Akun? Daftar Disini';
    }
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!this.supabase) {
      this.showToast('Koneksi Supabase tidak tersedia!', 'error');
      return;
    }

    const submitBtn = document.getElementById('auth-submit-btn');
    submitBtn.disabled = true;

    try {
      if (this.isRegisterMode) {
        const { data, error } = await this.supabase.auth.signUp({ email, password });
        if (error) throw error;

        this.showToast('Pendaftaran Akun Berhasil! Silakan lengkapi data diri Anda.', 'success');
        this.currentUser = data.user;

        if (this.currentUser) {
          this.currentProfile = null;
          this.showCompleteDataScreen();
        } else {
          this.toggleAuthMode();
        }
      } else {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.showToast('Login Berhasil!', 'success');
        this.currentUser = data.user;
        await this.validateUserFlow();
      }
    } catch (err) {
      this.showToast(err.message || 'Gagal login/daftar.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  }

  async handleSaveInitialData(e) {
    e.preventDefault();
    if (!this.currentUser || !this.supabase) return;

    const btnSubmit = document.getElementById('btn-submit-init-data');
    btnSubmit.disabled = true;

    const fullName = document.getElementById('init-fullname').value.trim();
    const phone = document.getElementById('init-phone').value.trim();
    const bike = document.getElementById('init-bike').value.trim();
    const plate = document.getElementById('init-plate').value.trim();

    const memberNumber = `ITORA-BSN-${this.currentUser.id.substring(0, 4).toUpperCase()}`;

    try {
      const { error } = await this.supabase.from('members').upsert([{
        id: this.currentUser.id,
        full_name: fullName,
        email: this.currentUser.email,
        phone: phone,
        bike: bike,
        plate: plate,
        member_number: memberNumber,
        role: 'Anggota Resmi',
        approval_status: 'Pending'
      }], { onConflict: 'id' });

      if (error) throw error;

      this.showToast('Data berhasil dikirim! Menunggu persetujuan Admin.', 'success');
      await this.loadUserProfileDetails();
      this.showPendingApprovalScreen();
    } catch(err) {
      console.error(err);
      this.showToast('Gagal menyimpan data diri: ' + err.message, 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  }

  contactAdminForApproval() {
    const targetWA = this.adminWANumber || "6281234567890";
    const myName = this.currentProfile?.full_name || this.currentUser.email;
    const msg = `Halo Pengurus ITORA BSN SURABAYA,%0ASaya *${myName}* (${this.currentUser.email}) telah melengkapi data pendaftaran anggota.%0A%0AMohon bantuannya untuk verifikasi & persetujuan akun saya. Terima kasih!`;
    window.open(`https://wa.me/${targetWA}?text=${msg}`, '_blank');
  }

  async handleLogout() {
    if (this.supabase) await this.supabase.auth.signOut().catch(()=>{});
    this.currentUser = null;
    this.currentProfile = null;
    this.hideDashboard();
    this.showToast('Anda telah keluar dari akun.', 'info');
  }

  async loadUserProfileDetails() {
    if (!this.currentUser || !this.supabase) return;
    try {
      const { data, error } = await this.supabase.from('members').select('*').eq('id', this.currentUser.id).single();
      if (!error && data) {
        this.currentProfile = data;
      } else {
        this.currentProfile = null;
      }
    } catch (e) {
      this.currentProfile = null;
    }
  }

  async loadBreakingNewsText() {
    const tickerEl = document.getElementById('breaking-news-text');
    if (!tickerEl || !this.supabase) return;

    try {
      let newsItems = [];

      const { data: recentMembers } = await this.supabase
        .from('members')
        .select('full_name')
        .neq('email', 'mastrisnobpb@gmail.com')
        .eq('approval_status', 'Approved')
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentMembers && recentMembers.length > 0) {
        recentMembers.forEach(m => {
          newsItems.push(`🎉 Welcome Anggota Baru: <b>${m.full_name}</b>`);
        });
      }

      const { data: recentDues } = await this.supabase
        .from('dues')
        .select('member_name, period_month')
        .eq('status', 'Verified')
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentDues && recentDues.length > 0) {
        recentDues.forEach(d => {
          newsItems.push(`💸 Setor Iuran Lunas: <b>${d.member_name}</b> (${d.period_month})`);
        });
      }

      const { data: recentOrders } = await this.supabase
        .from('orders')
        .select('member_name, item_name')
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentOrders && recentOrders.length > 0) {
        recentOrders.forEach(o => {
          newsItems.push(`🛍️ Pemesanan Merch: <b>${o.member_name}</b> memproses ${o.item_name}`);
        });
      }

      if (newsItems.length > 0) {
        tickerEl.innerHTML = newsItems.join(' &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; ');
      } else {
        tickerEl.innerHTML = "Selamat Datang di PWA Aplikasi Komunitas ITORA BSN Surabaya! • Tetap Utamakan Safety Riding!";
      }

    } catch (e) {
      tickerEl.innerHTML = "Selamat Datang di PWA Aplikasi Komunitas ITORA BSN Surabaya!";
    }
  }

  updateUserUI() {
    if (!this.currentUser) return;
    const isSuperAdmin = (this.currentUser.email === 'mastrisnobpb@gmail.com');
    const userRole = isSuperAdmin ? 'Super Admin' : (this.currentProfile?.role || 'Anggota Resmi');
    const canManageAdmin = (isSuperAdmin || userRole === 'Admin');

    const displayName = isSuperAdmin ? 'Super Admin ITORA' : (this.currentProfile?.full_name || 'Sutrisno');

    document.getElementById('user-greeting').innerText = `Salam, ${displayName}!`;
    document.getElementById('profile-name').innerText = displayName;
    document.getElementById('profile-email').innerText = this.currentUser.email;
    document.getElementById('profile-role').innerText = userRole;
    document.getElementById('profile-avatar').innerText = displayName.charAt(0).toUpperCase();

    const adminProfileBtn = document.getElementById('btn-admin-panel-profile');
    if (adminProfileBtn) adminProfileBtn.style.display = canManageAdmin ? 'flex' : 'none';

    const adminAddBtn = document.getElementById('admin-add-touring-btn');
    if (adminAddBtn) adminAddBtn.style.display = canManageAdmin ? 'inline-block' : 'none';

    const adminAddPhotoBtn = document.getElementById('admin-add-photo-btn');
    if (adminAddPhotoBtn) adminAddPhotoBtn.style.display = canManageAdmin ? 'inline-block' : 'none';

    if (canManageAdmin) {
      this.loadAdminPendingMembersList();
      this.loadAdminDuesList();
      this.loadAdminOrdersList();
      this.loadAdminProductsList();
      this.loadAdminRolesList();
      this.loadAdminBoardList();
    }

    const niaCode = this.currentProfile?.member_number || `ITORA-BSN-${this.currentUser.id ? this.currentUser.id.substring(0, 4).toUpperCase() : '0000'}`;
    document.getElementById('profile-nia').innerText = niaCode;
    document.getElementById('profile-phone').innerText = this.currentProfile?.phone || '-';
    document.getElementById('profile-bike').innerText = this.currentProfile?.bike || 'Motor BSN';
    document.getElementById('profile-plate').innerText = this.currentProfile?.plate || 'L 1234 IT';

    document.getElementById('edit-fullname').value = displayName;
    document.getElementById('edit-phone').value = this.currentProfile?.phone || '';
    document.getElementById('edit-bike').value = this.currentProfile?.bike || '';
    document.getElementById('edit-plate').value = this.currentProfile?.plate || '';

    this.generateQRCode(niaCode);
  }

  async handleSaveProfile(e) {
    e.preventDefault();
    if (!this.currentUser || !this.supabase) return;

    const btnSave = document.getElementById('btn-save-profile');
    btnSave.disabled = true;

    try {
      const { error } = await this.supabase.from('members').upsert([{
        id: this.currentUser.id,
        full_name: document.getElementById('edit-fullname').value.trim(),
        email: this.currentUser.email,
        phone: document.getElementById('edit-phone').value.trim() || '-',
        bike: document.getElementById('edit-bike').value.trim() || 'Motor BSN',
        plate: document.getElementById('edit-plate').value.trim() || '-',
        member_number: this.currentProfile?.member_number || `ITORA-BSN-${this.currentUser.id.substring(0, 4).toUpperCase()}`,
        role: (this.currentUser.email === 'mastrisnobpb@gmail.com') ? 'Super Admin' : (this.currentProfile?.role || 'Anggota Resmi'),
        approval_status: 'Approved'
      }], { onConflict: 'id' });

      if (error) throw error;
      
      this.showToast('Profil Berhasil Diperbarui!', 'success');
      this.closeModal('modal-edit-profile');

      await this.createNotification(
        this.currentUser.id,
        "Profil Berhasil Diperbarui 👤",
        "Data diri dan kendaraan Anda telah berhasil diperbarui di sistem ITORA BSN.",
        "auth"
      );

      await this.loadUserProfileDetails();
      this.updateUserUI();
      this.loadMembersFromSupabase();
    } catch (err) {
      this.showToast('Gagal memperbarui profil.', 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  async loadAdminRolesList() {
    const container = document.getElementById('admin-roles-list');
    if (!container || !this.supabase) return;

    try {
      const { data: approvedMembers, error } = await this.supabase
        .from('members')
        .select('*')
        .neq('email', 'mastrisnobpb@gmail.com')
        .eq('approval_status', 'Approved')
        .order('created_at', { ascending: false });

      if (!error && approvedMembers && approvedMembers.length > 0) {
        container.innerHTML = approvedMembers.map(m => `
          <div class="menu-admin-item" style="flex-direction:column; align-items:flex-start; gap:10px; padding:14px; border-radius:12px; background:#F8FAFC;">
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
              <div>
                <strong style="font-size:var(--font-base); font-weight:700;">${m.full_name || 'Anggota'}</strong>
                <span class="text-muted" style="display:block;">${m.email} (${m.phone || '-'})</span>
              </div>
              <span class="badge badge-primary">${m.role || 'Anggota Resmi'}</span>
            </div>
            
            <div style="display:flex; gap:8px; width:100%; align-items:center; margin-top:4px;">
              <select class="input-control" style="padding:8px 12px; font-size:var(--font-xs); border-radius:8px;" id="role-select-${m.id}">
                <option value="Anggota Resmi" ${m.role === 'Anggota Resmi' ? 'selected' : ''}>Anggota Resmi</option>
                <option value="Admin" ${m.role === 'Admin' ? 'selected' : ''}>Admin</option>
                <option value="Ketua" ${m.role === 'Ketua' ? 'selected' : ''}>Ketua</option>
                <option value="Bendahara" ${m.role === 'Bendahara' ? 'selected' : ''}>Bendahara</option>
                <option value="Sekretaris" ${m.role === 'Sekretaris' ? 'selected' : ''}>Sekretaris</option>
                <option value="Super Admin" ${m.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
              </select>
              <button type="button" class="btn btn-sm btn-gold" style="width:auto; white-space:nowrap; padding:8px 14px; border-radius:8px;" onclick="app.adminUpdateMemberRole('${m.id}')">
                <i class="fa-solid fa-floppy-disk"></i> Simpan
              </button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada anggota terverifikasi.</p>';
      }
    } catch (e) {
      console.error(e);
    }
  }

  async adminUpdateMemberRole(memberId) {
    if (!this.supabase) return;
    const roleSelect = document.getElementById(`role-select-${memberId}`);
    if (!roleSelect) return;

    const newRole = roleSelect.value;

    try {
      const { error } = await this.supabase
        .from('members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      this.showToast(`Jabatan / Role Berhasil Diubah Menjadi: ${newRole}!`, 'success');
      
      await this.createNotification(
        memberId,
        "Pembaruan Jabatan Komunitas 🎖️",
        `Jabatan / Role Anda di komunitas ITORA BSN telah diperbarui menjadi: ${newRole}.`,
        "member"
      );

      this.loadAdminRolesList();
      this.loadMembersFromSupabase();
    } catch (e) {
      this.showToast('Gagal mengubah role anggota.', 'error');
    }
  }

  async loadProductsFromSupabase() {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        this.products = data;
        this.renderShopGrid();
      }
    } catch(e) {
      console.error(e);
    }
  }

  renderShopGrid() {
    const container = document.getElementById('public-products-grid');
    if (!container) return;

    if (this.products.length === 0) {
      container.innerHTML = '<p class="text-muted" style="grid-column: span 2; text-align:center; padding:20px;">Belum ada produk merchandise tersedia.</p>';
      return;
    }

    container.innerHTML = this.products.map(p => {
      const imgUrl = p.image_url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500';
      const formattedPrice = `Rp ${parseFloat(p.price).toLocaleString('id-ID')}`;

      return `
        <div class="product-card">
          <div class="product-img-wrapper" onclick="app.openZoomPhoto('${imgUrl}', '${p.title} - ${formattedPrice}', 'Merchandise ITORA')">
            <img src="${imgUrl}" alt="${p.title}">
            <span class="product-badge ${p.stock_status === 'Ready Stock' ? 'badge-success' : 'badge-warning'}">${p.stock_status || 'Ready'}</span>
          </div>
          <div class="product-info">
            <div>
              <div class="product-title">${p.title}</div>
              <div class="product-price">${formattedPrice}</div>
            </div>
            <button type="button" class="btn btn-sm btn-primary" onclick="app.openOrderMerchModal('${p.id}')">
              <i class="fa-solid fa-cart-plus"></i> Pesan
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openOrderMerchModal(productId) {
    const p = this.products.find(item => item.id === productId);
    if (p) {
      document.getElementById('merch-item-name').value = p.title;
      document.getElementById('merch-item-price').value = `Rp ${parseFloat(p.price).toLocaleString('id-ID')}`;
    }
    this.openModal('modal-order-merch');
  }

  async loadAdminProductsList() {
    const container = document.getElementById('admin-products-list');
    if (!container || !this.supabase) return;

    try {
      const { data: prods, error } = await this.supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && prods && prods.length > 0) {
        container.innerHTML = prods.map(p => `
          <div class="menu-admin-item" style="padding:12px; border-radius:12px;">
            <div class="menu-admin-info">
              <img src="${p.image_url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500'}" style="border-radius:8px; width:40px; height:40px; object-fit:cover;">
              <div>
                <strong style="font-size:var(--font-base); font-weight:700;">${p.title}</strong>
                <span class="text-muted" style="display:block;">Rp ${parseFloat(p.price).toLocaleString('id-ID')} (${p.stock_status})</span>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-gold" onclick="app.editProductModal('${p.id}')"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-sm btn-danger" onclick="app.adminDeleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada produk di katalog.</p>';
      }
    } catch(e) {}
  }

  editProductModal(productId) {
    const p = this.products.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('product-id').value = p.id;
    document.getElementById('product-title').value = p.title;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-stock').value = p.stock_status || 'Ready Stock';
    document.getElementById('product-desc').value = p.description || '';

    this.openModal('modal-add-product');
  }

  async handleSaveProduct(e) {
    e.preventDefault();
    if (!this.supabase) return;

    const btnSave = document.getElementById('btn-save-product');
    btnSave.disabled = true;

    const id = document.getElementById('product-id').value;
    const imageFile = document.getElementById('product-image-file').files[0];
    let imageUrl = '';

    try {
      if (imageFile) {
        const compressed = await this.compressImage(imageFile, 200);
        const fileName = `product_${Date.now()}_${compressed.name}`;
        const { error: uploadErr } = await this.supabase.storage.from('product-images').upload(fileName, compressed, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = this.supabase.storage.from('product-images').getPublicUrl(fileName);
          imageUrl = urlData ? urlData.publicUrl : '';
        }
      }

      const payload = {
        title: document.getElementById('product-title').value.trim(),
        price: parseFloat(document.getElementById('product-price').value) || 0,
        stock_status: document.getElementById('product-stock').value,
        description: document.getElementById('product-desc').value.trim(),
        is_active: true
      };

      if (imageUrl) payload.image_url = imageUrl;

      let dbError;
      if (id) {
        ({ error: dbError } = await this.supabase.from('products').update(payload).eq('id', id));
      } else {
        ({ error: dbError } = await this.supabase.from('products').insert([payload]));
      }

      if (dbError) throw dbError;

      this.showToast('Produk Berhasil Disimpan!', 'success');
      this.closeModal('modal-add-product');
      document.getElementById('form-product').reset();
      document.getElementById('product-id').value = '';
      this.loadProductsFromSupabase();
      this.loadAdminProductsList();

    } catch(err) {
      this.showToast('Gagal menyimpan produk: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  async adminDeleteProduct(productId) {
    if (!confirm('Hapus produk ini dari katalog toko?')) return;
    if (!this.supabase) return;
    try {
      await this.supabase.from('products').delete().eq('id', productId);
      this.showToast('Produk berhasil dihapus!', 'success');
      this.loadProductsFromSupabase();
      this.loadAdminProductsList();
    } catch(e) {
      this.showToast('Gagal menghapus produk.', 'error');
    }
  }

  async loadMenusFromSupabase() {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase
        .from('menus')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data) {
        this.menus = data;
        this.renderDynamicMenus();
        if (this.currentUser && (this.currentUser.email === 'mastrisnobpb@gmail.com' || this.currentProfile?.role === 'Admin')) {
          this.renderAdminMenuList();
        }
      } else {
        this.renderDynamicMenus();
      }
    } catch (e) {
      console.error('Error fetching menus:', e);
      this.renderDynamicMenus();
    }
  }

  renderDynamicMenus() {
    const isSuperAdmin = (this.currentUser && this.currentUser.email === 'mastrisnobpb@gmail.com');
    const isAdmin = (this.currentProfile?.role === 'Admin' || isSuperAdmin);

    let navItems = this.menus.filter(m => m.is_active && m.show_in_bottom_nav);

    if (navItems.length === 0) {
      navItems = [
        { menu_key: 'beranda', title: 'Beranda', icon_class: 'fa-solid fa-house' },
        { menu_key: 'event', title: 'Event', icon_class: 'fa-solid fa-calendar-days' },
        { menu_key: 'touring', title: 'Touring', icon_class: 'fa-solid fa-route' },
        { menu_key: 'profil', title: 'Profil', icon_class: 'fa-solid fa-user' }
      ];
    }

    const quickMenuContainer = document.getElementById('dynamic-quick-menu');
    if (quickMenuContainer) {
      const quickItems = this.menus.filter(m => m.is_active && m.show_in_quick_menu);
      if (quickItems.length > 0) {
        quickMenuContainer.innerHTML = quickItems.map(m => {
          if (m.menu_key === 'admin' && !isAdmin) return '';

          let actionCall = `app.navigateTo('${m.menu_key}')`;
          if (m.menu_key === 'setor_iuran') actionCall = `app.openModal('modal-iuran')`;
          if (m.menu_key === 'keluar') actionCall = `app.handleLogout()`;

          const customBg = m.bg_color || '#F1F5F9';
          const customIconColor = m.icon_color || '#00875A';

          const iconContent = m.image_url 
            ? `<img src="${m.image_url}" alt="${m.title}" style="width: 24px; height: 24px; object-fit: contain;">`
            : `<i class="${m.icon_class}" style="color: ${customIconColor};"></i>`;

          return `
            <div class="quick-item" onclick="${actionCall}">
              <div class="quick-icon" style="background-color: ${customBg};">
                ${iconContent}
                ${m.menu_key === 'admin' ? '<span class="notification-badge" id="admin-notif-dot"></span>' : ''}
              </div>
              <span>${m.title}</span>
            </div>
          `;
        }).join('');
      }
    }

    const bottomNavContainer = document.getElementById('dynamic-bottom-nav');
    if (bottomNavContainer) {
      bottomNavContainer.innerHTML = navItems.map((m, index) => {
        const iconContent = m.image_url 
          ? `<img src="${m.image_url}" alt="${m.title}" style="width: 20px; height: 20px; object-fit: contain;">`
          : `<i class="${m.icon_class}"></i>`;

        return `
          <a class="nav-item ${index === 0 ? 'active' : ''}" onclick="app.navigateTo('${m.menu_key}')" id="nav-${m.menu_key}">
            ${iconContent}
            <span>${m.title}</span>
          </a>
        `;
      }).join('');
    }
  }

  renderAdminMenuList() {
    const container = document.getElementById('admin-menu-list');
    if (!container) return;

    container.innerHTML = this.menus.map(m => `
      <div class="menu-admin-item" style="padding:12px; border-radius:12px;">
        <div class="menu-admin-info">
          ${m.image_url ? `<img src="${m.image_url}">` : `<i class="${m.icon_class}" style="color: ${m.icon_color || '#00875A'}"></i>`}
          <div>
            <strong style="font-size:var(--font-base); font-weight:700;">${m.title}</strong>
            <span class="text-muted" style="display:block;">Bg: ${m.bg_color || '#F1F5F9'} | Icon: ${m.icon_color || '#00875A'}</span>
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn-sm ${m.is_active ? 'btn-primary' : 'btn-danger'}" onclick="app.toggleMenuStatus('${m.id}', ${!m.is_active})">
            ${m.is_active ? 'Aktif' : 'Nonaktif'}
          </button>
          <button class="btn btn-sm btn-gold" onclick="app.editMenuModal('${m.id}')"><i class="fa-solid fa-pen"></i></button>
        </div>
      </div>
    `).join('');
  }

  async toggleMenuStatus(menuId, newStatus) {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase.from('menus').update({ is_active: newStatus }).eq('id', menuId);
      if (error) throw error;
      this.showToast('Status menu diperbarui!', 'success');
      this.loadMenusFromSupabase();
    } catch (e) {
      this.showToast('Gagal mengubah status menu.', 'error');
    }
  }

  editMenuModal(menuId) {
    const menu = this.menus.find(m => m.id === menuId);
    if (!menu) return;

    document.getElementById('menu-id').value = menu.id;
    document.getElementById('menu-key').value = menu.menu_key;
    document.getElementById('menu-title').value = menu.title;
    document.getElementById('menu-icon').value = menu.icon_class;
    document.getElementById('menu-order').value = menu.sort_order;
    document.getElementById('menu-bg-color').value = menu.bg_color || '#F1F5F9';
    document.getElementById('menu-bg-color-text').value = menu.bg_color || '#F1F5F9';
    document.getElementById('menu-icon-color').value = menu.icon_color || '#00875A';
    document.getElementById('menu-icon-color-text').value = menu.icon_color || '#00875A';
    document.getElementById('menu-show-quick').checked = menu.show_in_quick_menu;
    document.getElementById('menu-show-bottom').checked = menu.show_in_bottom_nav;

    this.openModal('modal-add-menu');
  }

  async handleSaveMenu(e) {
    e.preventDefault();
    if (!this.supabase) return;

    const btnSave = document.getElementById('btn-save-menu');
    btnSave.disabled = true;

    const id = document.getElementById('menu-id').value;
    const imageFileInput = document.getElementById('menu-image-file').files[0];
    let imageUrl = '';

    try {
      if (imageFileInput) {
        const compressedFile = await this.compressImage(imageFileInput, 200);
        const fileName = `icon_${Date.now()}_${compressedFile.name}`;

        const { error: uploadErr } = await this.supabase.storage
          .from('menu-icons')
          .upload(fileName, compressedFile, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = this.supabase.storage.from('menu-icons').getPublicUrl(fileName);
        imageUrl = urlData ? urlData.publicUrl : '';
      }

      const payload = {
        menu_key: document.getElementById('menu-key').value.trim().toLowerCase(),
        title: document.getElementById('menu-title').value.trim(),
        icon_class: document.getElementById('menu-icon').value.trim() || 'fa-solid fa-square',
        bg_color: document.getElementById('menu-bg-color').value,
        icon_color: document.getElementById('menu-icon-color').value,
        sort_order: parseInt(document.getElementById('menu-order').value) || 0,
        show_in_quick_menu: document.getElementById('menu-show-quick').checked,
        show_in_bottom_nav: document.getElementById('menu-show-bottom').checked
      };

      if (imageUrl) payload.image_url = imageUrl;

      let dbError;
      if (id) {
        ({ error: dbError } = await this.supabase.from('menus').update(payload).eq('id', id));
      } else {
        ({ error: dbError } = await this.supabase.from('menus').insert([payload]));
      }

      if (dbError) throw dbError;

      this.showToast('Menu Berhasil Disimpan!', 'success');
      this.closeModal('modal-add-menu');
      document.getElementById('form-menu').reset();
      document.getElementById('menu-id').value = '';
      this.loadMenusFromSupabase();

    } catch (err) {
      this.showToast('Gagal menyimpan menu: ' + err.message, 'error');
    } finally {
      btnSave.disabled = false;
    }
  }

  async handleOrderMerchSubmit(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const btnSubmit = document.getElementById('btn-submit-merch');
    btnSubmit.disabled = true;

    const itemName = document.getElementById('merch-item-name').value;
    const size = document.getElementById('merch-item-size').value;
    const qty = parseInt(document.getElementById('merch-item-qty').value) || 1;
    const note = document.getElementById('merch-item-note').value.trim();

    const rawPriceText = document.getElementById('merch-item-price').value.replace(/[^0-9]/g, '');
    let basePrice = parseInt(rawPriceText) || 125000;
    if (size === 'XXL') basePrice += 10000;
    const totalPrice = basePrice * qty;

    const userName = this.currentProfile?.full_name || 'Sutrisno';
    const userPhone = this.currentProfile?.phone || '-';
    const userPlate = this.currentProfile?.plate || '-';

    try {
      if (this.supabase) {
        await this.supabase.from('orders').insert([{
          user_id: this.currentUser.id,
          member_name: userName,
          item_name: `${itemName} (${size}) x${qty}`,
          price: totalPrice,
          status: 'Pending'
        }]);
      }

      this.showToast('Pesanan tersimpan! Mengalihkan ke WhatsApp Admin...', 'success');
      this.closeModal('modal-order-merch');

      const targetWA = this.adminWANumber || "6281234567890";
      const waMsg = `Halo Admin ITORA BSN SURABAYA,%0ASaya *${userName}* (${userPlate}) ingin memesan Merchandise:%0A- *Barang:* ${itemName}%0A- *Ukuran:* ${size}%0A- *Jumlah:* ${qty} Pcs%0A- *Total Harga:* Rp ${totalPrice.toLocaleString('id-ID')}%0A- *Catatan:* ${note || '-'}%0A- *No WA Pemesan:* ${userPhone}%0A%0AMohon diproses pesanan saya. Terima kasih!`;

      setTimeout(() => {
        window.open(`https://wa.me/${targetWA}?text=${waMsg}`, '_blank');
      }, 800);

    } catch (err) {
      this.showToast('Gagal memproses pesanan.', 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  }

  async loadAdminPendingMembersList() {
    const container = document.getElementById('admin-pending-members-list');
    if (!container || !this.supabase) return;

    try {
      const { data: pendingMembers, error } = await this.supabase
        .from('members')
        .select('*')
        .eq('approval_status', 'Pending')
        .order('created_at', { ascending: false });

      if (!error && pendingMembers && pendingMembers.length > 0) {
        container.innerHTML = pendingMembers.map(m => `
          <div class="card" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid #F59E0B; border-radius:14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size:var(--font-base); font-weight:700;">${m.full_name || 'Calon Anggota'}</h4>
              <span class="badge badge-warning">Pending Approval</span>
            </div>
            <p class="text-muted" style="margin-top:4px;"><i class="fa-solid fa-envelope"></i> ${m.email} | <i class="fa-brands fa-whatsapp"></i> ${m.phone || '-'}</p>
            <p class="text-muted"><i class="fa-solid fa-motorcycle"></i> ${m.bike || '-'} (${m.plate || '-'})</p>

            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button type="button" class="btn btn-sm btn-primary" style="border-radius:10px;" onclick="app.adminApproveMember('${m.id}', 'Approved', '${m.full_name || 'Anggota'}')"><i class="fa-solid fa-check"></i> Setujui</button>
              <button type="button" class="btn btn-sm btn-danger" style="border-radius:10px;" onclick="app.adminApproveMember('${m.id}', 'Rejected', '${m.full_name || 'Anggota'}')"><i class="fa-solid fa-xmark"></i> Tolak</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Tidak ada pendaftaran anggota baru yang pending.</p>';
      }
    } catch (e) {}
  }

  async adminApproveMember(memberId, status, memberName) {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase.from('members').update({ approval_status: status }).eq('id', memberId);
      if (error) throw error;
      
      this.showToast(`Pendaftaran Anggota Berhasil di-${status}!`, 'success');

      if (status === 'Approved') {
        await this.createNotification(
          memberId,
          "Pendaftaran Akun Disetujui! 🎉",
          "Selamat! Pengajuan pendaftaran anggota ITORA BSN Anda telah disetujui Admin. Nikmati seluruh fitur aplikasi!",
          "member"
        );

        await this.createNotification(
          null,
          "Anggota Baru Bergabung! 🎉",
          `${memberName} telah resmi bergabung dengan komunitas ITORA BSN Surabaya. Selamat bergabung!`,
          "member"
        );
      }

      this.loadAdminPendingMembersList();
      this.loadMembersFromSupabase();
      this.loadBreakingNewsText();
      this.checkRealtimeNotifications();
    } catch (e) {
      this.showToast('Gagal memproses persetujuan anggota.', 'error');
    }
  }

  async loadAdminOrdersList() {
    const container = document.getElementById('admin-orders-list');
    if (!container || !this.supabase) return;

    try {
      const { data: orders, error } = await this.supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && orders && orders.length > 0) {
        container.innerHTML = orders.map(o => `
          <div class="card" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid ${o.status === 'Completed' ? '#10B981' : '#9333EA'}; border-radius:14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size:var(--font-base); font-weight:700;">${o.member_name}</h4>
              <span class="badge ${o.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${o.status}</span>
            </div>
            <p style="font-weight:700; color:var(--primary); margin-top:4px;">${o.item_name} - Rp ${parseFloat(o.price).toLocaleString('id-ID')}</p>
            <p class="text-muted" style="margin-top:2px;">${new Date(o.created_at).toLocaleDateString('id-ID')}</p>

            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button type="button" class="btn btn-sm btn-primary" style="border-radius:10px;" onclick="app.adminVerifyOrder('${o.id}', 'Completed', '${o.user_id}', '${o.item_name}')"><i class="fa-solid fa-check"></i> Selesai</button>
              <button type="button" class="btn btn-sm btn-danger" style="border-radius:10px;" onclick="app.adminVerifyOrder('${o.id}', 'Cancelled', '${o.user_id}', '${o.item_name}')"><i class="fa-solid fa-xmark"></i> Batal</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada antrean pesanan merchandise.</p>';
      }
    } catch (e) {}
  }

  async adminVerifyOrder(orderId, status, userId, itemName) {
    if (!this.supabase) return;
    try {
      await this.supabase.from('orders').update({ status }).eq('id', orderId);
      this.showToast(`Status Pesanan Diubah: ${status}!`, 'success');

      if (status === 'Completed') {
        await this.createNotification(
          userId,
          "Pembelian Merchandise Disetujui! 🛍️",
          `Pesanan merchandise Anda (${itemName}) telah disetujui & diverifikasi oleh Admin.`,
          "merch"
        );
      }

      this.loadAdminOrdersList();
      this.checkRealtimeNotifications();
    } catch(e) {
      this.showToast('Gagal memverifikasi pesanan.', 'error');
    }
  }

  async calculateTotalKas() {
    if (!this.supabase) return;
    try {
      const { data: approvedDues, error } = await this.supabase.from('dues').select('amount').eq('status', 'Verified');
      if (!error && approvedDues) {
        this.approvedKasTotal = approvedDues.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      } else {
        this.approvedKasTotal = 0;
      }
      this.updateKasUI();
    } catch (e) {}
  }

  updateKasUI() {
    const grandTotal = this.baseKas + this.approvedKasTotal;
    const textFormatted = `Rp ${grandTotal.toLocaleString('id-ID')}`;
    
    const statEl = document.getElementById('stat-kas-amount');
    const kasPageEl = document.getElementById('kas-page-amount');
    
    if (statEl) statEl.innerText = grandTotal >= 1000000 ? (grandTotal / 1000000).toFixed(2) + 'M' : textFormatted;
    if (kasPageEl) kasPageEl.innerText = textFormatted;
    
    const adminInput = document.getElementById('admin-kas-input');
    if (adminInput) adminInput.value = this.baseKas;
  }

  adminUpdateBaseKas() {
    const input = document.getElementById('admin-kas-input');
    if (!input) return;

    const val = parseFloat(input.value);
    if (isNaN(val)) {
      this.showToast('Masukkan nominal Kas Pokok yang valid!', 'error');
      return;
    }

    this.baseKas = val;
    localStorage.setItem('itora_base_kas', val);
    this.updateKasUI();
    this.showToast('Saldo Kas Pokok Berhasil Diperbarui!', 'success');
  }

  async handleSubmitIuran(e) {
    e.preventDefault();
    if (!this.currentUser) return;

    const btnSubmit = document.getElementById('btn-submit-iuran');
    btnSubmit.disabled = true;

    const periode = document.getElementById('iuran-periode').value;
    const jumlah = document.getElementById('iuran-jumlah').value;
    const tanggal = document.getElementById('iuran-tanggal').value;
    const metode = document.getElementById('iuran-metode').value;
    const catatan = document.getElementById('iuran-catatan').value;
    const rawFile = document.getElementById('iuran-bukti').files[0];

    const userName = this.currentProfile?.full_name || 'Sutrisno';

    try {
      let compressedFile = null;
      if (rawFile) compressedFile = await this.compressImage(rawFile, 200);

      let receiptUrl = '';
      if (this.supabase && compressedFile) {
        const fileName = `bukti_${Date.now()}_${compressedFile.name}`;
        const { data: uploadData, error: uploadErr } = await this.supabase.storage.from('receipts').upload(fileName, compressedFile);
        if (!uploadErr && uploadData) {
          const { data: urlData } = this.supabase.storage.from('receipts').getPublicUrl(fileName);
          receiptUrl = urlData ? urlData.publicUrl : '';
        }
      }

      if (this.supabase) {
        const { error: dbError } = await this.supabase.from('dues').insert([{
          user_id: this.currentUser.id,
          member_name: userName,
          amount: parseFloat(jumlah),
          period_month: periode,
          payment_date: tanggal ? new Date(tanggal).toISOString() : new Date().toISOString(),
          payment_method: metode,
          receipt_url: receiptUrl,
          note: catatan,
          status: 'Pending'
        }]);
        if (dbError) throw dbError;
      }

      this.showToast('Bukti iuran tersimpan!', 'success');
      this.closeModal('modal-iuran');
      document.getElementById('form-iuran').reset();
      this.loadIuranHistory();

      const targetWA = this.adminWANumber || "6281234567890";
      const waMessage = `Halo Bendahara ITORA BSN,%0ASaya *${userName}* telah melakukan konfirmasi setor iuran:%0A- *Periode:* ${periode}%0A- *Nominal:* Rp ${parseInt(jumlah).toLocaleString('id-ID')}%0A- *Metode:* ${metode}%0A%0AMohon dicek. Terima kasih!`;
      setTimeout(() => window.open(`https://wa.me/${targetWA}?text=${waMessage}`, '_blank'), 1000);

    } catch (err) {
      this.showToast('Gagal memproses setoran iuran.', 'error');
    } finally {
      btnSubmit.disabled = false;
    }
  }

  async checkRealtimeNotifications() {
    if (!this.supabase || !this.currentUser) return;
    const isSuperAdmin = (this.currentUser.email === 'mastrisnobpb@gmail.com');
    const isAdmin = (this.currentProfile?.role === 'Admin' || isSuperAdmin);

    if (!isAdmin) return;

    try {
      const { count: pendingMembersCount } = await this.supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'Pending');

      const { count: pendingDuesCount } = await this.supabase
        .from('dues')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');

      const { count: pendingOrdersCount } = await this.supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');

      const memberNotifDot = document.getElementById('admin-member-notif-dot');
      if (memberNotifDot) memberNotifDot.style.display = (pendingMembersCount > 0) ? 'block' : 'none';

      const dueNotifDot = document.getElementById('admin-due-notif-dot');
      if (dueNotifDot) dueNotifDot.style.display = (pendingDuesCount > 0) ? 'block' : 'none';

      const orderNotifDot = document.getElementById('admin-order-notif-dot');
      if (orderNotifDot) orderNotifDot.style.display = (pendingOrdersCount > 0) ? 'block' : 'none';

      const totalNotif = (pendingMembersCount || 0) + (pendingDuesCount || 0) + (pendingOrdersCount || 0);

      const adminNotifDot = document.getElementById('admin-notif-dot');
      const headerNotifDot = document.getElementById('header-notif-dot');
      if (adminNotifDot) adminNotifDot.style.display = totalNotif > 0 ? 'block' : 'none';
      if (headerNotifDot) headerNotifDot.style.display = totalNotif > 0 ? 'block' : 'none';
    } catch(e) {
      console.error('Notif check error:', e);
    }
  }

  subscribeToRealtimeChanges() {
    if (!this.supabase || !this.currentUser) return;

    try {
      this.supabase.removeAllChannels();

      this.supabase
        .channel('realtime-notif-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
          this.updateUnreadCountBadge();
          const modal = document.getElementById('notificationModal');
          if (modal && window.getComputedStyle(modal).display === 'flex') {
            this.loadNotifications();
          }
        })
        .subscribe();

      const isSuperAdmin = (this.currentUser.email === 'mastrisnobpb@gmail.com');
      const isAdmin = (this.currentProfile?.role === 'Admin' || isSuperAdmin);

      if (isAdmin) {
        this.supabase
          .channel('realtime-admin-channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
            this.checkRealtimeNotifications();
            this.loadAdminPendingMembersList();
            this.loadMembersFromSupabase();
            this.loadBreakingNewsText();
            if (payload.eventType === 'INSERT') {
              this.showToast('Pendaftaran anggota baru masuk!', 'info');
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'dues' }, (payload) => {
            this.checkRealtimeNotifications();
            this.loadAdminDuesList();
            this.loadBreakingNewsText();
            if (payload.eventType === 'INSERT') {
              this.showToast('Setoran iuran baru masuk!', 'info');
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            this.checkRealtimeNotifications();
            this.loadAdminOrdersList();
            this.loadBreakingNewsText();
            if (payload.eventType === 'INSERT') {
              this.showToast('Pesanan Merchandise baru masuk!', 'info');
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'touring_participants' }, () => {
            this.loadTouringParticipants();
            this.renderTouringsUI();
          })
          .subscribe();
      }
    } catch (e) {
      console.error('Realtime subscription error:', e);
    }
  }

  async loadIuranHistory() {
    const historyContainer = document.getElementById('iuran-history-list');
    if (!historyContainer || !this.supabase || !this.currentUser) return;

    try {
      const { data: dues, error } = await this.supabase.from('dues').select('*').eq('user_id', this.currentUser.id).order('created_at', { ascending: false });

      if (!error && dues && dues.length > 0) {
        this.iuranHistory = dues;
        historyContainer.innerHTML = dues.map(item => `
          <div class="card" style="padding: 14px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size:var(--font-base); font-weight:var(--fw-bold);">${item.period_month}</h4>
              <span class="badge ${item.status === 'Verified' ? 'badge-success' : item.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${item.status === 'Verified' ? 'Disetujui' : item.status === 'Rejected' ? 'Ditolak' : 'Menunggu Verifikasi'}</span>
            </div>
            <p style="color: var(--primary); font-weight: var(--fw-bold); margin-top: 4px; font-size: var(--font-base);">Rp ${parseFloat(item.amount).toLocaleString('id-ID')}</p>
            <p class="text-muted" style="margin-top: 4px;"><i class="fa-regular fa-clock"></i> ${new Date(item.payment_date).toLocaleDateString('id-ID')} • ${item.payment_method}</p>
            ${item.receipt_url ? `<a href="${item.receipt_url}" target="_blank" class="text-muted" style="color:var(--primary); font-weight:var(--fw-semibold); margin-top:4px; display:inline-block;"><i class="fa-solid fa-image"></i> Lihat Bukti Foto</a>` : ''}
          </div>
        `).join('');
      } else {
        historyContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada riwayat setoran iuran.</p>';
      }
    } catch(e) {}
  }

  async loadAdminDuesList() {
    const container = document.getElementById('admin-dues-list');
    if (!container || !this.supabase) return;

    try {
      const { data: dues, error } = await this.supabase.from('dues').select('*').order('created_at', { ascending: false });

      if (!error && dues && dues.length > 0) {
        container.innerHTML = dues.map(item => `
          <div class="card" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid ${item.status === 'Verified' ? '#10B981' : item.status === 'Rejected' ? '#EF4444' : '#F59E0B'}; border-radius:14px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size:var(--font-base); font-weight:700;">${item.member_name}</h4>
              <span class="badge ${item.status === 'Verified' ? 'badge-success' : item.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${item.status}</span>
            </div>
            <p style="font-weight:700; color:var(--primary); margin-top:4px;">Rp ${parseFloat(item.amount).toLocaleString('id-ID')} (${item.period_month})</p>
            <p class="text-muted">Metode: ${item.payment_method} | ${new Date(item.payment_date).toLocaleDateString('id-ID')}</p>
            ${item.receipt_url ? `<p style="margin-top:4px;"><a href="${item.receipt_url}" target="_blank" style="color:var(--primary); font-weight:600;"><i class="fa-solid fa-image"></i> Cek Foto Bukti Transfer</a></p>` : ''}
            
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button type="button" class="btn btn-sm btn-primary" style="border-radius:10px;" onclick="app.adminVerifyDue('${item.id}', 'Verified', '${item.user_id}', '${item.period_month}', '${item.member_name}')"><i class="fa-solid fa-check"></i> Setujui</button>
              <button type="button" class="btn btn-sm btn-danger" style="border-radius:10px;" onclick="app.adminVerifyDue('${item.id}', 'Rejected', '${item.user_id}', '${item.period_month}', '${item.member_name}')"><i class="fa-solid fa-xmark"></i> Tolak</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada antrean setoran iuran anggota.</p>';
      }
    } catch (e) {}
  }

  async adminVerifyDue(dueId, status, userId, periodMonth, memberName) {
    if (!this.supabase) return;
    try {
      const { error } = await this.supabase.from('dues').update({ status }).eq('id', dueId);
      if (error) throw error;
      this.showToast(`Iuran Berhasil Diubah: ${status}!`, 'success');

      if (status === 'Verified') {
        await this.createNotification(
          userId,
          "Setor Iuran Disetujui 💳",
          `Setoran iuran bulanan Anda untuk periode ${periodMonth} telah terverifikasi LUNAS. Terima kasih!`,
          "iuran"
        );

        await this.createNotification(
          null,
          "Update Setor Iuran 💸",
          `${memberName} baru saja melunasi iuran bulanan (${periodMonth}). Kas komunitas bertambah!`,
          "iuran"
        );
      }

      await this.calculateTotalKas();
      this.loadAdminDuesList();
      this.loadIuranHistory();
      this.loadBreakingNewsText();
      this.checkRealtimeNotifications();
    } catch (e) {
      this.showToast('Gagal memverifikasi iuran.', 'error');
    }
  }

  async loadMembersFromSupabase() {
    if (!this.supabase) return;
    try {
      const { data: members, error } = await this.supabase
        .from('members')
        .select('*')
        .neq('email', 'mastrisnobpb@gmail.com')
        .eq('approval_status', 'Approved')
        .order('created_at', { ascending: false });

      if (!error && members && members.length > 0) {
        this.members = members.map(m => ({
          id: m.id,
          name: m.full_name || m.email || 'Anggota',
          email: m.email || '',
          role: m.role || 'Anggota Resmi',
          bike: m.bike || 'Motor BSN',
          plate: m.plate || '-'
        }));
      } else {
        this.members = [];
      }

      this.renderMembers(this.members);
      const countEl = document.getElementById('stat-members');
      if (countEl) countEl.innerText = this.members.length;
    } catch (e) {}
  }

  renderMembers(data) {
    const container = document.getElementById('members-list');
    if (!container) return;

    if (data.length === 0) {
      container.innerHTML = '<p class="text-muted" style="text-align:center;">Belum ada data anggota terverifikasi.</p>';
      return;
    }

    const isSuperAdmin = (this.currentUser && this.currentUser.email === 'mastrisnobpb@gmail.com');
    const isAdmin = (this.currentProfile?.role === 'Admin' || isSuperAdmin);

    container.innerHTML = data.map(m => `
      <div class="card" style="display: flex; align-items: center; gap: 14px; padding: 14px; margin-bottom: 10px;">
        <div class="avatar-placeholder" style="margin:0; width: 44px; height: 44px; font-size: 1.1rem; ${m.role === 'Admin' || m.role === 'Ketua' ? 'background: var(--accent-gold); color: #000;' : ''}">
          ${m.name.charAt(0).toUpperCase()}
        </div>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="font-size: var(--font-base); font-weight: var(--fw-bold);">${m.name}</h4>
            <span class="badge ${m.role === 'Admin' || m.role === 'Ketua' ? 'badge-gold' : 'badge-primary'}">${m.role}</span>
          </div>
          <p class="text-muted" style="margin-top: 2px;">${m.email || m.bike}</p>
          <span class="badge badge-gold" style="margin-top: 4px;">Plat: ${m.plate}</span>
        </div>
        ${isAdmin ? `
          <button type="button" class="btn btn-sm btn-danger" style="width:auto;" onclick="app.adminDeleteMember('${m.id}')"><i class="fa-solid fa-trash"></i></button>
        ` : ''}
      </div>
    `).join('');
  }

  async adminDeleteMember(memberId) {
    if (!confirm('Apakah Anda yakin ingin menghapus anggota ini?')) return;
    if (!this.supabase) return;

    try {
      await this.supabase.from('members').delete().eq('id', memberId);
      this.showToast('Anggota berhasil dihapus!', 'success');
      this.loadMembersFromSupabase();
    } catch (e) {
      this.showToast('Gagal menghapus anggota.', 'error');
    }
  }

  filterMembers() {
    const query = document.getElementById('search-member').value.toLowerCase();
    const filtered = this.members.filter(m => 
      m.name.toLowerCase().includes(query) || 
      m.email.toLowerCase().includes(query) ||
      m.plate.toLowerCase().includes(query)
    );
    this.renderMembers(filtered);
  }

  navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${pageId}`);
    if (activeNav) activeNav.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  }

  generateQRCode(niaCode) {
    if (typeof QRCode !== 'undefined') {
      const container = document.getElementById("qrcode");
      if (!container) return;
      
      container.innerHTML = '';

      const profileUrl = `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(this.currentUser ? this.currentUser.id : niaCode)}`;

      new QRCode(container, { 
        text: profileUrl, 
        width: 180, 
        height: 180, 
        correctLevel: QRCode.CorrectLevel.H 
      });

      setTimeout(() => {
        const qrCanvas = container.querySelector('canvas');
        if (qrCanvas) {
          const ctx = qrCanvas.getContext('2d');
          const size = qrCanvas.width;
          const badgeWidth = 110, badgeHeight = 32;
          const badgeX = (size - badgeWidth) / 2, badgeY = (size - badgeHeight) / 2;

          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          
          if (ctx.roundRect) {
            ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
          } else {
            ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
          }
          ctx.fill();

          ctx.lineWidth = 2;
          ctx.strokeStyle = "#00875A";
          ctx.stroke();

          ctx.fillStyle = "#00875A";
          ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("ANGGOTA ITORA", size / 2, badgeY + 13);

          ctx.fillStyle = "#D4AF37"; 
          ctx.font = "bold 8px 'Plus Jakarta Sans', sans-serif";
          ctx.fillText("BSN SURABAYA", size / 2, badgeY + 25);
        }
      }, 150);
    }
  }

  exportData(type, format) {
    if (type === 'Kas') {
      if (!this.iuranHistory || this.iuranHistory.length === 0) {
        this.showToast('Belum ada data iuran kas untuk diexport!', 'error');
        return;
      }

      if (format === 'PDF') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Laporan Kas Iuran ITORA BSN Surabaya', 14, 15);

        const tableData = this.iuranHistory.map((item, index) => [
          index + 1,
          item.period_month,
          `Rp ${parseFloat(item.amount).toLocaleString('id-ID')}`,
          item.payment_method,
          new Date(item.payment_date).toLocaleDateString('id-ID'),
          item.status
        ]);

        doc.autoTable({
          head: [['No', 'Periode', 'Jumlah', 'Metode', 'Tanggal', 'Status']],
          body: tableData,
          startY: 22
        });

        doc.save(`Laporan_Kas_ITORA_${Date.now()}.pdf`);
        this.showToast('File PDF Kas berhasil diunduh!', 'success');

      } else if (format === 'Excel') {
        const excelData = this.iuranHistory.map((item, index) => ({
          No: index + 1,
          Periode: item.period_month,
          Jumlah: parseFloat(item.amount),
          Metode: item.payment_method,
          Tanggal: new Date(item.payment_date).toLocaleDateString('id-ID'),
          Status: item.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kas');
        XLSX.writeFile(workbook, `Laporan_Kas_ITORA_${Date.now()}.xlsx`);
        this.showToast('File Excel Kas berhasil diunduh!', 'success');
      }

    } else if (type === 'Touring') {
      const filtered = this.touringParticipants.filter(p => p.touring_id === this.selectedTouringId);
      if (!filtered || filtered.length === 0) {
        this.showToast('Belum ada data partisipasi touring ini untuk diexport!', 'error');
        return;
      }

      const agenda = this.tourings.find(t => t.id === this.selectedTouringId);
      const agendaTitle = agenda ? agenda.title : 'Agenda Touring';

      if (format === 'PDF') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text(`Daftar Peserta Touring - ${agendaTitle}`, 14, 15);

        const tableData = filtered.map((item, index) => [
          index + 1,
          item.member_name,
          item.plate || '-',
          item.status
        ]);

        doc.autoTable({
          head: [['No', 'Nama Anggota', 'Plat Nomor', 'Status Kehadiran']],
          body: tableData,
          startY: 22
        });

        doc.save(`Peserta_Touring_${agendaTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
        this.showToast('File PDF Peserta Touring berhasil diunduh!', 'success');

      } else if (format === 'Excel') {
        const excelData = filtered.map((item, index) => ({
          No: index + 1,
          Nama: item.member_name,
          PlatNomor: item.plate || '-',
          Status: item.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Peserta Touring');
        XLSX.writeFile(workbook, `Peserta_Touring_${agendaTitle.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
        this.showToast('File Excel Peserta Touring berhasil diunduh!', 'success');
      }
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.background = type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : 'var(--primary)';
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 3500);
    }, 3500);
  }

  // ==========================================
  // MODUL SYSTEM NOTIFIKASI
  // ==========================================

  async loadNotifications() {
    const notifList = document.getElementById('notifList');
    if (!notifList) return;
    
    notifList.innerHTML = '<div class="notif-empty">Memuat notifikasi...</div>';

    try {
      if (!this.supabase) return;
      const currentUserId = this.currentUser ? this.currentUser.id : null;

      let query = this.supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (currentUserId) {
        query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
      } else {
        query = query.is('user_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        notifList.innerHTML = '<div class="notif-empty">Belum ada notifikasi.</div>';
        return;
      }

      let html = '';
      data.forEach(item => {
        const isUnread = !item.is_read ? 'unread' : '';
        const dateFormatted = new Date(item.created_at).toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });

        html += `
          <div class="notif-item ${isUnread}" onclick="app.markAsRead('${item.id}')">
            <div class="notif-item-title">${this.escapeHtml(item.title)}</div>
            <div class="notif-item-msg">${this.escapeHtml(item.message)}</div>
            <div class="notif-item-time">${dateFormatted}</div>
          </div>
        `;
      });

      notifList.innerHTML = html;
      this.updateUnreadCountBadge();

    } catch (err) {
      console.error('Error loadNotifications:', err);
      notifList.innerHTML = '<div class="notif-empty">Gagal memuat notifikasi.</div>';
    }
  }

  escapeHtml(str) {
    return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
  }

  async updateUnreadCountBadge() {
    try {
      if (!this.supabase) return;
      const currentUserId = this.currentUser ? this.currentUser.id : null;

      let query = this.supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);

      if (currentUserId) {
        query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
      } else {
        query = query.is('user_id', null);
      }

      const { count, error } = await query;
      if (error) throw error;

      const badge = document.getElementById('notifBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 99 ? '99+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error updateUnreadCountBadge:', err);
    }
  }

  async markAsRead(id) {
    try {
      if (!this.supabase) return;
      await this.supabase.from('notifications').update({ is_read: true }).eq('id', id);
      this.loadNotifications();
    } catch (err) {
      console.error('Error markAsRead:', err);
    }
  }

  async markAllNotificationsAsRead() {
    try {
      if (!this.supabase) return;
      const currentUserId = this.currentUser ? this.currentUser.id : null;

      let query = this.supabase.from('notifications').update({ is_read: true }).eq('is_read', false);

      if (currentUserId) {
        query = query.or(`user_id.eq.${currentUserId},user_id.is.null`);
      } else {
        query = query.is('user_id', null);
      }

      await query;
      this.loadNotifications();
    } catch (err) {
      console.error('Error markAllNotificationsAsRead:', err);
    }
  }

  async createNotification(userId, title, message, type = 'info') {
    try {
      if (!this.supabase) return;
      const { error } = await this.supabase.from('notifications').insert([
        {
          user_id: userId,
          title: title,
          message: message,
          type: type,
          is_read: false
        }
      ]);
      if (error) console.error('Gagal membuat notifikasi:', error);
      else this.updateUnreadCountBadge();
    } catch (e) {
      console.error('Error createNotification:', e);
    }
  }
}

// ------------------------------------------
// GLOBAL HELPER FUNCTIONS UNTUK HTML
// ------------------------------------------

function toggleNotificationModal() {
  const modal = document.getElementById('notificationModal');
  if (!modal) return;

  const computedDisplay = window.getComputedStyle(modal).display;

  if (computedDisplay === 'none') {
    modal.style.setProperty('display', 'flex', 'important');
    if (window.app) {
      app.loadNotifications();
    }
  } else {
    modal.style.setProperty('display', 'none', 'important');
  }
}

function closeNotifModalOuter(event) {
  if (event.target.id === 'notificationModal') {
    const modal = document.getElementById('notificationModal');
    if (modal) {
      modal.style.setProperty('display', 'none', 'important');
    }
  }
}

function markAllNotificationsAsRead() {
  if (window.app) {
    app.markAllNotificationsAsRead();
  }
}

// INISIALISASI APLIKASI
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());

// REGISTER SERVICE WORKER (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}
