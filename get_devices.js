const { execSync } = require('child_process');
try {
    console.log('Installing @zeppos/device-types locally...');
    execSync('npm install @zeppos/device-types@latest --no-save', { stdio: 'inherit' });

    let targetKeys = [];
    try {
        const models = require('@zeppos/device-types/models');
        targetKeys = Object.keys(models);
    } catch (e) {
        const types = require('@zeppos/device-types');
        targetKeys = Object.keys(types.models || types);
    }
    console.log('--- VALID ZEPPOS DEVICE TARGET KEYS ---');
    console.log(targetKeys.join('\n'));
} catch (err) {
    console.error(err);
}
