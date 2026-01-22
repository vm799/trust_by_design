import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.10.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate Stripe configuration
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Payment service not configured. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia'
    })

    // Parse request body
    const { priceId, tier, billingPeriod } = await req.json()

    // Validate price ID
    if (!priceId || typeof priceId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid price ID. Please select a valid plan.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate Stripe price ID format (should start with 'price_')
    if (!priceId.startsWith('price_')) {
      console.error('Invalid Stripe price ID format:', priceId)
      return new Response(
        JSON.stringify({ error: 'Invalid pricing configuration. Please contact support.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: 'Service configuration error. Please contact support.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error('Auth error:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Session expired. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Build checkout session configuration
    const origin = req.headers.get('origin') || 'https://jobproof.app'

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${origin}/#/admin?subscription=success&tier=${tier || 'unknown'}`,
      cancel_url: `${origin}/#/pricing?cancelled=true`,
      metadata: {
        user_id: user.id,
        tier: tier || 'unknown',
        billing_period: billingPeriod || 'monthly',
      },
      // 14-day free trial for all paid plans
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: user.id,
          tier: tier || 'unknown',
        },
      },
      // Allow promotion codes
      allow_promotion_codes: true,
      // Collect billing address for tax purposes
      billing_address_collection: 'required',
      // Automatic tax calculation (if enabled in Stripe)
      automatic_tax: { enabled: true },
    }

    // Use existing customer or create by email
    if (profile?.stripe_customer_id) {
      sessionConfig.customer = profile.stripe_customer_id
    } else {
      sessionConfig.customer_email = user.email
      // Update customer after creation via webhook
      sessionConfig.customer_creation = 'always'
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig)

    if (!session.url) {
      console.error('Stripe session created but no URL returned')
      return new Response(
        JSON.stringify({ error: 'Failed to create checkout session. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Checkout session created for user ${user.id}: ${session.id}`)

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Checkout error:', error)

    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      const message = error.type === 'StripeInvalidRequestError'
        ? 'Invalid pricing configuration. Please contact support.'
        : 'Payment service error. Please try again.'

      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
