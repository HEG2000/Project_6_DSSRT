const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));

app.use(express.json());

// Rate limiting
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many submissions from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' }
});

// ============================================
// DATABASE CONNECTION (POSTGRESQL)
// ============================================

const DATABASE_URL = process.env.DATABASE_URL;

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Test connection
sequelize.authenticate()
  .then(() => console.log('Connected to PostgreSQL successfully'))
  .catch(err => {
    console.error('PostgreSQL connection error:', err);
    process.exit(1);
  });

// ============================================
// DATABASE MODELS
// ============================================

// Admin Model
const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login'
  }
}, {
  tableName: 'admins',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Report Model
const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sessionId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'session_id'
  },
  zipCode: {
    type: DataTypes.STRING(5),
    allowNull: false,
    field: 'zip_code',
    validate: {
      is: /^\d{5}$/
    }
  },
  ipHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    field: 'ip_hash'
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Symptom Model
const Symptom = sequelize.define('Symptom', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  }
}, {
  tableName: 'symptoms',
  timestamps: false
});

// ReportSymptom Junction Model
const ReportSymptom = sequelize.define('ReportSymptom', {
  reportId: {
    type: DataTypes.UUID,
    references: {
      model: Report,
      key: 'id'
    },
    field: 'report_id'
  },
  symptomId: {
    type: DataTypes.INTEGER,
    references: {
      model: Symptom,
      key: 'id'
    },
    field: 'symptom_id'
  }
}, {
  tableName: 'report_symptoms',
  timestamps: false
});

// Associations
Report.belongsToMany(Symptom, { through: ReportSymptom, foreignKey: 'report_id' });
Symptom.belongsToMany(Report, { through: ReportSymptom, foreignKey: 'symptom_id' });

// ============================================
// HELPER FUNCTIONS
// ============================================

const hashIP = (ip) => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip).digest('hex');
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// CREATE DEFAULT ADMIN
// ============================================

const createDefaultAdmin = async () => {
  try {
    const adminExists = await Admin.findOne({ where: { username: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('healthadmin2024', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      console.log(' Default admin created');
      console.log(' Username: admin');
      console.log(' Password: healthadmin2024');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

// ============================================
// API ROUTES
// ============================================

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'DSSRT Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      submitReport: 'POST /api/reports',
      login: 'POST /api/auth/login',
      dashboard: 'GET /api/dashboard (admin)'
    }
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'PostgreSQL'
  });
});

// ============================================
// INITIALIZE SYMPTOMS IN DATABASE
// ============================================

const createDefaultAdmin = async () => {
  try {
    const adminExists = await Admin.findOne({ where: { username: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('healthadmin2024', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      console.log('Default admin created');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

const initializeSymptoms = async () => {
  try {
    const SYMPTOMS = [
      'Fever', 'Dry Cough', 'Wet Cough', 'Shortness of Breath',
      'Fatigue', 'Body Aches', 'Headache', 'Loss of Taste', 'Loss of Smell',
      'Sore Throat', 'Nausea', 'Vomiting', 'Diarrhea', 'Stomach Pain',
      'Congestion', 'Runny Nose', 'Chills', 'Dizziness',
      'Chest Pain', 'Rash', 'Eye Irritation', 'Painful Urination',
      'Toothache', 'Loss of Appetite', 'Earache'
    ];
    
    for (const symptomName of SYMPTOMS) {
      await Symptom.findOrCreate({
        where: { name: symptomName },
        defaults: { name: symptomName }
      });
    }
    console.log('Symptoms initialized');
  } catch (error) {
    console.error('Error initializing symptoms:', error);
  }
};

// Sync database ONCE
sequelize.sync().then(() => {
  console.log('Database synced');
  createDefaultAdmin();
  initializeSymptoms();
});

// ============================================
// PUBLIC ROUTES
// ============================================

// Submit a Report
app.post('/api/reports', reportLimiter, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { symptoms, zipCode, sessionId } = req.body;

    // Validation
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Please select at least one symptom.' });
    }

    if (symptoms.length > 10) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Maximum 10 symptoms allowed.' });
    }

    if (!zipCode || !/^\d{5}$/.test(zipCode)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Please provide a valid 5-digit zip code.' });
    }

    // Validate symptoms
    const validSymptoms = await Symptom.findAll({
      where: { name: symptoms },
      transaction
    });

    if (validSymptoms.length !== symptoms.length) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Invalid symptom(s) provided.' });
    }

    // Generate session ID
    const finalSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Hash IP
    const ipAddress = req.ip || req.socket.remoteAddress || '0.0.0.0';
    const ipHash = hashIP(ipAddress);

    // Check for duplicates
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duplicate = await Report.findOne({
      where: {
        sessionId: finalSessionId,
        timestamp: { [Sequelize.Op.gte]: oneHourAgo }
      },
      transaction
    });

    if (duplicate) {
      await transaction.rollback();
      return res.status(429).json({ error: 'You have already submitted a report recently. Please try again later.' });
    }

    // Create report
    const report = await Report.create({
      sessionId: finalSessionId,
      zipCode,
      ipHash
    }, { transaction });

    // Add symptoms
    await report.addSymptoms(validSymptoms, { transaction });

    await transaction.commit();

    res.status(201).json({
      message: 'Report submitted successfully.',
      id: report.id
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Admin Login
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const admin = await Admin.findOne({ where: { username: 'admin' } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Update last login
    await admin.update({ lastLogin: new Date() });

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      message: 'Login successful.'
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ============================================
// PROTECTED ROUTES (ADMIN ONLY)
// ============================================

// Get Dashboard Data
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get reports for current period
    const reports = await Report.findAll({
      where: {
        timestamp: { [Sequelize.Op.gte]: startDate }
      },
      include: [{
        model: Symptom,
        attributes: ['name'],
        through: { attributes: [] }
      }],
      order: [['timestamp', 'DESC']]
    });

    // Get reports for previous period
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    const prevReports = await Report.findAll({
      where: {
        timestamp: {
          [Sequelize.Op.gte]: prevStartDate,
          [Sequelize.Op.lt]: startDate
        }
      },
      include: [{
        model: Symptom,
        attributes: ['name'],
        through: { attributes: [] }
      }]
    });

    // Calculate statistics
    const stats = {
      totalReports: reports.length,
      uniqueLocations: new Set(reports.map(r => r.zipCode)).size,
      mostCommon: null,
      mostCommonCount: 0
    };

    // Symptom data
    const SYMPTOMS = [
      'Fever', 'Dry Cough', 'Wet Cough', 'Shortness of Breath',
      'Fatigue', 'Body Aches', 'Headache', 'Loss of Taste', 'Loss of Smell',
      'Sore Throat', 'Nausea', 'Vomiting', 'Diarrhea','Stomach Pain',
      'Congestion', 'Runny Nose', 'Chills', 'Dizziness',
      'Chest Pain', 'Rash', 'Eye Irritation', 'Painful Urination',
      'Toothache', 'Loss of Appetite', 'Earache'
    ];

    const symptomCounts = {};
    SYMPTOMS.forEach(s => symptomCounts[s] = 0);

    reports.forEach(report => {
      report.Symptoms.forEach(symptom => {
        if (symptomCounts.hasOwnProperty(symptom.name)) {
          symptomCounts[symptom.name]++;
        }
      });
    });

    const symptomData = Object.entries(symptomCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: reports.length > 0 ? ((count / reports.length) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count);

    if (symptomData.length > 0 && symptomData[0].count > 0) {
      stats.mostCommon = symptomData[0].name;
      stats.mostCommonCount = symptomData[0].count;
    }

    // Week over week comparison
    const prevSymptomCounts = {};
    SYMPTOMS.forEach(s => prevSymptomCounts[s] = 0);

    prevReports.forEach(report => {
      report.Symptoms.forEach(symptom => {
        if (prevSymptomCounts.hasOwnProperty(symptom.name)) {
          prevSymptomCounts[symptom.name]++;
        }
      });
    });

    const weekOverWeek = SYMPTOMS.map(symptom => {
      const thisWeek = symptomCounts[symptom];
      const lastWeek = prevSymptomCounts[symptom];
      const change = lastWeek === 0
        ? (thisWeek > 0 ? 100 : 0)
        : ((thisWeek - lastWeek) / lastWeek * 100);

      return {
        symptom,
        change: parseFloat(change.toFixed(1)),
        thisWeek,
        lastWeek
      };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    // Geographic data
    const zipCounts = {};
    reports.forEach(report => {
      zipCounts[report.zipCode] = (zipCounts[report.zipCode] || 0) + 1;
    });

    const zipData = Object.entries(zipCounts)
      .map(([zip, count]) => ({ zip, count }))
      .filter(item => item.count >= 10)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily trend
    const dailyCounts = {};
    reports.forEach(report => {
      const date = new Date(report.timestamp).toLocaleDateString();
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    const dailyTrend = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      stats,
      symptomData,
      weekOverWeek,
      zipData,
      dailyTrend
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('   ============================================');
  console.log(`   DSSRT Backend Server Running (PostgreSQL)`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log('   ============================================');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  sequelize.close().then(() => {
    console.log('PostgreSQL connection closed');
    process.exit(0);
  });

});






