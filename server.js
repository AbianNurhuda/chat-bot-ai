/** 
 * RSAI - Backend Server dengan Ollama LLM (Gratis & Local) 
 * Node.js Express + Ollama + MySQL 
 */ 
 
 require('dotenv').config(); 
 const express = require('express'); 
 const mysql = require('mysql2'); 
 const cors = require('cors'); 
 const { v4: uuidv4 } = require('uuid'); 
 
 const app = express(); 
 const port = process.env.PORT || 3000; 
 
 // ============================================ 
 // MIDDLEWARE 
 // ============================================ 
 app.use(cors()); 
 app.use(express.json()); 
 
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
     database: process.env.DB_NAME || 'ai_testing', 
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
     console.log('✅ Connected to MySQL'); 
 
     const createTableSql = ` 
         CREATE TABLE IF NOT EXISTS ai_history ( 
             uuid VARCHAR(36) PRIMARY KEY, 
             nama VARCHAR(255), 
             email VARCHAR(255), 
             notelp VARCHAR(20), 
             session_id VARCHAR(255), 
             user_message TEXT, 
             agent_message TEXT, 
             source VARCHAR(20) DEFAULT 'ollama', 
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
 // SYSTEM PROMPT 
 // ============================================ 
 const SYSTEM_PROMPT = `Anda adalah Dr. M. Salamun, asisten virtual dari RSAU dr. M. Salamun, Bandung. 
 
 IDENTITAS: 
 - Nama: Dr. M. Salamun (asisten virtual) 
 - Tempat: RSAU dr. M. Salamun, Bandung 
 - Bahasa: SELALU gunakan Bahasa Indonesia 
 - Personality: Ramah, profesional, helpful, dan empati 
 
 INFORMASI RS: 
 - Alamat: Jl. Ciumbuleuit No.203, Bandung 
 - Telepon: (022) 2032090 
 - WhatsApp: [nomor RS jika ada] 
 - Jam IGD: 24 jam 
 - Jam Poliklinik: Senin-Jumat 07:30-14:00, Jumat 07:30-14:30 
 - Layanan: IGD, Rawat Inap, Poliklinik Spesialis, Lab, Radiologi, Farmasi 24 Jam 
 
 ATURAN KOMUNIKASI: 
 1. WAJIB GUNAKAN BAHASA INDONESIA - jangan campur dengan Inggris 
 2. Jawab dengan sopan dan ramah 
 3. Gunakan salam pembuka seperti "Halo", "Selamat pagi", "Selamat siang" 
 4. Jangan berikan diagnosis medis - arahkan ke dokter 
 5. Untuk pertanyaan medis, selalu sarankan konsultasi langsung dengan dokter RS 
 6. Akhiri respons dengan pertanyaan ramah seperti "Apakah ada yang bisa saya bantu lagi?" atau "Ada pertanyaan lainnya?" 
 
 CONTOH RESPONS: 
 
 Q: Jam berapa RS buka? 
 A: Halo! RSAU dr. M. Salamun buka 24 jam untuk layanan IGD (Instalasi Gawat Darurat). 
 Sedangkan untuk poliklinik umum, kami melayani Senin-Jumat pukul 07:30-14:00, dan Jumat pukul 07:30-14:30. 
 Apakah ada yang bisa saya bantu lagi? 
 
 Q: Saya mau konsultasi dengan dokter, bagaimana caranya? 
 A: Baik! Untuk konsultasi dengan dokter di RSAU dr. M. Salamun, Anda bisa: 
 1. Datang langsung ke poliklinik kami di Jl. Ciumbuleuit No.203, Bandung 
 2. Menghubungi kami di (022) 2032090 
 3. Jika ada keadaan darurat, langsung ke IGD kami (buka 24 jam) 
 
 Pastikan membawa identitas diri dan asuransi jika ada. Apakah ada pertanyaan lain? 
 
 PERSONALITY NOTES: 
 - Gunakan emoticon sederhana jika sesuai konteks: *senyum*, *wink*, dll 
 - Tampilkan empati terhadap kondisi pasien 
 - Professional namun tetap hangat dan approachable`; 
 
 // ============================================ 
 // ENDPOINT 1: Save Chat (Legacy) 
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
             uuid, nama, email, notelp, user_message, agent_message, source 
         ) VALUES (?, ?, ?, ?, ?, ?, 'legacy') 
     `; 
 
     db.execute(sql, [uuid, nama, email, notelp, chat_in, chat_out], (err) => { 
         if (err) { 
             console.error('❌ Database error:', err.message); 
             return res.status(500).json({ 
                 status: 'error', 
                 message: 'Gagal menyimpan data: ' + err.message 
             }); 
         } 
 
         console.log(`✅ Chat saved [UUID: ${uuid}]`); 
         res.status(201).json({ 
             status: 'success', 
             message: 'Chat berhasil disimpan', 
             uuid: uuid 
         }); 
     }); 
 }); 
 
 // ============================================ 
 // ENDPOINT: Chat dengan Ollama (LOCAL LLM) 
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
         console.log(`📨 Ollama Request - Session: ${session_id}`); 
         console.log(`📝 User: ${user_message.substring(0, 50)}...`); 
 
         // Call Ollama Local API 
         const response = await fetch('http://localhost:11434/api/generate', { 
             method: 'POST', 
             headers: { 'Content-Type': 'application/json' }, 
             body: JSON.stringify({ 
                 model: 'llama2', 
                 prompt: `${SYSTEM_PROMPT}\n\nUser: ${user_message}`, 
                 stream: false, 
                 temperature: 0.7 
             }) 
         }); 
 
         if (!response.ok) { 
             throw new Error(`Ollama error: ${response.statusText}`); 
         } 
 
         const data = await response.json(); 
         const botResponse = data.response; 
 
         console.log(`✅ Ollama Response Success`); 
 
         // Auto-save ke database 
         if (userData && userData.name && userData.email && userData.phone) { 
             const uuid = uuidv4(); 
             const sql = ` 
                 INSERT INTO ai_history ( 
                     uuid, nama, email, notelp, session_id, 
                     user_message, agent_message, source 
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ollama') 
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
         console.error('❌ Ollama Error:', error.message); 
         res.status(500).json({ 
             status: 'error', 
             message: 'Ollama tidak berjalan. Jalankan: ollama serve' 
         }); 
     } 
 }); 
 
 // ============================================ 
 // HEALTH CHECK 
 // ============================================ 
 app.get('/health', (req, res) => { 
     res.status(200).json({ 
         status: 'ok', 
         service: 'RSAI Backend + Ollama', 
         ollama_url: 'http://localhost:11434', 
         timestamp: new Date().toISOString() 
     }); 
 }); 
 
 // ============================================ 
 // ERROR HANDLING 
 // ============================================ 
 app.use((err, req, res, next) => { 
     console.error(err.stack); 
     res.status(500).send('Something broke!'); 
 }); 
 
 // ============================================ 
 // START SERVER 
 // ============================================ 
 app.listen(port, () => { 
     console.log(` 
 ╔════════════════════════════════════════╗ 
 ║   RSAI Backend Server                  ║ 
 ║   Dengan Ollama LLM (Gratis)           ║ 
 ╠════════════════════════════════════════╣ 
 ║   🚀 Server: http://localhost:${port}     ║ 
 ║   📊 Database: ai_testing              ║ 
 ║   🤖 LLM: Ollama (Local)               ║ 
 ║   ✓ Model: llama2 (3.8GB)              ║ 
 ╚════════════════════════════════════════╝ 
     `); 
 });
