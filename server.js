const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Document parsers (PDF, DOC/DOCX)
let pdfjsLib = null;
let mammoth = null;
let pdfParse = null;
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
} catch (e) {
  console.log('pdfjs-dist not installed; PDF parsing will use fallback.');
}
try {
  mammoth = require('mammoth');
} catch (e) {
  console.log('mammoth not installed; DOC/DOCX parsing will use fallback.');
}
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.log('pdf-parse not installed; PDF parsing will rely on pdfjs-dist.');
}

// OpenAI integration (optional - only if API key is provided)
let OpenAI;
try {
  OpenAI = require('openai');
} catch (e) {
  console.log('OpenAI package not installed. AI features will use placeholder responses.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/jobspeedy',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// AI Service API Key (supports Vercel env names)
const AI_SERVICE_API_KEY =
  process.env.AI_SERVICE_API_KEY || // preferred (per Vercel)
  process.env.OPENAI_API_KEY ||      // common default
  process.env.JOBS_AI_API_KEY ||     // legacy fallback
  null;

// Initialize OpenAI client if API key is available
let openai = null;
if (AI_SERVICE_API_KEY && OpenAI) {
  try {
    openai = new OpenAI({
      apiKey: AI_SERVICE_API_KEY
    });
    console.log('OpenAI client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error.message);
  }
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'text/rtf',
      'application/vnd.oasis.opendocument.text'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Store error in request for better handling
      const error = new Error(`Invalid file type: ${file.mimetype}. Only PDF, DOC, DOCX, TXT, RTF, ODT are allowed.`);
      req.fileValidationError = error.message;
      cb(error, false);
    }
  }
});

// Helper: extract text from uploaded resume (PDF, DOC/DOCX, TXT)
async function extractResumeText(file, maxChars = 60000) {
  const ext = (path.extname(file?.originalname || '') || '').toLowerCase();

  // PDF via pdfjs-dist if available
  if (ext === '.pdf' && pdfjsLib) {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: file.buffer });
      const pdf = await loadingTask.promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\n';
      }
      if (text.trim()) return text.slice(0, maxChars);
    } catch (e) {
      console.error('PDF parse error (pdfjs):', e.message);
    }
  }

  // PDF fallback via pdf-parse if available
  if (ext === '.pdf' && pdfParse) {
    try {
      const parsed = await pdfParse(file.buffer);
      if (parsed.text && parsed.text.trim()) return parsed.text.slice(0, maxChars);
    } catch (e) {
      console.error('PDF parse error (pdf-parse):', e.message);
    }
  }

  // DOC/DOCX via mammoth if available
  if ((ext === '.docx' || ext === '.doc') && mammoth) {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      if (result.value && result.value.trim()) return result.value;
    } catch (e) {
      console.error('DOC/DOCX parse error (mammoth):', e.message);
    }
  }

  // Plain text / RTF / fallback decode
  try {
    const text = file.buffer.toString('utf-8');
    if (text.trim()) return text.slice(0, maxChars);
  } catch (e) {
    console.error('Fallback text decode error:', e.message);
  }

  return '';
}

// Helpers to normalize parsed resume structure
function normalizeSkills(raw) {
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  if (typeof raw === 'string')
    return raw
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function normalizeExperience(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = item || {};
    return {
      title: obj.title || obj.role || '',
      company: obj.company || obj.organization || '',
      start_date: obj.start_date || obj.startDate || obj.from || '',
      end_date: obj.end_date || obj.endDate || obj.to || '',
      responsibilities: normalizeSkills(obj.responsibilities || obj.responsibility || [])
    };
  });
}

function normalizeParsed(parsed, resumeText = '') {
  const safe = parsed || {};
  const contact = safe.contact || {};
  const email =
    safe.email ||
    contact.email ||
    (resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [null])[0];
  const phone =
    safe.phone ||
    contact.phone ||
    (resumeText.match(/(\+?\d[\d\s\-\(\)]{7,}\d)/) || [null])[0];

  return {
    skills: normalizeSkills(safe.skills),
    contact: {
      name: contact.name || safe.name || null,
      email: email || null,
      phone: phone || null,
      location: contact.location || safe.location || null
    },
    summary: safe.summary || '',
    experience: normalizeExperience(safe.experience),
    education: Array.isArray(safe.education) ? safe.education : [],
    certifications: normalizeSkills(safe.certifications),
    languages: normalizeSkills(safe.languages),
    links: normalizeSkills(safe.links)
  };
}

async function parseAiResponseToJson(aiResponse, resumeText) {
  // First attempt
  try {
    const parsed = JSON.parse(aiResponse);
    return normalizeParsed(parsed, resumeText);
  } catch (e) {
    // try repair with a secondary prompt
  }
  return null;
}

async function repairAiResponse(openaiClient, aiResponse, resumeText) {
  try {
    const repair = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a strict JSON reformatter. Given a model reply, return ONLY valid JSON matching this schema: {skills:[string], contact:{name,email,phone,location}, summary:string, experience:[{title,company,start_date,end_date,responsibilities:[string]}], education:[{degree,institution,year}], certifications:[string], languages:[string], links:[string]}. No markdown, no prose.'
        },
        { role: 'user', content: `Fix this to valid JSON only: ${aiResponse}` }
      ]
    });
    const repaired = repair.choices[0]?.message?.content;
    if (repaired) {
      const parsed = JSON.parse(repaired);
      return normalizeParsed(parsed, resumeText);
    }
  } catch (err) {
    console.error('Repair JSON error:', err.message);
  }
  return null;
}

function heuristicParsed(resumeText) {
  const skillsHeuristic = extractSkillsHeuristic(resumeText);
  return normalizeParsed(
    {
      skills: skillsHeuristic,
      contact: {},
      summary: 'Parsed resume text without AI (heuristic fallback)',
      experience: []
    },
    resumeText
  );
}

function extractSkillsHeuristic(resumeText = '') {
  if (!resumeText) return [];
  const candidates = resumeText
    .split(/[\s,;\/\n]+/)
    .map((w) => w.replace(/[^A-Za-z0-9\+\#\.\-]/g, ''))
    .filter((w) => w.length > 1 && w.length < 40);
  const commonStop = new Set(['and', 'or', 'the', 'a', 'an', 'to', 'in', 'of', 'for', 'on', 'with', 'at', 'by', 'from']);
  const skills = [];
  const seen = new Set();
  for (const w of candidates) {
    const key = w.toLowerCase();
    if (commonStop.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(w);
    if (skills.length >= 50) break;
  }
  return skills;
}

// Centralized AI parsing for resumes (no dummy data)
async function aiParseResume(openaiClient, resumeText) {
  const truncatedText = resumeText.slice(0, 15000);

  const baseMessages = [
    {
      role: 'system',
      content:
        'You are a resume parser. Return ONLY JSON (no markdown, no prose). Schema: {skills:[string], contact:{name,email,phone,location}, summary:string, experience:[{title,company,start_date,end_date,responsibilities:[string]}], education:[{degree,institution,year}], certifications:[string], languages:[string], links:[string]}. Use ONLY the provided resume text; do not invent data.'
    },
    {
      role: 'user',
      content: `Parse this resume text and respond with JSON only (no extra text):\n\n${truncatedText}`
    }
  ];

  const strictCall = async (messages) => {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-3.5-turbo-1106',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages,
      max_tokens: 2000
    });
    return completion.choices[0]?.message?.content || '';
  };

  // First attempt
  let aiResponse = await strictCall(baseMessages);
  let parsed = await parseAiResponseToJson(aiResponse, truncatedText);
  if (!parsed) {
    parsed = await repairAiResponse(openaiClient, aiResponse, truncatedText);
  }

  // If parsed but missing core data, attempt a focused re-ask
  const needsRetry =
    !parsed ||
    ((parsed.skills.length === 0 || parsed.skills.every((s) => !s.trim())) &&
      parsed.experience.length === 0 &&
      (!parsed.contact.name && !parsed.contact.email && !parsed.contact.phone));

  if (needsRetry) {
    const retryMessages = [
      {
        role: 'system',
        content:
          'You are a resume parser. Return ONLY JSON (no markdown). Extract actual data from the resume text; do not invent. Schema: {skills:[string], contact:{name,email,phone,location}, summary:string, experience:[{title,company,start_date,end_date,responsibilities:[string]}], education:[{degree,institution,year}], certifications:[string], languages:[string], links:[string]}. Ensure skills and experience are filled when present in text.'
      },
      {
        role: 'user',
        content: `Parse this resume text and respond with JSON only (no extra text):\n\n${truncatedText}`
      }
    ];
    aiResponse = await strictCall(retryMessages);
    parsed = await parseAiResponseToJson(aiResponse, truncatedText);
    if (!parsed) {
      parsed = await repairAiResponse(openaiClient, aiResponse, truncatedText);
    }
  }

  if (!parsed) {
    throw new Error('AI parse failed');
  }

  return parsed;
}

// Middleware: Verify JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware: Verify Admin Token
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id FROM admin_users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// --------------------------------------------
// Helper: cache table columns to handle older schemas gracefully
// --------------------------------------------
const tableColumnsCache = {};

const getTableColumns = async (tableName) => {
  if (tableColumnsCache[tableName]) return tableColumnsCache[tableName];
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  const cols = result.rows.map((r) => r.column_name);
  tableColumnsCache[tableName] = cols;
  return cols;
};

// ============================================
// AUTHENTICATION APIs
// ============================================

// 1. User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;
    
    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'full_name, email, and password are required' });
    }

    // Check if email already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, phone, created_at',
      [full_name, email, passwordHash, phone || null]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. User Login
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, full_name, email, phone, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Get Current User Profile
app.get('/api/users/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Admin Registration
app.post('/api/admin/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if email already exists
    const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert admin
    const result = await pool.query(
      'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const admin = result.rows[0];

    // Generate JWT token
    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        created_at: admin.created_at
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find admin
    const result = await pool.query(
      'SELECT id, email, password_hash, created_at FROM admin_users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        created_at: admin.created_at
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alternative Admin Auth Endpoints (for frontend compatibility)
app.post('/api/auth/register-admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const existingAdmin = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );
    const admin = result.rows[0];
    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      user: {
        id: admin.id,
        email: admin.email
      },
      token
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login-admin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await pool.query(
      'SELECT id, email, password_hash, created_at FROM admin_users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const admin = result.rows[0];
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      user: {
        id: admin.id,
        email: admin.email
      },
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and newPassword are required' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE admin_users SET password_hash = $1 WHERE email = $2 RETURNING id',
      [passwordHash, email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// JOBS APIs
// ============================================

// Get All Jobs (Public)
app.get('/api/jobs', async (req, res) => {
  try {
    const { search, location, job_type, category, status, department, limit, offset } = req.query;
    
    let query = `
      SELECT 
        j.*,
        COALESCE(j.company, c.company) AS company,
        c.company AS client_company,
        j.location,
        j.job_type,
        j.category,
        j.language
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (j.title ILIKE $${paramCount} OR j.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    if (location) {
      paramCount++;
      query += ` AND j.location = $${paramCount}`;
      params.push(location);
    }
    if (job_type) {
      paramCount++;
      query += ` AND j.job_type = $${paramCount}`;
      params.push(job_type);
    }
    if (category) {
      paramCount++;
      query += ` AND j.category = $${paramCount}`;
      params.push(category);
    }
    if (status) {
      paramCount++;
      query += ` AND j.status = $${paramCount}`;
      params.push(status);
    }
    if (department) {
      paramCount++;
      query += ` AND j.department = $${paramCount}`;
      params.push(department);
    }

    // Build count query (same filters, no pagination)
    let countQuery = `
      SELECT COUNT(*) as count
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE 1=1
    `;
    const countParams = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (j.title ILIKE $${countParamCount} OR j.description ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }
    if (location) {
      countParamCount++;
      countQuery += ` AND j.location = $${countParamCount}`;
      countParams.push(location);
    }
    if (job_type) {
      countParamCount++;
      countQuery += ` AND j.job_type = $${countParamCount}`;
      countParams.push(job_type);
    }
    if (category) {
      countParamCount++;
      countQuery += ` AND j.category = $${countParamCount}`;
      countParams.push(category);
    }
    if (status) {
      countParamCount++;
      countQuery += ` AND j.status = $${countParamCount}`;
      countParams.push(status);
    }
    if (department) {
      countParamCount++;
      countQuery += ` AND j.department = $${countParamCount}`;
      countParams.push(department);
    }

    query += ' ORDER BY j.created_at DESC';

    if (limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));
    }
    if (offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset));
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    res.json({
      jobs: result.rows,
      count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Single Job by ID (Public)
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
        j.*,
        COALESCE(j.company, c.company) AS company,
        c.company AS client_company,
        j.location,
        j.job_type,
        j.category,
        j.language
      FROM jobs j
      LEFT JOIN clients c ON j.client_id = c.id
      WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job: result.rows[0] });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Job (Admin Only)
app.post('/api/jobs', verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      department,
      description,
      requirements,
      status,
      created_by,
      client_id,
      location,
      job_type,
      type, // alias from frontend
      category,
      language,
      company, // possible alias for client_id (numeric) or company name
      company_id, // possible alias for client_id
      company_name, // explicit company name field
    } = req.body;

    if (!title || !department) {
      return res.status(400).json({ error: 'title and department are required' });
    }

    // Normalize requirements to an array (accept array, JSON string, or string -> split by comma/line)
    let requirementsArray = [];
    if (Array.isArray(requirements)) {
      requirementsArray = requirements;
    } else if (typeof requirements === 'string') {
      try {
        const parsed = JSON.parse(requirements);
        requirementsArray = Array.isArray(parsed) ? parsed : [];
      } catch {
        requirementsArray = requirements
          .split(/,|\n/)
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    // Normalize required skills (accept aliases and string/array)
    const requiredSkillsRaw =
      req.body.required_skills ??
      req.body.requiredSkills ??
      req.body.skills ??
      req.body.skills_text ??
      req.body.skillsText;
    let requiredSkillsArray = [];
    if (requiredSkillsRaw !== undefined) {
      if (Array.isArray(requiredSkillsRaw)) {
        requiredSkillsArray = requiredSkillsRaw;
      } else if (typeof requiredSkillsRaw === 'string') {
        try {
          const parsed = JSON.parse(requiredSkillsRaw);
          requiredSkillsArray = Array.isArray(parsed) ? parsed : [];
        } catch {
          requiredSkillsArray = requiredSkillsRaw
            .split(/,|\n/)
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }
    }

    // Normalize optional types / defaults
    const numericCompany =
      company !== undefined && company !== null && company !== '' && !Number.isNaN(Number(company))
        ? Number(company)
        : undefined;
    const candidateClientId =
      client_id !== undefined ? client_id :
      company_id !== undefined ? company_id :
      numericCompany;
    const normalizedClientId =
      candidateClientId === undefined || candidateClientId === null || candidateClientId === ''
        ? null
        : Number(candidateClientId);
    const normalizedJobType = job_type || type || null;
    const normalizedStatus = status || 'Open';
    const normalizedCreatedBy = created_by || 'Admin';
    const normalizedCompanyName =
      company_name !== undefined && company_name !== null && company_name !== ''
        ? company_name
        : company !== undefined && typeof company === 'string' && company.trim() !== ''
          ? company
          : null;

    const availableCols = await getTableColumns('jobs');
    // Map payload fields to DB columns
    const candidateFields = {
      title,
      department,
      description: description || null,
      required_skills: requiredSkillsArray,
      requirements: requirementsArray,
      status: normalizedStatus,
      created_by: normalizedCreatedBy,
      client_id: Number.isNaN(normalizedClientId) ? null : normalizedClientId,
      location: location || null,
      job_type: normalizedJobType,
      category: category || null,
      language: language || null,
      company: normalizedCompanyName,
    };

    const columns = [];
    const values = [];
    let param = 0;
    for (const [key, value] of Object.entries(candidateFields)) {
      if (availableCols.includes(key) && value !== undefined) {
        param += 1;
        columns.push(key);
        values.push(value);
      }
    }

    if (columns.length === 0) {
      return res.status(400).json({
        error: 'No matching columns found in jobs table',
        available_columns: availableCols
      });
    }

    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    const query = `INSERT INTO jobs (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);

    res.status(201).json({ job: result.rows[0] });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Update Job (Admin Only)
app.put('/api/jobs/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      department,
      description,
      requirements,
      required_skills,
      status,
      location,
      job_type,
      type, // alias from frontend
      category,
      language,
      client_id,
      company,
      company_id,
      company_name,
    } = req.body;

    // Normalize requirements to an array if provided
    let requirementsArray = undefined;
    if (requirements !== undefined) {
      if (Array.isArray(requirements)) {
        requirementsArray = requirements;
      } else if (typeof requirements === 'string') {
        try {
          const parsed = JSON.parse(requirements);
          requirementsArray = Array.isArray(parsed) ? parsed : [];
        } catch {
          requirementsArray = requirements
            .split(/,|\n/)
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } else {
        requirementsArray = [];
      }
    }

    // Normalize required skills (accept aliases and string/array)
    const requiredSkillsRaw =
      required_skills ??
      req.body.requiredSkills ??
      req.body.skills ??
      req.body.skills_text ??
      req.body.skillsText;
    let requiredSkillsArray = undefined;
    if (requiredSkillsRaw !== undefined) {
      if (Array.isArray(requiredSkillsRaw)) {
        requiredSkillsArray = requiredSkillsRaw;
      } else if (typeof requiredSkillsRaw === 'string') {
        try {
          const parsed = JSON.parse(requiredSkillsRaw);
          requiredSkillsArray = Array.isArray(parsed) ? parsed : [];
        } catch {
          requiredSkillsArray = requiredSkillsRaw
            .split(/,|\n/)
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } else {
        requiredSkillsArray = [];
      }
    }

    // Normalize optional numeric / defaults
    const numericCompany =
      company !== undefined && company !== null && company !== '' && !Number.isNaN(Number(company))
        ? Number(company)
        : undefined;
    const candidateClientId =
      client_id !== undefined ? client_id :
      company_id !== undefined ? company_id :
      numericCompany;
    const normalizedClientId =
      candidateClientId === undefined || candidateClientId === null || candidateClientId === ''
        ? null
        : Number(candidateClientId);
    const normalizedJobType = job_type || type || null;
    const normalizedCompanyName =
      company_name !== undefined && company_name !== null && company_name !== ''
        ? company_name
        : company !== undefined && typeof company === 'string' && company.trim() !== ''
          ? company
          : null;

    const availableCols = await getTableColumns('jobs');
    const candidateFields = {
      title,
      department,
      description,
      required_skills: requiredSkillsArray,
      requirements: requirementsArray,
      status,
      location,
      job_type: normalizedJobType,
      category,
      language,
      client_id: Number.isNaN(normalizedClientId) ? null : normalizedClientId,
      company: normalizedCompanyName,
    };

    const updates = [];
    const values = [];
    let param = 0;

    for (const [key, value] of Object.entries(candidateFields)) {
      if (value !== undefined && availableCols.includes(key)) {
        param += 1;
        updates.push(`${key} = $${param}`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    param += 1;
    values.push(id);

    const result = await pool.query(
      `UPDATE jobs SET ${updates.join(', ')} WHERE id = $${param} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job: result.rows[0] });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Delete Job (Admin Only)
app.delete('/api/jobs/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true, message: 'Job deleted successfully', id: parseInt(id) });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Applications for a Job (Admin Only)
app.get('/api/jobs/:jobId/applications', verifyAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(
      `SELECT 
        a.*,
        u.full_name,
        u.email
      FROM applications a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.job_id = $1
      ORDER BY a.created_at DESC`,
      [jobId]
    );

    res.json({
      applications: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate Job Ad (Admin Only)
app.post('/api/jobs/generate-ad', verifyAdmin, async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Use OpenAI if available, otherwise return placeholder
    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a job posting expert. Generate a structured job posting from the given description. Return a JSON object with: title, company (optional), department, location (optional), job_type (optional), category (optional), language (optional), description, required_skills (array), and requirements (array).'
            },
            {
              role: 'user',
              content: `Generate a job posting from this description: ${description}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        const aiResponse = completion.choices[0]?.message?.content;
        let jobAd;
        
        try {
          // Try to parse JSON response
          jobAd = JSON.parse(aiResponse);
        } catch (e) {
          // If not JSON, create structured response from text
          jobAd = {
            title: description.split(' ').slice(0, 5).join(' ') + ' Position',
            company: null,
            department: null,
            location: null,
            job_type: null,
            category: null,
            language: null,
            status: null,
            description: aiResponse || description,
            required_skills: [],
            requirements: []
          };
        }

        res.json({ jobAd });
      } catch (aiError) {
        console.error('OpenAI API error:', aiError);
        // Fallback to placeholder
        const jobAd = {
          title: description.split(' ').slice(0, 5).join(' ') + ' Position',
          company: null,
          department: null,
          location: null,
          job_type: null,
          category: null,
          language: null,
          status: null,
          description: description || '',
          required_skills: [],
          requirements: []
        };
        res.json({ jobAd });
      }
    } else {
      // Placeholder response when OpenAI is not configured
      const jobAd = {
        title: description ? description.split(' ').slice(0, 5).join(' ') + ' Position' : 'New Position',
        company: null,
        department: null,
        location: null,
        job_type: null,
        category: null,
        language: null,
        status: null,
        description: description || '',
        required_skills: [],
        requirements: []
      };
      res.json({ jobAd });
    }
  } catch (error) {
    console.error('Generate job ad error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get XML Feed for Job Portal
app.get('/api/jobs/:id/xml-feed/:portal', async (req, res) => {
  try {
    const { id, portal } = req.params;
    const result = await pool.query(
      `SELECT 
        j.*,
        COALESCE(j.company, c.company) AS company,
        c.company AS client_company
      FROM jobs j 
      LEFT JOIN clients c ON j.client_id = c.id 
      WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<job>\n';
    xml += `  <title>${escapeXml(job.title)}</title>\n`;
    xml += `  <description>${escapeXml(job.description || '')}</description>\n`;
    if (job.company) xml += `  <company>${escapeXml(job.company)}</company>\n`;
    if (job.location) xml += `  <location>${escapeXml(job.location)}</location>\n`;
    xml += '</job>';

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('XML feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// ============================================
// APPLICATIONS APIs
// ============================================

// Create Application (User)
app.post('/api/applications', verifyToken, upload.single('resume'), async (req, res) => {
  try {
    const { job_id, cover_letter, name, email, phone, ai_parsed_data } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'resume file is required' });
    }

    // Check if user already applied
    const existingApp = await pool.query(
      'SELECT id FROM applications WHERE user_id = $1 AND job_id = $2',
      [req.user.id, job_id]
    );

    if (existingApp.rows.length > 0) {
      return res.status(409).json({ error: 'You have already applied for this job' });
    }

    // Parse AI data if provided
    let parsedData = null;
    if (ai_parsed_data) {
      try {
        parsedData = typeof ai_parsed_data === 'string' ? JSON.parse(ai_parsed_data) : ai_parsed_data;
      } catch (e) {
        console.error('Error parsing AI data:', e);
      }
    }

    const result = await pool.query(
      `INSERT INTO applications (user_id, job_id, resume_data, resume_filename, resume_mime, cover_letter, ai_parsed_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, job_id, resume_url, resume_filename, resume_mime, cover_letter, status, ai_parsed_data, admin_notes, created_at, updated_at`,
      [
        req.user.id,
        job_id,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        cover_letter || null,
        parsedData ? JSON.stringify(parsedData) : null
      ]
    );

    res.status(201).json({ application: result.rows[0] });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Get All Applications (Admin Only)
app.get('/api/applications', verifyAdmin, async (req, res) => {
  try {
    const { status, user_id, job_id, limit, offset } = req.query;

    let query = `
      SELECT 
        a.*,
        u.full_name,
        u.email,
        j.title as job_title,
        j.department
      FROM applications a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      params.push(status);
    }
    if (user_id) {
      paramCount++;
      query += ` AND a.user_id = $${paramCount}`;
      params.push(user_id);
    }
    if (job_id) {
      paramCount++;
      query += ` AND a.job_id = $${paramCount}`;
      params.push(job_id);
    }

    query += ' ORDER BY a.created_at DESC';

    if (limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit));
    }
    if (offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset));
    }

    const result = await pool.query(query, params);

    res.json({
      applications: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Single Application
app.get('/api/applications/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin or owns the application
    const isAdmin = await pool.query('SELECT id FROM admin_users WHERE id = $1', [req.user.id]);
    const result = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = result.rows[0];
    
    // If not admin, check if user owns the application
    if (isAdmin.rows.length === 0 && application.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Application (Admin Only)
app.put('/api/applications/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
    }
    if (admin_notes !== undefined) {
      paramCount++;
      updates.push(`admin_notes = $${paramCount}`);
      values.push(admin_notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = NOW()`);
    paramCount++;
    values.push(id);

    const result = await pool.query(
      `UPDATE applications SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application: result.rows[0] });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Application (Admin Only)
app.delete('/api/applications/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM applications WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// USERS (CANDIDATES) APIs
// ============================================

// Get All Users (Admin Only)
app.get('/api/users', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get User by ID (Admin Only)
app.get('/api/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, full_name, email, phone, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete User (Admin Only)
app.delete('/api/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully', id: parseInt(id) });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get User Applications (Admin Only)
app.get('/api/users/:id/applications', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT 
        a.id,
        a.user_id,
        a.job_id,
        j.title as job_title,
        j.description as job_description,
        a.status,
        a.resume_url,
        a.resume_filename,
        a.ai_parsed_data,
        a.created_at
      FROM applications a
      LEFT JOIN jobs j ON a.job_id = j.id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC`,
      [id]
    );

    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Get user applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Anonymized PDF (Admin Only)
app.get('/api/users/:id/anonymized-pdf', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // This is a placeholder - you would generate a PDF here
    // For now, return a simple text response
    res.set('Content-Type', 'application/pdf');
    res.send('PDF generation not implemented yet');
  } catch (error) {
    console.error('Get anonymized PDF error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CLIENTS APIs
// ============================================

// Get All Clients (Admin Only)
app.get('/api/clients', verifyAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        c.*,
        COUNT(j.id) as jobs_count
      FROM clients c
      LEFT JOIN jobs j ON c.id = j.client_id
      GROUP BY c.id
      ORDER BY c.created_at DESC`
    );

    res.json({ clients: result.rows });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Client (Admin Only)
app.post('/api/clients', verifyAdmin, async (req, res) => {
  try {
    const { company, contact_person, email } = req.body;

    if (!company) {
      return res.status(400).json({ error: 'company is required' });
    }

    const result = await pool.query(
      'INSERT INTO clients (company, contact_person, email) VALUES ($1, $2, $3) RETURNING *',
      [company, contact_person || null, email || null]
    );

    res.status(201).json({ client: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Company already exists' });
    }
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Client (Admin Only)
app.put('/api/clients/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { company, contact_person, email } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 0;

    if (company !== undefined) {
      paramCount++;
      updates.push(`company = $${paramCount}`);
      values.push(company);
    }
    if (contact_person !== undefined) {
      paramCount++;
      updates.push(`contact_person = $${paramCount}`);
      values.push(contact_person);
    }
    if (email !== undefined) {
      paramCount++;
      updates.push(`email = $${paramCount}`);
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    values.push(id);

    const result = await pool.query(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ client: result.rows[0] });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Client (Admin Only)
app.delete('/api/clients/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully', id: parseInt(id) });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// APPLICANTS APIs (Resume Parsing)
// ============================================

// Create/Parse Applicant Resume
// Supports both file upload and JSON payload with parsed data
app.post('/api/applicants', async (req, res) => {
  try {
    let resumeFile = null;
    let resumeFilename = null;
    let resumeMime = null;
    let resumeData = null;

    // Check if request is JSON with parsed data (from /api/parse-resume)
    if (req.body && req.body.parsed && req.body.name && req.body.email) {
      // Handle JSON payload with parsed resume data
      const { name, email, phone, parsed } = req.body;
      
      // Extract data from parsed object
      const skillsArray = parsed.skills || [];
      const experienceArray = parsed.experience || [];
      const education = parsed.education?.[0] ? 
        `${parsed.education[0].degree || ''} ${parsed.education[0].institution || ''} ${parsed.education[0].year || ''}`.trim() :
        (parsed.education || null);
      
      // Generate classification using OpenAI if available
      let applicantClassification = {
        stack: 'Full Stack',
        percentage: 85,
        role: 'Senior Developer',
        reasoning: 'Based on skills and experience analysis'
      };

      if (openai && (skillsArray.length > 0 || experienceArray.length > 0)) {
        try {
          const skillsText = skillsArray.join(', ');
          const experienceText = experienceArray.map(exp => 
            `${exp.title || exp.role || 'Role'} at ${exp.company || 'Company'}`
          ).join(', ');

          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a technical recruiter. Analyze the candidate\'s skills and experience, then classify them. Return a JSON object with: stack (e.g., "Full Stack", "Frontend", "Backend"), percentage (0-100 confidence score), role (e.g., "Senior Developer", "Junior Developer"), and reasoning (brief explanation).'
              },
              {
                role: 'user',
                content: `Skills: ${skillsText}\nExperience: ${experienceText}\n\nClassify this candidate.`
              }
            ],
            temperature: 0.5,
            max_tokens: 300
          });

          const aiResponse = completion.choices[0]?.message?.content;
          try {
            const aiClassification = JSON.parse(aiResponse);
            applicantClassification = {
              stack: aiClassification.stack || applicantClassification.stack,
              percentage: aiClassification.percentage || applicantClassification.percentage,
              role: aiClassification.role || applicantClassification.role,
              reasoning: aiClassification.reasoning || applicantClassification.reasoning
            };
          } catch (e) {
            console.log('Could not parse AI classification, using default');
          }
        } catch (aiError) {
          console.error('OpenAI classification error:', aiError);
        }
      }

      const result = await pool.query(
        `INSERT INTO applicants (name, email, phone, skills, experience, education, resume_filename, resume_mime, resume_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, email, phone, skills, experience, education, created_at`,
        [
          name,
          email,
          phone || null,
          skillsArray,
          JSON.stringify(experienceArray),
          education,
          parsed.contact?.name ? `${parsed.contact.name}_resume.pdf` : 'resume.pdf',
          'application/pdf',
          null // No file data when using JSON payload
        ]
      );

      const applicant = result.rows[0];
      applicant.classification = applicantClassification;

      return res.status(201).json({ applicant });
    }

    // Otherwise, handle file upload (multipart/form-data)
    const uploadMiddleware = upload.single('resume');
    
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ 
                error: 'File too large',
                message: 'File size exceeds 10MB limit'
              });
            }
            return res.status(400).json({ 
              error: 'File upload error',
              message: err.message
            });
          }
          if (err.message && err.message.includes('Invalid file type')) {
            return res.status(400).json({ 
              error: 'Invalid file type',
              message: err.message
            });
          }
          return res.status(400).json({ 
            error: 'File upload error',
            message: err.message || 'Failed to process file upload'
          });
        }
        resolve();
      });
    });

    const { name, email, phone, skills, experience, education } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'resume file is required' });
    }

    resumeFile = req.file;
    resumeFilename = resumeFile.originalname;
    resumeMime = resumeFile.mimetype;
    resumeData = resumeFile.buffer;

    let skillsArray = [];
    if (skills) {
      try {
        skillsArray = typeof skills === 'string' ? JSON.parse(skills) : skills;
      } catch (e) {
        skillsArray = Array.isArray(skills) ? skills : [];
      }
    }

    let experienceArray = [];
    if (experience) {
      try {
        experienceArray = typeof experience === 'string' ? JSON.parse(experience) : experience;
      } catch (e) {
        experienceArray = Array.isArray(experience) ? experience : [];
      }
    }

    // Generate classification using OpenAI if available
    let fileUploadClassification = {
      stack: 'Full Stack',
      percentage: 85,
      role: 'Senior Developer',
      reasoning: 'Based on skills and experience analysis'
    };

    if (openai && (skillsArray.length > 0 || experienceArray.length > 0)) {
      try {
        const skillsText = skillsArray.join(', ');
        const experienceText = experienceArray.map(exp => 
          `${exp.role || exp.title || 'Role'} at ${exp.company || 'Company'}`
        ).join(', ');

        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a technical recruiter. Analyze the candidate\'s skills and experience, then classify them. Return a JSON object with: stack (e.g., "Full Stack", "Frontend", "Backend"), percentage (0-100 confidence score), role (e.g., "Senior Developer", "Junior Developer"), and reasoning (brief explanation).'
            },
            {
              role: 'user',
              content: `Skills: ${skillsText}\nExperience: ${experienceText}\n\nClassify this candidate.`
            }
          ],
          temperature: 0.5,
          max_tokens: 300
        });

        const aiResponse = completion.choices[0]?.message?.content;
        try {
          const aiClassification = JSON.parse(aiResponse);
          fileUploadClassification = {
            stack: aiClassification.stack || fileUploadClassification.stack,
            percentage: aiClassification.percentage || fileUploadClassification.percentage,
            role: aiClassification.role || fileUploadClassification.role,
            reasoning: aiClassification.reasoning || fileUploadClassification.reasoning
          };
        } catch (e) {
          console.log('Could not parse AI classification, using default');
        }
      } catch (aiError) {
        console.error('OpenAI classification error:', aiError);
      }
    }

    // Generate classification using OpenAI if available
    let classification = {
      stack: 'Full Stack',
      percentage: 85,
      role: 'Senior Developer',
      reasoning: 'Based on skills and experience analysis'
    };

    if (openai && (skillsArray.length > 0 || experienceArray.length > 0)) {
      try {
        const skillsText = skillsArray.join(', ');
        const experienceText = experienceArray.map(exp => 
          `${exp.role || exp.title || 'Role'} at ${exp.company || 'Company'}`
        ).join(', ');

        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a technical recruiter. Analyze the candidate\'s skills and experience, then classify them. Return a JSON object with: stack (e.g., "Full Stack", "Frontend", "Backend"), percentage (0-100 confidence score), role (e.g., "Senior Developer", "Junior Developer"), and reasoning (brief explanation).'
            },
            {
              role: 'user',
              content: `Skills: ${skillsText}\nExperience: ${experienceText}\n\nClassify this candidate.`
            }
          ],
          temperature: 0.5,
          max_tokens: 300
        });

        const aiResponse = completion.choices[0]?.message?.content;
        try {
          const aiClassification = JSON.parse(aiResponse);
          classification = {
            stack: aiClassification.stack || classification.stack,
            percentage: aiClassification.percentage || classification.percentage,
            role: aiClassification.role || classification.role,
            reasoning: aiClassification.reasoning || classification.reasoning
          };
        } catch (e) {
          console.log('Could not parse AI classification, using default');
        }
      } catch (aiError) {
        console.error('OpenAI classification error:', aiError);
      }
    }

    const result = await pool.query(
      `INSERT INTO applicants (name, email, phone, skills, experience, education, resume_filename, resume_mime, resume_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, email, phone, skills, experience, education, created_at`,
      [
        name,
        email,
        phone || null,
        skillsArray,
        JSON.stringify(experienceArray),
        education || null,
        resumeFilename,
        resumeMime,
        resumeData
      ]
    );

    const applicant = result.rows[0];
    applicant.classification = fileUploadClassification;

    res.status(201).json({ applicant });
  } catch (error) {
    console.error('Create applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Applicant by ID
app.get('/api/applicants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, email, phone, skills, experience, education, created_at FROM applicants WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    const applicant = result.rows[0];
    
    // Generate classification using OpenAI if available
    let classification = {
      stack: 'Full Stack',
      percentage: 85,
      role: 'Senior Developer',
      reasoning: 'Based on skills and experience analysis'
    };

    if (openai && applicant.skills && applicant.skills.length > 0) {
      try {
        const skillsText = Array.isArray(applicant.skills) ? applicant.skills.join(', ') : '';
        let experienceText = '';
        
        if (applicant.experience) {
          try {
            const exp = typeof applicant.experience === 'string' ? JSON.parse(applicant.experience) : applicant.experience;
            experienceText = Array.isArray(exp) ? exp.map(e => `${e.role || 'Role'} at ${e.company || 'Company'}`).join(', ') : '';
          } catch (e) {
            experienceText = '';
          }
        }

        if (skillsText) {
          const completion = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a technical recruiter. Analyze the candidate\'s skills and experience, then classify them. Return a JSON object with: stack (e.g., "Full Stack", "Frontend", "Backend"), percentage (0-100 confidence score), role (e.g., "Senior Developer", "Junior Developer"), and reasoning (brief explanation).'
              },
              {
                role: 'user',
                content: `Skills: ${skillsText}${experienceText ? `\nExperience: ${experienceText}` : ''}\n\nClassify this candidate.`
              }
            ],
            temperature: 0.5,
            max_tokens: 300
          });

          const aiResponse = completion.choices[0]?.message?.content;
          try {
            const aiClassification = JSON.parse(aiResponse);
            classification = {
              stack: aiClassification.stack || classification.stack,
              percentage: aiClassification.percentage || classification.percentage,
              role: aiClassification.role || classification.role,
              reasoning: aiClassification.reasoning || classification.reasoning
            };
          } catch (e) {
            console.log('Could not parse AI classification, using default');
          }
        }
      } catch (aiError) {
        console.error('OpenAI classification error:', aiError);
      }
    }

    applicant.classification = classification;

    res.json({ applicant });
  } catch (error) {
    console.error('Get applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// AI/TOOLS APIs
// ============================================

// Parse Resume (Alias for extract-skills, matches frontend expectation)
// Supports both JSON payload (filename + text) and file upload (multipart/form-data)
app.post('/api/parse-resume', async (req, res) => {
  try {
    let resumeText = '';
    let filename = '';
    let fileExtension = '.txt';

    // Check if request is JSON with filename and text (frontend approach)
    if (req.body && req.body.filename && req.body.text) {
      // Handle JSON payload from frontend
      filename = req.body.filename;
      resumeText = req.body.text;
      fileExtension = path.extname(filename).toLowerCase();
      
      if (!openai) {
        return res.status(503).json({
          error: 'AI not configured',
          message: 'Set AI_SERVICE_API_KEY / OPENAI_API_KEY to enable resume parsing.'
        });
      }

      try {
      // Truncate resume text to avoid model context overflow
      const truncatedText = resumeText.slice(0, 15000);

      const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo-1106',
          response_format: { type: 'json_object' },
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You are a resume parser. Return ONLY JSON (no markdown, no prose). Schema: {skills:[string], contact:{name,email,phone,location}, summary:string, experience:[{title,company,start_date,end_date,responsibilities:[string]}], education:[{degree,institution,year}], certifications:[string], languages:[string], links:[string]}. Use the provided resume text; do not invent data.'
            },
            {
              role: 'user',
            content: `Parse this resume text and respond with JSON only (no extra text):\n\n${truncatedText}`
            }
          ],
          max_tokens: 2000
        });

        const aiResponse = completion.choices[0]?.message?.content || '';
        let parsed = await parseAiResponseToJson(aiResponse, resumeText);
        if (!parsed) {
          parsed = await repairAiResponse(openai, aiResponse, resumeText);
        }
        if (!parsed) {
          return res.status(500).json({
            error: 'AI parse failed',
            message: 'Unable to parse AI response into structured JSON',
            ai_response_preview: aiResponse.slice(0, 500)
          });
        }

        return res.json({ parsed });
      } catch (aiError) {
        console.error('OpenAI API error:', aiError);
        return res.status(500).json({
          error: 'AI parsing failed',
          message: aiError.message || 'Error calling AI parser'
        });
      }
    }

    // Otherwise, handle file upload (multipart/form-data)
    // Support multiple field names: 'resume', 'file', 'document'
    const uploadMiddleware = upload.fields([
      { name: 'resume', maxCount: 1 },
      { name: 'file', maxCount: 1 },
      { name: 'document', maxCount: 1 }
    ]);
    
    // Wrap multer in a promise to handle it properly
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          // Handle multer errors
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ 
                error: 'File too large',
                message: 'File size exceeds 10MB limit'
              });
            }
            return res.status(400).json({ 
              error: 'File upload error',
              message: err.message
            });
          }
          // Handle file validation errors
          if (err.message && err.message.includes('Invalid file type')) {
            return res.status(400).json({ 
              error: 'Invalid file type',
              message: err.message
            });
          }
          return res.status(400).json({ 
            error: 'File upload error',
            message: err.message || 'Failed to process file upload'
          });
        }
        resolve();
      });
    });

    // Get file from any of the supported field names
    let file = null;
    if (req.files) {
      file = req.files['resume']?.[0] || req.files['file']?.[0] || req.files['document']?.[0];
    }
    // Fallback to req.file for single field uploads
    if (!file) {
      file = req.file;
    }
    
    if (!file) {
      // Provide helpful error message
      return res.status(400).json({ 
        error: 'resume file is required',
        message: 'Please provide either: (1) JSON payload with "filename" and "text" fields, or (2) multipart/form-data file upload with field name "resume", "file", or "document"',
        details: {
          acceptedFormats: [
            'JSON: { "filename": "resume.pdf", "text": "resume content..." }',
            'multipart/form-data: file field named "resume", "file", or "document"'
          ],
          supportedFileFormats: ['PDF', 'DOC', 'DOCX', 'TXT', 'RTF', 'ODT'],
          maxSize: '10MB'
        }
      });
    }
    
    // Process file upload
    filename = file.originalname;
    fileExtension = path.extname(filename).toLowerCase();

    // Extract text from file (PDF/DOC/DOCX/TXT/RTF)
    resumeText = await extractResumeText(file);
    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({
        error: 'Could not extract text from file',
        message: 'Uploaded file could not be parsed into text. Please upload a PDF, DOC/DOCX, or TXT with readable text.'
      });
    }

    // Require AI; no dummy placeholders
    if (!openai) {
      return res.status(503).json({
        error: 'AI not configured',
        message: 'Set AI_SERVICE_API_KEY / OPENAI_API_KEY to enable resume parsing.'
      });
    }

    try {
      // Truncate to avoid context overflow
      const truncatedText = resumeText.slice(0, 15000);

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-1106',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You are a resume parser. Return ONLY JSON (no markdown, no prose). Schema: {skills:[string], contact:{name,email,phone,location}, summary:string, experience:[{title,company,start_date,end_date,responsibilities:[string]}], education:[{degree,institution,year}], certifications:[string], languages:[string], links:[string]}. Use the provided resume text; do not invent data.'
          },
          {
            role: 'user',
            content: `Parse this resume text and respond with JSON only (no extra text):\n\n${truncatedText}`
          }
        ],
        max_tokens: 2000
      });

      const aiResponse = completion.choices[0]?.message?.content || '';
      let parsed = await parseAiResponseToJson(aiResponse, truncatedText);
      if (!parsed) {
        parsed = await repairAiResponse(openai, aiResponse, truncatedText);
      }
      if (!parsed) {
        return res.status(500).json({
          error: 'AI parse failed',
          message: 'Unable to parse AI response into structured JSON',
          ai_response_preview: aiResponse.slice(0, 500)
        });
      }

      res.json({ parsed });
    } catch (aiError) {
      console.error('OpenAI API error:', aiError);
      return res.status(500).json({
        error: 'AI parsing failed',
        message: aiError.message || 'Error calling AI parser'
      });
    }
  } catch (error) {
    console.error('Parse resume error:', error);
    
    // Handle multer errors specifically
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'File too large',
          message: 'File size exceeds 10MB limit'
        });
      }
      return res.status(400).json({ 
        error: 'File upload error',
        message: error.message
      });
    }
    
    // Handle other errors
    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: 'Invalid file type',
        message: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Extract Skills from Resume
app.post('/api/tools/extract-skills', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'resume file is required' });
    }

  // Require AI; no dummy placeholders
  if (!openai) {
    return res.status(503).json({
      error: 'AI not configured',
      message: 'Set AI_SERVICE_API_KEY / OPENAI_API_KEY to enable resume parsing.'
    });
  }

  try {
    // Extract text from file (PDF/DOC/DOCX/TXT/RTF)
    let resumeText = await extractResumeText(req.file);
    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({
        error: 'Could not extract text from file',
        message: 'Uploaded file could not be parsed into text. Please upload a PDF, DOC/DOCX, or TXT with readable text.'
      });
    }

    // Truncate resume text to avoid model context overflow
    const truncatedText = resumeText.slice(0, 15000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-1106',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a resume parser. Return ONLY JSON (no markdown, no prose). Schema: {skills:[string], contact:{name,email,phone,location}, summary:string, experience:[{title,company,start_date,end_date,responsibilities:[string]}], education:[{degree,institution,year}], certifications:[string], languages:[string], links:[string]}. Use the provided resume text; do not invent data.'
        },
        {
          role: 'user',
          content: `Parse this resume text and respond with JSON only (no extra text):\n\n${truncatedText}`
        }
      ],
      max_tokens: 2000
    });

    const aiResponse = completion.choices[0]?.message?.content || '';
    let parsed = await parseAiResponseToJson(aiResponse, resumeText);
    if (!parsed) {
      parsed = await repairAiResponse(openai, aiResponse, resumeText);
    }
    if (!parsed) {
      return res.status(500).json({
        error: 'AI parse failed',
        message: 'Unable to parse AI response into structured JSON',
        ai_response_preview: aiResponse.slice(0, 500)
      });
    }

    res.json({ parsed });
  } catch (aiError) {
    console.error('OpenAI API error:', aiError);
    return res.status(500).json({
      error: 'AI parsing failed',
      message: aiError.message || 'Error calling AI parser'
    });
  }
  } catch (error) {
    console.error('Extract skills error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// Health Check
// ============================================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

