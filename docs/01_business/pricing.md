# Pricing Strategy

**Last Updated:** 2024-01-16

---

## Tiered SaaS Pricing

| Plan | Jobs/Month | Monthly Price | Annual Price | Target Customer |
|------|------------|---------------|--------------|-----------------|
| **Starter** | 5-25 | $49 | $470 (20% off) | Solo contractors |
| **Professional** | 25-100 | $99 | $950 (20% off) | Small teams (5-10 techs) |
| **Business** | 100-500 | $199 | $1,910 (20% off) | Mid-size companies (10-50 techs) |
| **Enterprise** | 500+ | Custom | Custom | Large organisations (50+ techs) |

---

## Plan Features Matrix

| Feature | Starter | Professional | Business | Enterprise |
|---------|---------|--------------|----------|------------|
| **Jobs per month** | 25 | 100 | 500 | Unlimited |
| **Technicians** | 2 | 10 | 50 | Unlimited |
| **Clients** | Unlimited | Unlimited | Unlimited | Unlimited |
| **Photo storage** | 1 GB | 10 GB | 100 GB | Custom |
| **Admin users** | 1 | 3 | 10 | Unlimited |
| **Magic links** | ✅ | ✅ | ✅ | ✅ |
| **Offline mode** | ✅ | ✅ | ✅ | ✅ |
| **PDF export** | ✅ | ✅ | ✅ | ✅ |
| **Location tracking** | ✅ | ✅ | ✅ | ✅ |
| **Digital signatures** | ✅ | ✅ | ✅ | ✅ |
| **Safety checklists** | ✅ | ✅ | ✅ | ✅ |
| **Email support** | ✅ | ✅ | ✅ | Priority |
| **QuickBooks integration** | Add-on | Add-on | ✅ Included | ✅ Included |
| **Salesforce integration** | ❌ | Add-on | ✅ Included | ✅ Included |
| **Real-time dashboard** | ❌ | ❌ | ✅ | ✅ |
| **Custom branding** | ❌ | ❌ | Add-on | ✅ Included |
| **SSO (SAML)** | ❌ | ❌ | ❌ | ✅ |
| **Dedicated account manager** | ❌ | ❌ | ❌ | ✅ |
| **SLA guarantee** | ❌ | ❌ | 99.5% | 99.9% |

---

## Add-Ons (All Plans)

| Add-On | One-Time Fee | Monthly Fee | Description |
|--------|--------------|-------------|-------------|
| **QuickBooks Integration** | $500 | - | Auto-sync invoices and clients |
| **Salesforce Integration** | $1,000 | - | Bi-directional CRM sync |
| **White-Label Branding** | - | +$50/mo | Your logo, colors, domain |
| **Custom Domain** | - | +$20/mo | yourcompany.jobproof.app |
| **Advanced Analytics** | - | +$30/mo | Custom reports, dashboards |
| **Additional Storage (100GB)** | - | +$10/mo | Beyond plan limits |
| **API Access** | - | +$50/mo | REST API for custom integrations |

---

## Unit Economics

### Professional Plan Example

```
Revenue: $99/month

Costs:
- Infrastructure (Supabase + Vercel): $2.50/month
- Support (amortized): $5/month
- Sales & Marketing (CAC recovery): $30/month
- Payment processing (2.9% + $0.30): $3.20/month

= Gross Margin: $58.30/month (59%)
```

### Customer Lifetime Value (LTV)

**Assumptions:**
- Average customer retention: 24 months
- Average plan: Professional ($99/mo)

```
LTV = $99/mo × 24 months = $2,376

CAC (Customer Acquisition Cost) = $360
  - Paid ads: $150
  - Sales time: $150
  - Onboarding: $60

LTV/CAC Ratio = $2,376 / $360 = 6.6x ✅
```

**Healthy SaaS Benchmarks:**
- LTV/CAC > 3x (we're at 6.6x ✅)
- CAC payback < 12 months (we're at 3.6 months ✅)
- Gross margin > 70% (we're at 59%, acceptable for early stage)

---

## Infrastructure Costs (Monthly)

### Free Tier (0-100 jobs/month)
- Supabase: **$0** (500MB DB + 1GB storage)
- Vercel: **$0** (100GB bandwidth)
- **Total: $0/month** (100% margin)

### Growth Tier (100-1,000 jobs/month)
- Supabase Pro: **$25/month** (8GB DB + 100GB storage)
- Vercel Hobby: **$0** (still free!)
- **Total: $25/month**

### Scale Tier (1,000-10,000 jobs/month)
- Supabase Pro: **$25/month**
- Vercel Pro: **$20/month** (1TB bandwidth)
- **Total: $45/month**

### Enterprise Tier (10,000+ jobs/month)
- Supabase Team: **$599/month** (custom limits)
- Vercel Enterprise: **$500-1,000/month**
- **Total: $1,100-1,600/month**

---

## Revenue Projections

### Year 1 Targets

| Quarter | Customers | Avg Plan | MRR | ARR |
|---------|-----------|----------|-----|-----|
| **Q1** | 20 | $75 | $1,500 | $18,000 |
| **Q2** | 100 | $85 | $8,500 | $102,000 |
| **Q3** | 250 | $95 | $23,750 | $285,000 |
| **Q4** | 500 | $100 | $50,000 | $600,000 |

**Year 1 ARR Target:** $600,000

### Year 2 Targets

| Quarter | Customers | Avg Plan | MRR | ARR |
|---------|-----------|----------|-----|-----|
| **Q1** | 750 | $105 | $78,750 | $945,000 |
| **Q2** | 1,000 | $110 | $110,000 | $1,320,000 |
| **Q3** | 1,250 | $115 | $143,750 | $1,725,000 |
| **Q4** | 1,500 | $120 | $180,000 | $2,160,000 |

**Year 2 ARR Target:** $2,160,000

---

## Pricing Psychology

### Anchoring Strategy
- **Starter** is intentionally low ($49) to get users in the door
- **Professional** is the "Goldilocks" plan (most will choose this)
- **Business** creates enterprise credibility
- **Enterprise** is high-touch, high-value (custom pricing)

### Feature Gating
- **Pain killers** (magic links, offline, PDF) available on all plans
- **Vitamins** (analytics, branding, SSO) gated to higher tiers
- **Integrations** as add-ons create expansion revenue

### Annual Discount
- 20% off encourages annual commitment
- Improves cash flow
- Reduces churn risk

---

## Competitive Pricing Comparison

| Competitor | Entry Price | Target Market | Our Advantage |
|------------|-------------|---------------|---------------|
| **ServiceTitan** | $199/mo | Large companies | We're 4x cheaper for small teams |
| **FieldEdge** | $99/mo | Mid-market | We have offline-first + dual location |
| **Housecall Pro** | $125/mo | Small teams | We're 26% cheaper + better UX |
| **Jobber** | $129/mo | Small-mid teams | We're 31% cheaper + immutable evidence |

**Value Positioning:** Premium features at mid-market pricing.

---

## Discounts & Promotions

### Launch Promotion (First 100 Customers)
- **50% off for 3 months** on any plan
- **Free QuickBooks integration** ($500 value)
- Lifetime "Founding Member" badge

### Referral Program
- **20% recurring commission** for referrer
- **20% discount** for referee (first 3 months)
- Paid out monthly via Stripe Connect

### Non-Profit Discount
- **30% off** any plan (verified via TechSoup)

### Educational Institutions
- **50% off** for training/vocational programs

---

## Pricing Experiments to Run

### A/B Test 1: Starter Plan Pricing
- **Control:** $49/mo
- **Variant:** $39/mo
- **Hypothesis:** Lower price increases conversion by 30%+
- **Measure:** Conversion rate, LTV

### A/B Test 2: Annual Discount
- **Control:** 20% off
- **Variant:** 2 months free (equivalent to 17% off)
- **Hypothesis:** "2 months free" framing increases annual uptake
- **Measure:** Annual plan adoption rate

### A/B Test 3: Feature Bundling
- **Control:** QuickBooks as $500 add-on
- **Variant:** Included in Professional plan at $119/mo
- **Hypothesis:** Bundling increases ARPU
- **Measure:** ARPU, upgrade rate

---

## Churn Mitigation Strategy

### At-Risk Indicators
- No jobs created in 14 days
- <50% of plan limit used consistently
- Support tickets with "expensive" or "not using"

### Retention Tactics
1. **Usage emails:** "You have 80 unused jobs this month!"
2. **Downgrade offer:** "Switch to Starter and save $50/mo"
3. **Feature education:** "Did you know you can...?"
4. **Win-back offer:** "Come back for 40% off for 6 months"

### Target Churn: <5%/month

---

## Enterprise Pricing Model

**Custom Pricing Based On:**
1. Number of technicians (per-seat pricing)
2. Monthly job volume
3. Storage requirements (photos/videos)
4. Integration needs
5. SLA requirements (99.5% vs 99.9%)
6. Training and onboarding services

**Example Enterprise Quote:**
- 100 technicians
- 2,000 jobs/month
- 500GB storage
- QuickBooks + Salesforce integrations
- 99.9% SLA
- Dedicated account manager

**Price:** $2,000-3,000/month ($24K-36K annually)

---

## Pricing FAQ

**Q: Can I change plans mid-month?**
A: Yes, you'll be prorated for the remainder of the month.

**Q: What happens if I exceed my job limit?**
A: Overage fees: $2/job over limit. We'll notify you at 80% and 100% usage.

**Q: Do I get a refund if I cancel?**
A: Monthly plans: No refunds (cancel anytime). Annual plans: Prorated refund after 60 days.

**Q: Is there a free trial?**
A: Yes, 14-day free trial on all plans. No credit card required.

**Q: Can I export my data if I leave?**
A: Yes, full data export available (CSV + ZIP of all photos).

**Q: Are there setup fees?**
A: No setup fees for self-service plans. Enterprise may have implementation fees.

---

## Pricing Decision Log

| Date | Change | Rationale |
|------|--------|-----------|
| 2024-01-16 | Initial pricing set | Competitive analysis + unit economics |
| TBD | Price increase test | After 100 customers, test 10% increase |
| TBD | Enterprise tier launch | After 10 business plan customers |

---

**Next Steps:**
1. Implement Stripe billing integration
2. Build pricing page UI
3. Set up usage tracking (jobs/month per customer)
4. Create upgrade flow (self-service)
5. Design enterprise quote calculator
