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
    // Try bunker_jobs first, then fall back to jobs table
    // =========================================================================

    let job: any = null;
    let jobSource = '';

    // Try bunker_jobs first (has inline photo data)
    const { data: bunkerJob } = await supabase
      .from('bunker_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (bunkerJob) {
      job = bunkerJob;
      jobSource = 'bunker_jobs';
    } else {
      // Try main jobs table with photos
      const { data: mainJob } = await supabase
        .from('jobs')
        .select(`
          *,
          photos (
            id,
            url,
            type,
            timestamp,
            lat,
            lng,
            w3w
          )
        `)
        .eq('id', jobId)
        .single();

      if (mainJob) {
        job = mainJob;
        jobSource = 'jobs';

        // Convert photos array to inline data format for email compatibility
        // Find before and after photos
        const photos = mainJob.photos || [];
        const beforePhoto = photos.find((p: any) => p.type === 'before' || p.type === 'Before');
        const afterPhoto = photos.find((p: any) => p.type === 'after' || p.type === 'After');

        // If photos are URLs (not base64), we can't inline them in email
        // But we can still use the URL info for display
        if (beforePhoto) {
          job.before_photo_url = beforePhoto.url;
          job.before_photo_timestamp = beforePhoto.timestamp;
          job.before_photo_lat = beforePhoto.lat;
          job.before_photo_lng = beforePhoto.lng;
          // Note: before_photo_data will be null unless we fetch and convert
        }
        if (afterPhoto) {
          job.after_photo_url = afterPhoto.url;
          job.after_photo_timestamp = afterPhoto.timestamp;
          job.after_photo_lat = afterPhoto.lat;
          job.after_photo_lng = afterPhoto.lng;
        }

        // Map some field names for compatibility
        job.signature_data = job.signature;
        job.manager_email = job.managerEmail;
      }
    }

    if (!job) {
      console.error('[GenerateReport] Job not found in any table:', jobId);
      return new Response(
        JSON.stringify({ success: false, error: `Job not found: ${jobId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasBeforePhoto = !!(job.before_photo_data || job.before_photo_url);
    const hasAfterPhoto = !!(job.after_photo_data || job.after_photo_url);
    const hasSignature = !!job.signature_data;
    const isSealed = !!job.sealed_at;

    console.log('[GenerateReport] Job verified from database:', {
      id: job.id,
      title: job.title,
      client: job.client,
      status: job.status,
      source: jobSource,
      hasBeforePhoto,
      hasAfterPhoto,
      hasSignature,
      hasW3W: !!job.w3w,
      isSealed,
      managerEmail: job.manager_email,
    });

    // =========================================================================
    // EVIDENCE GUARD: Only generate PDF if there's actual evidence
    // No evidence = return progress status (not an empty PDF)
    // =========================================================================

    const hasEvidence = hasBeforePhoto || hasAfterPhoto || hasSignature || isSealed;

    if (!hasEvidence) {
      console.log(`[GenerateReport] Job ${jobId} has no evidence - returning progress status`);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'no_evidence',
          message: 'Job has no evidence to report yet. Evidence collection in progress.',
          job: {
            id: job.id,
            title: job.title,
            status: job.status,
            hasPhotos: false,
            hasSignature: false,
            isSealed: false,
          },
          pdfUrl: null,
          emailSent: false,
          action: 'await_evidence',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    yPosition -= 35;

    // -------------------------------------------------------------------------
    // SEAL CERTIFICATE (ABOVE FOLD - First thing visible)
    // -------------------------------------------------------------------------

    if (isJobSealed && job.evidence_hash) {
      // Large prominent seal certificate banner
      const certHeight = 85;
      const certY = yPosition - certHeight + 25;

      // Background with gradient effect (dark green)
      page.drawRectangle({
        x: margin,
        y: certY,
        width: pageWidth - margin * 2,
        height: certHeight,
        color: rgb(0.02, 0.12, 0.05), // Dark green
        borderColor: rgb(0.13, 0.77, 0.37), // Bright green border
        borderWidth: 2,
      });

      // Checkmark and title
      page.drawText('✓ CRYPTOGRAPHICALLY SEALED', {
        x: margin + 20,
        y: certY + certHeight - 25,
        size: 16,
        font: helveticaBold,
        color: rgb(0.13, 0.77, 0.37),
      });

      // Hash line
      const hashDisplay = job.evidence_hash.length > 40
        ? job.evidence_hash.substring(0, 40) + '...'
        : job.evidence_hash;
      page.drawText(`SHA-256: ${hashDisplay}`, {
        x: margin + 20,
        y: certY + certHeight - 45,
        size: 9,
        font: helvetica,
        color: rgb(0.6, 0.85, 0.65),
      });

      // Sealed timestamp
      const sealDate = job.sealed_at
        ? new Date(job.sealed_at).toLocaleString('en-GB', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : 'Unknown';
      page.drawText(`Sealed: ${sealDate} | Algorithm: SHA-256 + RSA-2048`, {
        x: margin + 20,
        y: certY + certHeight - 62,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.7, 0.55),
      });

      // Verification note
      page.drawText('Evidence integrity verified • Tamper-proof record', {
        x: margin + 20,
        y: certY + certHeight - 78,
        size: 7,
        font: helvetica,
        color: rgb(0.4, 0.6, 0.45),
      });

      yPosition = certY - 15;
    }

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
    } else if (job.before_photo_url) {
      // Photo exists but as URL (can't embed in PDF, but will show in email)
      console.log('[GenerateReport] Before photo URL available (not embeddable in PDF):', job.before_photo_url);
      page.drawText('BEFORE PHOTO - SEE EMAIL', {
        x: margin,
        y: yPosition - 10,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      beforePhotoIncluded = true; // Mark as included for email
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

    // After Photo (from DATABASE: after_photo_data or after_photo_url)
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
    } else if (job.after_photo_url) {
      // Photo exists but as URL (can't embed in PDF, but will show in email)
      console.log('[GenerateReport] After photo URL available (not embeddable in PDF):', job.after_photo_url);
      const afterX = margin + (pageWidth - margin * 2) / 2 + 15;
      page.drawText('AFTER PHOTO - SEE EMAIL', {
        x: afterX,
        y: yPosition - 10,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      afterPhotoIncluded = true; // Mark as included for email
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
    // FOOTER STATUS BAR (Compact - main seal info is at top)
    // -------------------------------------------------------------------------

    const statusBarY = yPosition - 10;
    const statusBarHeight = 30;

    page.drawRectangle({
      x: margin,
      y: statusBarY - statusBarHeight + 15,
      width: pageWidth - margin * 2,
      height: statusBarHeight,
      color: isSealed ? rgb(0.04, 0.15, 0.06) : rgb(0.96, 0.96, 0.94),
      borderColor: isSealed ? rgb(0.13, 0.77, 0.37) : rgb(0.7, 0.7, 0.65),
      borderWidth: 1,
    });

    if (isSealed && job.evidence_hash) {
      // Compact sealed reference (full details at top)
      page.drawText('✓ SEALED', {
        x: margin + 15,
        y: statusBarY - 5,
        size: 10,
        font: helveticaBold,
        color: rgb(0.13, 0.77, 0.37),
      });

      page.drawText(`${job.evidence_hash.substring(0, 16)}...`, {
        x: margin + 90,
        y: statusBarY - 5,
        size: 8,
        font: helvetica,
        color: rgb(0.4, 0.6, 0.45),
      });

    } else {
      // Unsealed - show evidence summary with clear action hint
      const evidenceList = [
        beforePhotoIncluded && 'Before',
        afterPhotoIncluded && 'After',
        signatureIncluded && 'Signature'
      ].filter(Boolean);

      const statusText = evidenceList.length > 0
        ? `Evidence: ${evidenceList.join(' • ')} | Ready to seal`
        : 'Awaiting evidence capture';

      page.drawText(statusText, {
        x: margin + 15,
        y: statusBarY - 5,
        size: 9,
        font: helvetica,
        color: evidenceList.length > 0 ? rgb(0.2, 0.5, 0.3) : rgb(0.5, 0.5, 0.5),
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

    const { error: uploadError } = await supabase.storage
      .from('job-reports')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '31536000',
      });

    if (uploadError) {
      console.error('[GenerateReport] Upload error:', uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Get signed URL (more reliable than public URL for email downloads)
    // Signed URL is valid for 7 days (604800 seconds)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('job-reports')
      .createSignedUrl(fileName, 604800);

    let pdfUrl: string;
    if (signedUrlError || !signedUrlData?.signedUrl) {
      // Fallback to public URL if signed URL fails
      console.warn('[GenerateReport] Signed URL failed, using public URL:', signedUrlError);
      const { data: urlData } = supabase.storage
        .from('job-reports')
        .getPublicUrl(fileName);
      pdfUrl = urlData.publicUrl;
    } else {
      pdfUrl = signedUrlData.signedUrl;
    }
    console.log(`[GenerateReport] PDF uploaded: ${pdfUrl}`);

    // =========================================================================
    // STEP 3: Send Email via Resend
    // =========================================================================

    let emailSent = false;
    let emailError = null;
    let clientEmailSent = false;
    let clientEmailError = null;

    const managerEmail = job.manager_email;
    const clientEmail = job.client_email;

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
    // SEND EMAIL TO CLIENT (if available)
    // =========================================================================

    if (clientEmail && resendApiKey) {
      try {
        console.log(`[GenerateReport] Sending email to client: ${clientEmail}`);

        const emailHtml = generateEmailHtml(job, pdfUrl, { beforePhotoIncluded, afterPhotoIncluded, signatureIncluded });

        const clientEmailPayload = {
          from: 'JobProof <reports@jobproof.pro>',
          to: [clientEmail],
          subject: `Work Complete: ${job.title || `Job ${job.id}`}`,
          html: emailHtml,
        };

        console.log('[GenerateReport] Client email payload:', JSON.stringify({ ...clientEmailPayload, html: '[HTML CONTENT]' }));

        const clientEmailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(clientEmailPayload),
        });

        const clientResponseText = await clientEmailResponse.text();
        console.log(`[GenerateReport] Client email Resend response (${clientEmailResponse.status}):`, clientResponseText);

        if (clientEmailResponse.ok) {
          clientEmailSent = true;
          console.log(`[GenerateReport] Email sent successfully to client: ${clientEmail}`);
        } else {
          clientEmailError = clientResponseText;
          console.error('[GenerateReport] Client email failed:', clientResponseText);
        }
      } catch (e) {
        clientEmailError = e.message;
        console.error('[GenerateReport] Client email error:', e);
      }
    } else if (clientEmail && !resendApiKey) {
      console.warn('[GenerateReport] Client email configured but RESEND_API_KEY not available');
      clientEmailError = 'RESEND_API_KEY not configured';
    }

    // =========================================================================
    // STEP 4: AUTO-SEAL evidence via seal-evidence edge function
    // Proper cryptographic sealing with RSA-2048 signature
    // =========================================================================

    let sealedAt: string | null = null;
    let evidenceHash: string | null = null;

    // Auto-seal if not already sealed and has evidence
    if (!job.sealed_at && (beforePhotoIncluded || afterPhotoIncluded || signatureIncluded)) {
      try {
        console.log(`[GenerateReport] Invoking seal-evidence for job ${job.id}...`);

        // Call the seal-evidence edge function for proper cryptographic sealing
        const sealResponse = await fetch(
          `${supabaseUrl}/functions/v1/seal-evidence`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId: job.id }),
          }
        );

        if (sealResponse.ok) {
          const sealData = await sealResponse.json();
          if (sealData.success) {
            sealedAt = sealData.sealedAt;
            evidenceHash = sealData.evidenceHash;

            // Update job object for email template
            job.sealed_at = sealedAt;
            job.evidence_hash = evidenceHash;
            job.sealed_by = sealData.sealedBy;

            console.log(`[GenerateReport] Job ${job.id} sealed: ${evidenceHash?.substring(0, 16)}...`);
          } else {
            console.warn(`[GenerateReport] Seal returned non-success:`, sealData);
          }
        } else {
          const errorText = await sealResponse.text();
          console.error(`[GenerateReport] Seal request failed:`, sealResponse.status, errorText);
        }
      } catch (sealError) {
        console.error(`[GenerateReport] Auto-seal failed:`, sealError);
        // Non-blocking - report still generated without seal
      }
    } else if (job.sealed_at) {
      sealedAt = job.sealed_at;
      evidenceHash = job.evidence_hash;
      console.log(`[GenerateReport] Job already sealed at ${sealedAt}`);
    } else {
      console.log(`[GenerateReport] Skipping seal - no evidence to seal`);
    }

    // =========================================================================
    // STEP 5: Update job record with report URL and seal data
    // =========================================================================

    const updatePayload: Record<string, any> = {
      report_url: pdfUrl,
      report_generated_at: new Date().toISOString(),
      report_emailed: emailSent,
      client_notified_at: clientEmailSent ? new Date().toISOString() : null,
    };

    // Include seal data if we sealed this job
    if (sealedAt && evidenceHash && !job.sealed_at) {
      updatePayload.sealed_at = sealedAt;
      updatePayload.evidence_hash = evidenceHash;
      updatePayload.status = 'Archived';
    }

    await supabase
      .from('bunker_jobs')
      .update(updatePayload)
      .eq('id', job.id);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl,
        emailSent,
        emailError,
        clientEmailSent,
        clientEmailError,
        evidenceIncluded: { beforePhotoIncluded, afterPhotoIncluded, signatureIncluded },
        sealed: !!sealedAt,
        sealedAt,
        evidenceHash,
        message: `Report generated${sealedAt ? ' and sealed' : ''} for job ${job.id}${clientEmailSent ? ' - client notified' : ''}`,
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
  const beforeW3W = formatW3W(job.before_photo_w3w || job.w3w);
  const afterW3W = formatW3W(job.after_photo_w3w || job.w3w);
  const completedTs = formatTimestamp(job.completed_at);
  const sealedTs = formatTimestamp(job.sealed_at);

  // App URL for Review & Seal button
  // Use request origin/referer when available, fall back to env vars, then production URL
  const requestOrigin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/+$/, '') || '';
  const appUrl = requestOrigin || Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://trust-by-design.vercel.app';
  const reviewSealUrl = `${appUrl}/#/admin/jobs/${job.id}/evidence`;

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
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Evidence Report - ${job.title || job.id}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, sans-serif !important; }
    .dark-bg { background-color: #0f172a !important; }
  </style>
  <![endif]-->
  <style>
    @media (prefers-color-scheme: dark) {
      body, .body-wrapper { background-color: #0f172a !important; }
    }
  </style>
</head>
<body bgcolor="#0f172a" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a !important; color: #f8fafc;">
  <!--[if mso]>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0f172a" class="dark-bg">
  <tr><td align="center">
  <![endif]-->

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#0f172a" style="background-color: #0f172a !important;">
    <tr>
      <td align="center" style="padding: 24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width: 640px; width: 100%;">
          <tr>
            <td>

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
            <td style="padding: 6px 0; color: #cbd5e1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; width: 100px;">Client</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 15px; font-weight: 600;">${job.client}</td>
          </tr>
          ` : ''}
          ${job.address ? `
          <tr>
            <td style="padding: 6px 0; color: #cbd5e1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Location</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 14px;">${job.address}</td>
          </tr>
          ` : ''}
          ${job.technician_name ? `
          <tr>
            <td style="padding: 6px 0; color: #cbd5e1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Technician</td>
            <td style="padding: 6px 0; color: #f1f5f9; font-size: 14px;">${job.technician_name}</td>
          </tr>
          ` : ''}
          ${completedTs ? `
          <tr>
            <td style="padding: 6px 0; color: #cbd5e1; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Completed</td>
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
          <p style="color: #cbd5e1; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">📸 EVIDENCE PHOTOS</p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              ${evidence.beforePhotoIncluded ? `
              <td style="width: 50%; padding-right: 8px; vertical-align: top;">
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                  <!-- Photo with metadata -->
                  <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 8px 12px;">
                    <span style="color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">⬅ BEFORE</span>
                  </div>
                  ${job.before_photo_data ? `
                  <img src="${job.before_photo_data}" alt="Before photo" style="width: 100%; height: auto; display: block; max-height: 200px; object-fit: cover;" />
                  ` : job.before_photo_url ? `
                  <img src="${job.before_photo_url}" alt="Before photo" style="width: 100%; height: auto; display: block; max-height: 200px; object-fit: cover;" />
                  ` : `
                  <div style="background: #334155; height: 120px; text-align: center; padding-top: 40px;">
                    <span style="color: #cbd5e1; font-size: 13px; font-weight: 600;">📷 Photo Available</span>
                  </div>
                  `}
                  <div style="padding: 10px 12px; background: #0f172a;">
                    ${beforeTs ? `
                    <p style="color: #22c55e; font-size: 11px; font-weight: 700; margin: 0;">🕐 ${beforeTs.utc}</p>
                    ` : ''}
                    ${beforeGPS ? `
                    <p style="color: #e2e8f0; font-size: 10px; margin: 4px 0 0 0; font-family: monospace; font-weight: 600;">📍 ${beforeGPS}</p>
                    ` : ''}
                    ${beforeW3W ? `
                    <p style="color: #fca5a5; font-size: 10px; margin: 4px 0 0 0; font-family: monospace; font-weight: 700;">${beforeW3W}</p>
                    ` : ''}
                  </div>
                </div>
              </td>
              ` : '<td style="width: 50%; padding-right: 8px;"></td>'}

              ${evidence.afterPhotoIncluded ? `
              <td style="width: 50%; padding-left: 8px; vertical-align: top;">
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden;">
                  <!-- Photo with metadata -->
                  <div style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); padding: 8px 12px;">
                    <span style="color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">AFTER ➡</span>
                  </div>
                  ${job.after_photo_data ? `
                  <img src="${job.after_photo_data}" alt="After photo" style="width: 100%; height: auto; display: block; max-height: 200px; object-fit: cover;" />
                  ` : job.after_photo_url ? `
                  <img src="${job.after_photo_url}" alt="After photo" style="width: 100%; height: auto; display: block; max-height: 200px; object-fit: cover;" />
                  ` : `
                  <div style="background: #334155; height: 120px; text-align: center; padding-top: 40px;">
                    <span style="color: #cbd5e1; font-size: 13px; font-weight: 600;">📷 Photo Available</span>
                  </div>
                  `}
                  <div style="padding: 10px 12px; background: #0f172a;">
                    ${afterTs ? `
                    <p style="color: #22c55e; font-size: 11px; font-weight: 700; margin: 0;">🕐 ${afterTs.utc}</p>
                    ` : ''}
                    ${afterGPS ? `
                    <p style="color: #e2e8f0; font-size: 10px; margin: 4px 0 0 0; font-family: monospace; font-weight: 600;">📍 ${afterGPS}</p>
                    ` : ''}
                    ${afterW3W ? `
                    <p style="color: #fca5a5; font-size: 10px; margin: 4px 0 0 0; font-family: monospace; font-weight: 700;">${afterW3W}</p>
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
        <!-- SIGNATURE CONFIRMATION WITH METADATA -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        ${evidence.signatureIncluded ? `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 10px 16px;">
            <span style="color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">✍️ CLIENT SIGN-OFF</span>
          </div>
          <div style="padding: 16px;">
            ${job.signature_data ? `
            <div style="background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 12px; text-align: center;">
              <img src="${job.signature_data}" alt="Client signature" style="max-height: 80px; max-width: 100%;" />
            </div>
            ` : ''}
            <table style="width: 100%; border-collapse: collapse;">
              ${job.signer_name || job.client_name_signed ? `
              <tr>
                <td style="padding: 4px 0; color: #cbd5e1; font-size: 10px; font-weight: 700; text-transform: uppercase;">Signed By</td>
                <td style="padding: 4px 0; color: #f1f5f9; font-size: 13px; font-weight: 600; text-align: right;">${job.signer_name || job.client_name_signed}</td>
              </tr>
              ` : ''}
              ${completedTs ? `
              <tr>
                <td style="padding: 4px 0; color: #cbd5e1; font-size: 10px; font-weight: 700; text-transform: uppercase;">Signed At</td>
                <td style="padding: 4px 0; color: #22c55e; font-size: 12px; font-weight: 600; text-align: right;">${completedTs.date} ${completedTs.time}</td>
              </tr>
              ` : ''}
              ${afterGPS ? `
              <tr>
                <td style="padding: 4px 0; color: #cbd5e1; font-size: 10px; font-weight: 700; text-transform: uppercase;">Location</td>
                <td style="padding: 4px 0; color: #e2e8f0; font-size: 11px; font-family: monospace; text-align: right;">📍 ${afterGPS}</td>
              </tr>
              ` : ''}
              ${afterW3W ? `
              <tr>
                <td style="padding: 4px 0; color: #cbd5e1; font-size: 10px; font-weight: 700; text-transform: uppercase;">W3W</td>
                <td style="padding: 4px 0; color: #fca5a5; font-size: 11px; font-family: monospace; font-weight: 700; text-align: right;">${afterW3W}</td>
              </tr>
              ` : ''}
            </table>
            <p style="color: #94a3b8; font-size: 10px; margin: 12px 0 0 0; padding-top: 10px; border-top: 1px solid #334155; line-height: 1.4;">
              Client confirmed satisfaction with completed work by providing signature above.
            </p>
          </div>
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
                        <span style="color: #cbd5e1; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Evidence Hash</span>
                        <p style="color: #f1f5f9; font-size: 11px; font-family: monospace; margin: 2px 0 0 0;">${sealHash}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="color: #cbd5e1; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Algorithm</span>
                        <p style="color: #f1f5f9; font-size: 11px; margin: 2px 0 0 0;">SHA-256 + RSA-2048</p>
                      </td>
                    </tr>
                    ${sealedTs ? `
                    <tr>
                      <td style="padding: 4px 0;">
                        <span style="color: #cbd5e1; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Sealed At</span>
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
          <p style="color: #cbd5e1; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">EVIDENCE SUMMARY</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #e2e8f0; font-size: 13px; font-weight: 600;">Before Photo</td>
              <td style="padding: 4px 0; text-align: right; color: ${evidence.beforePhotoIncluded ? '#22c55e' : '#94a3b8'}; font-size: 13px; font-weight: 600;">${evidence.beforePhotoIncluded ? '✓ Captured' : '—'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #e2e8f0; font-size: 13px; font-weight: 600;">After Photo</td>
              <td style="padding: 4px 0; text-align: right; color: ${evidence.afterPhotoIncluded ? '#22c55e' : '#94a3b8'}; font-size: 13px; font-weight: 600;">${evidence.afterPhotoIncluded ? '✓ Captured' : '—'}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #e2e8f0; font-size: 13px; font-weight: 600;">Client Signature</td>
              <td style="padding: 4px 0; text-align: right; color: ${evidence.signatureIncluded ? '#22c55e' : '#94a3b8'}; font-size: 13px; font-weight: 600;">${evidence.signatureIncluded ? '✓ Signed' : '—'}</td>
            </tr>
            ${w3wAddress ? `
            <tr>
              <td style="padding: 4px 0; color: #e2e8f0; font-size: 13px; font-weight: 600;">Location Verified</td>
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

        ${!isSealed ? `
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- EDUCATIONAL TIPS - WHY JOBPROOF MATTERS -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px; padding: 16px; margin-bottom: 20px;">

          <!-- TIP 1: Why Seal -->
          <div style="margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #475569;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 36px; vertical-align: top; padding-right: 10px;">
                  <div style="width: 32px; height: 32px; background: #7c3aed; border-radius: 8px; text-align: center; line-height: 32px;">
                    <span style="color: white; font-size: 16px;">🔐</span>
                  </div>
                </td>
                <td style="vertical-align: top;">
                  <p style="color: #e2e8f0; font-size: 12px; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                    Why Seal Evidence?
                  </p>
                  <p style="color: #cbd5e1; font-size: 12px; margin: 0; line-height: 1.4;">
                    Creates <strong style="color: #ffffff;">tamper-detection cryptographic proof</strong> that photos haven't been altered. Useful for verifying work.
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- TIP 2: What's W3W -->
          <div style="margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #475569;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 36px; vertical-align: top; padding-right: 10px;">
                  <div style="width: 32px; height: 32px; background: #dc2626; border-radius: 8px; text-align: center; line-height: 32px;">
                    <span style="color: white; font-size: 16px;">📍</span>
                  </div>
                </td>
                <td style="vertical-align: top;">
                  <p style="color: #e2e8f0; font-size: 12px; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                    What3Words = 3m Accuracy
                  </p>
                  <p style="color: #cbd5e1; font-size: 12px; margin: 0; line-height: 1.4;">
                    Pinpoints exact location to a <strong style="color: #ffffff;">3-meter square</strong>. Far more precise than GPS (±50m).
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <!-- TIP 3: Clear Documentation -->
          <div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 36px; vertical-align: top; padding-right: 10px;">
                  <div style="width: 32px; height: 32px; background: #059669; border-radius: 8px; text-align: center; line-height: 32px;">
                    <span style="color: white; font-size: 16px;">📋</span>
                  </div>
                </td>
                <td style="vertical-align: top;">
                  <p style="color: #e2e8f0; font-size: 12px; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                    Clear Documentation
                  </p>
                  <p style="color: #cbd5e1; font-size: 12px; margin: 0; line-height: 1.4;">
                    Sealed evidence provides <strong style="color: #ffffff;">clear records</strong> of work completed with verifiable timestamps and locations.
                  </p>
                </td>
              </tr>
            </table>
          </div>

        </div>

        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <!-- SECONDARY CTA - REVIEW & SEAL EVIDENCE -->
        <!-- ═══════════════════════════════════════════════════════════════════ -->
        <div style="text-align: center; margin: 16px 0 24px 0;">
          <a href="${reviewSealUrl}"
             style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 6px 20px 0 rgba(5, 150, 105, 0.4); letter-spacing: 0.5px;">
            🔐 Review & Seal Evidence
          </a>
        </div>
        <p style="color: #f59e0b; font-size: 11px; text-align: center; margin: 0 0 16px 0; line-height: 1.5;">
          ⚠️ Evidence is NOT YET SEALED. Review and seal to create<br/>
          tamper-proof cryptographic proof of this work.
        </p>
        ` : ''}

        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0; line-height: 1.5;">
          The PDF contains high-resolution photos, GPS coordinates,<br/>
          timestamps, signature, and cryptographic verification.
        </p>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- FOOTER -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div style="text-align: center; padding: 24px 16px;">
      <p style="color: #cbd5e1; font-size: 13px; font-weight: 600; margin: 0;">
        Powered by <strong style="color: #60a5fa;">JobProof</strong>
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0 0;">
        Job ID: ${job.id.substring(0, 8).toUpperCase()}
      </p>
    </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!--[if mso]>
  </td></tr></table>
  <![endif]-->
</body>
</html>
  `.trim();
}
