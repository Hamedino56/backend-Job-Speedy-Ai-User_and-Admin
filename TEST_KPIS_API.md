# 🧪 Test KPIs API - Complete Guide

## Base URL
```
https://backend-job-speedy-ai-user-and-admi.vercel.app
```

---

## Step 1: Get Admin Token (Login First)

### **Endpoint:** `POST /api/admin/login`

**Request:**
```bash
POST https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login
Content-Type: application/json
```

**Request JSON:**
```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "created_at": "2024-12-01T10:15:00.000Z"
  }
}
```

**Copy the `token` value for next steps!**

---

## Step 2: Test Dashboard KPIs API

### **Option A: Unified Dashboard Endpoint (Recommended)**

#### **Endpoint:** `GET /api/admin/dashboard`

**Full URL:**
```
https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard
```

**Request Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Request JSON:** None (GET request, no body)

**cURL Command:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**With Period Filter (Last 7 days):**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard?period=week" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response:**
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

---

### **Option B: Simple Stats Endpoint**

#### **Endpoint:** `GET /api/admin/stats`

**Full URL:**
```
https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/stats
```

**Request Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**cURL Command:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "totalCandidates": 150,
  "totalJobs": 45,
  "activeClients": 12,
  "totalApplications": 320
}
```

---

## Step 3: Test Individual KPI Endpoints

### **1. Total Candidates**

**Endpoint:** `GET /api/users`

**Full URL:**
```
https://backend-job-speedy-ai-user-and-admi.vercel.app/api/users
```

**cURL:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/users" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Response:**
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

**KPI Value:** `users.length` = Total Candidates

---

### **2. Total Jobs**

**Endpoint:** `GET /api/jobs`

**Full URL:**
```
https://backend-job-speedy-ai-user-and-admi.vercel.app/api/jobs
```

**cURL:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/jobs" \
  -H "Content-Type: application/json"
```

**Response:**
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

**KPI Value:** `count` or `jobs.length` = Total Jobs

---

### **3. Active Clients**

**Endpoint:** `GET /api/clients`

**Full URL:**
```
https://backend-job-speedy-ai-user-and-admi.vercel.app/api/clients
```

**cURL:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/clients" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Response:**
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

**KPI Value:** `clients.length` = Active Clients

---

### **4. Total Applications**

**Endpoint:** `GET /api/applications`

**Full URL:**
```
https://backend-job-speedy-ai-user-and-admi.vercel.app/api/applications
```

**cURL:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/applications" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Response:**
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

**KPI Value:** `count` or `applications.length` = Total Applications

---

## 📋 Complete Test Script (Copy & Paste)

### **For Windows PowerShell:**

```powershell
# Step 1: Login and get token
$loginResponse = Invoke-RestMethod -Uri "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@example.com","password":"Password123!"}'

$token = $loginResponse.token
Write-Host "Token: $token" -ForegroundColor Green

# Step 2: Get Dashboard Stats
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$dashboard = Invoke-RestMethod -Uri "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard" `
  -Method GET `
  -Headers $headers

Write-Host "`nDashboard KPIs:" -ForegroundColor Cyan
Write-Host "Total Candidates: $($dashboard.stats.totalCandidates)"
Write-Host "Total Jobs: $($dashboard.stats.totalJobs)"
Write-Host "Active Clients: $($dashboard.stats.activeClients)"
Write-Host "Total Applications: $($dashboard.stats.totalApplications)"
```

### **For Linux/Mac (Bash):**

```bash
#!/bin/bash

# Step 1: Login and get token
TOKEN=$(curl -s -X POST "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123!"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# Step 2: Get Dashboard Stats
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.'
```

---

## 🧪 Postman Collection

### **1. Login Request**

- **Method:** `POST`
- **URL:** `https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login`
- **Headers:**
  - `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

### **2. Dashboard Stats Request**

- **Method:** `GET`
- **URL:** `https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard`
- **Headers:**
  - `Authorization: Bearer {{token}}` (use Postman variable)
  - `Content-Type: application/json`
- **Body:** None

**To set token variable:**
1. In Login response, add: `pm.environment.set("token", pm.response.json().token);`
2. Use `{{token}}` in Dashboard request header

---

## 🔍 Quick Test (One-Liner)

Replace `YOUR_TOKEN` with actual token:

```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/dashboard" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## ✅ Expected Results

If everything works, you should see:
- ✅ Status Code: `200 OK`
- ✅ Response with `stats` object containing 4 KPIs
- ✅ All numbers are integers (not 0 if you have data)
- ✅ `applicationsTrend` array with 7 days of data
- ✅ `distribution` object matching stats

If you see:
- ❌ `401 Unauthorized` → Token is invalid/expired, login again
- ❌ `403 Forbidden` → Using regular user token instead of admin token
- ❌ `500 Internal Server Error` → Check server logs, database connection issue
- ❌ All KPIs are `0` → Database might be empty, or check if queries are working

---

## 📝 Notes

1. **Token Expiry:** Admin tokens expire after 7 days
2. **Admin vs User:** Must use admin token (from `/api/admin/login`), not regular user token
3. **No Body Required:** All GET requests don't need a request body
4. **Period Filter:** Add `?period=week` for last 7 days, `?period=month` for last 30 days

---

## 🚀 Ready to Test!

1. **Login first** to get token
2. **Use token** in Authorization header
3. **Call dashboard endpoint** to get all KPIs
4. **Check response** - should have real numbers if database has data
