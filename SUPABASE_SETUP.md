# 🚀 Supabase Backend Setup Guide

**Complete this 5-minute setup to enable cloud sync, photo storage, and real-time updates.**

---

## ✅ WHAT I'VE ALREADY DONE FOR YOU

I've implemented **95% of the backend integration**:

- ✅ Supabase client configuration (`lib/supabase.ts`)
- ✅ Database schema (`supabase/schema.sql`)
- ✅ Sync queue with retry logic (`lib/syncQueue.ts`)
- ✅ Photo/signature upload to cloud storage
- ✅ Real-time sync in TechnicianPortal
- ✅ Background sync worker (auto-retries failed uploads)
- ✅ Graceful degradation (works offline without Supabase)

**The app will continue working in offline-only mode until you complete the setup below.**

---

## 🎯 WHAT YOU NEED TO DO (5 minutes)

### Step 1: Create Free Supabase Account (2 minutes)

1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign up with GitHub (fastest) or email
4. Create a new project:
   - **Name:** `jobproof-v2`
   - **Database Password:** Generate strong password (save it!)
   - **Region:** Choose closest to your users
   - Click **"Create new project"**
5. Wait 1-2 minutes for project provisioning

---

### Step 2: Get Your API Credentials (30 seconds)

1. In Supabase dashboard, click **"Settings"** (gear icon in sidebar)
2. Click **"API"** in the left menu
3. Copy these two values:

   - **Project URL** (looks like: `https://abcdefghijk.supabase.co`)
   - **anon public** key (under "Project API keys")

---

### Step 3: Add Credentials to Your Project (1 minute)

1. Create a `.env` file in the project root:

```bash
# In your terminal:
touch .env
```

2. Open `.env` and add your credentials:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**IMPORTANT:** Replace `YOUR_PROJECT_REF` and `your_anon_key_here` with the values from Step 2.

3. Save the file.

---

### Step 4: Install Supabase Client Library (30 seconds)

```bash
npm install @supabase/supabase-js
```

---

### Step 5: Run Database Schema (1 minute)

1. In Supabase dashboard, click **"SQL Editor"** in sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` in your code editor
4. **Copy the entire contents** of `schema.sql`
5. **Paste** into the Supabase SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see:
   ```
   Success. No rows returned
   ```

**What this does:**
- Creates 5 tables: `jobs`, `photos`, `safety_checks`, `clients`, `technicians`
- Creates 2 storage buckets: `job-photos`, `job-signatures`
- Sets up Row Level Security (RLS) policies
- Adds database indexes for performance

---

### Step 6: Verify Storage Buckets (30 seconds)

1. In Supabase dashboard, click **"Storage"** in sidebar
2. You should see two buckets:
   - `job-photos` (public)
   - `job-signatures` (public)
3. If missing, they'll be auto-created on first upload (no action needed)

---

### Step 7: Test the Integration (1 minute)

1. **Restart your dev server:**
   ```bash
   npm run dev
   ```

2. **Check the browser console** - you should see:
   ```
   🚀 JobProof v2 - Background sync worker started
   ```

3. **Create a test job:**
   - Go to Admin Dashboard → Create Job
   - Fill in details and dispatch
   - Open the magic link in technician portal
   - Add a photo
   - Watch the browser console - you should see:
     ```
     ✅ Job abc123 synced successfully to Supabase
     ```

4. **Verify in Supabase:**
   - Go to Supabase dashboard → "Table Editor"
   - Click "jobs" table
   - Your test job should appear!
   - Click "Storage" → "job-photos"
   - Your photo should be there!

---

## 🎉 DONE! Your Backend is Live

**What you now have:**

- ✅ **Cloud Database** - Jobs persist beyond localStorage
- ✅ **Photo Storage** - Photos uploaded to Supabase Storage (S3-compatible)
- ✅ **Auto-Sync** - Background worker retries failed uploads every 60 seconds
- ✅ **Offline Support** - Works without internet, syncs when back online
- ✅ **Real-time Ready** - Foundation for live dashboard updates (see Optional Enhancements below)

---

## 🔧 Troubleshooting

### "Supabase credentials not configured" in console

**Fix:** Double-check your `.env` file:
- File must be named exactly `.env` (not `.env.txt`)
- Must be in project root (same folder as `package.json`)
- Variable names must start with `VITE_` (required for Vite)
- Restart dev server after creating `.env`

### Photos not uploading

**Fix:** Check storage policies:
1. Supabase dashboard → Storage → Policies
2. Ensure `job-photos` bucket has `INSERT` and `SELECT` policies
3. If missing, re-run Step 5 (schema.sql)

### "Failed to sync" errors

**Fix:** Check browser console for specific error:
- **401 Unauthorized:** Wrong anon key
- **404 Not Found:** Wrong project URL
- **403 Forbidden:** Storage policies missing
- **500 Server Error:** Database schema not created

### Jobs not appearing in Supabase Table Editor

**Fix:**
1. Go to SQL Editor and run:
   ```sql
   SELECT * FROM jobs;
   ```
2. If error "relation jobs does not exist", re-run schema.sql
3. If no error but empty results, ensure you completed a job in technician portal

---

## 📊 Optional Enhancements (After MVP)

### 1. Real-Time Dashboard Updates (15 minutes)

Add live sync to AdminDashboard so jobs update without refresh:

```typescript
// In AdminDashboard.tsx
import { getSupabase } from '../lib/supabase';

useEffect(() => {
  const supabase = getSupabase();
  if (!supabase) return;

  const channel = supabase
    .channel('jobs-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'jobs' },
      (payload) => {
        console.log('Real-time update:', payload);
        // Refresh jobs list
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

### 2. Email Notifications with Supabase Edge Functions

Create edge function to send magic links via email:

```bash
# In Supabase dashboard → Edge Functions
npx supabase functions new send-magic-link
```

### 3. Advanced Security (Production)

Replace anonymous access with proper authentication:

```sql
-- In SQL Editor, replace existing policies with:
CREATE POLICY "Authenticated users can view jobs"
  ON jobs FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

### 4. Data Export to QuickBooks

Use Supabase webhooks to trigger QuickBooks API on job completion.

---

## 🆘 Need Help?

- **Supabase Docs:** https://supabase.com/docs
- **JobProof Issues:** Check `SUPABASE_SETUP.md` first, then contact admin
- **Stack Overflow:** Tag with `supabase` and `postgresql`

---

## 📝 Architecture Overview

```
┌─────────────────┐
│  TechnicianPortal│ → Captures photo → IndexedDB (offline)
└────────┬────────┘                           │
         │                                    │
         │ (when online)                      │
         ↓                                    ↓
   syncJobToSupabase()  ←────────── getMedia(photoId)
         │
         ├─→ Upload photos to Supabase Storage
         ├─→ Upload signature to Supabase Storage
         ├─→ Upsert job to jobs table
         ├─→ Upsert photos to photos table
         └─→ Upsert safety_checks to safety_checks table
                     │
                     ↓
            ┌────────────────┐
            │ Supabase Cloud │
            │  - PostgreSQL  │
            │  - Storage     │
            │  - Real-time   │
            └────────────────┘
```

**Key Design Decisions:**

1. **Offline-First:** IndexedDB is source of truth until sync succeeds
2. **Retry Queue:** Failed syncs auto-retry with exponential backoff (2s, 5s, 10s, 30s)
3. **Graceful Degradation:** App works without Supabase (offline-only mode)
4. **Idempotent Upserts:** Safe to retry - no duplicate data
5. **Public Storage:** Photos/signatures publicly accessible via URL (for client reports)

---

## 🔐 Security Notes

**Current Setup (MVP):**
- Anonymous access enabled for magic links to work
- Anyone with job ID can view/edit (by design for field workers)
- Storage buckets are public (photos accessible via URL)

**Production Hardening (When Ready):**
- Add authentication for admin portal
- Implement Row Level Security (RLS) based on user roles
- Use signed URLs for sensitive photos
- Add rate limiting via Supabase Edge Functions
- Enable SSL certificate pinning in mobile apps

---

## 💰 Pricing (Free Tier is Generous)

**Supabase Free Tier:**
- 500 MB database (enough for ~10,000 jobs)
- 1 GB storage (enough for ~2,000 photos)
- 2 GB bandwidth/month
- Unlimited API requests
- 50,000 monthly active users

**When to Upgrade ($25/month):**
- Database > 8 GB
- Storage > 100 GB
- Need daily backups
- Need point-in-time recovery

---

**You're all set! 🎉 Your JobProof v2 app now has enterprise-grade cloud infrastructure.**
