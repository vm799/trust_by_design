/**
 * generate-report Edge Function
 *
 * Cloud-triggered PDF report generation for completed jobs.
 * Called when a bunker job syncs successfully.
 *
 * Flow:
 * 1. Receive job data (photos, signature, metadata)
 * 2. Generate professional PDF with timestamps + GPS overlay
 * 3. Upload PDF to Supabase Storage
 * 4. Send email to manager with download link
 *
 * @author Claude Code - Bunker-Proof MVP
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
  title: string;
  client: string;
  address?: string;
  managerEmail: string;
  managerName?: string;
  technicianName?: string;
  beforePhoto?: {
    dataUrl: string;
    timestamp: string;
    lat?: number;
    lng?: number;
  };
  afterPhoto?: {
    dataUrl: string;
    timestamp: string;
    lat?: number;
    lng?: number;
  };
  signature?: {
    dataUrl: string;
    timestamp: string;
    signerName: string;
  };
  completedAt: string;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: ReportRequest = await req.json();

    console.log(`[GenerateReport] Processing job: ${data.jobId}`);

    // =========================================================================
    // STEP 1: Generate PDF
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

    // -------------------------------------------------------------------------
    // HEADER
    // -------------------------------------------------------------------------

    // Title
    page.drawText('JOB COMPLETION REPORT', {
      x: margin,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0.13, 0.38, 0.85), // Primary blue
    });
    yPosition -= 35;

    // Job ID and Date
    page.drawText(`Job ID: ${data.jobId}`, {
      x: margin,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    const completedDate = new Date(data.completedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    page.drawText(`Completed: ${completedDate}`, {
      x: pageWidth - margin - 250,
      y: yPosition,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
    yPosition -= 20;

    // Client and Address
    page.drawText(`Client: ${data.client}`, {
      x: margin,
      y: yPosition,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 15;

    if (data.address) {
      page.drawText(`Location: ${data.address}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 15;
    }

    if (data.technicianName) {
      page.drawText(`Technician: ${data.technicianName}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
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
    // PHOTOS SECTION
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

    // Before Photo
    if (data.beforePhoto?.dataUrl) {
      try {
        const beforeImageBytes = base64ToBytes(data.beforePhoto.dataUrl);
        const beforeImage = data.beforePhoto.dataUrl.includes('image/png')
          ? await pdfDoc.embedPng(beforeImageBytes)
          : await pdfDoc.embedJpg(beforeImageBytes);

        page.drawText('BEFORE', {
          x: margin,
          y: yPosition,
          size: 10,
          font: helveticaBold,
          color: rgb(0.9, 0.3, 0.2), // Red accent
        });
        yPosition -= 5;

        page.drawImage(beforeImage, {
          x: margin,
          y: yPosition - photoHeight,
          width: photoWidth,
          height: photoHeight,
        });

        // Timestamp overlay info below photo
        const beforeTimestamp = new Date(data.beforePhoto.timestamp).toLocaleString();
        page.drawText(`Captured: ${beforeTimestamp}`, {
          x: margin,
          y: yPosition - photoHeight - 12,
          size: 8,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });

        if (data.beforePhoto.lat && data.beforePhoto.lng) {
          page.drawText(`GPS: ${data.beforePhoto.lat.toFixed(6)}, ${data.beforePhoto.lng.toFixed(6)}`, {
            x: margin,
            y: yPosition - photoHeight - 22,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      } catch (e) {
        console.error('[GenerateReport] Failed to embed before photo:', e);
      }
    }

    // After Photo (side by side)
    if (data.afterPhoto?.dataUrl) {
      try {
        const afterImageBytes = base64ToBytes(data.afterPhoto.dataUrl);
        const afterImage = data.afterPhoto.dataUrl.includes('image/png')
          ? await pdfDoc.embedPng(afterImageBytes)
          : await pdfDoc.embedJpg(afterImageBytes);

        const afterX = margin + photoWidth + 30;

        page.drawText('AFTER', {
          x: afterX,
          y: yPosition,
          size: 10,
          font: helveticaBold,
          color: rgb(0.2, 0.7, 0.3), // Green accent
        });

        page.drawImage(afterImage, {
          x: afterX,
          y: yPosition - photoHeight,
          width: photoWidth,
          height: photoHeight,
        });

        // Timestamp overlay info below photo
        const afterTimestamp = new Date(data.afterPhoto.timestamp).toLocaleString();
        page.drawText(`Captured: ${afterTimestamp}`, {
          x: afterX,
          y: yPosition - photoHeight - 12,
          size: 8,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });

        if (data.afterPhoto.lat && data.afterPhoto.lng) {
          page.drawText(`GPS: ${data.afterPhoto.lat.toFixed(6)}, ${data.afterPhoto.lng.toFixed(6)}`, {
            x: afterX,
            y: yPosition - photoHeight - 22,
            size: 8,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      } catch (e) {
        console.error('[GenerateReport] Failed to embed after photo:', e);
      }
    }

    yPosition -= photoHeight + 50;

    // -------------------------------------------------------------------------
    // SIGNATURE SECTION
    // -------------------------------------------------------------------------

    if (data.signature) {
      // Divider
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

      if (data.signature.dataUrl) {
        try {
          const sigBytes = base64ToBytes(data.signature.dataUrl);
          const sigImage = await pdfDoc.embedPng(sigBytes);

          page.drawImage(sigImage, {
            x: margin,
            y: yPosition - 60,
            width: 200,
            height: 60,
          });
        } catch (e) {
          console.error('[GenerateReport] Failed to embed signature:', e);
        }
      }

      page.drawText(`Signed by: ${data.signature.signerName}`, {
        x: margin,
        y: yPosition - 75,
        size: 10,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });

      const sigTimestamp = new Date(data.signature.timestamp).toLocaleString();
      page.drawText(`Date: ${sigTimestamp}`, {
        x: margin,
        y: yPosition - 88,
        size: 9,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      yPosition -= 110;
    }

    // -------------------------------------------------------------------------
    // VERIFICATION BADGE
    // -------------------------------------------------------------------------

    // Draw verification badge at bottom
    const badgeY = margin + 30;

    page.drawRectangle({
      x: margin,
      y: badgeY,
      width: pageWidth - margin * 2,
      height: 40,
      color: rgb(0.95, 0.98, 0.95),
      borderColor: rgb(0.2, 0.7, 0.3),
      borderWidth: 1,
    });

    page.drawText('✓ VERIFIED IMMUTABLE EVIDENCE', {
      x: margin + 15,
      y: badgeY + 15,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.6, 0.3),
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

    console.log(`[GenerateReport] PDF generated: ${pdfBytes.length} bytes`);

    // =========================================================================
    // STEP 2: Upload to Supabase Storage
    // =========================================================================

    const fileName = `reports/${data.jobId}_${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('job-reports')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '31536000', // 1 year cache
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

    if (resendApiKey && data.managerEmail) {
      try {
        const emailHtml = generateEmailHtml(data, pdfUrl);

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'JobProof <reports@jobproof.io>',
            to: [data.managerEmail],
            subject: `✓ Job ${data.jobId} Complete - Evidence Report Ready`,
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
          console.log(`[GenerateReport] Email sent to: ${data.managerEmail}`);
        } else {
          const errorText = await emailResponse.text();
          console.error('[GenerateReport] Email failed:', errorText);
        }
      } catch (e) {
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
      .eq('id', data.jobId);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl,
        emailSent,
        message: `Report generated for job ${data.jobId}`,
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

function generateEmailHtml(data: ReportRequest, pdfUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Complete - ${data.jobId}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
        ✓ Job Complete
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
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${data.jobId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Client</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.client}</td>
          </tr>
          ${data.address ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.address}</td>
          </tr>
          ` : ''}
          ${data.technicianName ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Technician</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${data.technicianName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Completed</td>
            <td style="padding: 8px 0; color: #1e293b; font-size: 14px;">${new Date(data.completedAt).toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <!-- Evidence Summary -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h3 style="color: #166534; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">
          ✓ Evidence Captured
        </h3>
        <ul style="margin: 0; padding: 0 0 0 20px; color: #15803d; font-size: 13px;">
          ${data.beforePhoto ? '<li style="margin-bottom: 4px;">Before photo with GPS + timestamp</li>' : ''}
          ${data.afterPhoto ? '<li style="margin-bottom: 4px;">After photo with GPS + timestamp</li>' : ''}
          ${data.signature ? `<li style="margin-bottom: 4px;">Client signature by ${data.signature.signerName}</li>` : ''}
        </ul>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${pdfUrl}"
           style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.4);">
          📄 Download Full Report (PDF)
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
        This report contains immutable evidence with GPS coordinates and timestamps.
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
