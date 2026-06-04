/** 
 * RSAI - Backend Server dengan Llama API Server
 * Node.js Express + Llama API + MySQL 
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
            source VARCHAR(20) DEFAULT 'llama_api', 
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
 - Jam IGD: 24 jam 
 - Jam Poliklinik: Senin-Jumat 07:30-14:00, Jumat 07:30-14:30 
 - Layanan: IGD, Rawat Inap, Poliklinik Spesialis, Lab, Radiologi, Farmasi 24 Jam 
 
 ATURAN KOMUNIKASI: 
 1. WAJIB GUNAKAN BAHASA INDONESIA - jangan campur dengan Inggris 
 2. Jawab dengan sopan dan ramah 
 3. Gunakan salam pembuka seperti "Halo", "Selamat pagi", "Selamat siang" 
 4. Jangan berikan diagnosis medis - arahkan ke dokter 
 5. Untuk pertanyaan medis, selalu sarankan konsultasi langsung dengan dokter RS 
 6. Akhiri respons dengan pertanyaan ramah seperti "Apakah ada yang bisa saya bantu lagi?" atau "Ada pertanyaan lainnya?"`; 
 
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
// ENDPOINT: Chat dengan Llama API Server 
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
        console.log(`📨 Llama API Request - Session: ${session_id}`); 
        console.log(`📝 User: ${user_message.substring(0, 50)}...`); 
 
        const LLAMA_API_URL = process.env.LLAMA_API_URL || 'http://202.150.130.251:8090/v1/chat/completions'; 
        const LLAMA_API_KEY = process.env.LLAMA_API_KEY || 'simrs_agent_9Vq9Zf2Kp8LmQb4ZaT6rYw3BpD5hGM0JkE1uPi'; 
 
        const response = await fetch(LLAMA_API_URL, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${LLAMA_API_KEY}` 
            }, 
            body: JSON.stringify({ 
                model: 'llama', 
                messages: [ 
                    { 
                        role: 'system', 
                        content: SYSTEM_PROMPT 
                    }, 
                    { 
                        role: 'user', 
                        content: user_message 
                    } 
                ], 
                max_tokens: 512, 
                temperature: 0.7 
            }) 
        }); 
 
        if (!response.ok) { 
            const errorText = await response.text(); 
            console.error('❌ API Error Response:', errorText); 
            throw new Error(`Llama API error: ${response.status} ${response.statusText}`); 
        } 
 
        const data = await response.json(); 
        console.log('✅ API Response received'); 
        
        // Parse OpenAI-compatible response 
        const botResponse = data.choices[0].message.content; 
 
        console.log(`✅ Llama API Response Success`); 
 
        // Auto-save ke database (Remote Server) 
        if (userData && userData.name && userData.email && userData.phone) { 
            const uuid = uuidv4(); 
            const sql = ` 
                INSERT INTO ai_history ( 
                    uuid, nama, email, notelp, session_id, 
                    user_message, agent_message, source 
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'llama_api') 
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
        console.error('❌ Llama API Error:', error.message); 
        res.status(500).json({ 
            status: 'error', 
            message: 'Gagal mendapatkan respons dari Llama API: ' + error.message 
        }); 
    } 
}); 
 
// ============================================ 
// HEALTH CHECK 
// ============================================ 
app.get('/health', (req, res) => { 
    res.status(200).json({ 
        status: 'ok', 
        service: 'RSAI Backend + Llama API', 
        llama_url: process.env.LLAMA_API_URL, 
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
 ║   Dengan Llama API (Remote)            ║ 
 ╠════════════════════════════════════════╣ 
 ║   🚀 Server: http://localhost:${port}     ║ 
 ║   📊 Database: ai_testing (Remote)     ║ 
 ║   🤖 LLM: Llama API (Remote)           ║ 
 ╚════════════════════════════════════════╝ 
    `); 
});
