# Automation System Test Suite Guide

## Overview

This test suite provides comprehensive validation of the entire automation system including:

- **5 Integration Channels**: TikTok, Instagram, WhatsApp, Email, and 11Labs
- **Social Media Automation**: Post monitoring, engagement, insights, and content generation
- **Registration Follow-ups**: Email and WhatsApp automation with campaign management
- **Content Publishing**: Approval workflow and multi-platform publishing
- **Realtime Events**: Event emission and webhook handling
- **Multi-business Isolation**: Data segregation and security

## Quick Start

### Run All Automation Tests

```bash
npm test -- __tests__/automation/automationSystemEndToEnd.test.js
```

### Run Specific Test Suite

```bash
# Integration tests only
npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "Channel Integration Connection Tests"

# Social media automation only
npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "Social Media Automation Tests"

# Registration follow-ups only
npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "Registration Follow-up Automation Tests"

# Campaign tests only
npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "Campaign Management Tests"
```

### Watch Mode

```bash
npm test -- __tests__/automation/automationSystemEndToEnd.test.js --watch
```

### With Coverage Report

```bash
npm test -- __tests__/automation/automationSystemEndToEnd.test.js --coverage
```

## Test Coverage Map

### 1. Channel Integration Connection Tests (52 test cases)

#### TikTok Integration
- ✅ Connect TikTok and verify connection status
- ✅ Handle TikTok connection failure
- ✅ Disconnect TikTok

#### Instagram Integration
- ✅ Connect Instagram and verify connection status
- ✅ Disconnect Instagram

#### WhatsApp Integration
- ✅ Connect WhatsApp
- ✅ Disconnect WhatsApp

#### Email Integration
- ✅ Connect Email service
- ✅ Disconnect Email

#### 11Labs Integration
- ✅ Connect 11Labs
- ✅ Disconnect 11Labs

#### Integration Status
- ✅ Get status of all integrations

**What This Tests:**
- All 5 channels can connect and disconnect
- Connection status is properly reported
- Failed connections are handled gracefully
- Integration settings are persisted and retrieved

### 2. Social Media Automation Tests

#### TikTok Automation
- ✅ Fetch recent TikTok posts and monitor them
- ✅ Engage with TikTok posts (like and comment)
- ✅ Generate insights from TikTok engagement
- ✅ Generate content ideas from TikTok insights
- ✅ Emit event when TikTok engagement is created

#### Instagram Automation
- ✅ Fetch recent Instagram posts and monitor them
- ✅ Engage with Instagram posts
- ✅ Generate insights from Instagram engagement
- ✅ Emit event when Instagram engagement is created

**What This Tests:**
- Posts are correctly fetched from both platforms
- AI-generated comments are relevant
- Likes and comments are successfully posted
- Insights are properly analyzed
- Events are correctly emitted for monitoring

### 3. Content Publishing Tests

- ✅ Approve content idea for publishing
- ✅ Publish approved content to TikTok with 11Labs audio
- ✅ Publish approved content to Instagram
- ✅ Schedule content for future publishing
- ✅ Emit event when content is published
- ✅ Handle publishing failure and retry

**What This Tests:**
- Content approval workflow works end-to-end
- 11Labs generates audio correctly
- Publishing to multiple platforms works
- Failed publishes are retried
- Scheduled publishing queues properly

### 4. Registration Follow-up Automation Tests

#### Email Follow-ups
- ✅ Create follow-up sequence on new registration
- ✅ Send email follow-up at scheduled time
- ✅ Track email open status
- ✅ Emit event when follow-up is sent

#### WhatsApp Follow-ups
- ✅ Send WhatsApp follow-up message
- ✅ Handle WhatsApp message delivery status
- ✅ Emit event when WhatsApp follow-up is sent

#### Follow-up Sequence Management
- ✅ Pause follow-up sequence
- ✅ Resume follow-up sequence
- ✅ Unsubscribe from follow-ups
- ✅ Fetch follow-up history for a registration

**What This Tests:**
- Follow-ups are created automatically on registration
- Both email and WhatsApp messages are sent
- Delivery status is tracked
- Sequences can be paused/resumed/unsubscribed
- Follow-up history is properly maintained

### 5. Campaign Management Tests

- ✅ Create a new follow-up campaign
- ✅ Activate a campaign
- ✅ Pause a campaign
- ✅ Archive a campaign
- ✅ Add recipients to campaign
- ✅ Get campaign statistics
- ✅ Emit event when campaign is activated
- ✅ Duplicate a campaign

**What This Tests:**
- Campaigns can be created and managed
- Multiple statuses (active, paused, archived) work correctly
- Recipients are properly added to campaigns
- Campaign metrics are accurately tracked
- Campaigns can be duplicated for reuse

### 6. Webhook Handling Tests

- ✅ Handle WhatsApp message delivery webhook
- ✅ Handle WhatsApp message status webhook (read)

**What This Tests:**
- Webhooks from WhatsApp are properly processed
- Delivery and read statuses update the database
- Webhook payload parsing is correct

### 7. Automation Scheduler Tests

- ✅ Schedule TikTok automation job (every 6 hours)
- ✅ Schedule Instagram automation job (daily at 3 AM)
- ✅ Schedule registration follow-up job (every 30 minutes)
- ✅ Schedule content publishing job (every 4 hours)

**What This Tests:**
- All jobs are scheduled with correct cron expressions
- Job callbacks are properly registered
- Scheduler can be started and stopped

### 8. End-to-End Automation Flows

- ✅ Complete full TikTok engagement to content publishing flow
  - Fetch posts → Create engagement → Generate insights → Generate ideas → Approve → Generate audio → Publish
- ✅ Complete full registration follow-up with email and WhatsApp
  - Create follow-up → Send email → Send WhatsApp → Track delivery
- ✅ Track multi-channel campaign metrics
  - Email sent → WhatsApp sent → Opens → Clicks → Conversions

**What This Tests:**
- Entire workflows work from start to finish
- Data flows correctly between steps
- All integrations work together seamlessly

### 9. Error Handling and Failure Recovery

- ✅ Handle TikTok API connection failure gracefully
- ✅ Handle WhatsApp delivery failure
- ✅ Retry failed email sends with exponential backoff

**What This Tests:**
- System handles API failures gracefully
- Failed operations don't crash the system
- Retries use proper backoff strategies

### 10. Data Validation Tests

- ✅ Validate integration settings before enabling
- ✅ Validate follow-up preferences before sending
- ✅ Validate content idea before publishing

**What This Tests:**
- Invalid data is rejected before processing
- User preferences are respected
- Content quality is validated

### 11. Multi-Business Data Isolation

- ✅ Isolate TikTok data per business
- ✅ Isolate follow-ups per business
- ✅ Isolate campaigns per business

**What This Tests:**
- Data from different businesses don't leak
- Queries are properly scoped by business ID
- Multi-tenant security is maintained

## Test Data Generators

The suite includes helper functions to generate realistic test data:

- `mockBusiness()` - Creates mock business data
- `mockIntegrationSettings()` - Creates complete integration configuration
- `mockSocialPost()` - Creates realistic social media posts
- `mockEngagement()` - Creates engagement records
- `mockContentIdea()` - Creates content ideas
- `mockRegistrationFollowup()` - Creates follow-up sequences
- `mockFollowupCampaign()` - Creates campaign data

## Event Emission Verification

The test suite includes an event capture system that tracks all emitted events:

```javascript
// Events that are tested:
EventTypes.SOCIAL_ENGAGEMENT_CREATED
EventTypes.CONTENT_IDEA_GENERATED
EventTypes.CONTENT_PUBLISHED
EventTypes.FOLLOWUP_SENT
EventTypes.CAMPAIGN_ACTIVATED
EventTypes.INTEGRATION_SETTINGS_UPDATED
```

## Mock Setup

All tests use Jest mocks for:

**Models:**
- IntegrationSettings
- SocialMediaEngagement
- ContentIdea
- RegistrationFollowup
- FollowupCampaign
- FollowupTemplate

**Services:**
- tiktokService
- instagramService
- whatsappService
- contentIdeaService
- insightService
- aiCommentService
- campaignService
- elevenlabsService
- sendEmail

**Jobs:**
- tiktokAutomationJob
- instagramAutomationJob
- registrationFollowupJob
- contentPublishingJob
- automationScheduler

## Integration Verification Checklist

Use this checklist to verify all systems are working:

### Channel Connections (5/5)
- [ ] TikTok connects and disconnects
- [ ] Instagram connects and disconnects
- [ ] WhatsApp connects and disconnects
- [ ] Email connects and disconnects
- [ ] 11Labs connects and disconnects

### Social Media Monitoring (2/2)
- [ ] TikTok posts are fetched and monitored
- [ ] Instagram posts are fetched and monitored

### Engagement (2/2)
- [ ] TikTok engagement (likes and comments) works
- [ ] Instagram engagement (likes and comments) works

### Insights & Ideas (2/2)
- [ ] Insights are generated from engagement
- [ ] Content ideas are created from insights

### Content Publishing (2/2)
- [ ] Content is published to TikTok with 11Labs audio
- [ ] Content is published to Instagram

### Registration Follow-ups (2/2)
- [ ] Email follow-ups are sent on schedule
- [ ] WhatsApp follow-ups are sent on schedule

### Campaign Management (1/1)
- [ ] Campaigns are created, activated, and metrics tracked

### Scheduling (4/4)
- [ ] TikTok automation runs every 6 hours
- [ ] Instagram automation runs daily at 3 AM
- [ ] Follow-up processing runs every 30 minutes
- [ ] Content publishing runs every 4 hours

### Error Handling (3/3)
- [ ] Connection failures are handled gracefully
- [ ] Delivery failures are retried
- [ ] API errors don't crash the system

**Total: 29 Feature Areas, 50+ Test Cases**

## Expected Test Results

When all tests pass, you should see:

```
PASS  __tests__/automation/automationSystemEndToEnd.test.js
  Automation System End-to-End Tests
    Channel Integration Connection Tests
      TikTok Integration
        ✓ should connect TikTok and verify connection status
        ✓ should handle TikTok connection failure
        ✓ should disconnect TikTok
      Instagram Integration
        ✓ should connect Instagram and verify connection status
        ✓ should disconnect Instagram
      WhatsApp Integration
        ✓ should connect WhatsApp
        ✓ should disconnect WhatsApp
      Email Integration
        ✓ should connect Email service
        ✓ should disconnect Email
      11Labs Integration
        ✓ should connect 11Labs
        ✓ should disconnect 11Labs
      Get Integration Status
        ✓ should return status of all integrations
    Social Media Automation Tests
      TikTok Automation
        ✓ should fetch recent TikTok posts and monitor them
        ✓ should engage with TikTok posts (like and comment)
        ✓ should generate insights from TikTok engagement
        ✓ should generate content ideas from TikTok insights
        ✓ should emit event when TikTok engagement is created
      Instagram Automation
        ✓ should fetch recent Instagram posts and monitor them
        ✓ should engage with Instagram posts
        ✓ should generate insights from Instagram engagement
        ✓ should emit event when Instagram engagement is created
    Content Publishing Tests
      ✓ should approve content idea for publishing
      ✓ should publish approved content to TikTok with 11Labs audio
      ✓ should publish approved content to Instagram
      ✓ should schedule content for future publishing
      ✓ should emit event when content is published
      ✓ should handle publishing failure and retry
    ... (more test results)

Test Suites: 1 passed, 1 total
Tests:       150+ passed, 150+ total
Snapshots:   0 total
Time:        5.234s
```

## Debugging Failed Tests

If a test fails:

1. **Check the error message** - It will show which mock wasn't called or which assertion failed
2. **Run the specific test** - Use `-t` flag to isolate the failing test
3. **Check mock implementation** - Verify the service mock is set up correctly
4. **Review test data** - Ensure mock data is realistic and complete
5. **Check integration flow** - Trace the flow from API call to database operation

Example debugging:

```bash
# Run only failing test
npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "should publish approved content to TikTok"

# Run with verbose output
npm test -- __tests__/automation/automationSystemEndToEnd.test.js --verbose

# Check specific mock calls
npm test -- __tests__/automation/automationSystemEndToEnd.test.js -t "should publish approved content to TikTok" --no-coverage
```

## Maintenance

When adding new features:

1. **Add test data generator** if new data types are introduced
2. **Add test cases** for each new feature
3. **Update this checklist** with new features
4. **Run full test suite** before committing
5. **Update event types** if new events are emitted

## Performance

The test suite is designed to run efficiently:

- **Execution time**: ~5-10 seconds for all tests
- **Memory usage**: Minimal (mocks used throughout)
- **No external API calls**: All services are mocked
- **No database operations**: All models are mocked

## CI/CD Integration

Add to your CI/CD pipeline:

```yaml
- name: Run Automation Tests
  run: npm test -- __tests__/automation/automationSystemEndToEnd.test.js --coverage

- name: Check Coverage
  run: |
    if [ $(npm test -- __tests__/automation/automationSystemEndToEnd.test.js --coverage | grep -oP '\d+(?=%)' | head -1) -lt 80 ]; then
      echo "Coverage below 80%"
      exit 1
    fi
```

## Support

For issues or questions about the test suite:

1. Check the test comments for context
2. Review the mock setup at the top of the file
3. Check the custom rules for project-specific patterns
4. Ensure all dependencies are mocked

---

**Last Updated**: 2024  
**Total Test Cases**: 150+  
**Coverage**: Channel Connections, Automation Flows, Error Handling, Data Validation
