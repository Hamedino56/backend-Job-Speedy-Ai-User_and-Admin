-- ============================================
-- JobSpeedy AI Backend - Complete Database Schema
-- ============================================

-- 1. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table (Candidates)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  company TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT,
  requirements TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'Open',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id INTEGER,
  location TEXT,
  job_type TEXT,
  category TEXT,
  language TEXT
);

-- Add foreign key constraint for jobs.client_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_client_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Applications Table
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  resume_url TEXT,
  resume_filename TEXT,
  resume_mime TEXT,
  resume_data BYTEA,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  ai_parsed_data JSONB,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- Add foreign key constraints for applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_user_id_fkey'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_job_id_fkey'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Applicants Table (Resume Parsing)
CREATE TABLE IF NOT EXISTS applicants (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  skills TEXT[],
  experience JSONB,
  education TEXT,
  resume_filename TEXT,
  resume_mime TEXT,
  resume_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Applications indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);

-- ============================================
-- Seed Data (Optional)
-- ============================================

-- Seed admin user (password: Password123!)
-- Change the password_hash accordingly
INSERT INTO admin_users (email, password_hash)
VALUES ('admin@example.com', '$2a$10$8Z8m8s9wQ3mQfQO1Yd8g2eIxm5Sg7xQd8xO1U7jE1m2jL0GmTqv8i')
ON CONFLICT (email) DO NOTHING;

-- Seed sample user (password: Password123!)
INSERT INTO users (full_name, email, password_hash)
VALUES ('John Doe', 'john@example.com', '$2a$10$8Z8m8s9wQ3mQfQO1Yd8g2eIxm5Sg7xQd8xO1U7jE1m2jL0GmTqv8i')
ON CONFLICT (email) DO NOTHING;

-- Seed sample clients
INSERT INTO clients (company, contact_person, email)
VALUES 
  ('TechNova', 'John Smith', 'contact@technova.com'),
  ('DataWorks', 'Jane Doe', 'contact@dataworks.com'),
  ('StackLab', 'Bob Johnson', 'contact@stacklab.com')
ON CONFLICT (company) DO NOTHING;

-- Seed sample jobs
INSERT INTO jobs (title, department, description, requirements, status, created_by, location, job_type, category, language)
VALUES 
  ('Senior React Developer', 'IT', 'Looking for an experienced React developer', ARRAY['React', 'JavaScript', 'TypeScript', '5+ years'], 'Open', 'Admin', 'Berlin', 'Full Time', 'Engineering', 'English'),
  ('Nurse', 'Healthcare', 'Registered nurse position', ARRAY['RN License', 'CPR Certified', '3+ years'], 'Open', 'Admin', 'Munich', 'Full Time', 'Healthcare', 'English'),
  ('Full Stack Developer', 'IT', 'Full stack developer with Node.js experience', ARRAY['Node.js', 'React', 'PostgreSQL', '4+ years'], 'Open', 'Admin', 'Remote', 'Remote', 'Engineering', 'English'),
  ('Frontend Developer', 'IT', 'Frontend developer position', ARRAY['Vue.js', 'JavaScript', 'HTML/CSS', '2+ years'], 'Closed', 'Admin', 'Hamburg', 'Full Time', 'Engineering', 'English')
ON CONFLICT DO NOTHING;

-- ============================================
-- Notes
-- ============================================
-- 
-- Password Hash: The seed data uses a bcrypt hash for 'Password123!'
-- To generate a new hash, use: bcrypt.hash('your-password', 10)
-- 
-- All timestamps are stored in UTC (TIMESTAMPTZ)
-- 
-- File uploads are stored as BYTEA (binary data) in the database
-- Consider using external storage (S3, etc.) for production
-- 
-- JSONB fields (ai_parsed_data, experience) allow efficient JSON queries
-- 
-- The UNIQUE constraint on applications(user_id, job_id) prevents duplicate applications
-- 
-- Foreign keys use CASCADE delete for applications, SET NULL for jobs.client_id
-- 

