# 🚀 Dashboard APIs - Quick Reference

## ✅ What Was Fixed

1. **Created unified dashboard endpoint** - `/api/admin/dashboard` (returns all KPIs in 1 call)
2. **Fixed applications count bug** - Now uses proper SQL COUNT instead of array length
3. **Added trend data** - Last 7 days of applications for charts
4. **Added distribution data** - For pie charts
5. **Added period filtering** - Filter by week/month/year

---

## 🎯 Quick Start

### **Use This Endpoint (Recommended):**

```bash
GET /api/admin/dashboard
Authorization: Bearer <admin_token>
```

**Returns everything you need:**
- ✅ Total Candidates
- ✅ Total Jobs  
- ✅ Active Clients
- ✅ Total Applications
- ✅ Applications Trend (last 7 days)
- ✅ Distribution data (for pie chart)
- ✅ Status breakdowns

---

## 📋 API Details

### **Endpoint:** `GET /api/admin/dashboard`

**Headers:**
```
Authorization: Bearer <your_admin_token>
```

**Query Parameters (Optional):**
- `period=week` - Last 7 days
- `period=month` - Last 30 days  
- `period=year` - Last 365 days
- (no period) - All time

**Response:**
```json
{
  "stats": {
    "totalCandidates": 150,
    "totalJobs": 45,
    "activeClients": 12,
    "totalApplications": 320
  },
  "applicationsTrend": [
    { "date": "2024-11-25", "count": 12 },
    { "date": "2024-11-26", "count": 18 }
  ],
  "distribution": {
    "candidates": 150,
    "jobs": 45,
    "clients": 12,
    "applications": 320
  }
}
```

---

## 🔧 Existing Endpoints (Still Work)

| Endpoint | Returns | Auth |
|----------|---------|------|
| `GET /api/users` | `{ users: [...] }` | Admin |
| `GET /api/jobs` | `{ jobs: [...], count: N }` | Public |
| `GET /api/clients` | `{ clients: [...] }` | Admin |
| `GET /api/applications` | `{ applications: [...], count: N }` | Admin |

**Note:** Applications count is now fixed (uses proper SQL COUNT).

---

## 🧪 Test It

### **Using curl:**
```bash
# 1. Login as admin
TOKEN=$(curl -X POST https://your-api.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.token')

# 2. Get dashboard stats
curl https://your-api.com/api/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### **Using Postman:**
1. **POST** `/api/admin/login` with email/password
2. Copy the `token` from response
3. **GET** `/api/admin/dashboard` with header: `Authorization: Bearer <token>`

---

## 📊 Frontend Integration

**Replace your current 4 API calls with 1:**

```javascript
// OLD (4 separate calls)
const [users, jobs, clients, applications] = await Promise.all([
  apiFetch("/api/users"),
  apiFetch("/api/jobs"),
  apiFetch("/api/clients"),
  apiFetch("/api/applications")
]);

// NEW (1 unified call)
const dashboard = await apiFetch("/api/admin/dashboard");

// Use the data
setStats({
  totalCandidates: dashboard.stats.totalCandidates,
  totalJobs: dashboard.stats.totalJobs,
  activeClients: dashboard.stats.activeClients,
  totalApplications: dashboard.stats.totalApplications
});

// Trend chart data
setTrendData(dashboard.applicationsTrend);

// Distribution pie chart
setDistribution(dashboard.distribution);
```

---

## ⚠️ Important Notes

1. **Authentication Required:** All admin endpoints need `Authorization: Bearer <admin_token>`
2. **Token Type:** Must be an **admin token** (from `/api/admin/login`), not a regular user token
3. **Empty Data:** If KPIs show 0, check:
   - Database has data
   - Using correct admin token
   - API is returning 200 (not 401/403)

---

## 📚 Full Documentation

See `DASHBOARD_APIS.md` for complete documentation with all parameters and examples.
