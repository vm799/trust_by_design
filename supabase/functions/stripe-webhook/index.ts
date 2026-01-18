import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.10.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-11-20.acacia'
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  try {
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata!.user_id
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      )
      const priceId = subscription.items.data[0].price.id

      const tierMap: Record<string, string> = {
        [Deno.env.get('VITE_STRIPE_PRICE_TEAM_MONTHLY')!]: 'team',
        [Deno.env.get('VITE_STRIPE_PRICE_TEAM_ANNUAL')!]: 'team',
        [Deno.env.get('VITE_STRIPE_PRICE_AGENCY_MONTHLY')!]: 'agency',
        [Deno.env.get('VITE_STRIPE_PRICE_AGENCY_ANNUAL')!]: 'agency'
      }

      await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        tier: tierMap[priceId] || 'solo',
        status: 'active',
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString()
      })
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription
      const status =
        subscription.status === 'active' ? 'active' : 'canceled'

      await supabase
        .from('user_subscriptions')
        .update({
          status,
          current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString()
        })
        .eq('stripe_subscription_id', subscription.id)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400
    })
  }
})
