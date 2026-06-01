/**
 * RSAI - Backend Server dengan LLM Integration (Opsi 2)
 * Node.js Express + Google Gemini AI + MySQL (Remote/Local)
 */

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// KONFIGURASI GEMINI AI CLIENT
// ============================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash" 
});

// System prompt untuk LLM dengan Knowledge Base RSAU dr. M. Salamun
const SYSTEM_PROMPT = `Anda adalah ASISTEN VIRTUAL RESMI dari RSAU dr. M. Salamun (Rumah Sakit Angkatan Udara), Bandung.

PROFIL RUMAH SAKIT:
- Nama: RSAU dr. M. Salamun
- Alamat: Jl. Ciumbuleuit No.203, Hegarmanah, Kec. Cidadap, Kota Bandung, Jawa Barat 40141
- Telepon (IGD/Call Center): (022) 2032090
- Email: rsau.msalamun@gmail.com
- Akreditasi: Paripurna (KARS)

LAYANAN UNGGULAN & FASILITAS:
1. IGD 24 Jam: Siaga melayani kasus gawat darurat medik maupun bedah.
2. Poliklinik Spesialis: Penyakit Dalam, Bedah Umum/Tulang/Saraf, Anak, Obgyn (Kandungan), Mata, THT, Kulit & Kelamin, Jantung, Paru, Saraf, Jiwa, Rehabilitasi Medik, Gigi & Mulut.
3. Rawat Inap: Kamar Super VIP, VIP, Kelas I, II, dan III.
4. Penunjang Medis: Laboratorium Patologi Klinik & Anatomi, Radiologi (Rontgen, USG, CT-Scan), Farmasi/Apotek 24 Jam, Fisioterapi.

JAM OPERASIONAL POLIKLINIK:
- Senin - Kamis: 07.30 - 14.00 WIB
- Jumat: 07.30 - 14.30 WIB
*Pendaftaran dianjurkan minimal 30 menit sebelum jam pelayanan berakhir.*

ALUR PELAYANAN:
- Pasien Umum/Asuransi: Membawa identitas diri (KTP/SIM).
- Pasien BPJS/TNI/PNS: Membawa rujukan Faskes Tk.1, rujukan online (Aplikasi JKN), KTA, dan Kartu BPJS.
- Gawat Darurat: Langsung ke IGD tanpa perlu rujukan.

KEBIJAKAN RESPON:
1. Berikan informasi yang akurat berdasarkan data di atas.
2. Gunakan bahasa Indonesia yang formal, sopan, dan ramah.
3. JANGAN memberikan diagnosis medis atau resep obat. Selalu arahkan untuk konsultasi langsung dengan dokter.
4. Jika ditanya hal di luar konteks RS, arahkan kembali ke layanan RSAU dr. M. Salamun.
5. Gunakan format Markdown untuk menebalkan poin penting (contoh: **IGD 24 Jam**).

TONE: Profesional, informatif, dan membantu.
PENUTUP: Setiap respons diakhiri dengan sapaan hangat seperti "Apakah ada hal lain yang bisa saya bantu terkait layanan RSAU dr. M. Salamun?"`;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());

// Security headers & CSP
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self' http://localhost:3000; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "connect-src 'self' http://localhost:3000 ws://localhost:*;"
    );
    next();
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(404).end());
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ============================================
// DATABASE CONNECTION
// ============================================
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_simrs',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Initialize Database Table
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error connecting to MySQL:', err.message);
        return;
    }
    console.log('✅ Connected to MySQL (' + (process.env.DB_HOST || 'localhost') + ')');

    // Create table ai_history if not exists
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS ai_history (
            uuid VARCHAR(36) PRIMARY KEY,
            nama VARCHAR(255),
            email VARCHAR(255),
            notelp VARCHAR(20),
            session_id VARCHAR(255),
            user_message TEXT,
            agent_message TEXT,
            source VARCHAR(20) DEFAULT 'llm',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    connection.query(createTableSql, (err) => {
        if (err) {
            console.error('❌ Error creating table:', err.message);
        } else {
            console.log("✅ Table 'ai_history' ready");
        }
        connection.release();
    });
});

// ============================================
// ENDPOINT 1: Save Chat (Legacy/Manual)
// ============================================
app.post('/save-chat', (req, res) => {
    const { nama, email, notelp, chat_in, chat_out } = req.body;

    if (!nama || !email || !notelp) {
        return res.status(400).json({
            status: 'error',
            message: 'Nama, Email, dan No Telp wajib diisi.'
        });
    }

    const uuid = uuidv4();
    const sql = `
        INSERT INTO ai_history (
            uuid, nama, email, notelp, user_message, agent_message, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'legacy', NOW(), NOW())
    `;

    db.execute(sql, [uuid, nama, email, notelp, chat_in, chat_out], (err) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({
                status: 'error',
                message: 'Gagal menyimpan data: ' + err.message
            });
        }

        console.log(`✅ Chat saved to ai_history [UUID: ${uuid}]`);
        res.status(201).json({
            status: 'success',
            message: 'Chat berhasil disimpan',
            uuid: uuid
        });
    });
});

// ============================================
// ENDPOINT 2: Chat dengan LLM (Gemini 2.0 Flash)
// ============================================
app.post('/chat-with-llm', async (req, res) => {
    const { user_message, session_id, userData } = req.body;

    if (!user_message || !session_id) {
        return res.status(400).json({
            status: 'error',
            message: 'user_message dan session_id diperlukan'
        });
    }

    try {
        console.log(`📨 Gemini Request - Session: ${session_id}`);
        console.log(`📝 User: ${user_message.substring(0, 50)}...`);

        const prompt = `${SYSTEM_PROMPT}\n\nUser: ${user_message}`;
        const result = await model.generateContent(prompt);
        const botResponse = result.response.text();

        console.log(`✅ Gemini Response Success`);

        // Auto-save ke database 
        if (userData && userData.name && userData.email && userData.phone) {
            const uuid = uuidv4();
            const sql = ` 
                INSERT INTO ai_history ( 
                    uuid, nama, email, notelp, session_id, 
                    user_message, agent_message, source 
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'gemini') 
            `;

            db.execute(sql, [
                uuid,
                userData.name,
                userData.email,
                userData.phone,
                session_id,
                user_message,
                botResponse
            ], (err) => {
                if (err) console.error('❌ DB Error:', err.message);
                else console.log(`✅ Chat Auto-Saved [UUID: ${uuid}]`);
            });
        }

        res.json({
            status: 'success',
            response: botResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Gemini Error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Gagal mendapatkan respons dari Gemini: ' + error.message
        });
    }
});

// Global Error Handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server RSAI berjalan di http://localhost:${port}`);
});
