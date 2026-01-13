# Controllers and Routes Architecture

## Overview

The codebase has been refactored to follow the **Controller Pattern**, separating route definitions from business logic. This improves code organization, maintainability, and testability.

## Directory Structure

```
src/
├── controllers/           # Business logic handlers
│   ├── authController.ts
│   ├── chatController.ts
│   ├── documentsController.ts
│   └── homeController.ts
├── routes/               # Route definitions only
│   ├── auth.ts
│   ├── chat.ts
│   ├── documents.ts
│   └── home.ts
└── middleware/           # Reusable middleware
    ├── auth.ts          # Authentication middleware
    └── rateLimiting.ts  # Rate limiting & validation
```

## Architecture Pattern

### Routes (Thin Layer)

Routes now only define:

- HTTP methods and paths
- Middleware chain
- Controller function mapping

**Example:**

```typescript
// routes/auth.ts
import { Router } from "express";
import { authLimiter } from "../middleware/rateLimiting.js";
import { register, login } from "../controllers/authController.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

export default router;
```

### Controllers (Business Logic)

Controllers contain all business logic:

- Request validation
- Service calls
- Response formatting
- Error handling

**Example:**

```typescript
// controllers/authController.ts
export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "user already exists" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const created = await insertUser({ email, name, password_hash });

    res.status(201).json({
      message: "registered, pending approval",
      userId: created.id,
    });
  } catch (err: any) {
    console.error("register error", err);
    res.status(500).json({ error: "registration failed" });
  }
};
```

### Middleware (Shared Logic)

Reusable middleware for cross-cutting concerns:

- Authentication (`authenticateUser`)
- Authorization (`verifyAdminAccess`)
- Rate limiting
- Input validation

## Benefits

### 1. **Separation of Concerns**

- Routes define structure
- Controllers implement logic
- Middleware handles cross-cutting concerns

### 2. **Improved Maintainability**

- Business logic centralized in controllers
- Easy to locate and modify functionality
- Reduced code duplication

### 3. **Better Testability**

- Controllers can be unit tested independently
- Mock requests/responses easily
- Test business logic without HTTP layer

### 4. **Code Reusability**

- Controllers can be reused in different routes
- Middleware shared across multiple endpoints
- Helper functions easily imported

### 5. **Cleaner Routes**

Routes went from **150+ lines** to **20-30 lines**:

- `auth.ts`: 152 → 28 lines
- `chat.ts`: 569 → 33 lines
- `documents.ts`: 284 → 30 lines
- `home.ts`: 19 → 9 lines

## File Mappings

| Route File            | Controller File                      | Purpose                         |
| --------------------- | ------------------------------------ | ------------------------------- |
| `routes/auth.ts`      | `controllers/authController.ts`      | User registration, login, admin |
| `routes/chat.ts`      | `controllers/chatController.ts`      | Chat, embeddings, settings      |
| `routes/documents.ts` | `controllers/documentsController.ts` | Document CRUD, search           |
| `routes/home.ts`      | `controllers/homeController.ts`      | Health checks                   |

## Shared Middleware

### `middleware/auth.ts`

- `authenticateUser`: Verify JWT token and attach user to request
- `verifyAdminAccess`: Check admin API key

Used across multiple routes to avoid duplication.

## Migration Notes

### What Changed

1. **Route files** now only define route→controller mappings
2. **Controller files** contain all request handling logic
3. **Authentication middleware** extracted to shared module
4. **Helper functions** kept in controllers for context

### What Stayed the Same

- All endpoint paths remain unchanged
- Request/response formats unchanged
- Middleware execution order preserved
- Error handling behavior identical

## Usage Examples

### Adding a New Endpoint

**1. Create controller function:**

```typescript
// controllers/authController.ts
export const resetPassword = async (req: Request, res: Response) => {
  // Implementation here
};
```

**2. Add route:**

```typescript
// routes/auth.ts
import { resetPassword } from "../controllers/authController.js";

router.post("/reset-password", authLimiter, resetPassword);
```

### Adding Middleware

**1. Add to middleware chain:**

```typescript
router.post(
  "/protected",
  rateLimiter, // Rate limiting
  authenticateUser, // Authentication
  customValidation, // Custom middleware
  controllerFunction // Handler
);
```

## Best Practices

1. **Keep routes thin** - Only routing logic
2. **Keep controllers focused** - One responsibility per function
3. **Use middleware for common logic** - Don't repeat yourself
4. **Export named functions** - Easier to test and import
5. **Handle errors in controllers** - Consistent error responses
6. **Type your requests** - Use TypeScript interfaces

## Testing Strategy

### Unit Tests (Controllers)

```typescript
import { register } from "../controllers/authController";

test("register creates new user", async () => {
  const mockReq = { body: { email: "test@example.com", password: "pass" } };
  const mockRes = { status: jest.fn(), json: jest.fn() };

  await register(mockReq, mockRes);

  expect(mockRes.status).toHaveBeenCalledWith(201);
});
```

### Integration Tests (Routes)

Test the full middleware chain and controller interaction.

## Future Improvements

1. **Add service layer** - Separate business logic from controllers
2. **Add validators** - Extract validation to separate functions
3. **Add DTOs** - Type-safe request/response objects
4. **Add repository pattern** - Abstract database operations
5. **Add error handler middleware** - Centralized error handling

## References

- Controllers: `src/controllers/`
- Routes: `src/routes/`
- Middleware: `src/middleware/`
- Original architecture discussion: BEST_PRACTICES.md
