@echo off
echo Starting JobProof Deployment...

echo 1. DB Push
call supabase db push
if %errorlevel% neq 0 exit /b %errorlevel%

echo 2. Edge Functions
call supabase functions deploy stripe-checkout --no-verify-jwt
call supabase functions deploy stripe-webhook --no-verify-jwt
call supabase functions deploy seal-evidence --no-verify-jwt
call supabase functions deploy verify-evidence --no-verify-jwt

echo DONE.
pause
