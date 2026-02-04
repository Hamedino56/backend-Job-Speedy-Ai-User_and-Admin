# 🔑 How to Get Admin Token - Step by Step

## Step 1: Login as Admin

### **Endpoint:**
```
POST https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login
```

### **Request Headers:**
```
Content-Type: application/json
```

### **Request Body (JSON):**
```json
{
  "email": "admin@example.com",
  "password": "Password123!"
}
```

---

## 🧪 Method 1: Using cURL (Command Line)

### **Windows PowerShell:**
```powershell
$body = @{
    email = "admin@example.com"
    password = "Password123!"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "Token: $($response.token)" -ForegroundColor Green
Write-Host "`nFull Response:" -ForegroundColor Cyan
$response | ConvertTo-Json
```

### **Linux/Mac (Bash):**
```bash
curl -X POST "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123!"
  }'
```

### **Windows CMD:**
```cmd
curl -X POST "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" -H "Content-Type: application/json" -d "{\"email\":\"admin@example.com\",\"password\":\"Password123!\"}"
```

---

## 🌐 Method 2: Using Browser (JavaScript Console)

1. Open your browser (Chrome/Firefox)
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Paste this code:

```javascript
fetch('https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'Password123!'
  })
})
.then(response => response.json())
.then(data => {
  console.log('✅ Token:', data.token);
  console.log('📋 Full Response:', data);
  // Copy token to clipboard
  navigator.clipboard.writeText(data.token).then(() => {
    console.log('✅ Token copied to clipboard!');
  });
})
.catch(error => console.error('❌ Error:', error));
```

5. Press **Enter**
6. The token will be logged in console and copied to clipboard

---

## 📮 Method 3: Using Postman

1. **Create New Request:**
   - Method: `POST`
   - URL: `https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login`

2. **Headers Tab:**
   - Key: `Content-Type`
   - Value: `application/json`

3. **Body Tab:**
   - Select: `raw`
   - Select: `JSON` (from dropdown)
   - Paste:
   ```json
   {
     "email": "admin@example.com",
     "password": "Password123!"
   }
   ```

4. **Click "Send"**

5. **Copy the `token` from response:**
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "admin": { ... }
   }
   ```

---

## 🧪 Method 4: Using Online Tools

### **Option A: ReqBin (https://reqbin.com/)**

1. Go to https://reqbin.com/
2. Select **POST** method
3. Enter URL: `https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login`
4. Click **Headers** tab, add:
   - `Content-Type: application/json`
5. Click **Body** tab, paste:
   ```json
   {
     "email": "admin@example.com",
     "password": "Password123!"
   }
   ```
6. Click **Send**
7. Copy the `token` from response

### **Option B: HTTPie (if installed)**
```bash
http POST https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login \
  email=admin@example.com \
  password=Password123!
```

---

## ✅ Expected Response

If login is successful, you'll get:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlhdCI6MTcwMTQ0ODAwMCwiZXhwIjoxNzAyMDQ4MDAwfQ.abc123...",
  "admin": {
    "id": 1,
    "email": "admin@example.com",
    "created_at": "2024-12-01T10:15:00.000Z"
  }
}
```

**Copy the `token` value!** It's a long string starting with `eyJ...`

---

## 🔐 Step 2: Use Token in API Request

Once you have the token, use it like this:

### **cURL:**
```bash
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/stats" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### **Replace `YOUR_TOKEN_HERE` with the actual token you got from login!**

---

## 🚨 Common Issues

### **Issue 1: "Invalid credentials"**
- **Solution:** Check email and password are correct
- Try the seeded admin: `admin@example.com` / `Password123!`
- Or use the admin you created: `support@jobspeedy.de` / `Maximilian007`

### **Issue 2: "Email already exists" (when trying to register)**
- You're trying to register, but the admin already exists
- **Solution:** Use `/api/admin/login` instead of `/api/admin/register`

### **Issue 3: "No token provided"**
- You forgot to include the token in the request
- **Solution:** Add header: `Authorization: Bearer YOUR_TOKEN`

### **Issue 4: "Invalid token"**
- Token expired (tokens last 7 days)
- **Solution:** Login again to get a new token

---

## 📋 Complete Example (Copy & Paste)

### **Windows PowerShell:**
```powershell
# Step 1: Login
$loginBody = @{
    email = "admin@example.com"
    password = "Password123!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Uri "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody

$token = $loginResponse.token
Write-Host "✅ Token: $token" -ForegroundColor Green

# Step 2: Use token to get stats
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$stats = Invoke-RestMethod -Uri "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/stats" `
    -Method GET `
    -Headers $headers

Write-Host "`n📊 Dashboard Stats:" -ForegroundColor Cyan
Write-Host "Total Candidates: $($stats.totalCandidates)"
Write-Host "Total Jobs: $($stats.totalJobs)"
Write-Host "Active Clients: $($stats.activeClients)"
Write-Host "Total Applications: $($stats.totalApplications)"
```

### **Linux/Mac (Bash):**
```bash
#!/bin/bash

# Step 1: Login and get token
TOKEN=$(curl -s -X POST "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Password123!"
  }' | jq -r '.token')

echo "✅ Token: $TOKEN"

# Step 2: Use token to get stats
curl -X GET "https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/stats" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
```

---

## 🎯 Quick Test URLs

### **Login:**
```
POST https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/login
```

### **Get Stats (after login):**
```
GET https://backend-job-speedy-ai-user-and-admi.vercel.app/api/admin/stats
Header: Authorization: Bearer YOUR_TOKEN
```

---

## 💡 Pro Tip

Save your token in an environment variable:

**Windows PowerShell:**
```powershell
$env:ADMIN_TOKEN = "your-token-here"
```

**Linux/Mac:**
```bash
export ADMIN_TOKEN="your-token-here"
```

Then use it:
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" ...
```
