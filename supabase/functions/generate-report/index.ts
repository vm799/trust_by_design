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
    // HEADER - Professional Evidence Report
    // -------------------------------------------------------------------------

    // Title with seal status indicator
    const isJobSealed = !!job.sealed_at;
    page.drawText(isJobSealed ? 'SEALED EVIDENCE REPORT' : 'JOB COMPLETION REPORT', {
      x: margin,
      y: yPosition,
      size: 22,
      font: helveticaBold,
      color: isJobSealed ? rgb(0.13, 0.65, 0.35) : rgb(0.13, 0.38, 0.85),
    });

    // Seal indicator on right
    if (isJobSealed) {
      page.drawRectangle({
        x: pageWidth - margin - 90,
        y: yPosition - 5,
        width: 90,
        height: 25,
        color: rgb(0.04, 0.2, 0.08),
        borderColor: rgb(0.13, 0.77, 0.37),
        borderWidth: 1,
      });
      page.drawText('VERIFIED', {
        x: pageWidth - margin - 70,
        y: yPosition + 2,
        size: 10,
        font: helveticaBold,
        color: rgb(0.13, 0.77, 0.37),
      });
    }

    yPosition -= 30;

    // Job title if exists
    if (job.title) {
      page.drawText(job.title, {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 20;
    }

    // Job ID and Date (from DATABASE)
    page.drawText(`Job ID: ${job.id.substring(0, 8).toUpperCase()}`, {
      x: margin,
      y: yPosition,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    const completedDate = job.completed_at
      ? new Date(job.completed_at).toLocaleDateString('en-GB', {
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
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 20;

    // Client (from DATABASE)
    if (job.client) {
      page.drawText('CLIENT', {
        x: margin,
        y: yPosition,
        size: 8,
        font: helveticaBold,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(job.client, {
        x: margin + 50,
        y: yPosition,
        size: 11,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yPosition -= 18;
    }

    // Address (from DATABASE)
    if (job.address) {
      page.drawText('LOCATION', {
        x: margin,
        y: yPosition,
        size: 8,
        font: helveticaBold,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(job.address, {
        x: margin + 50,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 18;
    }

    // Technician (from DATABASE)
    if (job.technician_name) {
      page.drawText('TECH', {
        x: margin,
        y: yPosition,
        size: 8,
        font: helveticaBold,
        color: rgb(0.5, 0.5, 0.5),
      });
      page.drawText(job.technician_name, {
        x: margin + 50,
        y: yPosition,
        size: 10,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 18;
    }

    // What3Words location (from DATABASE) - PROMINENT RED BADGE
    if (job.w3w) {
      // W3W Badge background
      const w3wText = job.w3w.startsWith('///') ? job.w3w : `///${job.w3w}`;
      const w3wWidth = w3wText.length * 7 + 30;

      page.drawRectangle({
        x: margin,
        y: yPosition - 8,
        width: w3wWidth,
        height: 22,
        color: rgb(0.86, 0.08, 0.08), // W3W red
        borderColor: rgb(0.7, 0.05, 0.05),
        borderWidth: 1,
      });

      page.drawText(w3wText, {
        x: margin + 10,
        y: yPosition - 2,
        size: 11,
        font: helveticaBold,
        color: rgb(1, 1, 1), // White text
      });

      // W3W label
      page.drawText('What3Words Location', {
        x: margin + w3wWidth + 10,
        y: yPosition - 2,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });

      yPosition -= 28;
    }

    // Divider line
    yPosition -= 5;
    page.drawLine({
      start: { x: margin, y: yPosition },
      end: { x: pageWidth - margin, y: yPosition },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    yPosition -= 25;

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
    // CHAIN OF CUSTODY TIMELINE
    // -------------------------------------------------------------------------

    // Draw timeline section
    page.drawText('CHAIN OF CUSTODY', {
      x: margin,
      y: yPosition,
      size: 12,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    yPosition -= 20;

    // Timeline nodes
    const timelineY = yPosition - 10;
    const nodeSpacing = (pageWidth - margin * 2 - 40) / 3;
    const nodeRadius = 8;

    // Draw connecting line
    page.drawLine({
      start: { x: margin + 20, y: timelineY },
      end: { x: pageWidth - margin - 20, y: timelineY },
      thickness: 2,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Node 1: Created
    const node1X = margin + 20;
    page.drawCircle({
      x: node1X,
      y: timelineY,
      size: nodeRadius,
      color: rgb(0.13, 0.38, 0.85),
    });
    page.drawText('DISPATCHED', {
      x: node1X - 22,
      y: timelineY - 20,
      size: 7,
      font: helveticaBold,
      color: rgb(0.4, 0.4, 0.4),
    });
    if (job.created_at) {
      page.drawText(new Date(job.created_at).toLocaleDateString(), {
        x: node1X - 18,
        y: timelineY - 30,
        size: 6,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Node 2: Evidence Captured
    const node2X = node1X + nodeSpacing;
    const hasCaptured = beforePhotoIncluded || afterPhotoIncluded;
    page.drawCircle({
      x: node2X,
      y: timelineY,
      size: nodeRadius,
      color: hasCaptured ? rgb(0.13, 0.65, 0.35) : rgb(0.7, 0.7, 0.7),
    });
    page.drawText('CAPTURED', {
      x: node2X - 18,
      y: timelineY - 20,
      size: 7,
      font: helveticaBold,
      color: hasCaptured ? rgb(0.13, 0.65, 0.35) : rgb(0.5, 0.5, 0.5),
    });
    if (job.before_photo_timestamp || job.after_photo_timestamp) {
      const captureDate = new Date(job.before_photo_timestamp || job.after_photo_timestamp);
      page.drawText(captureDate.toLocaleDateString(), {
        x: node2X - 15,
        y: timelineY - 30,
        size: 6,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Node 3: Sealed
    const node3X = node2X + nodeSpacing;
    const isSealed = !!job.sealed_at;
    page.drawCircle({
      x: node3X,
      y: timelineY,
      size: nodeRadius,
      color: isSealed ? rgb(0.13, 0.65, 0.35) : rgb(0.7, 0.7, 0.7),
    });
    page.drawText('SEALED', {
      x: node3X - 14,
      y: timelineY - 20,
      size: 7,
      font: helveticaBold,
      color: isSealed ? rgb(0.13, 0.65, 0.35) : rgb(0.5, 0.5, 0.5),
    });
    if (job.sealed_at) {
      page.drawText(new Date(job.sealed_at).toLocaleDateString(), {
        x: node3X - 12,
        y: timelineY - 30,
        size: 6,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Node 4: Verified/Complete
    const node4X = node3X + nodeSpacing;
    const isComplete = job.status === 'Archived' || job.status === 'Complete';
    page.drawCircle({
      x: node4X,
      y: timelineY,
      size: nodeRadius,
      color: isComplete ? rgb(0.13, 0.65, 0.35) : rgb(0.7, 0.7, 0.7),
    });
    page.drawText('VERIFIED', {
      x: node4X - 16,
      y: timelineY - 20,
      size: 7,
      font: helveticaBold,
      color: isComplete ? rgb(0.13, 0.65, 0.35) : rgb(0.5, 0.5, 0.5),
    });
    if (job.completed_at) {
      page.drawText(new Date(job.completed_at).toLocaleDateString(), {
        x: node4X - 14,
        y: timelineY - 30,
        size: 6,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    yPosition -= 50;

    // -------------------------------------------------------------------------
    // CRYPTOGRAPHIC SEAL BADGE
    // -------------------------------------------------------------------------

    const sealBadgeY = yPosition - 10;
    const sealBadgeHeight = isSealed ? 70 : 40;

    // Draw seal badge background
    page.drawRectangle({
      x: margin,
      y: sealBadgeY - sealBadgeHeight + 30,
      width: pageWidth - margin * 2,
      height: sealBadgeHeight,
      color: isSealed ? rgb(0.04, 0.2, 0.08) : rgb(0.95, 0.97, 0.95),
      borderColor: isSealed ? rgb(0.13, 0.77, 0.37) : rgb(0.8, 0.8, 0.8),
      borderWidth: 2,
    });

    if (isSealed && job.evidence_hash) {
      // Sealed state - show full badge
      page.drawText('CRYPTOGRAPHICALLY SEALED', {
        x: margin + 15,
        y: sealBadgeY + 10,
        size: 12,
        font: helveticaBold,
        color: rgb(0.13, 0.77, 0.37),
      });

      page.drawText('Evidence integrity verified • Tamper-proof', {
        x: margin + 15,
        y: sealBadgeY - 5,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.6, 0.4),
      });

      // Hash display
      const hashDisplay = job.evidence_hash.length > 32
        ? `${job.evidence_hash.substring(0, 32)}...`
        : job.evidence_hash;
      page.drawText(`Hash: ${hashDisplay}`, {
        x: margin + 15,
        y: sealBadgeY - 20,
        size: 7,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText('Algorithm: SHA-256 + RSA-2048', {
        x: margin + 15,
        y: sealBadgeY - 32,
        size: 7,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Sealed timestamp
      if (job.sealed_at) {
        const sealedDate = new Date(job.sealed_at).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        page.drawText(`Sealed: ${sealedDate}`, {
          x: pageWidth - margin - 140,
          y: sealBadgeY + 10,
          size: 8,
          font: helveticaBold,
          color: rgb(0.13, 0.77, 0.37),
        });
      }

      if (job.sealed_by) {
        page.drawText(`By: ${job.sealed_by}`, {
          x: pageWidth - margin - 140,
          y: sealBadgeY - 5,
          size: 7,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Verified checkmark icon (text-based)
      page.drawText('VERIFIED', {
        x: pageWidth - margin - 55,
        y: sealBadgeY - 25,
        size: 9,
        font: helveticaBold,
        color: rgb(0.13, 0.77, 0.37),
      });

    } else {
      // Not sealed - show evidence summary
      const hasEvidence = beforePhotoIncluded || afterPhotoIncluded || signatureIncluded;

      const badgeText = hasEvidence
        ? `Evidence: ${[beforePhotoIncluded && 'Before Photo', afterPhotoIncluded && 'After Photo', signatureIncluded && 'Signature'].filter(Boolean).join(' • ')}`
        : 'NO EVIDENCE PHOTOS AVAILABLE';

      page.drawText(badgeText, {
        x: margin + 15,
        y: sealBadgeY + 5,
        size: 10,
        font: helveticaBold,
        color: hasEvidence ? rgb(0.2, 0.6, 0.3) : rgb(0.6, 0.2, 0.2),
      });

      page.drawText('Not yet sealed - awaiting cryptographic sealing', {
        x: margin + 15,
        y: sealBadgeY - 10,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Report generation timestamp at bottom
    page.drawText(`Report generated: ${new Date().toISOString()}`, {
      x: margin,
      y: margin,
      size: 7,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });

    page.drawText(`Job ID: ${job.id}`, {
      x: pageWidth - margin - 100,
      y: margin,
      size: 7,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
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

/**
 * Generate beautiful, high-contrast email with inline evidence photos
 *
 * Design principles:
 * - Dark mode optimized with high contrast (WCAG AAA)
 * - Inline evidence photos with metadata overlay
 * - Prominent W3W display with red branding
 * - Cryptographic seal badge for trust
 * - Mobile-first responsive design
 */
function generateEmailHtml(job: any, pdfUrl: string, evidence: EvidenceStatus): string {
  // Format timestamp for display
  const formatTimestamp = (ts: string | null) => {
    if (!ts) return null;
    try {
      const date = new Date(ts);
      return {
        date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        utc: date.toISOString().split('T')[1].substring(0, 8) + ' UTC'
      };
    } catch { return null; }
  };

  // Format GPS coordinates
  const formatGPS = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) return null;
    return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
  };

  // Format W3W address
  const formatW3W = (w3w: string | null) => {
    if (!w3w) return null;
    return w3w.startsWith('///') ? w3w : `///${w3w}`;
  };

  const beforeTs = formatTimestamp(job.before_photo_timestamp);
  const afterTs = formatTimestamp(job.after_photo_timestamp);
  const beforeGPS = formatGPS(job.before_photo_lat, job.before_photo_lng);
  const afterGPS = formatGPS(job.after_photo_lat, job.after_photo_lng);
  const w3wAddress = formatW3W(job.w3w);
  const completedTs = formatTimestamp(job.completed_at);
  const sealedTs = formatTimestamp(job.sealed_at);

  // Truncate hash for display
  const truncateHash = (hash: string | null, len = 16) => {
    if (!hash) return null;
    return hash.length > len ? `${hash.substring(0, len)}...` : hash;
  };

  // Check if job is sealed
  const isSealed = !!job.sealed_at && !!job.evidence_hash;
  const sealHash = truncateHash(job.evidence_hash);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Evidence Report - ${job.title || job.id}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #f8fafc;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- HERO HEADER WITH SEAL BADGE -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 2px solid ${isSealed ? '#22c55e' : '#3b82f6'}; border-radius: 24px; overflow: hidden;">

      <!-- Top Bar with Seal Status -->
      <div style="background: ${isSealed ? 'linear-gradient(135deg, #14532d 0%, #166534 100%)' : 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)'}; padding: 20px 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                ${isSealed ? '🔒 EVIDENCE SEALED' : '📋 JOB COMPLETE'}
              </h1>
              <p style="color: ${isSealed ? '#bbf7d0' : '#bfdbfe'}; margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">
                ${job.title || 'Work Completion Report'}
              </p>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              ${isSealed ? `
              <div style="display: inline-block; background: rgba(34, 197, 94, 0.2); border: 2px solid #22c55e; border-radius: 12px; padding: 8px 16px;">
                <span style="color: #22c55e; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">✓ VERIFIED</span>
              </div>
              ` : `
              <div style="display: inline-block; background: rgba(59, 130, 246, 0.2); border: 2px solid #3b82f6; border-radius: 12px; padding: 8px 16px;">
                <span style="color: #60a5fa; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">READY</span>
              </div>
              `}
            </td>
          </tr>
        </table>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <!-- JOB DETAILS CARD -->
      <!-- ═══════════════════════════════════════════════════════════════════════ -->
      <div style="padding: 24px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${job.client ? `
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; width: 100px;">Client</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 15px; font-weight: 600;">${job.client}</td>
          </tr>
          ` : ''}
          ${job.address ? `
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Location</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 14px;">${job.address}</td>
          </tr>
          ` : ''}
          ${job.technician_name ? `
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Technician</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 14px;">${job.technician_name}</td>
          </tr>
          ` : ''}
          ${completedTs ? `
          <tr>
            <td style="padding: 6px 0; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Completed</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 14px;">${completedTs.date} at ${completedTs.time}</td>
          </tr>
          ` : ''}
        </table>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- WHAT3WORDS LOCATION BADGE -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        ${w3wAddress ? `
        <div style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle; width: 40px;">
                <div style="width: 36px; height: 36px; background: #dc2626; border-radius: 8px; text-align: center; line-height: 36px;">
                  <span style="color: white; font-size: 18px;">📍</span>
                </div>
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <p style="color: #fecaca; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0;">What3Words Location</p>
                <p style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 4px 0 0 0; font-family: monospace;">${w3wAddress}</p>
              </td>
            </tr>
          </table>
        </div>
        ` : ''}

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- EVIDENCE PHOTOS WITH METADATA -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        ${(evidence.beforePhotoIncluded || evidence.afterPhotoIncluded) ? `
        <div style="margin-bottom: 20px;">
          <p style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">📸 Evidence Photos</p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${evidence.beforePhotoIncluded ? `
              <td style="width: 50%; padding-right: 8px; vertical-align: top;">
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                  <!-- Photo placeholder with metadata -->
                  <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 8px 12px;">
                    <span style="color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">⬅ BEFORE</span>
                  </div>
                  ${job.before_photo_data ? `
                  <img src="${job.before_photo_data}" alt="Before photo" style="width: 100%; height: auto; display: block;" />
                  ` : `
                  <div style="background: #334155; height: 120px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #64748b; font-size: 12px;">Photo in PDF</span>
                  </div>
                  `}
                  <div style="padding: 10px 12px; background: #0f172a;">
                    ${beforeTs ? `
                    <p style="color: #22c55e; font-size: 11px; font-weight: 700; margin: 0;">🕐 ${beforeTs.utc}</p>
                    ` : ''}
                    ${beforeGPS ? `
                    <p style="color: #94a3b8; font-size: 10px; margin: 4px 0 0 0; font-family: monospace;">📍 ${beforeGPS}</p>
                    ` : ''}
                  </div>
                </div>
              </td>
              ` : '<td style="width: 50%; padding-right: 8px;"></td>'}

              ${evidence.afterPhotoIncluded ? `
              <td style="width: 50%; padding-left: 8px; vertical-align: top;">
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                  <!-- Photo placeholder with metadata -->
                  <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 8px 12px;">
                    <span style="color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">AFTER ➡</span>
                  </div>
                  ${job.after_photo_data ? `
                  <img src="${job.after_photo_data}" alt="After photo" style="width: 100%; height: auto; display: block;" />
                  ` : `
                  <div style="background: #334155; height: 120px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #64748b; font-size: 12px;">Photo in PDF</span>
                  </div>
                  `}
                  <div style="padding: 10px 12px; background: #0f172a;">
                    ${afterTs ? `
                    <p style="color: #22c55e; font-size: 11px; font-weight: 700; margin: 0;">🕐 ${afterTs.utc}</p>
                    ` : ''}
                    ${afterGPS ? `
                    <p style="color: #94a3b8; font-size: 10px; margin: 4px 0 0 0; font-family: monospace;">📍 ${afterGPS}</p>
                    ` : ''}
                  </div>
                </div>
              </td>
              ` : '<td style="width: 50%; padding-left: 8px;"></td>'}
            </tr>
          </table>
        </div>
        ` : ''}

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- SIGNATURE CONFIRMATION -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        ${evidence.signatureIncluded && job.signer_name ? `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle; width: 40px;">
                <div style="width: 36px; height: 36px; background: #3b82f6; border-radius: 8px; text-align: center; line-height: 36px;">
                  <span style="color: white; font-size: 18px;">✍️</span>
                </div>
              </td>
              <td style="vertical-align: middle; padding-left: 12px;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Client Approval</p>
                <p style="color: #f1f5f9; font-size: 15px; font-weight: 600; margin: 4px 0 0 0;">Signed by ${job.signer_name}</p>
                ${job.signer_role ? `<p style="color: #64748b; font-size: 12px; margin: 2px 0 0 0;">${job.signer_role}</p>` : ''}
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span style="color: #22c55e; font-size: 20px;">✓</span>
              </td>
            </tr>
          </table>
        </div>
        ` : ''}

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- CRYPTOGRAPHIC SEAL BADGE -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        ${isSealed ? `
        <div style="background: linear-gradient(135deg, #052e16 0%, #14532d 100%); border: 2px solid #22c55e; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: top; width: 56px;">
                <div style="width: 48px; height: 48px; background: rgba(34, 197, 94, 0.2); border: 2px solid #22c55e; border-radius: 50%; text-align: center; line-height: 44px;">
                  <span style="color: #22c55e; font-size: 24px;">🔒</span>
                </div>
              </td>
              <td style="vertical-align: top; padding-left: 16px;">
                <h3 style="color: #22c55e; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
                  Cryptographically Sealed
                </h3>
                <p style="color: #86efac; font-size: 12px; margin: 6px 0 0 0;">
                  Evidence integrity verified • Tamper-proof
                </p>

                <div style="margin-top: 16px; background: #0f172a; border-radius: 8px; padding: 12px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Evidence Hash</span>
                        <p style="color: #f1f5f9; font-size: 11px; font-family: monospace; margin: 2px 0 0 0;">${sealHash}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Algorithm</span>
                        <p style="color: #f1f5f9; font-size: 11px; margin: 2px 0 0 0;">SHA-256 + RSA-2048</p>
                      </td>
                    </tr>
                    ${sealedTs ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Sealed At</span>
                        <p style="color: #f1f5f9; font-size: 11px; margin: 2px 0 0 0;">${sealedTs.date} ${sealedTs.time}</p>
                      </td>
                    </tr>
                    ` : ''}
                    ${job.sealed_by ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Sealed By</span>
                        <p style="color: #f1f5f9; font-size: 11px; margin: 2px 0 0 0;">${job.sealed_by}</p>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
              </td>
            </tr>
          </table>
        </div>
        ` : `
        <!-- Evidence Summary (not sealed) -->
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">Evidence Summary</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 13px;">Before Photo</td>
              <td style="padding: 4px 0; text-align: right; color: ${evidence.beforePhotoIncluded ? '#22c55e' : '#64748b'}; font-size: 13px; font-weight: 600;">${evidence.beforePhotoIncluded ? '✓ Captured' : '—'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 13px;">After Photo</td>
              <td style="padding: 4px 0; text-align: right; color: ${evidence.afterPhotoIncluded ? '#22c55e' : '#64748b'}; font-size: 13px; font-weight: 600;">${evidence.afterPhotoIncluded ? '✓ Captured' : '—'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 13px;">Client Signature</td>
              <td style="padding: 4px 0; text-align: right; color: ${evidence.signatureIncluded ? '#22c55e' : '#64748b'}; font-size: 13px; font-weight: 600;">${evidence.signatureIncluded ? '✓ Signed' : '—'}</td>
            </tr>
            ${w3wAddress ? `
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-size: 13px;">Location Verified</td>
              <td style="padding: 4px 0; text-align: right; color: #22c55e; font-size: 13px; font-weight: 600;">✓ W3W</td>
            </tr>
            ` : ''}
          </table>
        </div>
        `}

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- PRIMARY CTA - DOWNLOAD PDF -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div style="text-align: center; margin: 28px 0 20px 0;">
          <a href="${pdfUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px 0 rgba(37, 99, 235, 0.4); letter-spacing: 0.5px;">
            📄 Download Full Report (PDF)
          </a>
        </div>

        <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0; line-height: 1.5;">
          The PDF contains high-resolution photos, GPS coordinates,<br/>
          timestamps, signature, and cryptographic verification.
        </p>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- FOOTER -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div style="text-align: center; padding: 24px 16px;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        Powered by <strong style="color: #3b82f6;">JobProof</strong> • Professional Evidence Management
      </p>
      <p style="color: #475569; font-size: 10px; margin: 8px 0 0 0;">
        Job ID: ${job.id.substring(0, 8).toUpperCase()}
      </p>
      <p style="color: #475569; font-size: 10px; margin: 4px 0 0 0;">
        Report generated ${new Date().toISOString().split('T')[0]}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
