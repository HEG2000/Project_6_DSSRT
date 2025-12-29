import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

const SYMPTOMS = [
  'Fever', 'Dry Cough', 'Wet Cough', 'Shortness of Breath',
  'Fatigue', 'Body Aches', 'Headache', 'Loss of Taste', 'Loss of Smell',
  'Sore Throat', 'Nausea', 'Vomiting', 'Diarrhea','Stomach Pain',
  'Congestion', 'Runny Nose', 'Chills', 'Dizziness',
  'Chest Pain', 'Rash', 'Eye Irritation', 'Painful Urination',
  'Toothache', 'Loss of Appetite', 'Earache'
];

function App() {
  const [view, setView] = useState('public');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [zipCode, setZipCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Admin state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [dashboardData, setDashboardData] = useState(null);
  const [dateRange, setDateRange] = useState(7);

  const handleSymptomToggle = (symptom) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const handleSubmitReport = async () => {
    if (selectedSymptoms.length === 0 || !zipCode) {
      setError('Please select at least one symptom and enter your zip code');
      return;
    }

    if (!/^\d{5}$/.test(zipCode)) {
      setError('Please enter a valid 5-digit zip code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post(`${API_URL}/api/reports`, {
        symptoms: selectedSymptoms,
        zipCode: zipCode
      });
      
      setSubmitted(true);
      setSelectedSymptoms([]);
      setZipCode('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error submitting report');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { password });
      const { token: newToken } = response.data;
      
      setToken(newToken);
      localStorage.setItem('adminToken', newToken);
      setView('dashboard');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('adminToken');
    setView('public');
    setDashboardData(null);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/dashboard?days=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboardData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error fetching dashboard data');
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, token, handleLogout]);

  useEffect(() => {
    if (view === 'dashboard' && token) {
      fetchDashboardData();
    }
  }, [view, token, fetchDashboardData]);

  const renderPublicForm = () => (
    <div className="container public-form">
      <div className="header-card">
        <h1>
         <img 
          src="/AIMS_logo.png" 
          alt="Logo" 
          className="title-logo" /> 
          Disease Symptom Self-Reporting (DSSRT)
        </h1>

        <p>Anonymously report your symptoms to help successful interventions. No personal informations are collected.</p>
        <div className="privacy-notice">
          <strong>Privacy Notice:</strong> We only collect symptom selections and general location (zip code). 
          No names, emails, IP addresses, or precise locations are stored.
        </div>
      </div>

      <div className="form-card">
        <h2>Select Your Symptoms</h2>
        <div className="symptoms-grid">
          {SYMPTOMS.map(symptom => (
            <button
              key={symptom}
              onClick={() => handleSymptomToggle(symptom)}
              className={`symptom-btn ${selectedSymptoms.includes(symptom) ? 'selected' : ''}`}
            >
              <span className="checkbox">{selectedSymptoms.includes(symptom) ? '✓' : ''}</span>
              {symptom}
            </button>
          ))}
        </div>
      </div>

      <div className="form-card">
        <h2>📍 General Location</h2>
        <input
          type="text"
          placeholder="Enter 5-digit zip code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
          className="zip-input"
          maxLength={5}
        />
      </div>

      {error && <div className="error-message">{error}</div>}
      {submitted && <div className="success-message">✓ Thank you! Your report helps the community.</div>}

      <button onClick={handleSubmitReport} disabled={loading} className="submit-btn">
        {loading ? 'Submitting...' : 'Submit Anonymous Report'}
      </button>

      <div className="admin-link">
        <button onClick={() => setView('login')}>🔒 Admin Dashboard</button>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="container login-form">
      <div className="login-card">
        <h2>🔒 Admin Login</h2>
        <div className="password-input-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            className="password-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="toggle-password"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <span className="eye-icon">👁️</span>
            ) : (
              <span className="eye-icon">👁️‍🗨️</span>
            )}
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        <button onClick={handleLogin} disabled={loading} className="login-btn">
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <button onClick={() => setView('public')} className="back-btn">
          Back to Public Form
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (!dashboardData) return <div className="loading">Loading dashboard...</div>;

    const { stats, symptomData, weekOverWeek, zipData, dailyTrend } = dashboardData;

    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>Admin Dashboard</h1>
            <p>Last Updated: {new Date().toLocaleString()}</p>
          </div>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>

        <div className="date-filter">
          <label>Date Range:</label>
          <select value={dateRange} onChange={(e) => setDateRange(Number(e.target.value))}>
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <span>Total Reports: <strong>{stats.totalReports}</strong></span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Reports</h3>
            <p className="stat-number">{stats.totalReports}</p>
            <small>in selected period</small>
          </div>
          <div className="stat-card">
            <h3>Most Common Symptom</h3>
            <p className="stat-number">{stats.mostCommon || 'N/A'}</p>
            <small>{stats.mostCommonCount || 0} reports</small>
          </div>
          <div className="stat-card">
            <h3>Locations Reporting</h3>
            <p className="stat-number">{stats.uniqueLocations}</p>
            <small>unique zip codes</small>
          </div>
        </div>

        <div className="chart-card">
          <h2>Week-Over-Week Changes</h2>
          <div className="trend-grid">
            {weekOverWeek.slice(0, 5).map(item => (
              <div key={item.symptom} className="trend-card">
                <p className="trend-symptom">{item.symptom}</p>
                <p className={`trend-change ${item.change > 0 ? 'up' : item.change < 0 ? 'down' : ''}`}>
                  {item.change > 0 ? '↑' : item.change < 0 ? '↓' : '→'} {Math.abs(item.change)}%
                </p>
                <small>{item.thisWeek} reports (was {item.lastWeek})</small>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h2>Symptom Prevalence</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={symptomData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#4f46e5" name="Number of Reports" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2>Daily Submission Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} name="Reports" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2>Geographic Distribution (Min. 10 reports)</h2>
          {zipData.length === 0 ? (
            <p className="no-data">Insufficient data to display. Need at least 10 reports per zip code.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={zipData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zip" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Reports by Zip Code" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {view === 'public' && renderPublicForm()}
      {view === 'login' && renderLogin()}
      {view === 'dashboard' && renderDashboard()}
    </div>
  );
}


export default App;


