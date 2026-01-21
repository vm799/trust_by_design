# Auth Flow Integration Guide

## Overview

This guide explains how to integrate the new auth flow system that prevents circular redirects, ensures user rows exist, and handles profile fetching safely without 406 errors.

## Architecture

### Subagent Pattern

The auth flow is built using a subagent architecture where each subagent has a specific responsibility:

```
┌─────────────────────────────────────────────────────────┐
│             AuthFlowManager (Orchestrator)              │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬──────────────┐
        │                 │                 │              │
        ▼                 ▼                 ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│AuthSubagent  │  │UserSubagent  │  │WorkspaceSub. │  │ErrorSubagent │
│              │  │              │  │              │  │              │
│- Get session │  │- Check user  │  │- Fetch user  │  │- Handle      │
│- Listen to   │  │  exists      │  │  profile     │  │  errors      │
│  changes     │  │- Create user │  │- Fetch       │  │- Log errors  │
│              │  │  if missing  │  │  workspace   │  │- Create error│
│              │  │- Auto-heal   │  │- Fetch       │  │  objects     │
│              │  │  OAuth users │  │  personas    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Responsibilities

**AuthSubagent**
- Manages Supabase Auth session state
- Listens for auth state changes (login, logout, token refresh)
- Does NOT handle user profile creation or fetching

**UserSubagent**
- Ensures user row exists in `users` table
- Auto-creates missing profiles using `create_workspace_with_owner` RPC
- Handles OAuth users who don't have profiles yet

**WorkspaceSubagent**
- Fetches user profile from `users` table
- Fetches workspace from `workspaces` table (handles null workspace_id)
- Fetches personas from `user_personas` table
- Returns proper single-user JSON object for frontend
- Never throws 406 errors (returns null instead)

**ErrorSubagent**
- Handles all errors gracefully without throwing
- Logs errors with context
- Creates standardized error objects

## Installation

### Step 1: Ensure Migration is Applied

Make sure the `create_workspace_with_owner` RPC function exists in your database:

```bash
# Check if migration 001_auth_and_workspaces.sql has been applied
# This migration creates the necessary RPC function
```

### Step 2: Install the Auth Flow Manager

The following files have been created:

- `/lib/authFlowManager.ts` - Core auth flow manager with subagents
- `/hooks/useAuthFlow.ts` - React hook for easy integration
- `/views/LandingPageV2.tsx` - Example landing page using the new system

### Step 3: Update Your App

There are two ways to integrate:

#### Option A: Replace Landing Page (Recommended for New Projects)

```typescript
// App.tsx or your router config
import LandingPageV2 from './views/LandingPageV2';

// Replace your existing landing page route
<Route path="/" element={<LandingPageV2 />} />
<Route path="/home" element={<LandingPageV2 />} />
```

#### Option B: Update Existing Components (For Existing Projects)

Update your existing `App.tsx` to use the `useAuthFlow` hook:

```typescript
import { useAuthFlow } from './hooks/useAuthFlow';

const App: React.FC = () => {
  const { isLoading, isAuthenticated, user, session, needsSetup, error, refresh } = useAuthFlow();

  // Handle loading state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Handle error state
  if (error) {
    return <ErrorScreen error={error} onRetry={refresh} />;
  }

  // Handle needs setup (OAuth users without workspace)
  if (isAuthenticated && needsSetup) {
    return <Navigate to="/auth/setup" replace />;
  }

  // Handle authenticated users
  if (isAuthenticated && user) {
    // Redirect based on persona
    const persona = user.personas.find(p => p.is_active)?.persona_type?.toLowerCase();

    if (persona === 'technician' || persona === 'contractor') {
      return <Navigate to="/contractor" replace />;
    }
    if (persona === 'client') {
      return <Navigate to="/client" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  // Not authenticated - show landing page
  return <LandingPage />;
};
```

## Usage Examples

### Example 1: Basic Auth Flow in Component

```typescript
import { useAuthFlow } from '../hooks/useAuthFlow';

const MyComponent: React.FC = () => {
  const { isLoading, isAuthenticated, user, session, error } = useAuthFlow();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user.full_name || user.email}!</h1>
      <p>Workspace: {user.workspace?.name}</p>
      <p>Role: {user.role}</p>
    </div>
  );
};
```

### Example 2: Manual Auth Flow Refresh

```typescript
import { useAuthFlow } from '../hooks/useAuthFlow';

const ProfileSetupComplete: React.FC = () => {
  const { refresh } = useAuthFlow();

  const handleSetupComplete = async () => {
    // After user completes OAuth setup or profile update
    await refresh(); // Manually refresh auth state
    // User will be redirected automatically based on new profile
  };

  return (
    <button onClick={handleSetupComplete}>
      Complete Setup
    </button>
  );
};
```

### Example 3: Direct AuthFlowManager Usage (Without React)

```typescript
import { authFlowManager } from '../lib/authFlowManager';

// Initialize auth flow
const result = await authFlowManager.initializeAuthFlow();

if (result.success && result.user) {
  console.log('User authenticated:', result.user);
} else if (result.needsSetup) {
  console.log('User needs to complete setup');
  // Redirect to /auth/setup
} else if (result.error) {
  console.error('Auth error:', result.error);
}

// Listen for auth state changes
const unsubscribe = authFlowManager.onAuthFlowChange((result) => {
  if (result.user) {
    console.log('User logged in:', result.user.email);
  } else {
    console.log('User logged out');
  }
});

// Cleanup
unsubscribe();
```

### Example 4: Handle New User Sign-In Flow

```typescript
import { useAuthFlow } from '../hooks/useAuthFlow';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const SignupSuccessPage: React.FC = () => {
  const { isLoading, isAuthenticated, user, needsSetup } = useAuthFlow();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (needsSetup) {
      // New user without workspace - redirect to setup
      navigate('/auth/setup', { replace: true });
    } else if (isAuthenticated && user) {
      // User fully set up - redirect to dashboard
      navigate('/admin', { replace: true });
    }
  }, [isLoading, isAuthenticated, user, needsSetup, navigate]);

  return <div>Setting up your account...</div>;
};
```

## Key Features

### 1. Prevents Circular Redirects

The auth flow manager uses proper state management to prevent circular redirects:

- Only initializes once on mount
- Uses a loading flag to prevent redirects during initialization
- Redirects only after auth state is fully resolved
- `needsSetup` flag prevents redirect loops for incomplete profiles

### 2. Ensures User Row Exists

The `UserSubagent` automatically ensures every authenticated user has a row in the `users` table:

```typescript
// Checks if user exists
const exists = await userSubagent.userExists(authUser.id);

// Creates user if missing
if (!exists) {
  await userSubagent.createUser(authUser, workspaceName);
}
```

This handles:
- New OAuth users (Google sign-in)
- Users created via email/password but missing profile
- Edge cases where `create_workspace_with_owner` failed during signup

### 3. Safe Profile Fetching (No 406 Errors)

The `WorkspaceSubagent` fetches data in three separate queries to avoid 406 errors:

```typescript
// Query 1: User profile
const userProfile = await fetchUserProfile(userId);

// Query 2: Workspace (handles null workspace_id)
const workspace = await fetchWorkspace(userProfile.workspace_id);

// Query 3: Personas (returns empty array on error)
const personas = await fetchPersonas(userId);

// Combine into single object
return { ...userProfile, workspace, personas };
```

**Key improvements:**
- No embedded resources (no `workspaces(*)` syntax that causes 406)
- Graceful handling of null workspace_id
- Returns null instead of throwing errors
- Always returns valid JSON structure

### 4. Handles `get_workspace_id()` Returning Null

The auth flow manager handles cases where `get_workspace_id()` returns null:

```typescript
if (!userProfile.workspace_id || !userProfile.workspace) {
  // User exists but workspace is missing - needs setup
  return {
    success: true,
    session,
    user: userProfile,
    needsSetup: true,
  };
}
```

This ensures:
- Users without workspace are redirected to setup
- No crashes or errors when workspace_id is null
- Proper UX flow for incomplete profiles

### 5. Proper Error Handling

All errors are handled gracefully without throwing:

```typescript
try {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

  if (error) {
    // Handle specific error codes
    if (error.code === 'PGRST116') {
      // No rows found - return null (not an error)
      return null;
    }
    // Log error and return null
    console.error('Error fetching user:', error);
    return null;
  }

  return data;
} catch (err) {
  // Catch any exceptions
  console.error('Exception fetching user:', err);
  return null;
}
```

## Testing

### Manual Testing Checklist

- [ ] **New user signup (email/password)**
  - Sign up with new email
  - Verify user row is created in `users` table
  - Verify no 406 errors in console
  - Verify redirected to admin dashboard

- [ ] **New user signup (Google OAuth)**
  - Sign up with Google
  - Verify redirected to `/auth/setup` for workspace creation
  - Complete setup
  - Verify redirected to admin dashboard

- [ ] **Existing user login**
  - Log in with existing account
  - Verify profile loaded correctly
  - Verify no circular redirects
  - Verify redirected based on persona

- [ ] **User without workspace**
  - Create auth user without users table row (simulate edge case)
  - Log in
  - Verify auto-healing creates workspace
  - Verify no errors

- [ ] **Missing workspace_id**
  - Set workspace_id to null in database (simulate corrupt data)
  - Log in
  - Verify redirected to `/auth/setup`
  - Verify no crashes

- [ ] **Logout flow**
  - Log out
  - Verify session cleared
  - Verify user state cleared
  - Verify redirected to landing page

### Automated Testing

```typescript
// Example test
import { authFlowManager } from '../lib/authFlowManager';

describe('AuthFlowManager', () => {
  it('should handle new user signup', async () => {
    const result = await authFlowManager.initializeAuthFlow();

    expect(result.success).toBe(true);
    expect(result.needsSetup).toBe(false);
    expect(result.user).not.toBeNull();
    expect(result.user.workspace).not.toBeNull();
  });

  it('should handle missing user row', async () => {
    // Simulate missing user row
    // ...test implementation
  });
});
```

## Troubleshooting

### Issue: User stuck in redirect loop

**Cause:** Auth state is changing repeatedly, triggering multiple redirects.

**Solution:**
1. Check that `isLoading` flag is respected in redirect logic
2. Ensure redirects use `replace: true` to avoid history stack buildup
3. Verify auth state listener is not triggering multiple times

### Issue: 406 Not Acceptable errors

**Cause:** PostgREST rejecting embedded resource queries.

**Solution:**
1. Verify you're using `WorkspaceSubagent.fetchCompleteProfile()`
2. Check that queries are split into three separate calls
3. Ensure no `workspaces(*)` syntax in queries

### Issue: User row not created

**Cause:** `create_workspace_with_owner` RPC failing.

**Solution:**
1. Check that migration `001_auth_and_workspaces.sql` is applied
2. Verify RPC has `GRANT EXECUTE TO authenticated, anon`
3. Check Supabase logs for RPC errors

### Issue: Circular redirects on landing page

**Cause:** Auth state changing after redirect, causing re-redirect.

**Solution:**
1. Use `replace: true` in all `navigate()` calls
2. Add redirect guard with `isLoading` check
3. Ensure single effect handles all redirects

## Migration Guide

### From Existing App.tsx Implementation

If you're currently using the auth logic in `App.tsx` (lines 111-175), here's how to migrate:

**Before:**
```typescript
// App.tsx
useEffect(() => {
  const unsubscribe = onAuthStateChange(async (newSession) => {
    setSession(newSession);
    if (newSession?.user) {
      let profile = await getUserProfile(newSession.user.id);
      // ...auto-healing logic
      setUser(profile);
    }
  });
  return () => unsubscribe();
}, []);
```

**After:**
```typescript
// App.tsx
const { isLoading, isAuthenticated, user, session, needsSetup } = useAuthFlow();

// All auth logic is handled by the hook
```

### Benefits of Migration

1. **Cleaner code:** All auth logic centralized in `authFlowManager`
2. **Better error handling:** No more unhandled promise rejections
3. **Type safety:** Full TypeScript support with proper types
4. **Testability:** Easy to unit test subagents independently
5. **Maintainability:** Clear separation of concerns

## API Reference

### AuthFlowManager

```typescript
class AuthFlowManager {
  // Initialize auth flow and return current state
  async initializeAuthFlow(): Promise<AuthFlowResult>;

  // Listen to auth state changes
  onAuthFlowChange(callback: (result: AuthFlowResult) => void): () => void;

  // Manually refresh auth state
  async refreshAuthFlow(): Promise<AuthFlowResult>;
}
```

### useAuthFlow Hook

```typescript
interface UseAuthFlowResult {
  isLoading: boolean;           // True while initializing
  isAuthenticated: boolean;     // True if user has valid session and profile
  session: Session | null;      // Supabase session
  user: AuthFlowUser | null;    // Complete user profile with workspace and personas
  error: AuthFlowError | null;  // Any errors that occurred
  needsSetup: boolean;          // True if user needs to complete workspace setup
  refresh: () => Promise<void>; // Manually refresh auth state
}
```

### AuthFlowResult

```typescript
interface AuthFlowResult {
  success: boolean;             // True if no fatal errors
  session: Session | null;      // Supabase session
  user: AuthFlowUser | null;    // Complete user profile
  error?: AuthFlowError;        // Error details if any
  needsSetup?: boolean;         // True if user needs workspace setup
}
```

### AuthFlowUser

```typescript
interface AuthFlowUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  identity_level: string;
  workspace_id: string | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    subscription_tier: string;
    subscription_status: string;
  } | null;
  personas: Array<{
    id: string;
    persona_type: string;
    is_active: boolean;
    is_complete: boolean;
    current_step: string | null;
  }>;
}
```

## Support

If you encounter issues:

1. Check console logs for `[AuthFlowManager]`, `[AuthSubagent]`, `[UserSubagent]`, `[WorkspaceSubagent]`, and `[ErrorSubagent]` messages
2. Verify Supabase connection is working
3. Check database migrations are applied
4. Review RLS policies are configured correctly
5. Open an issue with full error logs

## License

MIT
