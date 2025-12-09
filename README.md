# JobSpeedy AI Backend API

Complete backend API server for JobSpeedy AI platform with user and admin authentication, job management, applications, and resume parsing.

## Features

- ✅ User Authentication (Registration, Login, Profile)
- ✅ Admin Authentication (Registration, Login, Password Reset)
- ✅ Job Management (CRUD operations)
- ✅ Application Management (Create, View, Update, Delete)
- ✅ User/Candidate Management
- ✅ Client Management
- ✅ Resume Parsing & Applicant Classification
- ✅ AI Tools (Skills Extraction)
- ✅ File Upload Support (PDF, DOC, DOCX, TXT, RTF, ODT)
- ✅ JWT Authentication
- ✅ PostgreSQL Database

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-Job-Speedy-Ai-User_and-Admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL=postgresql://user:password@localhost:5432/jobspeedy
   JWT_SECRET=your-secret-key-change-in-production-use-a-long-random-string
   AI_SERVICE_API_KEY=your-openai-api-key-here
   ```
   
   **Note:** For Vercel deployment, use `AI_SERVICE_API_KEY` or `JOBS_AI_API_KEY` instead of `OPENAI_API_KEY` to avoid conflicts. The AI features will work with either variable name, but will fall back to placeholder responses if not provided.

4. **Set up PostgreSQL database**
   - Create a PostgreSQL database named `jobspeedy`
   - Run the schema SQL provided in the project documentation to create tables
   - Or use the schema provided in the API documentation

5. **Start the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login
- `GET /api/users/me` - Get current user profile
- `POST /api/admin/register` - Admin registration
- `POST /api/admin/login` - Admin login
- `POST /api/auth/register-admin` - Alternative admin registration endpoint
- `POST /api/auth/login-admin` - Alternative admin login endpoint
- `POST /api/auth/reset-password` - Reset admin password

### Jobs
- `GET /api/jobs` - Get all jobs (public, supports filtering)
- `GET /api/jobs/:id` - Get single job by ID (public)
- `POST /api/jobs` - Create job (admin only)
- `PUT /api/jobs/:id` - Update job (admin only)
- `DELETE /api/jobs/:id` - Delete job (admin only)
- `GET /api/jobs/:jobId/applications` - Get applications for a job (admin only)
- `POST /api/jobs/generate-ad` - Generate job ad using AI (admin only)
- `GET /api/jobs/:id/xml-feed/:portal` - Get XML feed for job portal

### Applications
- `POST /api/applications` - Create application (user, requires file upload)
- `GET /api/applications` - Get all applications (admin only)
- `GET /api/applications/:id` - Get single application
- `PUT /api/applications/:id` - Update application (admin only)
- `DELETE /api/applications/:id` - Delete application (admin only)

### Users (Candidates)
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)
- `GET /api/users/:id/applications` - Get user's applications (admin only)
- `GET /api/users/:id/anonymized-pdf` - Get anonymized PDF profile (admin only)

### Clients
- `GET /api/clients` - Get all clients (admin only)
- `POST /api/clients` - Create client (admin only)
- `PUT /api/clients/:id` - Update client (admin only)
- `DELETE /api/clients/:id` - Delete client (admin only)

### Applicants (Resume Parsing)
- `POST /api/applicants` - Create/parse applicant resume
- `GET /api/applicants/:id` - Get applicant by ID

### AI Tools
- `POST /api/parse-resume` - Parse resume and extract structured data (frontend endpoint)
- `POST /api/tools/extract-skills` - Extract skills from resume

### Health Check
- `GET /health` - Server health check

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

Tokens are returned on successful login/registration and expire after 7 days.

## File Uploads

File uploads are supported for:
- Resume files (PDF, DOC, DOCX, TXT, RTF, ODT)
- Maximum file size: 10MB

Use `multipart/form-data` content type for file upload endpoints.

## Database Schema

The server expects the following PostgreSQL tables:
- `admin_users` - Admin user accounts
- `users` - Regular user accounts
- `jobs` - Job postings
- `applications` - Job applications
- `clients` - Client companies
- `applicants` - Resume parsing data

See the schema SQL in the API documentation for table structures.

## Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Error message",
  "message": "Additional details (optional)"
}
```

Common HTTP status codes:
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Development

- Uses Express.js for the web framework
- PostgreSQL for database (via `pg` library)
- JWT for authentication
- Multer for file uploads
- Bcrypt for password hashing

## Production Deployment

1. Set `NODE_ENV=production` in your `.env` file
2. Use a strong `JWT_SECRET` (at least 32 characters)
3. Configure SSL for your PostgreSQL connection
4. Use a process manager like PM2
5. Set up proper logging and monitoring

## License

ISC