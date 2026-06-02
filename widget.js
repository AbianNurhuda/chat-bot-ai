/**
 * RSAI - Premium Floating Chatbot Widget Client Engine
 * Integrates with Node.js Express + Claude LLM backend.
 */

class FloatingChatbot {
    constructor() {
        // Core Layout Elements
        this.fab = document.getElementById('chatbot-fab');
        this.window = document.getElementById('chatbot-window');
        this.timeline = document.getElementById('message-timeline');
        this.input = document.getElementById('chat-input');
        this.form = document.getElementById('chat-input-form');
        this.badge = document.getElementById('notification-badge');
        
        // Header Controls
        this.soundToggleBtn = document.getElementById('sound-toggle-btn');
        this.soundIcon = document.getElementById('sound-icon');

        // View panels
        this.preChatContainer = document.getElementById('pre-chat-container');
        this.chatInterfaceContainer = document.getElementById('chat-interface-container');
        this.confirmModalOverlay = document.getElementById('confirm-modal-overlay');
        this.confirmModalText = document.getElementById('confirm-modal-text');

        // Pre-chat Form Inputs
        this.nameInput = document.getElementById('pre-chat-name');
        this.emailInput = document.getElementById('pre-chat-email');
        this.phoneInput = document.getElementById('pre-chat-phone');

        // States
        this.isOpen = false;
        this.isSoundEnabled = true;
        this.theme = 'light';
        this.messages = [];
        this.userData = null;
        this.audioCtx = null;
        this.badgeCount = 0;
        
        // Session ID database state
        this.sessionId = null;
        this.lastUserMessageText = null;
        this.lastUserMessageTime = null;

        // Timers & Inactivity intervals (Total 60 seconds)
        this.inactivityTimer = null;
        this.warningTimer = null;
        this.inactivityTimeoutMs = 50000; // 50 detik idle sebelum peringatan

        // API Base URL
        this.apiBase = 'http://localhost:3000';

        // Message keywords dictionary (Fallback only)
        this.botResponses = {
            'jadwal': 'Untuk melihat jadwal praktek dokter spesialis atau melakukan reservasi poliklinik rawat jalan di **RSAU dr. M. Salamun**, Anda dapat mengakses menu Jadwal Dokter di website utama.\n\n**Jam Pelayanan Poliklinik:**\n- Senin - Kamis: 07.30 - 14.00 WIB\n- Jumat: 07.30 - 14.30 WIB\n\n*Harap lakukan registrasi ulang dan verifikasi berkas di loket pendaftaran minimal 15 menit sebelum jam praktek dimulai.*',
            'kamar': 'Informasi ketersediaan ruang rawat inap di **RSAU dr. M. Salamun** diperbarui berkala melalui integrasi sistem BPJS Kesehatan.\n\nKami menyediakan fasilitas rawat inap:\n- Kamar Super VIP & VIP\n- Ruang Perawatan Kelas I, II, dan III\n- Kamar Isolasi Khusus\n- Ruang Intensif (ICU, NICU, PICU, HCU)\n\nUntuk konfirmasi status ketersediaan ranjang pasien terkini secara rinci, silakan hubungi bagian Admisi Pendaftaran Rawat Inap.',
            'alur': 'Berikut alur pelayanan pasien di **RSAU dr. M. Salamun**:\n\n1. **Pasien Umum / Asuransi Mandiri**:\n   Daftar langsung di loket pendaftaran Rawat Jalan dengan membawa kartu identitas diri (KTP/SIM).\n\n2. **Pasien BPJS Kesehatan / Dinas (TNI/PNS)**:\n   Harap membawa surat rujukan Faskes Tk. 1, surat rujukan online dari aplikasi JKN, KTA (bagi prajurit TNI/PNS Kemhan), serta Kartu BPJS.\n\n3. **Pasien Gawat Darurat (IGD)**:\n   Dapat langsung menuju gedung IGD yang siaga 24 jam tanpa memerlukan surat rujukan terlebih dahulu.',
            'kontak': 'Berikut adalah kontak layanan resmi **RSAU dr. M. Salamun Bandung**:\n\n- **Gawat Darurat / Call Center 24 Jam**: (022) 2032090\n- **Email Resmi**: rsau.msalamun@gmail.com\n- **Alamat**: Jl. Ciumbuleuit No.203, Hegarmanah, Kec. Cidadap, Kota Bandung, Jawa Barat 40141\n\nUntuk pengaduan pelayanan, silakan gunakan fasilitas SP4N Lapor atau hubungi petugas Humas di loket informasi.',
            'halo': 'Halo! Ada yang bisa kami bantu seputar pelayanan kesehatan di RSAU dr. M. Salamun? Silakan pilih menu di bawah atau ketik pertanyaan Anda.',
            'default': 'Maaf, sistem asisten sedang sibuk. Silakan pilih menu navigasi yang tersedia atau gunakan kata kunci pencarian seperti "jadwal", "kamar", "alur", atau "kontak".'
        };

        // Event typing listener
        this.input.addEventListener('input', () => this.resetInactivityTimer());

        // Phone input restriction: numbers only
        this.phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        this.init();
    }

    init() {
        this.loadThemeSetting();
        this.loadSoundSetting();
        this.loadUserData();

        if (this.userData) {
            // Retrieve or generate Session ID
            this.sessionId = localStorage.getItem('chatbot_session_id');
            if (!this.sessionId) {
                this.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
                localStorage.setItem('chatbot_session_id', this.sessionId);
            }

            this.showChatInterface();
            this.loadChatHistory();
            this.startInactivityTimer();
            if (this.messages.length === 0) {
                this.sendWelcomeMessage();
            } else {
                this.renderAllMessages();
            }
        } else {
            this.showPreChatForm();
        }
    }

    // --- THEMING & PREFERENCES ---
    loadThemeSetting() {
        const savedTheme = localStorage.getItem('chatbot_theme') || 'light';
        this.theme = savedTheme;
        document.body.setAttribute('data-theme', this.theme);
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.theme);
        localStorage.setItem('chatbot_theme', this.theme);
    }

    loadSoundSetting() {
        const savedSound = localStorage.getItem('chatbot_sound');
        if (savedSound !== null) {
            this.isSoundEnabled = savedSound === 'true';
        }
        this.updateSoundUI();
    }

    toggleSound() {
        this.isSoundEnabled = !this.isSoundEnabled;
        localStorage.setItem('chatbot_sound', this.isSoundEnabled);
        this.updateSoundUI();
        if (this.isSoundEnabled) {
            this.playReceivedSound();
        }
    }

    updateSoundUI() {
        if (this.isSoundEnabled) {
            this.soundIcon.textContent = 'volume_up';
            this.soundToggleBtn.title = 'Matikan Suara';
        } else {
            this.soundIcon.textContent = 'volume_off';
            this.soundToggleBtn.title = 'Aktifkan Suara';
        }
    }

    // --- USER PROFILE & SESSIONS ---
    loadUserData() {
        const savedUser = localStorage.getItem('chatbot_user_data');
        if (savedUser) {
            try {
                this.userData = JSON.parse(savedUser);
            } catch (e) {
                this.userData = null;
            }
        }
    }

    showPreChatForm() {
        this.preChatContainer.style.display = 'flex';
        this.chatInterfaceContainer.style.display = 'none';
    }

    showChatInterface() {
        this.preChatContainer.style.display = 'none';
        this.chatInterfaceContainer.style.display = 'flex';
    }

    handlePreChatSubmit(event) {
        event.preventDefault();
        
        const name = this.nameInput.value.trim();
        const email = this.emailInput.value.trim();
        const phone = this.phoneInput.value.trim();

        // Basic presence validation
        if (!name || !email || !phone) {
            alert('Silakan lengkapi semua data formulir.');
            return;
        }

        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Format alamat email tidak valid.');
            this.emailInput.focus();
            return;
        }

        // Phone validation (Indonesian format: 08... or 628...)
        const phoneRegex = /^(0|62)8[1-9][0-9]{7,11}$/;
        if (!phoneRegex.test(phone)) {
            alert('Nomor telepon tidak valid. Pastikan diawali 08 atau 628 dan terdiri dari 10-13 digit angka.');
            this.phoneInput.focus();
            return;
        }

        this.userData = { name, email, phone };
        localStorage.setItem('chatbot_user_data', JSON.stringify(this.userData));

        // Generate persistent Session ID
        this.sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        localStorage.setItem('chatbot_session_id', this.sessionId);

        this.showChatInterface();
        this.playReceivedSound();
        this.startInactivityTimer();

        this.messages = [];
        this.saveChatHistory();
        this.sendWelcomeMessage();

        this.nameInput.value = '';
        this.emailInput.value = '';
        this.phoneInput.value = '';
    }

    closeConfirmAction(action) {
        this.confirmModalOverlay.style.display = 'none';
        
        if (action === 'end') {
            this.clearInactivityTimers();
            localStorage.removeItem('chatbot_user_data');
            localStorage.removeItem('chatbot_messages');
            localStorage.removeItem('chatbot_session_id');
            
            this.userData = null;
            this.sessionId = null;
            this.messages = [];
            this.timeline.innerHTML = '';
            
            this.playSentSound();
            this.showPreChatForm();
            this.toggleChat(); // Minimize chat window
        } else {
            this.playSentSound();
            this.input.focus();
        }
    }

    // --- CHAT WINDOW TOGGLE OPEN/CLOSE ---
    toggleChat() {
        this.isOpen = !this.isOpen;
        this.initAudioContext();

        if (this.isOpen) {
            this.window.classList.add('active');
            this.fab.classList.add('active');
            
            // Clear notification badge count when chat is opened
            this.badgeCount = 0;
            this.badge.style.display = 'none';
            this.badge.textContent = '0';

            setTimeout(() => {
                if (this.userData) {
                    this.input.focus();
                } else {
                    this.nameInput.focus();
                }
            }, 200);
        } else {
            this.window.classList.remove('active');
            this.fab.classList.remove('active');
        }
    }

    handleHeaderClose() {
        // If user is logged in, show confirmation modal to end session
        if (this.userData) {
            this.confirmModalText.textContent = "Apakah Anda ingin mengakhiri ini?";
            this.confirmModalOverlay.style.display = 'flex';
            this.playReceivedSound();
        } else {
            // If no user data (still in pre-chat), just minimize
            this.toggleChat();
        }
    }

    // --- Web Audio Oscillator Synth ---
    initAudioContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playSentSound() {
        if (!this.isSoundEnabled) return;
        try {
            this.initAudioContext();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1000, this.audioCtx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.08);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.08);
        } catch (e) {
            console.warn("Audio Context Synth error:", e);
        }
    }

    playReceivedSound() {
        if (!this.isSoundEnabled) return;
        try {
            this.initAudioContext();
            const time = this.audioCtx.currentTime;
            this.playTone(523.25, 0.08, time); // C5
            this.playTone(659.25, 0.12, time + 0.07); // E5
        } catch (e) {
            console.warn("Audio Context Synth error:", e);
        }
    }

    playTone(freq, duration, startTime) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.06, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    // --- TIMELINES RENDERING ---
    getCurrentTime() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    saveChatHistory() {
        localStorage.setItem('chatbot_messages', JSON.stringify(this.messages));
    }

    loadChatHistory() {
        const savedMessages = localStorage.getItem('chatbot_messages');
        if (savedMessages) {
            try {
                this.messages = JSON.parse(savedMessages);
            } catch (e) {
                this.messages = [];
            }
        }
    }

    addMessage(sender, text, choices = null) {
        const message = {
            sender,
            text,
            timestamp: this.getCurrentTime(),
            choices
        };
        this.messages.push(message);
        this.saveChatHistory();
        this.renderMessageItem(message);
        this.scrollToBottom();

        // Increment Notification Badge if chat is closed and bot says something
        if (sender === 'bot' && !this.isOpen) {
            this.incrementNotificationBadge();
        }
    }

    renderMessageItem(msg) {
        const isBot = msg.sender === 'bot';
        const isSystem = msg.sender === 'system';

        const messageItem = document.createElement('div');
        messageItem.className = `message-item ${isSystem ? 'system' : (isBot ? 'bot' : 'user')}`;

        if (isBot) {
            const avatar = document.createElement('div');
            avatar.className = 'msg-avatar-wrapper';
            avatar.innerHTML = `<div style="width: 28px; height: 28px; background: #ffffff; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 1px solid var(--border-color);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14a7 7 0 0 1 14 0" stroke="var(--gold)" stroke-width="1.5"></path><rect x="6" y="10" width="12" height="10" rx="3" fill="none"></rect><circle cx="9.5" cy="14.5" r="1.2" fill="var(--gold)" stroke="none"></circle><circle cx="14.5" cy="14.5" r="1.2" fill="var(--gold)" stroke="none"></circle><path d="M10.5 17.5c.5.5 2.5.5 3 0" stroke-width="1.5"></path><rect x="4" y="12" width="2" height="4" rx="1" fill="var(--gold)" stroke="none"></rect><rect x="18" y="12" width="2" height="4" rx="1" fill="var(--gold)" stroke="none"></rect><line x1="12" y1="10" x2="12" y2="6" stroke-width="2"></line><path d="M10 5h4M12 3v4" stroke="var(--gold)" stroke-width="2"></path></svg></div>`;
            messageItem.appendChild(avatar);
        }

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'msg-content-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        let formattedText = msg.text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        if (isBot && msg.choices && msg.choices.length > 0) {
            const textPart = document.createElement('div');
            textPart.className = 'msg-text-content';
            textPart.innerHTML = formattedText;
            bubble.appendChild(textPart);

            const choicesContainer = document.createElement('div');
            choicesContainer.className = 'msg-choices-container';

            msg.choices.forEach(choice => {
                const choiceBtn = document.createElement('button');
                choiceBtn.className = 'msg-choice-item';
                choiceBtn.textContent = choice.text;
                choiceBtn.addEventListener('click', () => this.handleChoiceClick(choice));
                choicesContainer.appendChild(choiceBtn);
            });
            bubble.appendChild(choicesContainer);
        } else {
            const p = document.createElement('p');
            p.className = !isSystem ? 'msg-text-content' : '';
            p.innerHTML = formattedText;
            bubble.appendChild(p);
        }

        contentWrapper.appendChild(bubble);

        if (!isSystem) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'msg-time';
            timeSpan.textContent = msg.timestamp;
            contentWrapper.appendChild(timeSpan);
        }

        messageItem.appendChild(contentWrapper);
        this.timeline.appendChild(messageItem);
    }

    renderAllMessages() {
        this.timeline.innerHTML = '';
        this.messages.forEach(msg => this.renderMessageItem(msg));
        this.scrollToBottom();
    }

    scrollToBottom() {
        setTimeout(() => {
            this.timeline.parentElement.scrollTop = this.timeline.parentElement.scrollHeight;
        }, 50);
    }

    // --- INACTIVITY ENGINE (60s timers) ---
    startInactivityTimer() {
        this.clearInactivityTimers();
        if (!this.userData) return;

        this.inactivityTimer = setTimeout(() => {
            this.showInactivityWarning();
        }, this.inactivityTimeoutMs);
    }

    resetInactivityTimer() {
        this.startInactivityTimer();
    }

    clearInactivityTimers() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.warningTimer) clearTimeout(this.warningTimer);
    }

    showInactivityWarning() {
        if (!this.userData) return;

        const warningText = "Mohon maaf, dikarenakan kami masih belum menerima respon Anda, sesi obrolan asisten akan segera diakhiri secara otomatis.";
        const systemMessage = {
            sender: 'system',
            text: warningText,
            timestamp: this.getCurrentTime()
        };

        this.messages.push(systemMessage);
        this.saveChatHistory();
        this.renderMessageItem(systemMessage);
        this.scrollToBottom();
        this.playReceivedSound();

        if (!this.isOpen) {
            this.incrementNotificationBadge();
        }

        // Tunggu 10 detik lagi sebelum benar-benar mengakhiri sesi (Total 60s)
        this.warningTimer = setTimeout(() => {
            this.autoEndSession();
        }, 10000);
    }

    autoEndSession() {
        this.clearInactivityTimers();
        
        localStorage.removeItem('chatbot_user_data');
        localStorage.removeItem('chatbot_messages');
        localStorage.removeItem('chatbot_session_id');
        
        this.userData = null;
        this.sessionId = null;
        this.messages = [];
        this.timeline.innerHTML = '';
        
        this.showPreChatForm();
        if (this.isOpen) {
            this.toggleChat(); // Minimize chat window
        }
    }

    incrementNotificationBadge() {
        this.badgeCount++;
        this.badge.textContent = this.badgeCount;
        this.badge.style.display = 'flex';
        this.playReceivedSound();
    }

    /**
     * FUNGSI BARU: Kirim pesan ke LLM via Backend
     */
    async sendMessageToLLM(userMessage) {
        try {
            console.log('📤 Sending to LLM endpoint...');
            
            const response = await fetch(`${this.apiBase}/chat-with-llm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_message: userMessage,
                    session_id: this.sessionId,
                    userData: this.userData
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                console.log('✅ LLM response received');
                return data.response;
            } else {
                console.error('LLM error:', data.message);
                return this.botResponses.default;
            }

        } catch (error) {
            console.error('❌ LLM fetch error:', error);
            return 'Maaf, asisten sedang mengalami gangguan koneksi. Silakan coba beberapa saat lagi.';
        }
    }

    /**
     * Integrasi Node.js Express API (Legacy)
     */
    async saveChatToNode(chatIn, chatOut) {
        if (!this.userData) return;

        const payload = {
            nama: this.userData.name,
            email: this.userData.email,
            notelp: this.userData.phone,
            chat_in: chatIn,
            chat_out: chatOut
        };

        try {
            await fetch(`${this.apiBase}/save-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn('Gagal menghubungi Backend Express:', error.message);
        }
    }

    // --- USER CHAT DISPATCHERS ---
    handleSendMessage(event) {
        event.preventDefault();
        const text = this.input.value.trim();
        if (!text) return;

        this.resetInactivityTimer();
        this.input.value = '';

        this.addMessage('user', text);
        this.playSentSound();

        this.triggerBotResponse(text);
    }

    handleChoiceClick(choice) {
        this.resetInactivityTimer();
        this.addMessage('user', choice.text);
        this.playSentSound();

        this.triggerBotResponse(choice.value);
    }

    insertEmoji(emoji) {
        const start = this.input.selectionStart;
        const end = this.input.selectionEnd;
        const text = this.input.value;
        this.input.value = text.substring(0, start) + emoji + text.substring(end);
        this.input.selectionStart = this.input.selectionEnd = start + emoji.length;
        this.input.focus();
    }

    // --- BOT RESPONSE ENGINE (Updated with LLM) ---
    sendWelcomeMessage() {
        const name = this.userData ? this.userData.name : 'Pengunjung';
        const welcomeText = `Halo, selamat datang Kak **${name}** di Layanan Asisten Virtual **RSAU dr. M. Salamun**. Ada yang bisa saya bantu hari ini? Silakan pilih salah satu menu di bawah atau ketik pertanyaan Anda:`;
        
        const choices = [
            { text: 'Jadwal Dokter & Poli 📅', value: 'jadwal' },
            { text: 'Ketersediaan Kamar Inap 🏥', value: 'kamar' },
            { text: 'Alur Pelayanan Pasien 🔄', value: 'alur' },
            { text: 'Hubungi Kontak Resmi 📞', value: 'kontak' }
        ];

        this.addMessage('bot', welcomeText, choices);
        // Log sapaan awal
        this.saveChatToNode('MULAI_CHAT', welcomeText);
    }

    async triggerBotResponse(keyword) {
        const key = keyword.toLowerCase().trim();
        this.showTypingIndicator();

        // 1. Coba LLM Terlebih Dahulu (Prioritas Opsi 2)
        const botResponse = await this.sendMessageToLLM(keyword);
        
        this.hideTypingIndicator();

        // 2. Jika LLM gagal/sibuk, gunakan fallback keyword (Opsional)
        // Namun di sini kita asumsikan LLM selalu memberikan respon (baik jawaban asli atau pesan error)
        
        let followUpChoices = null;
        // Berikan pilihan menu jika keyword mengandung kata kunci tertentu
        if (key.includes('jadwal') || key.includes('dokter')) {
            followUpChoices = [
                { text: 'Cek Kamar Rawat Inap 🏥', value: 'kamar' },
                { text: 'Kembali ke Menu Utama 🏠', value: 'welcome' }
            ];
        } else if (key.includes('kamar')) {
            followUpChoices = [
                { text: 'Alur Pelayanan Pasien 🔄', value: 'alur' },
                { text: 'Kembali ke Menu Utama 🏠', value: 'welcome' }
            ];
        }

        if (key === 'welcome') {
            this.sendWelcomeMessage();
        } else {
            this.addMessage('bot', botResponse, followUpChoices);
        }

        this.playReceivedSound();
        this.startInactivityTimer();
    }

    showTypingIndicator() {
        this.hideTypingIndicator();

        const indicator = document.createElement('div');
        indicator.id = 'bot-typing-indicator';
        indicator.className = 'message-item bot';
        
        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar-wrapper';
        avatar.innerHTML = `<div style="width: 28px; height: 28px; background: #ffffff; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 1px solid var(--border-color);"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 14a7 7 0 0 1 14 0" stroke="var(--gold)" stroke-width="1.5"></path><rect x="6" y="10" width="12" height="10" rx="3" fill="none"></rect><circle cx="9.5" cy="14.5" r="1.2" fill="var(--gold)" stroke="none"></circle><circle cx="14.5" cy="14.5" r="1.2" fill="var(--gold)" stroke="none"></circle><path d="M10.5 17.5c.5.5 2.5.5 3 0" stroke-width="1.5"></path><rect x="4" y="12" width="2" height="4" rx="1" fill="var(--gold)" stroke="none"></rect><rect x="18" y="12" width="2" height="4" rx="1" fill="var(--gold)" stroke="none"></rect><line x1="12" y1="10" x2="12" y2="6" stroke-width="2"></line><path d="M10 5h4M12 3v4" stroke="var(--gold)" stroke-width="2"></path></svg></div>`;
        indicator.appendChild(avatar);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'msg-content-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = `
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        contentWrapper.appendChild(bubble);
        indicator.appendChild(contentWrapper);
        
        this.timeline.appendChild(indicator);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('bot-typing-indicator');
        if (indicator) indicator.remove();
    }

}

// Initialise core script on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new FloatingChatbot();
});
