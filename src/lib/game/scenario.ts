/**
 * "The Toastmaster Life" — an icebreaker scenario game for the Division
 * conference. Its real theme ("Beyond the Club") is only named on the final
 * screen, so the debrief lands as a reveal rather than a lecture.
 *
 * Pure data. Scores are never rendered: players see only the button text.
 */

export type Score = 0 | 1 | 2 | 3;

export type Option = {
  score: Score;
  label: string;
};

export type Decision = {
  id: "d1" | "d2" | "d3a" | "d3b" | "d4";
  title: string;
  text: string;
  options: Option[];
};

export type EndingId = "comfort" | "curious" | "connector" | "leader";

export type Ending = {
  id: EndingId;
  title: string;
  text: string;
};

export type RecapCard = {
  title: string;
  gained: string;
  missed: string;
};

export const GAME_TITLE = "The Toastmaster Life";

export const OPENING = {
  title: GAME_TITLE,
  text: "You joined Toastmasters 8 months ago and you're on Pathways Level 2. Your club feels like family: you know everyone's speaking style, and they know yours. Life is busy. Over the next few weeks, four invitations will land on your phone. What you do with them decides where you'll be a year from now.",
  button: "Let's go",
};

export const DECISION_1: Decision = {
  id: "d1",
  title: "The timer request",
  text: 'Tuesday, 8:47 PM. A WhatsApp message from your Area Director: "Need a timer for the area contest this Saturday, 9 AM. Can you help?" It\'s your only free Saturday this month.',
  options: [
    { score: 3, label: "“Yes, and I'll bring two club-mates to help.”" },
    { score: 2, label: "“Count me in!”" },
    { score: 1, label: "“Can't be timer, but I'll come and watch.”" },
    { score: 0, label: "“Sorry, family plans. Next time for sure!”" },
  ],
};

export const DECISION_2: Decision = {
  id: "d2",
  title: "The clash",
  text: 'Your mentor messages: "A corporate club meets on Thursday. Strong evaluators, very different style. Come with me?" But on Thursday you\'re the General Evaluator at your own club.',
  options: [
    { score: 3, label: "“I'll come, and I'll ask our VPE to plan a joint meeting with them.”" },
    { score: 2, label: "“I'll find a swap and come.”" },
    { score: 1, label: "“Not this time. Tell me how it goes?”" },
    { score: 0, label: "“Can't. My club is counting on me.”" },
  ],
};

/** Shown when the player went to the contest (scored 1+ at Decision 1). */
export const DECISION_3A: Decision = {
  id: "d3a",
  title: "The committee ask",
  text: 'Before you leave the contest, the Area Director introduces you to the Division Director: "We need a few more hands on the conference committee. Interested?" Full involvement means four weekends of work.',
  options: [
    { score: 3, label: "“Yes, and I'd like to lead a team.”" },
    { score: 2, label: "“Yes, I'm in.”" },
    { score: 1, label: "“I can help on the day itself.”" },
    { score: 0, label: "“Not this time, but thank you!”" },
  ],
};

/** Shown when the player skipped the contest (scored 0 at Decision 1). */
export const DECISION_3B: Decision = {
  id: "d3b",
  title: "The committee ask",
  text: 'A message lands in the Division WhatsApp group: "Looking for volunteers for the conference committee. DM me." Two hundred people see it. Nobody there knows you.',
  options: [
    { score: 3, label: "DM: “I'd like to lead a team.”" },
    { score: 2, label: "DM: “I'd like to volunteer.”" },
    { score: 1, label: "DM: “I can help on the day only.”" },
    { score: 0, label: "Scroll past. Someone else will take it." },
  ],
};

export const DECISION_4: Decision = {
  id: "d4",
  title: "The stuck speech",
  text: 'Your Level 3 speech isn\'t working. Your club\'s feedback is warm but familiar: "Good, but something\'s missing." It\'s what they said last time too.',
  options: [
    { score: 3, label: "“Deliver it at two other clubs and compare.”" },
    { score: 2, label: "“Deliver it at another club next week.”" },
    { score: 1, label: "“Send a recording to someone from another club.”" },
    { score: 0, label: "“Polish it and redo it at my club.”" },
  ],
};

/** Consequence text per step (0–3), indexed by score. 3A and 3B share one set. */
export const CONSEQUENCES: [string, string, string, string][] = [
  [
    "You sleep in and take your parents out for lunch. A genuinely good Saturday. On Monday the area group is full of contest photos, and you don't recognise most of the faces.",
    "You slip in for the second half and watch from the back row. The speakers are inspiring, but you leave before tea and nobody there learns your name.",
    "You arrive at 8:40 and get a five-minute briefing. For three hours you watch the area's best speakers up close. Over tea, the Chief Judge, a senior DTM, asks what you thought, and you talk for ten minutes.",
    "You and two club-mates run the timing and ballot desk together. All three of you meet the Chief Judge, a senior DTM, over tea, and the Area Director thanks your club by name.",
  ],
  [
    "Your GE report is the best of the evening, and the president thanks you in the club group. The meeting runs smoothly: the same 15 faces, the same jokes, the same comfortable rhythm.",
    "You give a solid GE report. Later your mentor sends a voice note about the corporate club's evaluations. It sounds interesting, and you mean to go next time.",
    "Your VPE finds a stand-in within 20 minutes. The corporate club runs like clockwork, and its Table Topics are all workplace scenarios. You leave with three ideas for your own club and two new contacts.",
    "Your VPE finds a stand-in and you go. By the end of the night, the two clubs have pencilled in a joint meeting next month. You leave with three ideas, two contacts and a bridge between two clubs.",
  ],
  [
    "You stay focused on your club role. The conference happens, you attend, enjoy the day and go home.",
    "You run the registration desk on conference day. You meet dozens of people and enjoy every minute, but you weren't there for the planning, so few people see what you could have handled.",
    "Over four weekends you handle registrations, chase vendors and survive a last-minute venue change. You learn more about leading volunteers than any project has taught you. The District team starts to know your name.",
    "You lead a team of five volunteers through four weekends: schedules, vendors and a last-minute venue change. When things go wrong, people look to you. The District team starts to know your name.",
  ],
  [
    "You rehearse more and the speech gets smoother. Your club is encouraging, and you complete Level 3. The feedback is kind, and still familiar.",
    "A member of another club replies with helpful notes on your structure. Useful, but a recording can't show how a room reacts, and the speech still feels flat live.",
    'A stranger evaluates you: "Your opening story is your strongest material, and you\'ve buried it at minute four." It\'s obvious the moment someone new says it. You restructure, and the speech finally lands.',
    "Two strangers, two angles. Both spot that your best story is buried at minute four, and one notices you rush your ending. You fix both, and one club invites you back as a guest speaker.",
  ],
];

export const ENDINGS: Record<EndingId, Ending> = {
  comfort: {
    id: "comfort",
    title: "Comfort Zone Champion",
    text: "Your club adores you. You're reliable, polished and always there when a role needs filling. But you're giving good speeches to the same 15 people and hearing the same feedback. You're comfortable, and your growth has quietly gone flat.",
  },
  curious: {
    id: "curious",
    title: "Curious Visitor",
    text: "You dipped a toe outside, and it shifted something. You've grown, and you know it. But most of your Toastmasters world is still one room. Imagine what three more open doors would have done.",
  },
  connector: {
    id: "connector",
    title: "The Connector",
    text: "People across the area know your name. Your circle is five times bigger than your club, and opportunities have started finding you: a second mentor, an invitation to speak, a contact who opens a door at work. Your network now works for you even when you're not in the room.",
  },
  leader: {
    id: "leader",
    title: "Leader in the Making",
    text: "You said yes to every door. You've timed a contest, helped run a conference, and your speech finally lands. The District team asks if you'd consider being an Area Director next term. Your club is still home. It's just no longer the boundary.",
  },
};

export const ENDING_ORDER: EndingId[] = ["comfort", "curious", "connector", "leader"];

export const RECAP: RecapCard[] = [
  {
    title: "The timer request",
    gained:
      "The Chief Judge became your second mentor and later invited you to speak at her company's learning week.",
    missed: "The Chief Judge that Saturday mentors new speakers. You'd have met her over tea.",
  },
  {
    title: "The clash",
    gained:
      "Your club tried two of the corporate club's ideas, and one of your new contacts invited you to speak at their club.",
    missed: "Their evaluators use a style of feedback your club has never tried.",
  },
  {
    title: "The committee ask",
    gained:
      "Four weekends of real leadership: volunteers, vendors and a crisis handled. The District team remembers your name.",
    missed: "The person who volunteered instead is now being considered for Area Director.",
  },
  {
    title: "The stuck speech",
    gained: "A stranger saw what your friends couldn't. Fresh ears find blind spots.",
    missed: "Your speech was one fresh pair of ears away from landing.",
  },
];

/** The reveal. The only place the real theme is named. */
export const FINAL = {
  title: "Beyond the Club",
  text: "Your club is the nets. Beyond it is where you play the matches. Before you leave today, swap numbers with one person from another club and visit their meeting in November.",
};
