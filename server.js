const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connexion PostgreSQL (Render fournit DATABASE_URL automatiquement)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Création des tables + données de démo
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      is_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activation_codes (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const codesRes = await pool.query('SELECT COUNT(*) FROM activation_codes');
  if (parseInt(codesRes.rows[0].count) === 0) {
    const codes = ['SMOKE2024','VIPACCESS','RAPHTNT99','BLAZEIT','FIRESTART'];
    for (const c of codes) await pool.query('INSERT INTO activation_codes (code) VALUES ($1)', [c]);
  }

  const usersRes = await pool.query('SELECT COUNT(*) FROM users');
  if (parseInt(usersRes.rows[0].count) === 0) {
    const users = [
      ['RaphTNT', await bcrypt.hash('admin123', 10), 2847, true],
      ['Smoker_99', await bcrypt.hash('pass123', 10), 2631, false],
      ['CloudNine', await bcrypt.hash('pass123', 10), 2405, false],
      ['BlazeKing', await bcrypt.hash('pass123', 10), 2198, false],
      ['FireFly', await bcrypt.hash('pass123', 10), 1954, false],
      ['AshTray', await bcrypt.hash('pass123', 10), 1822, false],
      ['SmokeSignal', await bcrypt.hash('pass123', 10), 1701, false],
      ['EmberSoul', await bcrypt.hash('pass123', 10), 1645, false]
    ];
    for (const u of users) await pool.query('INSERT INTO users (username, password, score, is_admin) VALUES ($1,$2,$3,$4)', u);
  }
}
initDB().catch(console.error);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'smokingv2-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Non connecté' });
}

// Activation
app.post('/api/activate', async (req, res) => {
  const { code, username, password } = req.body;
  if (!code || !username || !password) return res.status(400).json({ error: 'Champs requis' });
  
  const cRes = await pool.query('SELECT * FROM activation_codes WHERE code = $1', [code.toUpperCase()]);
  if (!cRes.rows[0]) return res.status(400).json({ error: 'Code invalide' });
  if (cRes.rows[0].used) return res.status(400).json({ error: 'Code déjà utilisé' });
  
  const uRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (uRes.rows[0]) return res.status(400).json({ error: 'Nom déjà pris' });
  
  const hash = await bcrypt.hash(password, 10);
  const newU = await pool.query('INSERT INTO users (username, password, score) VALUES ($1,$2,0) RETURNING id, username', [username, hash]);
  await pool.query('UPDATE activation_codes SET used = true WHERE code = $1', [code.toUpperCase()]);
  
  req.session.userId = newU.rows[0].id;
  req.session.username = username;
  res.json({ success: true, username });
});

// Connexion
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs requis' });
  
  const uRes = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (!uRes.rows[0]) return res.status(400).json({ error: 'Identifiants incorrects' });
  
  const valid = await bcrypt.compare(password, uRes.rows[0].password);
  if (!valid) return res.status(400).json({ error: 'Identifiants incorrects' });
  
  req.session.userId = uRes.rows[0].id;
  req.session.username = uRes.rows[0].username;
  res.json({ success: true, username: uRes.rows[0].username });
});

// Déconnexion
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Infos user
app.get('/api/me', requireAuth, async (req, res) => {
  const uRes = await pool.query('SELECT id, username, score, is_admin FROM users WHERE id = $1', [req.session.userId]);
  res.json(uRes.rows[0]);
});

// Classement
app.get('/api/leaderboard', async (req, res) => {
  const rows = await pool.query('SELECT username, score FROM users ORDER BY score DESC LIMIT 50');
  res.json(rows.rows);
});

// Prix
app.get('/api/prizes', (req, res) => {
  res.json([
    {name:'Grand prix', condition:'1ère place', value:'500 €', icon:'🏆'},
    {name:'Prix argent', condition:'2ème place', value:'250 €', icon:'🥈'},
    {name:'Prix bronze', condition:'3ème place', value:'100 €', icon:'🥉'},
    {name:'Bonus streak', condition:'7 jours consécutifs', value:'20 €', icon:'🔥'},
    {name:'Participation', condition:'Toutes épreuves', value:'10 €', icon:'🎯'}
  ]);
});

// Admin - générer code
app.post('/api/admin/generate-code', requireAuth, async (req, res) => {
  const uRes = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.session.userId]);
  if (!uRes.rows[0]?.is_admin) return res.status(403).json({ error: 'Non autorisé' });
  const code = 'SMOKE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  await pool.query('INSERT INTO activation_codes (code) VALUES ($1)', [code]);
  res.json({ code });
});

// Admin - liste codes
app.get('/api/admin/codes', requireAuth, async (req, res) => {
  const uRes = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.session.userId]);
  if (!uRes.rows[0]?.is_admin) return res.status(403).json({ error: 'Non autorisé' });
  const rows = await pool.query('SELECT code, used FROM activation_codes ORDER BY id DESC');
  res.json(rows.rows);
});

app.listen(PORT, () => console.log('SmokingV2 sur le port ' + PORT));
