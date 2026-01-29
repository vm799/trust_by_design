/**
 * generate-report Edge Function
 *
 * SECURE PDF report generation for completed jobs.
 * All data is VERIFIED from the database - never trusts request payload.
 *
 * Flow:
 * 1. Receive jobId from request
 * 2. VERIFY job exists in bunker_jobs table
 * 3. Generate PDF with DATABASE data (not request data)
 * 4. Upload PDF to Supabase Storage
 * 5. Send email to manager with download link
 *
 * @author Claude Code - Security Hardened
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

interface ReportRequest {
  jobId: string;
  // All other data will be fetched from database for verification
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    console.log('[GenerateReport] RESEND_API_KEY configured:', !!resendApiKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: ReportRequest = await req.json();
    const { jobId } = requestData;

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[GenerateReport] Processing job: ${jobId}`);

    // =========================================================================
    // STEP 0: VERIFY JOB EXISTS IN DATABASE (CRITICAL SECURITY)
    // =========================================================================

    const { data: job, error: jobError } = await supabase
      .from('bunker_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('[GenerateReport] Job not found:', jobId, jobError?.message);
      return new Response(
        JSON.stringify({ success: false, error: `Job not found: ${jobId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[GenerateReport] Job verified from database:', {
      id: job.id,
      title: job.title,
      client: job.client,
      status: job.status,
      hasBeforePhoto: !!job.before_photo_data,
      hasAfterPhoto: !!job.after_photo_data,
      hasSignature: !!job.signature_data,
      managerEmail: job.manager_email,
    });

    // =========================================================================
    // STEP 1: Generate PDF with VERIFIED DATABASE DATA
    // =========================================================================

    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Page dimensions (Letter size)
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 50;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Track what evidence was included
    let beforePhotoIncluded = false;
    let afterPhotoIncluded = false;
    let signatureIncluded = false;

    // -------------------------------------------------------------------------
    // HEADER
    // -------------------------------------------------------------------------

    page.drawText('JOB COMPLETION REPORT', {
      x: margin,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0.13, 0.38, 0.85),
    });
    yPosition -= 35;

    // Job ID and Date (from DATABASE)
    page.drawText(`Job ID: ${job.id}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    const completedDate = job.completed_at
      ? new Date(job.completed_at).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'In Progress';

    page.drawText(`Completed: ${completedDate}`, {
      x: pageWidth - margin - 250,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 20;

    // Client (from DATABASE)
    if (job.client) {
      page.drawText(`Client: ${job.client}`, {
        x: margin,
        y: yPosition,
        size: 11,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 15;
    }

    // Address (from DATABASE)
    if (job.address) {
      page.drawText(`Location: ${job.address}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 15;
    }

    // Technician (from DATABASE)
    if (job.technician_name) {
      page.drawText(`Technician: ${job.technician_name}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 15;
    }

    // What3Words location (from DATABASE)
    if (job.w3w) {
      page.drawText(`What3Words: ///${job.w3w}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: rgb(0.88, 0.14, 0.22), // W3W red color
      });
      yPosition -= 15;
    }

    // Divider line
    yPosition -= 10;
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 30;

    // -------------------------------------------------------------------------
    // PHOTOS SECTION (from DATABASE)
    // -------------------------------------------------------------------------

    page.drawText('EVIDENCE PHOTOS', {
      x: margin,
      y: yPosition,
      size: 14,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 25;

    const photoWidth = 240;
    const photoHeight = 180;

    // Before Photo (from DATABASE: before_photo_data)
    if (job.before_photo_data) {
      try {
        console.log('[GenerateReport] Embedding before photo from database...');
        const beforeImageBytes = base64ToBytes(job.before_photo_data);
        const imageType = detectImageType(job.before_photo_data);
        const beforeImage = imageType === 'png'
          ? await pdfDoc.embedPng(beforeImageBytes)
          : await pdfDoc.embedJpg(beforeImageBytes);

        page.drawText('BEFORE', {
          x: margin,
          y: yPosition,
          size: 10,
          font: helveticaBold,
          color: rgb(0.9, 0.3, 0.2),
        });
        yPosition -= 5;

        page.drawImage(beforeImage, {
          x: margin,
          y: yPosition - photoHeight,
          width: photoWidth,
          height: photoHeight,
        });

        // Timestamp from DATABASE
        if (job.before_photo_timestamp) {
          const beforeTimestamp = new Date(job.before_photo_timestamp).toLocaleString();
          page.drawText(`Captured: ${beforeTimestamp}`, {
            x: margin,
            y: yPosition - photoHeight - 12,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }

        // GPS from DATABASE
        if (job.before_photo_lat && job.before_photo_lng) {
          page.drawText(`GPS: ${Number(job.before_photo_lat).toFixed(6)}, ${Number(job.before_photo_lng).toFixed(6)}`, {
            x: margin,
            y: yPosition - photoHeight - 22,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }

        beforePhotoIncluded = true;
        console.log('[GenerateReport] Before photo embedded successfully');
      } catch (e) {
        console.error('[GenerateReport] FAILED to embed before photo:', e);
        // Draw placeholder for failed photo
        page.drawText('BEFORE PHOTO - FAILED TO LOAD', {
          x: margin,
          y: yPosition - photoHeight / 2,
          size: 10,
          font: helvetica,
          color: rgb(0.8, 0.2, 0.2),
        });
      }
    } else {
      console.log('[GenerateReport] No before photo in database');
      page.drawText('NO BEFORE PHOTO', {
        x: margin,
        y: yPosition - 10,
        size: 10,
        font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    // After Photo (from DATABASE: after_photo_data)
    if (job.after_photo_data) {
      try {
        console.log('[GenerateReport] Embedding after photo from database...');
        const afterImageBytes = base64ToBytes(job.after_photo_data);
        const imageType = detectImageType(job.after_photo_data);
        const afterImage = imageType === 'png'
          ? await pdfDoc.embedPng(afterImageBytes)
          : await pdfDoc.embedJpg(afterImageBytes);

        const afterX = margin + photoWidth + 30;

        page.drawText('AFTER', {
          x: afterX,
          y: yPosition,
          size: 10,
          font: helveticaBold,
          color: rgb(0.2, 0.7, 0.3),
        });

        page.drawImage(afterImage, {
          x: afterX,
          y: yPosition - photoHeight,
          width: photoWidth,
          height: photoHeight,
        });

        // Timestamp from DATABASE
        if (job.after_photo_timestamp) {
          const afterTimestamp = new Date(job.after_photo_timestamp).toLocaleString();
          page.drawText(`Captured: ${afterTimestamp}`, {
            x: afterX,
            y: yPosition - photoHeight - 12,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }

        // GPS from DATABASE
        if (job.after_photo_lat && job.after_photo_lng) {
          page.drawText(`GPS: ${Number(job.after_photo_lat).toFixed(6)}, ${Number(job.after_photo_lng).toFixed(6)}`, {
            x: afterX,
            y: yPosition - photoHeight - 22,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }

        afterPhotoIncluded = true;
        console.log('[GenerateReport] After photo embedded successfully');
      } catch (e) {
        console.error('[GenerateReport] FAILED to embed after photo:', e);
      }
    } else {
      console.log('[GenerateReport] No after photo in database');
    }

    yPosition -= photoHeight + 50;

    // -------------------------------------------------------------------------
    // SIGNATURE SECTION (from DATABASE)
    // -------------------------------------------------------------------------

    if (job.signature_data) {
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: pageWidth - margin, y: yPosition },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
      yPosition -= 25;

      page.drawText('CLIENT APPROVAL', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 20;

      try {
        console.log('[GenerateReport] Embedding signature from database...');
        const sigBytes = base64ToBytes(job.signature_data);
        const sigImage = await pdfDoc.embedPng(sigBytes);

        page.drawImage(sigImage, {
          x: margin,
          y: yPosition - 60,
          width: 200,
          height: 60,
        });

        signatureIncluded = true;
        console.log('[GenerateReport] Signature embedded successfully');
      } catch (e) {
        console.error('[GenerateReport] FAILED to embed signature:', e);
      }

      if (job.signer_name) {
        page.drawText(`Signed by: ${job.signer_name}`, {
          x: margin,
          y: yPosition - 75,
          size: 10,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      if (job.signature_timestamp) {
        const sigTimestamp = new Date(job.signature_timestamp).toLocaleString();
        page.drawText(`Date: ${sigTimestamp}`, {
          x: margin,
          y: yPosition - 88,
          size: 9,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      yPosition -= 110;
    }

    // -------------------------------------------------------------------------
    // STATUS BADGE (Honest - not fake "verified")
    // -------------------------------------------------------------------------

    const badgeY = margin + 30;
    const hasEvidence = beforePhotoIncluded || afterPhotoIncluded || signatureIncluded;

    page.drawRectangle({
      x: margin,
      y: badgeY,
      width: pageWidth - margin * 2,
      height: 40,
      color: hasEvidence ? rgb(0.95, 0.98, 0.95) : rgb(0.98, 0.95, 0.95),
      borderColor: hasEvidence ? rgb(0.2, 0.7, 0.3) : rgb(0.7, 0.2, 0.2),
      borderWidth: 1,
    });

    const badgeText = hasEvidence
      ? `Evidence: ${[beforePhotoIncluded && 'Before Photo', afterPhotoIncluded && 'After Photo', signatureIncluded && 'Signature'].filter(Boolean).join(' • ')}`
      : 'NO EVIDENCE PHOTOS AVAILABLE';

    page.drawText(badgeText, {
      x: margin + 15,
      y: badgeY + 15,
      size: 10,
      font: helveticaBold,
      color: hasEvidence ? rgb(0.2, 0.6, 0.3) : rgb(0.6, 0.2, 0.2),
    });

    page.drawText(`Report generated: ${new Date().toISOString()}`, {
      x: pageWidth - margin - 200,
      y: badgeY + 15,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();

    console.log(`[GenerateReport] PDF generated: ${pdfBytes.length} bytes, evidence: before=${beforePhotoIncluded}, after=${afterPhotoIncluded}, sig=${signatureIncluded}`);

    // =========================================================================
    // STEP 2: Upload to Supabase Storage
    // =========================================================================

    const fileName = `reports/${job.id}_${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-reports')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('[GenerateReport] Upload error:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('job-reports')
      .getPublicUrl(fileName);

    const pdfUrl = urlData.publicUrl;
    console.log(`[GenerateReport] PDF uploaded: ${pdfUrl}`);

    // =========================================================================
    // STEP 3: Send Email via Resend
    // =========================================================================

    let emailSent = false;
    let emailError = null;

    const managerEmail = job.manager_email;

    if (!resendApiKey) {
      console.error('[GenerateReport] RESEND_API_KEY not configured!');
      emailError = 'RESEND_API_KEY not configured';
    } else if (!managerEmail) {
      console.error('[GenerateReport] No manager email in job record');
      emailError = 'No manager email';
    } else {
      try {
        console.log(`[GenerateReport] Sending email to: ${managerEmail}`);

        const emailHtml = generateEmailHtml(job, pdfUrl, { beforePhotoIncluded, afterPhotoIncluded, signatureIncluded });

        const emailPayload = {
          from: 'JobProof <reports@jobproof.pro>',
          to: [managerEmail],
          subject: `Job ${job.id} Complete - Evidence Report Ready`,
          html: emailHtml,
        };

        console.log('[GenerateReport] Email payload:', JSON.stringify({ ...emailPayload, html: '[HTML CONTENT]' }));

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailPayload),
        });

        const responseText = await emailResponse.text();
        console.log(`[GenerateReport] Resend response (${emailResponse.status}):`, responseText);

        if (emailResponse.ok) {
          emailSent = true;
          console.log(`[GenerateReport] Email sent successfully to: ${managerEmail}`);
        } else {
          emailError = responseText;
          console.error('[GenerateReport] Email failed:', responseText);
        }
      } catch (e) {
        emailError = e.message;
        console.error('[GenerateReport] Email error:', e);
      }
    }

    // =========================================================================
    // STEP 4: Update job record with report URL
    // =========================================================================

    await supabase
      .from('bunker_jobs')
      .update({
        report_url: pdfUrl,
        report_generated_at: new Date().toISOString(),
        report_emailed: emailSent,
      })
      .eq('id', job.id);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl,
        emailSent,
        emailError,
        evidenceIncluded: { beforePhotoIncluded, afterPhotoIncluded, signatureIncluded },
        message: `Report generated for job ${job.id}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[GenerateReport] Error:', error);

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function base64ToBytes(dataUrl: string): Uint8Array {
  // Extract base64 data from data URL
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function detectImageType(dataUrl: string): 'png' | 'jpeg' {
  if (dataUrl.startsWith('data:image/png')) return 'png';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'jpeg';
  // Check magic bytes as fallback
  const base64 = dataUrl.split(',')[1] || dataUrl;
  if (base64.startsWith('iVBOR')) return 'png';   // PNG magic bytes in base64
  if (base64.startsWith('/9j/')) return 'jpeg';   // JPEG magic bytes in base64
  return 'jpeg'; // default to JPEG
}

interface EvidenceStatus {
  beforePhotoIncluded: boolean;
  afterPhotoIncluded: boolean;
  signatureIncluded: boolean;
}

function generateEmailHtml(job: any, pdfUrl: string, evidence: EvidenceStatus): string {
  const evidenceItems = [];
  if (evidence.beforePhotoIncluded) evidenceItems.push('Before photo with GPS + timestamp');
  if (evidence.afterPhotoIncluded) evidenceItems.push('After photo with GPS + timestamp');
  if (evidence.signatureIncluded && job.signer_name) evidenceItems.push(`Client signature by ${job.signer_name}`);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Complete - ${job.id}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
        Job Complete
      </h1>
      <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">
        Evidence report is ready for review
      </p>
    </div>

    <!-- Body -->
    <div style="background-color: #ffffff; padding: 32px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
      <!-- Job Details -->
      <div style="margin-bottom: 24px;">
        <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 16px 0;">Job Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Job ID</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${job.id}</td>
          </tr>
          ${job.client ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Client</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${job.client}</td>
          </tr>
          ` : ''}
          ${job.address ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${job.address}</td>
          </tr>
          ` : ''}
          ${job.technician_name ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Technician</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${job.technician_name}</td>
          </tr>
          ` : ''}
          ${job.completed_at ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Completed</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${new Date(job.completed_at).toLocaleString()}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${evidenceItems.length > 0 ? `
      <!-- Evidence Summary -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h3 style="color: #166534; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
          Evidence Captured
        </h3>
        <ul style="margin: 0; padding: 0 0 0 20px; color: #15803d; font-size: 13px;">
          ${evidenceItems.map(item => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
        </ul>
      </div>
      ` : `
      <!-- No Evidence Warning -->
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h3 style="color: #991b1b; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
          No Evidence Photos
        </h3>
        <p style="margin: 0; color: #b91c1c; font-size: 13px;">
          This report does not contain photo evidence.
        </p>
      </div>
      `}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${pdfUrl}"
           style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.4);">
          Download Report (PDF)
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
        This report contains job completion evidence from the database.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f1f5f9; border-radius: 0 0 16px 16px; padding: 24px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        Powered by <strong style="color: #2563eb;">JobProof</strong> - Professional Field Evidence
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0 0;">
        Report generated automatically upon job completion
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
