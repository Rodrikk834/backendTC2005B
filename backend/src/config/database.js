const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

const dbQuery = {
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        rol TEXT NOT NULL DEFAULT 'Colaborador',
        avatar TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS empleados (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        no_empleado TEXT NOT NULL,
        rfc TEXT,
        curp TEXT,
        imss TEXT,
        departamento TEXT,
        puesto TEXT,
        fecha_ingreso DATE,
        reporta_a TEXT,
        abono_cuenta TEXT,
        FOREIGN KEY (id) REFERENCES usuarios(id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS empresa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        rfc TEXT,
        registro_patronal TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS nominas (
        id TEXT PRIMARY KEY,
        folio TEXT NOT NULL,
        empleado_id TEXT NOT NULL,
        empresa_id INTEGER NOT NULL,
        periodo_nombre TEXT NOT NULL,
        sueldo_diario REAL NOT NULL,
        dias_trabajados REAL NOT NULL,
        horas_trabajadas REAL NOT NULL,
        periodo_pago TEXT NOT NULL,
        fecha_pago DATE NOT NULL,
        turno TEXT NOT NULL,
        jornada TEXT NOT NULL,
        quincena_semana TEXT NOT NULL,
        anio INTEGER NOT NULL,
        mes INTEGER NOT NULL,
        estatus TEXT NOT NULL DEFAULT 'Pagado',
        total_percepciones REAL NOT NULL,
        total_deducciones REAL NOT NULL,
        neto_pagado REAL NOT NULL,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE,
        FOREIGN KEY (empresa_id) REFERENCES empresa(id)
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS conceptos_nomina (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nomina_id TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('percepcion', 'deduccion', 'informativo')) NOT NULL,
        concepto TEXT NOT NULL,
        importe REAL NOT NULL,
        FOREIGN KEY (nomina_id) REFERENCES nominas(id) ON DELETE CASCADE
      );
    `);

    seedDatabase();
  });
}

function seedDatabase() {
  db.get('SELECT COUNT(*) AS count FROM usuarios', [], (err, row) => {
    if (err || row.count > 0) return;

    db.run(
      `INSERT INTO empresa (id, nombre, rfc, registro_patronal) VALUES (1, 'ATLAS SOLUTIONS S.A. DE C.V.', 'ATL010101XXX', 'Y567891011')`
    );

    db.run(
      `INSERT INTO usuarios (id, nombre, email, password_hash, rol, avatar) VALUES 
       ('EP-4091', 'Juan Pérez', 'juan.perez@eslabon.com', 'password123', 'Colaborador', '/assets/user-profile.jpg?img=11'),
       ('EP-4092', 'María López R.', 'maria.lopez@eslabon.com', 'password456', 'Colaborador', '/assets/default-user.png?img=5')`
    );

    db.run(
      `INSERT INTO empleados (id, nombre, no_empleado, rfc, curp, imss, departamento, puesto, fecha_ingreso, reporta_a, abono_cuenta) VALUES 
       ('EP-4091', 'Juan Pérez', 'EP-4091', 'PEPJ900101XXX', 'PEPJ900101HDFXXX01', '12345678901', 'Tecnología e Innovación', 'Desarrollador Full Stack', '2022-01-15', 'Ing. Carlos Mendoza (TI)', 'BBVA - CLABE: 012180015928374910'),
       ('EP-4092', 'María López R.', 'EP-4092', 'LORM920512XXX', 'LORM920512MDFXXX02', '98765432109', 'Recursos Humanos', 'Especialista en Nóminas', '2021-06-01', 'Lic. Sofía Ramírez (RH)', 'BANORTE - CLABE: 072180009876543210')`
    );

    db.run(
      `INSERT INTO nominas (id, folio, empleado_id, empresa_id, periodo_nombre, sueldo_diario, dias_trabajados, horas_trabajadas, periodo_pago, fecha_pago, turno, jornada, quincena_semana, anio, mes, estatus, total_percepciones, total_deducciones, neto_pagado) VALUES 
       ('NOM-2026-15', 'REC-2026-0815', 'EP-4091', 1, 'Quincena 1 - Agosto 2026', 1100.00, 15.0, 120.0, '01/08/2026 al 15/08/2026', '2026-08-15', 'Matutino', 'Diurna (8 hrs)', 'Quincena 15 (Agosto Q1)', 2026, 8, 'Pagado', 18500.00, 3200.50, 15299.50),
       ('NOM-2026-14', 'REC-2026-0731', 'EP-4091', 1, 'Quincena 2 - Julio 2026', 1100.00, 15.0, 120.0, '16/07/2026 al 31/07/2026', '2026-07-31', 'Matutino', 'Diurna (8 hrs)', 'Quincena 14 (Julio Q2)', 2026, 7, 'Pagado', 18500.00, 3200.50, 15299.50)`
    );

    db.run(
      `INSERT INTO conceptos_nomina (nomina_id, tipo, concepto, importe) VALUES 
       ('NOM-2026-15', 'percepcion', 'Sueldo Base', 16500.00),
       ('NOM-2026-15', 'percepcion', 'Vales de Despensa', 2000.00),
       ('NOM-2026-15', 'deduccion', 'ISR Retenido', 2500.50),
       ('NOM-2026-15', 'deduccion', 'IMSS', 700.00),
       ('NOM-2026-15', 'informativo', 'Saldo Acumulado Fondo Ahorro', 12000.00),
       ('NOM-2026-14', 'percepcion', 'Sueldo Base', 16500.00),
       ('NOM-2026-14', 'percepcion', 'Vales de Despensa', 2000.00),
       ('NOM-2026-14', 'deduccion', 'ISR Retenido', 2500.50),
       ('NOM-2026-14', 'deduccion', 'IMSS', 700.00)`
    );
  });
}

initDatabase();

module.exports = {
  db,
  dbQuery
};