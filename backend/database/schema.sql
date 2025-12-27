-- DSSRT PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ADMINS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- ============================================
-- REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    zip_code VARCHAR(5) NOT NULL CHECK (zip_code ~ '^\d{5}$'),
    ip_hash VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SYMPTOMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS symptoms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- ============================================
-- REPORT_SYMPTOMS JUNCTION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS report_symptoms (
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    symptom_id INTEGER REFERENCES symptoms(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, symptom_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reports_zip_code ON reports(zip_code);
CREATE INDEX IF NOT EXISTS idx_reports_session ON reports(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_report_symptoms_report ON report_symptoms(report_id);
CREATE INDEX IF NOT EXISTS idx_report_symptoms_symptom ON report_symptoms(symptom_id);

-- ============================================
-- INSERT DEFAULT SYMPTOMS
-- ============================================

INSERT INTO symptoms (name) VALUES
    ('Fever'),
    ('Dry Cough'),
    ('Wet Cough'),
    ('Shortness of Breath'),
    ('Fatigue'),
    ('Body Aches'),
    ('Headache'),
    ('Loss of Taste'),
    ('Loss of Smell'),
    ('Sore Throat'),
    ('Nausea/Vomiting')
    ,('Diarrhea'),
    ('Stomach Pain'),
    ('Congestion'),
    ('Runny Nose'),
    ('Chills'),
    ('Dizziness'),
    ('Chest Pain'),
    ('Rash'),
    ('Eye Irritation'),
    ('Painful Urination')
    ('Toothache'),
    ('Loss of Appetite'),
    ('Earache'),
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INSERT DEFAULT ADMIN
-- ============================================
-- Password: healthadmin2024
-- Bcrypt hash generated for default password

INSERT INTO admins (username, password) VALUES
    ('admin', '$2a$10$rXJzH9qwX5LZYqKYvN5Q5.VGZKqH9qwX5LZYqKYvN5Q5.VGZKqH9q')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- DATA RETENTION FUNCTION (90 days)
-- ============================================

CREATE OR REPLACE FUNCTION delete_old_reports()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM reports
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_delete_old_reports ON reports;
CREATE TRIGGER trigger_delete_old_reports
    AFTER INSERT ON reports
    EXECUTE FUNCTION delete_old_reports();

-- ============================================
-- VERIFICATION
-- ============================================

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Default admin credentials:';
    RAISE NOTICE '  Username: admin';
    RAISE NOTICE '  Password: healthadmin2024';
    RAISE NOTICE '';
END $$;