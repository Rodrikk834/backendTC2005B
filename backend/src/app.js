const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRouter = require('./routes');

const app = express();

const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning', 'Accept']
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

module.exports = app;