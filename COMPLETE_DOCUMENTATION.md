# JobSpeedy AI Backend - Complete Documentation

## 📊 Database Schema

### 1. `admin_users` Table
**Purpose:** Stores admin user accounts

```sql
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Auto-incrementing admin ID
- `email` (TEXT, UNIQUE, NOT NULL) - Admin email address
- `password_hash` (TEXT, NOT NULL) - Bcrypt hashed password
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Account creation timestamp

---

### 2. `users` Table
**Purpose:** Stores regular user/candidate accounts

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Auto-incrementing user ID
- `full_name` (TEXT, NOT NULL) - User's full name
- `email` (TEXT, UNIQUE, NOT NULL) - User email address
- `password_hash` (TEXT, NOT NULL) - Bcrypt hashed password
- `phone` (TEXT, NULLABLE) - User phone number (optional)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Account creation timestamp

---

### 3. `jobs` Table
**Purpose:** Stores job postings

```sql
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
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  location TEXT,
  job_type TEXT,
  category TEXT,
  language TEXT
);
```

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Auto-incrementing job ID
- `title` (TEXT, NOT NULL) - Job title
- `department` (TEXT, NOT NULL) - Department name
- `description` (TEXT, NULLABLE) - Job description
- `requirements` (TEXT[], DEFAULT []) - Array of requirement strings
- `status` (TEXT, NOT NULL, DEFAULT 'Open') - Job status ('Open' or 'Closed')
- `created_by` (TEXT, NOT NULL) - Creator name/identifier
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Creation timestamp
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Last update timestamp
- `client_id` (INTEGER, FOREIGN KEY) - Reference to clients table (nullable)
- `location` (TEXT, NULLABLE) - Job location
- `job_type` (TEXT, NULLABLE) - Job type (e.g., 'Full-time', 'Part-time')
- `category` (TEXT, NULLABLE) - Job category
- `language` (TEXT, NULLABLE) - Language requirement

**Indexes:**
- `idx_jobs_status` - Index on status column for faster queries

---

### 4. `applications` Table
**Purpose:** Stores job applications from users

```sql
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
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
```

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Auto-incrementing application ID
- `user_id` (INTEGER, NOT NULL, FOREIGN KEY) - Reference to users table
- `job_id` (INTEGER, NOT NULL, FOREIGN KEY) - Reference to jobs table
- `resume_url` (TEXT, NULLABLE) - URL to resume file (if stored externally)
- `resume_filename` (TEXT, NULLABLE) - Original resume filename
- `resume_mime` (TEXT, NULLABLE) - Resume file MIME type
- `resume_data` (BYTEA, NULLABLE) - Binary resume file data
- `cover_letter` (TEXT, NULLABLE) - Cover letter text
- `status` (TEXT, NOT NULL, DEFAULT 'Pending') - Application status ('Pending', 'Shortlisted', 'Rejected', 'Accepted')
- `ai_parsed_data` (JSONB, NULLABLE) - Parsed resume data from AI
- `admin_notes` (TEXT, NULLABLE) - Admin notes about the application
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Creation timestamp
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Last update timestamp

**Constraints:**
- `UNIQUE(user_id, job_id)` - Prevents duplicate applications

**Indexes:**
- `idx_applications_user_id` - Index on user_id
- `idx_applications_job_id` - Index on job_id
- `idx_applications_status` - Index on status

---

### 5. `clients` Table
**Purpose:** Stores client/company information

```sql
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  company TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Auto-incrementing client ID
- `company` (TEXT, UNIQUE, NOT NULL) - Company name
- `contact_person` (TEXT, NULLABLE) - Contact person name
- `email` (TEXT, NULLABLE) - Contact email
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Creation timestamp

---

### 6. `applicants` Table
**Purpose:** Stores parsed applicant/resume data

```sql
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
```

**Columns:**
- `id` (SERIAL, PRIMARY KEY) - Auto-incrementing applicant ID
- `name` (TEXT, NULLABLE) - Applicant name
- `email` (TEXT, NULLABLE) - Applicant email
- `phone` (TEXT, NULLABLE) - Applicant phone
- `skills` (TEXT[]) - Array of skills
- `experience` (JSONB, NULLABLE) - Experience data as JSON
- `education` (TEXT, NULLABLE) - Education information
- `resume_filename` (TEXT, NULLABLE) - Resume filename
- `resume_mime` (TEXT, NULLABLE) - Resume MIME type
- `resume_data` (BYTEA, NULLABLE) - Binary resume file data
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW()) - Creation timestamp

---

## 🔌 Complete API Endpoints

### Authentication APIs (8 endpoints)

#### 1. User Registration
- **Endpoint:** `POST /api/users/register`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "full_name": "string (required)",
    "email": "string (required, unique)",
    "password": "string (required)",
    "phone": "string (optional)"
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "token": "JWT token",
    "user": {
      "id": 1,
      "full_name": "string",
      "email": "string",
      "phone": "string | null",
      "created_at": "ISO timestamp"
    }
  }
  ```

#### 2. User Login
- **Endpoint:** `POST /api/users/login`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "email": "string (required)",
    "password": "string (required)"
  }
  ```
- **Response:** `200 OK` (same format as registration)

#### 3. Get Current User Profile
- **Endpoint:** `GET /api/users/me`
- **Auth Required:** Yes (Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "user": {
      "id": 1,
      "full_name": "string",
      "email": "string",
      "phone": "string | null",
      "created_at": "ISO timestamp"
    }
  }
  ```

#### 4. Admin Registration
- **Endpoint:** `POST /api/admin/register`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "email": "string (required)",
    "password": "string (required)"
  }
  ```
- **Response:** `201 Created`
  ```json
  {
    "token": "JWT token",
    "admin": {
      "id": 1,
      "email": "string",
      "created_at": "ISO timestamp"
    }
  }
  ```

#### 5. Admin Login
- **Endpoint:** `POST /api/admin/login`
- **Auth Required:** No
- **Request Body:** Same as admin registration
- **Response:** `200 OK` (same format as admin registration)

#### 6. Alternative Admin Registration
- **Endpoint:** `POST /api/auth/register-admin`
- **Auth Required:** No
- **Request/Response:** Same as `/api/admin/register` but returns `user` instead of `admin` in response

#### 7. Alternative Admin Login
- **Endpoint:** `POST /api/auth/login-admin`
- **Auth Required:** No
- **Request/Response:** Same as `/api/admin/login` but returns `user` instead of `admin` in response

#### 8. Reset Admin Password
- **Endpoint:** `POST /api/auth/reset-password`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "email": "string (required)",
    "newPassword": "string (required)"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "message": "Password reset successfully"
  }
  ```

---

### Jobs APIs (8 endpoints)

#### 1. Get All Jobs
- **Endpoint:** `GET /api/jobs`
- **Auth Required:** No (Public)
- **Query Parameters (all optional):**
  - `search` - Search in title/description
  - `location` - Filter by location
  - `job_type` - Filter by job type
  - `category` - Filter by category
  - `status` - Filter by status
  - `department` - Filter by department
  - `limit` - Limit results
  - `offset` - Pagination offset
- **Response:** `200 OK`
  ```json
  {
    "jobs": [
      {
        "id": 1,
        "title": "string",
        "department": "string",
        "description": "string | null",
        "requirements": ["string"],
        "status": "string",
        "created_by": "string",
        "created_at": "ISO timestamp",
        "updated_at": "ISO timestamp",
        "client_id": 1,
        "company": "string",
        "location": "string",
        "job_type": "string",
        "category": "string",
        "language": "string"
      }
    ],
    "count": 10
  }
  ```

#### 2. Get Single Job
- **Endpoint:** `GET /api/jobs/:id`
- **Auth Required:** No (Public)
- **Response:** `200 OK`
  ```json
  {
    "job": { /* same structure as above */ }
  }
  ```

#### 3. Create Job
- **Endpoint:** `POST /api/jobs`
- **Auth Required:** Yes (Admin Bearer Token)
- **Request Body:**
  ```json
  {
    "title": "string (required)",
    "department": "string (required)",
    "description": "string (optional)",
    "requirements": ["string"] (optional),
    "status": "string (optional, default: 'Open')",
    "created_by": "string (required)",
    "client_id": 1 (optional),
    "location": "string (optional)",
    "job_type": "string (optional)",
    "category": "string (optional)",
    "language": "string (optional)"
  }
  ```
- **Response:** `201 Created`

#### 4. Update Job
- **Endpoint:** `PUT /api/jobs/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Request Body:** Any fields to update (all optional)
- **Response:** `200 OK`

#### 5. Delete Job
- **Endpoint:** `DELETE /api/jobs/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Job deleted successfully",
    "id": 1
  }
  ```

#### 6. Get Applications for Job
- **Endpoint:** `GET /api/jobs/:jobId/applications`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "applications": [ /* application objects */ ],
    "count": 5
  }
  ```

#### 7. Generate Job Ad (AI)
- **Endpoint:** `POST /api/jobs/generate-ad`
- **Auth Required:** Yes (Admin Bearer Token)
- **Request Body:**
  ```json
  {
    "description": "string (required)"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "jobAd": {
      "title": "string",
      "company": "string | null",
      "department": "string | null",
      "location": "string | null",
      "job_type": "string | null",
      "category": "string | null",
      "language": "string | null",
      "status": "string | null",
      "description": "string",
      "required_skills": ["string"],
      "requirements": ["string"]
    }
  }
  ```

#### 8. Get XML Feed for Job Portal
- **Endpoint:** `GET /api/jobs/:id/xml-feed/:portal`
- **Auth Required:** No
- **URL Parameters:**
  - `id` - Job ID
  - `portal` - Portal name ('indeed', 'glassdoor', 'linkedin', 'generic')
- **Response:** `200 OK` (XML content)

---

### Applications APIs (5 endpoints)

#### 1. Create Application
- **Endpoint:** `POST /api/applications`
- **Auth Required:** Yes (User Bearer Token)
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `job_id` (number, required)
  - `resume` (file, required) - PDF, DOC, DOCX, TXT, RTF, ODT
  - `cover_letter` (string, optional)
  - `name` (string, optional)
  - `email` (string, optional)
  - `phone` (string, optional)
  - `ai_parsed_data` (string, optional) - JSON stringified
- **Response:** `201 Created`
  ```json
  {
    "application": {
      "id": 1,
      "user_id": 1,
      "job_id": 1,
      "resume_url": "string | null",
      "resume_filename": "string | null",
      "resume_mime": "string | null",
      "cover_letter": "string | null",
      "status": "Pending",
      "ai_parsed_data": {},
      "admin_notes": "string | null",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  }
  ```

#### 2. Get All Applications
- **Endpoint:** `GET /api/applications`
- **Auth Required:** Yes (Admin Bearer Token)
- **Query Parameters (all optional):**
  - `status` - Filter by status
  - `user_id` - Filter by user ID
  - `job_id` - Filter by job ID
  - `limit` - Limit results
  - `offset` - Pagination offset
- **Response:** `200 OK`
  ```json
  {
    "applications": [ /* application objects with user and job info */ ],
    "count": 10
  }
  ```

#### 3. Get Single Application
- **Endpoint:** `GET /api/applications/:id`
- **Auth Required:** Yes (Admin or User Token for own application)
- **Response:** `200 OK`

#### 4. Update Application
- **Endpoint:** `PUT /api/applications/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Request Body:**
  ```json
  {
    "status": "string (optional)",
    "admin_notes": "string (optional)"
  }
  ```
- **Response:** `200 OK`

#### 5. Delete Application
- **Endpoint:** `DELETE /api/applications/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "success": true,
    "message": "Application deleted successfully"
  }
  ```

---

### Users/Candidates APIs (5 endpoints)

#### 1. Get All Users
- **Endpoint:** `GET /api/users`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "users": [
      {
        "id": 1,
        "full_name": "string",
        "email": "string",
        "phone": "string | null",
        "created_at": "ISO timestamp"
      }
    ]
  }
  ```

#### 2. Get User by ID
- **Endpoint:** `GET /api/users/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`

#### 3. Delete User
- **Endpoint:** `DELETE /api/users/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "message": "User deleted successfully",
    "id": 1
  }
  ```

#### 4. Get User Applications
- **Endpoint:** `GET /api/users/:id/applications`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "applications": [ /* application objects with job info */ ]
  }
  ```

#### 5. Get Anonymized PDF
- **Endpoint:** `GET /api/users/:id/anonymized-pdf`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK` (PDF file)
- **Note:** Currently returns placeholder - PDF generation not implemented

---

### Clients APIs (4 endpoints)

#### 1. Get All Clients
- **Endpoint:** `GET /api/clients`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "clients": [
      {
        "id": 1,
        "company": "string",
        "contact_person": "string | null",
        "email": "string | null",
        "jobs_count": 5,
        "created_at": "ISO timestamp"
      }
    ]
  }
  ```

#### 2. Create Client
- **Endpoint:** `POST /api/clients`
- **Auth Required:** Yes (Admin Bearer Token)
- **Request Body:**
  ```json
  {
    "company": "string (required)",
    "contact_person": "string (optional)",
    "email": "string (optional)"
  }
  ```
- **Response:** `201 Created`

#### 3. Update Client
- **Endpoint:** `PUT /api/clients/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Request Body:** Any fields to update (all optional)
- **Response:** `200 OK`

#### 4. Delete Client
- **Endpoint:** `DELETE /api/clients/:id`
- **Auth Required:** Yes (Admin Bearer Token)
- **Response:** `200 OK`
  ```json
  {
    "message": "Client deleted successfully",
    "id": 1
  }
  ```

---

### Applicants APIs (2 endpoints)

#### 1. Create/Parse Applicant Resume
- **Endpoint:** `POST /api/applicants`
- **Auth Required:** No
- **Supports Two Formats:**

  **Format 1: JSON Payload (from /api/parse-resume)**
  ```json
  {
    "name": "string (required)",
    "email": "string (required)",
    "phone": "string (optional)",
    "parsed": {
      "skills": ["string"],
      "experience": [{}],
      "education": [{}],
      "contact": {}
    }
  }
  ```

  **Format 2: File Upload (multipart/form-data)**
  - `resume` (file, required)
  - `name` (string, required)
  - `email` (string, required)
  - `phone` (string, optional)
  - `skills` (string, optional) - JSON stringified array
  - `experience` (string, optional) - JSON stringified array
  - `education` (string, optional)

- **Response:** `201 Created`
  ```json
  {
    "applicant": {
      "id": 1,
      "name": "string",
      "email": "string",
      "phone": "string | null",
      "skills": ["string"],
      "experience": [{}],
      "education": "string",
      "created_at": "ISO timestamp",
      "classification": {
        "stack": "string",
        "percentage": 85,
        "role": "string",
        "reasoning": "string"
      }
    }
  }
  ```

#### 2. Get Applicant by ID
- **Endpoint:** `GET /api/applicants/:id`
- **Auth Required:** No
- **Response:** `200 OK` (same format as create, includes classification)

---

### AI Tools APIs (2 endpoints)

#### 1. Parse Resume
- **Endpoint:** `POST /api/parse-resume`
- **Auth Required:** No
- **Supports Two Formats:**

  **Format 1: JSON Payload (Frontend)**
  ```json
  {
    "filename": "resume.pdf",
    "text": "resume text content..."
  }
  ```

  **Format 2: File Upload (multipart/form-data)**
  - `resume` (file, required) - or `file` or `document` field names
  - Supported formats: PDF, DOC, DOCX, TXT, RTF, ODT

- **Response:** `200 OK`
  ```json
  {
    "parsed": {
      "skills": ["string"],
      "contact": {
        "name": "string | null",
        "email": "string | null",
        "phone": "string | null",
        "location": "string | null"
      },
      "summary": "string | null",
      "experience": [
        {
          "title": "string | null",
          "company": "string | null",
          "start_date": "string | null",
          "end_date": "string | null",
          "responsibilities": ["string"] | null
        }
      ],
      "education": [
        {
          "degree": "string | null",
          "institution": "string | null",
          "year": "string | null"
        }
      ],
      "certifications": ["string"] | null,
      "languages": ["string"] | null,
      "links": ["string"] | null
    }
  }
  ```

#### 2. Extract Skills from Resume
- **Endpoint:** `POST /api/tools/extract-skills`
- **Auth Required:** No
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `resume` (file, required) - PDF file
- **Response:** `200 OK` (same format as parse-resume)

---

### Health Check API (1 endpoint)

#### 1. Health Check
- **Endpoint:** `GET /health`
- **Auth Required:** No
- **Response:** `200 OK`
  ```json
  {
    "status": "ok",
    "database": "connected"
  }
  ```

---

## 🔐 Authentication

### JWT Token Format
- **Header:** `Authorization: Bearer <TOKEN>`
- **Expiration:** 7 days
- **Token contains:** `{ id, email }`

### Middleware
- `verifyToken` - Verifies user JWT token
- `verifyAdmin` - Verifies admin JWT token (checks admin_users table)

---

## 📁 File Upload Specifications

### Supported File Types
- PDF (`.pdf`, `application/pdf`)
- DOC (`.doc`, `application/msword`)
- DOCX (`.docx`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- TXT (`.txt`, `text/plain`)
- RTF (`.rtf`, `application/rtf`, `text/rtf`)
- ODT (`.odt`, `application/vnd.oasis.opendocument.text`)

### File Size Limit
- Maximum: 10MB

### Field Names Accepted
- `resume` (primary)
- `file` (alternative)
- `document` (alternative)

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/jobspeedy
JWT_SECRET=your-secret-key-change-in-production-use-a-long-random-string
AI_SERVICE_API_KEY=your-openai-api-key-here
JOBS_AI_API_KEY=your-openai-api-key-here  # Alternative name
```

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "uuid": "^9.0.1",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

---

## 🎯 Summary

### Total Endpoints: 35
- Authentication: 8 endpoints
- Jobs: 8 endpoints
- Applications: 5 endpoints
- Users: 5 endpoints
- Clients: 4 endpoints
- Applicants: 2 endpoints
- AI Tools: 2 endpoints
- Health Check: 1 endpoint

### Total Database Tables: 6
- `admin_users`
- `users`
- `jobs`
- `applications`
- `clients`
- `applicants`

### Features
- ✅ JWT Authentication (User & Admin)
- ✅ File Upload Support (10MB limit)
- ✅ OpenAI Integration (Resume Parsing, Job Ad Generation, Classification)
- ✅ CORS Enabled
- ✅ Error Handling
- ✅ Query Filtering & Pagination
- ✅ Password Hashing (Bcrypt)

---

**Last Updated:** Based on current server.js implementation
**Base URL:** `https://backend-job-speedy-ai-user-and-admi.vercel.app`
**Local Dev:** `http://localhost:5000`

