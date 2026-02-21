const https = require('https');

https.get('https://unpkg.com/@zeppos/device-types@latest/models.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('MODELS_JS:', data.substring(0, 1000)));
}).on('error', err => console.error(err));

https.get('https://unpkg.com/@zeppos/device-types@latest/index.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('INDEX_JS:', data.substring(0, 1000)));
}).on('error', err => console.error(err));
