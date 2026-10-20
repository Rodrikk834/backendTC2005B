const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./src/app');

const puerto = 3000;
app.listen(puerto, '0.0.0.0', () => {
    console.log(`API corriendo y expuesta al exterior en el puerto ${puerto}`);
});