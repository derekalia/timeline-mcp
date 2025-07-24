# Timeline MCP Usage Examples

## Example 1: Product Launch Campaign

**User Request:**
"We are getting ready to launch our campaign. I want you to generate 10 ideas for the Aquilo book app, and take those 10 ideas and schedule posts for the next two weeks. Have some of those posts be video posts and have some of them be threads and then we are going to launch on the last day of the two-week period from today. Make it a buildup/teaser campaign."

**LLM Response using Timeline MCP:**

```javascript
// First, calculate the dates
const today = new Date();
const launchDate = new Date();
launchDate.setDate(today.getDate() + 14);

// Use timeline_add_scheduled_event
await timeline_add_scheduled_event({
  trackName: "Product Launch - Aquilo Book App",
  events: [
    // Week 1 - Teasers and Problem Awareness
    {
      name: "Teaser 1 - The Problem",
      prompt: "Create a tweet about how frustrating it is when reading PDFs and ebooks feels disconnected and boring. Don't mention the solution yet. Make it relatable. Use #ReadingExperience #BookLovers",
      scheduledTime: "2024-01-08T10:00:00Z"
    },
    {
      name: "Teaser 2 - Hint at Innovation", 
      prompt: "Create a mysterious tweet hinting that 'reading is about to become an experience, not just a task'. Include an eye emoji and book emoji. Make it intriguing. #ComingSoon",
      scheduledTime: "2024-01-09T15:00:00Z"
    },
    {
      name: "Thread 1 - Reading Problems",
      prompt: "Create a 5-tweet thread about common reading problems: 1) Lost context when switching between books 2) No way to interact with content 3) Boring PDF experience 4) Hard to retain information 5) Tease that a solution is coming. Make it engaging and relatable.",
      scheduledTime: "2024-01-10T12:00:00Z",
      metadata: { contentType: "thread" }
    },
    {
      name: "Video Teaser 1",
      prompt: "Script for a 30-second video: Show someone struggling with a boring PDF, then their face lighting up (don't show what they see). Text overlay: 'What if reading could be...' End with 'January 22' date reveal.",
      scheduledTime: "2024-01-11T18:00:00Z",
      metadata: { contentType: "video" }
    },
    
    // Week 2 - Feature Reveals and Building Excitement
    {
      name: "Feature Reveal 1 - Interactive",
      prompt: "Reveal that Aquilo makes books interactive. Tweet about clicking any concept and getting instant context, definitions, and related content. Include mock screenshot if possible. #AquiloApp #InteractiveReading",
      scheduledTime: "2024-01-13T11:00:00Z"
    },
    {
      name: "Thread 2 - AI Features",
      prompt: "Create a thread revealing Aquilo's AI features: 1) Smart summaries 2) Ask questions to your books 3) AI-powered note connections 4) Personalized reading insights 5) CTA to follow for launch. Make it exciting!",
      scheduledTime: "2024-01-15T14:00:00Z",
      metadata: { contentType: "thread" }
    },
    {
      name: "Video Feature Demo",
      prompt: "Script for 45-second demo video: Show the actual app interface, highlighting the interactive elements, AI chat with book, and beautiful reading experience. End with 'Launching January 22'",
      scheduledTime: "2024-01-17T16:00:00Z",
      metadata: { contentType: "video" }
    },
    {
      name: "Social Proof",
      prompt: "Share beta tester testimonials (create 2-3 realistic ones) about how Aquilo transformed their reading experience. Make it feel authentic and exciting.",
      scheduledTime: "2024-01-19T13:00:00Z"
    },
    {
      name: "Final Countdown",
      prompt: "Create an exciting countdown tweet: '3 days until reading changes forever. Aquilo Book App launches Monday! Get ready to experience books like never before. Set your reminders! 🚀📚' Include launch time.",
      scheduledTime: "2024-01-20T10:00:00Z"
    },
    
    // Launch Day
    {
      name: "Launch Announcement",
      prompt: "🎉 IT'S HERE! Aquilo Book App is now LIVE! Create an epic launch tweet with: link to download, key features recap, special launch day offer (if any), compelling CTA. Make it shareable! Include relevant hashtags #AquiloLaunch #BookTech #ReadingRevolution",
      scheduledTime: "2024-01-22T09:00:00Z"
    }
  ]
});
```

## Example 2: Content Series

**User Request:**
"Schedule a series of educational posts about productivity tips over the next week."

**LLM Response using Timeline MCP:**

```javascript
// Create a track for the productivity series
await timeline_add_scheduled_event({
  trackName: "Productivity Tips Series",
  eventName: "Tip 1 - Time Blocking",
  prompt: "Create an engaging post about time blocking technique. Explain what it is, why it works, and give a practical example. Include relevant emojis and hashtags like #ProductivityTips #TimeManagement",
  scheduledTime: "2024-01-08T09:00:00Z",
  platform: "x"
});

await timeline_add_scheduled_event({
  trackName: "Productivity Tips Series",
  eventName: "Tip 2 - The 2-Minute Rule",
  prompt: "Share the 2-minute rule for productivity. If a task takes less than 2 minutes, do it now. Explain the psychology behind it and give examples. #ProductivityHack #GetThingsDone",
  scheduledTime: "2024-01-09T09:00:00Z",
  platform: "x"
});

// Continue with more tips...
```

## Example 3: Event Coverage

**User Request:**
"I'm attending a tech conference next week. Help me schedule live updates and key takeaways."

**LLM Response using Timeline MCP:**

```javascript
await timeline_add_scheduled_event({
  trackName: "TechConf 2024 Coverage",
  eventName: "Conference Day 1 - Morning Keynote",
  prompt: "Share key insights from the morning keynote session. Focus on the most impactful announcements and include speaker quotes. Add conference hashtag #TechConf2024",
  scheduledTime: "2024-01-15T11:30:00Z",
  platform: "x"
});

await timeline_add_scheduled_event({
  trackName: "TechConf 2024 Coverage",
  eventName: "Conference Day 1 - Afternoon Highlights",
  prompt: "Summarize the best sessions from the afternoon. Include 3-4 key takeaways, mention notable speakers, and share one surprising insight. #TechConf2024",
  scheduledTime: "2024-01-15T17:00:00Z",
  platform: "x"
});
```