import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.10.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Validate configuration
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 })
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' })
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 })
  }

  const body = await req.text()

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log(`Processing Stripe webhook: ${event.type}`)

    // Handle checkout completion
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Skip if not a subscription
      if (session.mode !== 'subscription' || !session.subscription) {
        console.log('Non-subscription checkout, skipping')
        return new Response(JSON.stringify({ received: true }), { status: 200 })
      }

      const userId = session.metadata?.user_id
      if (!userId) {
        console.error('No user_id in session metadata')
        return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400 })
      }

      // Retrieve subscription details
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = subscription.items.data[0]?.price.id

      // Determine tier from metadata or price ID mapping
      let tier = session.metadata?.tier || 'solo'

      // Fallback: map price ID to tier
      if (tier === 'unknown' && priceId) {
        const priceToTier: Record<string, string> = {}
        const teamMonthly = Deno.env.get('STRIPE_PRICE_TEAM_MONTHLY')
        const teamAnnual = Deno.env.get('STRIPE_PRICE_TEAM_ANNUAL')
        const agencyMonthly = Deno.env.get('STRIPE_PRICE_AGENCY_MONTHLY')
        const agencyAnnual = Deno.env.get('STRIPE_PRICE_AGENCY_ANNUAL')

        if (teamMonthly) priceToTier[teamMonthly] = 'team'
        if (teamAnnual) priceToTier[teamAnnual] = 'team'
        if (agencyMonthly) priceToTier[agencyMonthly] = 'agency'
        if (agencyAnnual) priceToTier[agencyAnnual] = 'agency'

        tier = priceToTier[priceId] || 'team'
      }

      const customerId = session.customer as string

      // Update user profile with Stripe customer ID
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)

      if (userUpdateError) {
        console.error('Failed to update user stripe_customer_id:', userUpdateError)
      }

      // Upsert subscription record
      const { error: subError } = await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        tier,
        status: subscription.status === 'trialing' ? 'trialing' : 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        billing_period: session.metadata?.billing_period || 'monthly',
      }, { onConflict: 'user_id' })

      if (subError) {
        console.error('Failed to upsert subscription:', subError)
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 })
      }

      console.log(`Subscription created for user ${userId}: ${tier} (${subscription.status})`)
    }

    // Handle subscription updates
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription

      const statusMap: Record<string, string> = {
        active: 'active',
        trialing: 'trialing',
        past_due: 'past_due',
        canceled: 'canceled',
        unpaid: 'unpaid',
        incomplete: 'incomplete',
        incomplete_expired: 'expired',
        paused: 'paused',
      }

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: statusMap[subscription.status] || subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq('stripe_subscription_id', subscription.id)

      if (error) {
        console.error('Failed to update subscription:', error)
      } else {
        console.log(`Subscription ${subscription.id} updated to ${subscription.status}`)
      }
    }

    // Handle subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)

      if (error) {
        console.error('Failed to mark subscription as canceled:', error)
      } else {
        console.log(`Subscription ${subscription.id} canceled`)
      }
    }

    // Handle trial ending soon (3 days before)
    if (event.type === 'customer.subscription.trial_will_end') {
      const subscription = event.data.object as Stripe.Subscription
      console.log(`Trial ending soon for subscription ${subscription.id}`)
      // Could trigger email notification here
    }

    // Handle payment failures
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      console.log(`Payment failed for invoice ${invoice.id}`)
      // Could trigger email notification here
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 400 }
    )
  }
})
