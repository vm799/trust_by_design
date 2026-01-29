/**
 * Send Email Edge Function
 *
 * Centralized email sending via Resend API.
 * Used by notificationService and magicLinkService for:
 * - Job completion notifications
 * - Magic link delivery
 * - Manager alerts
 *
 * Requires RESEND_API_KEY in Supabase secrets.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  // Template support
  template?: 'notification' | 'magic-link' | 'job-sealed' | 'custom';
  templateData?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      console.warn('[SendEmail] RESEND_API_KEY not configured - emails will not be sent');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email service not configured',
          message: 'RESEND_API_KEY is required. Add it to Supabase secrets.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503, // Service Unavailable
        }
      );
    }

    const data: EmailRequest = await req.json();

    // Validate required fields
    if (!data.to || !data.subject || !data.html) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: to, subject, html',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Normalize to array
    const recipients = Array.isArray(data.to) ? data.to : [data.to];

    // Default sender
    const from = data.from || 'JobProof <notifications@jobproof.pro>';

    console.log(`[SendEmail] Sending to: ${recipients.join(', ')}`);
    console.log(`[SendEmail] Subject: ${data.subject}`);

    // Send via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: data.subject,
        html: data.html,
        ...(data.replyTo && { reply_to: data.replyTo }),
      }),
    });

    if (emailResponse.ok) {
      const result = await emailResponse.json();
      console.log(`[SendEmail] Success - ID: ${result.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          emailId: result.id,
          recipients,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else {
      const errorText = await emailResponse.text();
      console.error(`[SendEmail] Resend API error: ${errorText}`);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email delivery failed',
          details: errorText,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }
  } catch (error) {
    console.error('[SendEmail] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
