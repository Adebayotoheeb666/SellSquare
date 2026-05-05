# Automation System - Environment Variables Setup Guide

This guide explains all the environment variables needed to build and run the automation system for social media engagement, content generation, and registration follow-ups.

## Overview

The automation system has two main components:

1. **Social Media Automation** (TikTok & Instagram)
   - Auto-engagement (likes, relevant comments)
   - Insight generation from posts
   - Auto-posting via 11labs
   - Content idea generation

2. **Registration Follow-up Automation**
   - Email automation
   - WhatsApp automation
   - Campaign management

---

## 1. SOCIAL MEDIA AUTOMATION

### Instagram Graph API

To enable Instagram automation, you'll need:

**Variables:**
- `INSTAGRAM_ACCESS_TOKEN` - Long-lived access token for Instagram Graph API
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` - Your Instagram business account ID
- `INSTAGRAM_APP_ID` - Your Instagram App ID
- `INSTAGRAM_APP_SECRET` - Your Instagram App Secret

**How to get them:**
1. Go to [Meta Developers](https://developers.facebook.com/)
2. Create an app or use existing one
3. Add Instagram Graph API product
4. Generate access token with permissions: `instagram_basic`, `instagram_manage_messages`, `pages_read_engagement`, `pages_manage_posts`
5. Get your Instagram Business Account ID from Settings

**Cost:** Free (unless you exceed API rate limits)

---

### TikTok API

**Variables:**
- `TIKTOK_CLIENT_ID` - Your TikTok App Client ID
- `TIKTOK_CLIENT_SECRET` - Your TikTok App Secret
- `TIKTOK_ACCESS_TOKEN` - OAuth access token
- `TIKTOK_REFRESH_TOKEN` - For refreshing access token
- `TIKTOK_REDIRECT_URI` - Callback URL (e.g., `http://localhost:4000/api/tiktok/callback`)

**How to get them:**
1. Go to [TikTok Developers](https://developers.tiktok.com/)
2. Create a developer account
3. Create an app and request access to:
   - `user.info.basic` - Read basic user info
   - `video.list` - Read videos
   - `video.publish` - Post videos
   - `comment.list` - Read comments
   - `like.list` - Read likes
4. Generate credentials

**Cost:** Free (subject to rate limits)

---

### Social Media Webhook Verification

**Variable:**
- `SOCIAL_WEBHOOK_SECRET` - Secret string for verifying incoming webhooks from social platforms

**How to use:**
- Generate a random string (min 32 characters)
- Use this to verify webhook signatures from Instagram and TikTok
- Example: `SOCIAL_WEBHOOK_SECRET=your_random_32_char_secret_here`

---

## 2. CONTENT GENERATION & AI

### OpenAI API

For generating insights and content ideas from social media posts

**Variables:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - Model to use (recommended: `gpt-4` or `gpt-3.5-turbo`)

**How to get it:**
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up and go to API keys
3. Create a new secret key
4. Copy it to your `.env`

**Cost:** Pay-as-you-go (approximately $0.03-0.06 per 1K tokens depending on model)

**Usage in automation:**
- Generate insights from business posts
- Generate content ideas based on trending topics
- Create captions and hashtags

---

### 11Labs API (Text-to-Speech)

For automatically creating audio/video content from generated text

**Variables:**
- `ELEVEN_LABS_API_KEY` - Your 11labs API key
- `ELEVEN_LABS_VOICE_ID` - Voice ID to use (default: `21m00Tcm4TlvDq8ikWAM` for Rachel)
- `ELEVEN_LABS_VOICE_STABILITY` - Voice stability (0.0-1.0, default: 0.5)
- `ELEVEN_LABS_VOICE_SIMILARITY` - Similarity boost (0.0-1.0, default: 0.75)

**How to get it:**
1. Go to [11labs.io](https://elevenlabs.io/)
2. Sign up and go to API section
3. Copy your API key

**Available voices:** List of voice IDs available [here](https://elevenlabs.io/docs/voices)

**Cost:** Free tier (10k characters/month), paid plans start at $5/month

---

## 3. EMAIL AUTOMATION

### SendGrid (Recommended)

For automated follow-up emails to new registrations

**Variables:**
- `SENDGRID_API_KEY` - Your SendGrid API key
- `SENDGRID_FROM_EMAIL` - Email address to send from
- `SENDGRID_FOLLOW_UP_TEMPLATE_ID` - Template ID for follow-up emails

**How to get it:**
1. Go to [SendGrid](https://sendgrid.com/)
2. Create account and go to API Keys
3. Create a new API key
4. Create email templates in SendGrid for follow-ups
5. Copy template IDs

**Cost:** Free tier (100 emails/day), paid plans start at $19.95/month

**Note:** Already partially configured in your `package.json` dependencies

---

### Mailgun (Alternative)

If you prefer Mailgun instead of SendGrid

**Variables:**
- `MAILGUN_API_KEY` - Your Mailgun API key
- `MAILGUN_DOMAIN` - Your Mailgun domain

**How to get it:**
1. Go to [Mailgun](https://www.mailgun.com/)
2. Create account
3. Add and verify your domain
4. Copy API key

**Cost:** Free tier (up to 100 emails/day in sandbox), paid plans start at $35/month

---

## 4. WHATSAPP AUTOMATION

### Twilio

For sending WhatsApp messages to new registrations

**Variables:**
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_WHATSAPP_NUMBER` - Your WhatsApp-enabled Twilio number
- `TWILIO_MESSAGING_SERVICE_SID` - (Optional) For campaign management

**How to get it:**
1. Go to [Twilio Console](https://www.twilio.com/console)
2. Create account
3. Go to Messaging > Try it Out > WhatsApp
4. Request WhatsApp number (usually approved in minutes)
5. Copy Account SID, Auth Token, and your WhatsApp number

**Cost:** Pay-as-you-go (~$0.0075 per message)

**Note:** Already in your `package.json` dependencies

---

## 5. AUTOMATION SCHEDULING & JOBS

### Redis (Optional but Recommended)

For managing job queues and ensuring reliable task execution

**Variables:**
- `REDIS_URL` - Redis connection URL (e.g., `redis://localhost:6379`)
- `BULL_QUEUE_ENABLED` - Set to `true` to enable Bull queues

**How to set up:**
1. Install Redis: `brew install redis` (macOS) or `apt-get install redis-server` (Linux)
2. Start Redis: `redis-server`
3. Use connection URL in your env

**Cost:** Free (self-hosted)

---

### Automation Configuration Variables

**Check Intervals & Delays:**
- `AUTOMATION_ENABLED` - Toggle all automation on/off
- `SOCIAL_MEDIA_CHECK_INTERVAL` - How often to check for new posts (in seconds, default: 3600 = 1 hour)
- `EMAIL_FOLLOWUP_DELAY` - When to send first email (in seconds, default: 86400 = 1 day)
- `WHATSAPP_FOLLOWUP_DELAY` - When to send WhatsApp (in seconds, default: 604800 = 7 days)

**Engagement Limits:**
- `MAX_COMMENTS_PER_POST` - Max AI-generated comments per post (default: 5)
- `MAX_ENGAGEMENT_POSTS_PER_DAY` - Prevent spam by limiting daily engagement (default: 10)

**Features:**
- `ENABLE_INSTAGRAM_AUTOMATION` - Enable/disable Instagram
- `ENABLE_TIKTOK_AUTOMATION` - Enable/disable TikTok
- `ENABLE_AUTO_ENGAGEMENT` - Auto-like and comment
- `ENABLE_CONTENT_INSIGHTS` - Generate insights from posts
- `ENABLE_AUTO_POST_VIA_11LABS` - Auto-post via text-to-speech
- `ENABLE_CONTENT_IDEA_GENERATION` - Generate content ideas
- `ENABLE_EMAIL_FOLLOWUP` - Email follow-ups
- `ENABLE_WHATSAPP_FOLLOWUP` - WhatsApp follow-ups
- `ENABLE_FOLLOWUP_CAMPAIGNS` - Enable campaigns
- `REQUIRE_MANUAL_APPROVAL` - Require approval before posting (recommended: true)

---

## 6. LOGGING & MONITORING

**Variables:**
- `AUTOMATION_LOG_LEVEL` - Log level (`debug`, `info`, `warn`, `error`)
- `AUTOMATION_LOG_FILE` - Where to save logs
- `SEND_AUTOMATION_ALERTS` - Send alerts on errors
- `ALERT_EMAIL` - Where to send error alerts

---

## Quick Start Setup Steps

1. **Copy the template:**
   ```bash
   cp .env.automation.example .env.automation
   ```

2. **Get your API keys** (follow instructions above for each service)

3. **Fill in your .env.automation file** with actual keys

4. **Load in your main .env:**
   ```bash
   source .env.automation
   ```

5. **Test connections:**
   ```bash
   npm run test:automation
   ```

---

## Cost Estimation (Monthly)

| Service | Free Tier | Paid Tier | Notes |
|---------|-----------|-----------|-------|
| Instagram Graph API | Unlimited | Unlimited | Free forever |
| TikTok API | Limited | Limited | Free, rate-limited |
| OpenAI | $5 credit | Pay-as-you-go | ~$0.03-0.06 per 1K tokens |
| 11labs | 10k chars/month | $5/month | For text-to-speech |
| SendGrid | 100/day | $19.95/month | Recommended for email |
| Twilio WhatsApp | Pay-as-you-go | ~$0.0075/msg | Costs per message sent |
| Redis | Free (self-hosted) | $15+/month | Only if cloud-hosted |

**Estimated total: $40-100/month** (depending on usage volume)

---

## Security Best Practices

1. **Never commit `.env` files** to Git
2. **Use strong secrets** for `SOCIAL_WEBHOOK_SECRET`
3. **Rotate API keys** periodically
4. **Use environment-specific keys** (dev, staging, production)
5. **Monitor API usage** in each service's dashboard
6. **Set API key scopes** as restrictive as possible
7. **Enable rate limiting** in your automation to prevent abuse

---

## Next Steps

After setting up environment variables:

1. Create backend service modules for each API
2. Implement job scheduling with node-cron or Bull
3. Create automation flows for social media engagement
4. Build email/WhatsApp template system
5. Create admin dashboard to manage automations
6. Implement manual approval workflow
7. Add monitoring and error alerts

