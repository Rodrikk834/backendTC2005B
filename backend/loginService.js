const express = require('express');
const fs = require('fs'); 
const { hashPassword } = require('./hashing');

const app = express();
app.use(express.json());

const DUMMY_FILE = './dummy.json';

function leerBaseDeDatos() {
    try {
        const data = fs.readFileSync(DUMMY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error al leer dummy.json. Verifica que el archivo exista.");
        return [];
    }
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username y password son obligatorios' });
    }

    const db = leerBaseDeDatos();
    const user = db.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const hashToVerify = hashPassword(password);

    if (hashToVerify === user.password_hash) {
        res.status(200).json({ 
            message: 'Login exitoso', 
            id_usuario: user.id_usuario,
            username: user.username
        });
    } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`api: http://localhost:${PORT}`);
});