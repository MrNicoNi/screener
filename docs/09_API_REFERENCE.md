# API Reference - Screener

## Edge Functions

### Base URL

```
Production: https://your-project.supabase.co/functions/v1
Development: http://localhost:54321/functions/v1
```

### Authentication

All endpoints require JWT authentication via `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## POST `/manage-users`

Create a new user with password.

### Request

```http
POST /manage-users
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "role": "analyst",
  "teamId": "uuid-here",
  "method": "password"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name |
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Min 8 characters |
| `role` | enum | Yes | `admin`, `evaluator`, or `analyst` |
| `teamId` | uuid | No | Team assignment |
| `method` | enum | Yes | `password` or `invite` |

### Response (Success)

```json
{
  "success": true,
  "userId": "9829dbea-2a2b-46a4-b8b5-9dba0e1b8ef6",
  "message": "User created successfully"
}
```

### Response (Error)

```json
{
  "success": false,
  "error": "User already registered"
}
```

### Error Codes

| HTTP Status | Error Message | Cause |
|-------------|---------------|-------|
| 400 | Invalid email | Email format invalid |
| 400 | Password too short | Password \u003c 8 characters |
| 401 | Unauthorized | Missing or invalid JWT |
| 403 | Only administrators can manage users | User is not admin |
| 409 | User already registered | Email already exists |
| 500 | Internal server error | Database or auth error |

### Example (cURL)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/manage-users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "SecurePass456",
    "role": "evaluator",
    "teamId": "33bd0b88-d8d5-40ab-87b7-69ffd12d9e0a",
    "method": "password"
  }'
```

### Example (JavaScript)

```javascript
const { data: { session } } = await supabase.auth.getSession()

const response = await fetch('https://your-project.supabase.co/functions/v1/manage-users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: 'SecurePass456',
    role: 'evaluator',
    teamId: '33bd0b88-d8d5-40ab-87b7-69ffd12d9e0a',
    method: 'password'
  })
})

const result = await response.json()
```

---

## POST `/manage-users/bulk`

Create multiple users from Excel upload.

### Request

```http
POST /manage-users/bulk
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "users": [
    {
      "name": "User 1",
      "email": "user1@example.com",
      "password": "Pass123",
      "role": "analyst",
      "teamId": "uuid-1"
    },
    {
      "name": "User 2",
      "email": "user2@example.com",
      "password": "Pass456",
      "role": "evaluator",
      "teamId": "uuid-2"
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "results": [
    {
      "email": "user1@example.com",
      "success": true,
      "userId": "uuid-1"
    },
    {
      "email": "user2@example.com",
      "success": false,
      "error": "User already registered"
    }
  ],
  "summary": {
    "total": 2,
    "succeeded": 1,
    "failed": 1
  }
}
```

---

## POST `/manage-users/reset-password`

Reset user password (admin only).

### Request

```http
POST /manage-users/reset-password
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "userId": "9829dbea-2a2b-46a4-b8b5-9dba0e1b8ef6",
  "newPassword": "NewSecurePass789"
}
```

### Response

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### Error Codes

| HTTP Status | Error Message | Cause |
|-------------|---------------|-------|
| 401 | Unauthorized | Not admin |
| 404 | User not found | Invalid userId |
| 500 | Internal server error | Database error |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/manage-users` | 10 requests | 1 minute |
| `/manage-users/bulk` | 5 requests | 5 minutes |
| `/manage-users/reset-password` | 20 requests | 1 hour |

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642521600
```

---

## Database API (Supabase Client)

### Get All Evaluations

```javascript
const { data, error } = await supabase
  .from('evaluations')
  .select(`
    *,
    analyst:users!analyst_id(id, name, email),
    evaluator:users!evaluator_id(id, name, email)
  `)
  .order('created_at', { ascending: false })
  .limit(20)
```

**RLS**: Returns only evaluations user has access to based on role.

### Create Evaluation

```javascript
const { data, error } = await supabase
  .from('evaluations')
  .insert({
    analyst_id: 'analyst-uuid',
    evaluator_id: 'evaluator-uuid',
    ticket_id: 'TICKET-123',
    final_score: 85.5,
    status: 'pending'
  })
  .select()
  .single()
```

**RLS**: Only evaluators and admins can create.

### Update User

```javascript
const { data, error } = await supabase
  .from('users')
  .update({ name: 'New Name' })
  .eq('id', 'user-uuid')
  .select()
  .single()
```

**RLS**: Only admins can update.

> [!WARNING]
> **Silent Failure**: Update may return success even if RLS blocks it. Always verify with separate SELECT.

---

## WebSocket Events (Future)

### Real-time Evaluation Updates

```javascript
const channel = supabase
  .channel('evaluations')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'evaluations'
  }, (payload) => {
    console.log('New evaluation:', payload.new)
  })
  .subscribe()
```

**Status**: Not implemented yet

---

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: Screener API
  version: 1.0.0
  description: Analyst evaluation system API

servers:
  - url: https://your-project.supabase.co/functions/v1
    description: Production
  - url: http://localhost:54321/functions/v1
    description: Development

paths:
  /manage-users:
    post:
      summary: Create user
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - email
                - password
                - role
                - method
              properties:
                name:
                  type: string
                  example: "John Doe"
                email:
                  type: string
                  format: email
                  example: "john@example.com"
                password:
                  type: string
                  minLength: 8
                  example: "SecurePass123"
                role:
                  type: string
                  enum: [admin, evaluator, analyst]
                  example: "analyst"
                teamId:
                  type: string
                  format: uuid
                  nullable: true
                method:
                  type: string
                  enum: [password, invite]
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  userId:
                    type: string
                    format: uuid
        '401':
          description: Unauthorized
        '403':
          description: Forbidden

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

*For testing API endpoints, see [Testing Guide](./08_TESTING.md)*
