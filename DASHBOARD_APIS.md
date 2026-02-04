# 📊 Dashboard APIs Documentation

## Overview
This document describes all APIs that handle dashboard KPIs and statistics for the admin panel.

---

## 🎯 Main Dashboard Endpoint (Recommended)

### **GET `/api/admin/dashboard`**
**Unified endpoint that returns all dashboard KPIs in a single call.**

#### **Authentication:**
- **Required:** Yes (Admin token)
- **Header:** `Authorization: Bearer <admin_token>`

#### **Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | string | No | Filter period: `'week'`, `'month'`, `'year'`, or omit for all time |

#### **Request Example:**
```bash
# Get all-time stats
GET /api/admin/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Get last 7 days stats
GET /api/admin/dashboard?period=week
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Get last 30 days stats
GET /api/admin/dashboard?period=month
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **Response Format:**
```json
{
  "stats": {
    "totalCandidates": 150,
    "totalJobs": 45,
    "activeClients": 12,
    "totalApplications": 320
  },
  "applicationsByStatus": [
    {
      "status": "Pending",
      "count": 180
    },
    {
      "status": "Shortlisted",
      "count": 80
    },
    {
      "status": "Rejected",
      "count": 50
    },
    {
      "status": "Accepted",
      "count": 10
    }
  ],
  "jobsByStatus": [
    {
      "status": "Open",
      "count": 35
    },
    {
      "status": "Closed",
      "count": 10
    }
  ],
  "applicationsTrend": [
    {
      "date": "2024-11-25",
      "count": 12
    },
    {
      "date": "2024-11-26",
      "count": 18
    },
    {
      "date": "2024-11-27",
      "count": 15
    },
    {
      "date": "2024-11-28",
      "count": 22
    },
    {
      "date": "2024-11-29",
      "count": 19
    },
    {
      "date": "2024-11-30",
      "count": 25
    },
    {
      "date": "2024-12-01",
      "count": 20
    }
  ],
  "distribution": {
    "candidates": 150,
    "jobs": 45,
    "clients": 12,
    "applications": 320
  },
  "period": "all"
}
```

#### **Response Fields:**
- **`stats`** - Main KPI cards data:
  - `totalCandidates` - Total number of registered users/candidates
  - `totalJobs` - Total number of job postings
  - `activeClients` - Total number of clients
  - `totalApplications` - Total number of job applications
- **`applicationsByStatus`** - Breakdown of applications by status (for charts)
- **`jobsByStatus`** - Breakdown of jobs by status
- **`applicationsTrend`** - Last 7 days of application counts (for trend chart)
- **`distribution`** - Same as stats (for pie chart)
- **`period`** - The period filter applied (`'all'`, `'week'`, `'month'`, `'year'`)

---

## 📈 Alternative Simple Stats Endpoint

### **GET `/api/admin/stats`**
**Simplified endpoint that returns only the 4 main KPIs.**

#### **Authentication:**
- **Required:** Yes (Admin token)
- **Header:** `Authorization: Bearer <admin_token>`

#### **Query Parameters:**
None

#### **Request Example:**
```bash
GET /api/admin/stats
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### **Response Format:**
```json
{
  "totalCandidates": 150,
  "totalJobs": 45,
  "activeClients": 12,
  "totalApplications": 320
}
```

---

## 🔧 Individual Endpoints (For Backward Compatibility)

These endpoints still work and can be used individually:

### **1. GET `/api/users`** - Total Candidates
**Returns all users/candidates**

#### **Authentication:** Required (Admin)
#### **Response:**
```json
{
  "users": [
    {
      "id": 1,
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+49123456789",
      "created_at": "2024-12-01T10:15:00.000Z"
    }
  ]
}
```
**KPI:** `users.length` = Total Candidates

---

### **2. GET `/api/jobs`** - Total Jobs
**Returns all job postings**

#### **Authentication:** Not required (Public)
#### **Query Parameters:**
- `search` - Search term
- `location` - Filter by location
- `job_type` - Filter by job type
- `category` - Filter by category
- `status` - Filter by status
- `department` - Filter by department
- `limit` - Pagination limit
- `offset` - Pagination offset

#### **Response:**
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "Senior Developer",
      "department": "IT",
      "status": "Open",
      "created_at": "2024-12-01T10:15:00.000Z"
    }
  ],
  "count": 45
}
```
**KPI:** `jobs.length` or `count` = Total Jobs

---

### **3. GET `/api/clients`** - Active Clients
**Returns all clients**

#### **Authentication:** Required (Admin)
#### **Response:**
```json
{
  "clients": [
    {
      "id": 1,
      "company": "TechNova",
      "name": "TechNova",
      "status": "active",
      "contact_person": "John Smith",
      "email": "contact@technova.com",
      "jobs_count": 5,
      "created_at": "2024-12-01T10:15:00.000Z"
    }
  ]
}
```
**KPI:** `clients.length` = Active Clients

---

### **4. GET `/api/applications`** - Total Applications
**Returns all job applications**

#### **Authentication:** Required (Admin)
#### **Query Parameters:**
- `status` - Filter by status
- `user_id` - Filter by user
- `job_id` - Filter by job
- `limit` - Pagination limit
- `offset` - Pagination offset

#### **Response:**
```json
{
  "applications": [
    {
      "id": 1,
      "user_id": 1,
      "job_id": 1,
      "status": "Pending",
      "created_at": "2024-12-01T10:15:00.000Z"
    }
  ],
  "count": 320
}
```
**KPI:** `applications.length` or `count` = Total Applications

---

## 🚀 Frontend Integration Guide

### **Option 1: Use Unified Dashboard Endpoint (Recommended)**

```javascript
// Single API call for all dashboard data
const response = await fetch('/api/admin/dashboard', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();

// Use the data
setStats({
  totalCandidates: data.stats.totalCandidates,
  totalJobs: data.stats.totalJobs,
  activeClients: data.stats.activeClients,
  totalApplications: data.stats.totalApplications
});

// Use trend data for chart
setTrendData(data.applicationsTrend);

// Use distribution for pie chart
setDistribution(data.distribution);
```

### **Option 2: Use Individual Endpoints (Current Method)**

```javascript
// Multiple API calls (less efficient)
const [usersData, jobsData, clientsData, applicationsData] = await Promise.all([
  fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } }),
  fetch('/api/jobs'),
  fetch('/api/clients', { headers: { 'Authorization': `Bearer ${token}` } }),
  fetch('/api/applications', { headers: { 'Authorization': `Bearer ${token}` } })
]);

const users = await usersData.json();
const jobs = await jobsData.json();
const clients = await clientsData.json();
const applications = await applicationsData.json();

setStats({
  totalCandidates: users.users.length,
  totalJobs: jobs.jobs.length,
  activeClients: clients.clients.length,
  totalApplications: applications.applications.length
});
```

---

## 🔒 Authentication

All admin endpoints require a valid admin JWT token:

1. **Login as admin:**
```bash
POST /api/admin/login
{
  "email": "admin@example.com",
  "password": "password"
}
```

2. **Get token from response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": { ... }
}
```

3. **Use token in requests:**
```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🐛 Troubleshooting

### **All KPIs showing 0:**
1. Check if you're using an **admin token** (not a regular user token)
2. Verify the token is valid: `GET /api/users` should return 200 (not 401/403)
3. Check if there's actual data in the database
4. Check browser console for API errors

### **401 Unauthorized:**
- Your token is invalid or expired
- You're using a regular user token instead of admin token
- Solution: Login again as admin and get a new token

### **500 Internal Server Error:**
- Database connection issue
- Check server logs
- Verify `DATABASE_URL` is set correctly

### **Empty arrays but count > 0:**
- This is normal if you're using pagination (`limit`/`offset`)
- Use the `count` field instead of `array.length`

---

## 📝 Notes

- **Performance:** The unified `/api/admin/dashboard` endpoint is more efficient (1 API call vs 4)
- **Caching:** Consider caching dashboard stats for 1-5 minutes to reduce database load
- **Real-time:** Stats are calculated in real-time from the database
- **Period Filter:** Only affects `totalApplications` in the unified endpoint (for now)

---

## ✅ Summary

| Endpoint | Purpose | Auth | Returns |
|----------|---------|------|---------|
| `GET /api/admin/dashboard` | **All KPIs + charts** | Admin | Complete dashboard data |
| `GET /api/admin/stats` | **Simple KPIs only** | Admin | 4 main stats |
| `GET /api/users` | Candidates list | Admin | Users array |
| `GET /api/jobs` | Jobs list | Public | Jobs array + count |
| `GET /api/clients` | Clients list | Admin | Clients array |
| `GET /api/applications` | Applications list | Admin | Applications array + count |

**Recommended:** Use `GET /api/admin/dashboard` for the best performance and complete data.
