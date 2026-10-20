// Template banks: exercise scaffolding, not philosophy content (BUILD_PLAN 11). Neutral, everyday, British spelling.

// Simple statements with their negations, for argument forms.
export const STATEMENTS: { yes: string; no: string }[] = [
  { yes: 'the shop is open', no: 'the shop is not open' },
  { yes: 'it is raining', no: 'it is not raining' },
  { yes: 'the train is late', no: 'the train is not late' },
  { yes: 'the kettle is on', no: 'the kettle is not on' },
  { yes: 'Sara is at home', no: 'Sara is not at home' },
  { yes: 'the match is cancelled', no: 'the match is not cancelled' },
  { yes: 'the battery is flat', no: 'the battery is not flat' },
  { yes: 'the library is closed', no: 'the library is not closed' },
  { yes: 'Bilal passed the exam', no: 'Bilal did not pass the exam' },
  { yes: 'the oven is hot', no: 'the oven is not hot' },
  { yes: 'the road is flooded', no: 'the road is not flooded' },
  { yes: 'the parcel has arrived', no: 'the parcel has not arrived' },
  { yes: 'the lights are on', no: 'the lights are not on' },
  { yes: 'the bus is full', no: 'the bus is not full' },
  { yes: 'Ayesha is awake', no: 'Ayesha is not awake' },
  { yes: 'the milk has gone off', no: 'the milk has not gone off' },
  { yes: 'the printer is jammed', no: 'the printer is not jammed' },
  { yes: 'the meeting has started', no: 'the meeting has not started' },
];

// Cause and effect pairs: an explanation treats the effect as known; an argument offers the effect as evidence.
export const CAUSES: { effect: string; cause: string }[] = [
  { effect: 'the street is wet', cause: 'it rained last night' },
  { effect: 'the milk smells sour', cause: 'it was left out of the fridge' },
  { effect: 'the phone will not switch on', cause: 'its battery is flat' },
  { effect: 'the shop is closed', cause: 'today is a public holiday' },
  { effect: 'the plants have wilted', cause: 'nobody watered them this week' },
  { effect: 'the flight was delayed', cause: 'there was fog over the airport' },
  { effect: 'the cake sank in the middle', cause: 'the oven door was opened too early' },
  { effect: 'the road is jammed', cause: 'there was an accident at the junction' },
  { effect: 'the bread is stale', cause: 'it was left unwrapped' },
  { effect: 'the lights went out', cause: 'a fuse blew' },
  { effect: 'the river has risen', cause: 'there was heavy rain in the hills' },
  { effect: 'the printer shows an error', cause: 'the paper is jammed' },
];

// Survey and analogy scenarios for judging inductive strength (Logic Unit 2).
export const SURVEYS: { claim: string; small: string; large: string; biased: string; fair: string }[] = [
  {
    claim: 'most people in Lahore prefer tea to coffee',
    small: 'I asked 6 people on my street',
    large: 'a polling firm asked 2,400 people across the city',
    biased: 'a survey of 2,000 customers leaving a tea house',
    fair: 'a survey of 2,000 people chosen at random from the city electoral roll',
  },
  {
    claim: 'most students at the university walk to campus',
    small: 'I asked 5 friends in my class',
    large: 'the university surveyed 3,100 students',
    biased: 'a survey of 1,500 students in the halls next to campus',
    fair: 'a survey of 1,500 students chosen at random from the enrolment list',
  },
  {
    claim: 'most drivers in the city keep to the speed limit',
    small: 'I watched 8 cars go past my house',
    large: 'traffic cameras recorded 40,000 cars over a month',
    biased: 'cameras recorded 20,000 cars, all outside a police station',
    fair: 'cameras recorded 20,000 cars at 50 randomly chosen roads',
  },
  {
    claim: 'most families in the town own a car',
    small: 'I asked 4 neighbours',
    large: 'the council surveyed 2,800 households',
    biased: 'a survey of 1,200 households, all in the wealthiest district',
    fair: 'a survey of 1,200 households chosen at random across every district',
  },
];

export const ANALOGIES: { target: string; property: string; relevant: string; irrelevant: string }[] = [
  {
    target: 'a new vaccine will be safe in humans',
    property: 'safe',
    relevant: 'it was safe in a large trial of animals with closely similar immune systems',
    irrelevant: 'it comes in the same kind of vial as a vaccine that was safe',
  },
  {
    target: 'this bridge design will hold heavy lorries',
    property: 'strong',
    relevant: 'an identical design with the same steel has carried lorries for twenty years',
    irrelevant: 'it is painted the same colour as a bridge that carries lorries',
  },
  {
    target: 'the new recipe will rise like the old one',
    property: 'risen',
    relevant: 'it uses the same flour, yeast and proving time as the old one',
    irrelevant: 'it was written on the same page of the notebook as the old one',
  },
];

// Translation keys (Logic Unit 3): clause pairs for conditionals, a subject and two adjectives for neither and not both.
export const CLAUSES: { p: string; q: string; pl: string; ql: string }[] = [
  { p: 'you pass', q: 'you submit the essay', pl: 'P', ql: 'S' },
  { p: 'the match is on', q: 'it rains', pl: 'M', ql: 'R' },
  { p: 'the alarm sounds', q: 'the door opens', pl: 'A', ql: 'D' },
  { p: 'the shop opens', q: 'the manager arrives', pl: 'O', ql: 'M' },
  { p: 'the plant grows', q: 'it gets light', pl: 'G', ql: 'L' },
  { p: 'the train leaves', q: 'the signal is green', pl: 'T', ql: 'G' },
];

export const PAIRS: { subject: string; p: string; q: string; pl: string; ql: string }[] = [
  { subject: 'Sara', p: 'tired', q: 'hungry', pl: 'T', ql: 'H' },
  { subject: 'The soup', p: 'hot', q: 'salty', pl: 'H', ql: 'S' },
  { subject: 'The room', p: 'warm', q: 'quiet', pl: 'W', ql: 'Q' },
  { subject: 'The test', p: 'long', q: 'difficult', pl: 'L', ql: 'D' },
  { subject: 'The film', p: 'funny', q: 'sad', pl: 'F', ql: 'S' },
];

// Predicate pairs for quantifier translation (Logic Unit 6).
export const PREDICATES: { plural: string; noun: string; adj: string; fl: string; gl: string }[] = [
  { plural: 'students', noun: 'student', adj: 'tired', fl: 'S', gl: 'T' },
  { plural: 'cats', noun: 'cat', adj: 'black', fl: 'C', gl: 'B' },
  { plural: 'trains', noun: 'train', adj: 'late', fl: 'T', gl: 'L' },
  { plural: 'apples', noun: 'apple', adj: 'ripe', fl: 'A', gl: 'R' },
  { plural: 'doctors', noun: 'doctor', adj: 'busy', fl: 'D', gl: 'B' },
];

// Relations for spotting a quantifier shift.
export const RELATIONS: { xs: string; ys: string; every: string; one: string }[] = [
  { xs: 'student', ys: 'teacher', every: 'Every student has a teacher', one: 'there is one teacher whom every student has' },
  { xs: 'child', ys: 'mother', every: 'Every child has a mother', one: 'there is one mother whom every child has' },
  { xs: 'road', ys: 'town', every: 'Every road leads to some town', one: 'there is one town to which every road leads' },
  { xs: 'house', ys: 'shop', every: 'Every house is near some shop', one: 'there is one shop that every house is near' },
  { xs: 'player', ys: 'coach', every: 'Every player listens to some coach', one: 'there is one coach whom every player listens to' },
];

// Informal fallacies (Logic Unit 7). Diagnoses quote the lesson's own definitions.
// The everyday exchanges for the fallacy finder. Each name matches a heading in Logic 7's lesson; the diagnosis the
// student must choose is that lesson's own wording, read from the content when it loads (fallacies.ts).
export const FALLACIES: { name: string; examples: string[] }[] = [
  {
    name: 'Ad hominem',
    examples: [
      'A: The council should fix the potholes on our road. B: You cannot even park your own car straight, so why listen to you?',
      'A: This budget plan does not add up. B: You failed maths at school, so your opinion does not count.',
    ],
  },
  {
    name: 'Appeal to authority',
    examples: [
      'A: Is this diet safe? B: A famous cricketer swears by it, so it must be.',
      'A: Will the bridge hold? B: The mayor, who is a lawyer, says it is perfectly sound.',
    ],
  },
  {
    name: 'Appeal to popularity',
    examples: [
      'A: Does this remedy cure colds? B: Millions of people use it every winter, so it obviously works.',
      'A: Is the new phone better? B: It is the bestselling phone this year, so it must be the best.',
    ],
  },
  {
    name: 'Appeal to emotion',
    examples: [
      'A: Should we approve the loan? B: Think how heartbroken the family would be if we said no.',
      'A: Is the new road plan sensible? B: Imagine how frightened the children would feel walking past the works.',
    ],
  },
  {
    name: 'Appeal to ignorance',
    examples: [
      'A: Is the old house haunted? B: Nobody has ever proved it is not, so it must be.',
      'A: Does the new supplement help memory? B: No study has shown it works, so it definitely does nothing.',
    ],
  },
  {
    name: 'Red herring',
    examples: [
      'A: Did the company pay its workers late? B: Well, the company sponsors the local football team.',
      'A: Was the exam marked fairly? B: Let us not forget how hard the teachers work all year.',
    ],
  },
  {
    name: 'Begging the question',
    examples: [
      'A: Why trust this newspaper? B: Because it reports only the truth, as it says on its front page.',
      'A: Why is this the best restaurant? B: Because no restaurant is better than it.',
    ],
  },
  {
    name: 'False dilemma',
    examples: [
      'A: Should we change the timetable? B: Either we keep it exactly as it is or the whole school falls into chaos.',
      'A: Do you like the plan? B: You either support it completely or you want the project to fail.',
    ],
  },
  {
    name: 'Slippery slope',
    examples: [
      'A: Can we allow phones at lunch? B: If we allow phones at lunch, soon they will be in every lesson and nobody will learn anything.',
      'A: Could we start ten minutes later? B: Start ten minutes later and soon nobody will come in before noon.',
    ],
  },
  {
    name: 'Straw man',
    examples: [
      'A: We should spend a little less on the car park. B: So you want everyone to walk to work in the rain? Ridiculous.',
      'A: Homework could be shorter. B: You think pupils should never study at home at all? That would be a disaster.',
    ],
  },
  {
    name: 'Composition',
    examples: [
      'A: Is the machine light? B: Every part of it is light, so the whole machine must be light.',
      'A: Is the team good? B: Each player is excellent, so the team must be excellent.',
    ],
  },
  {
    name: 'Post hoc ergo propter hoc',
    examples: [
      'A: Why did the team win? B: They wore new socks this week, and then they won, so the socks did it.',
      'A: Why is the cough gone? B: I drank honey and lemon and then it went, so that cured it.',
    ],
  },
  {
    name: 'Equivocation',
    examples: [
      'A: Is the plan sound? B: A sound plan is one you can hear, and nobody has heard this plan, so it is not sound.',
      'A: What colour are feathers? B: Feathers are light, and what is light cannot be dark, so no feather is dark.',
    ],
  },
  {
    name: 'Genetic fallacy',
    examples: [
      'A: Is the new tax rule fair? B: It was first suggested by a rival party, so it cannot be fair.',
      'A: Is this recipe any good? B: It came from a cheap magazine, so it must be bad.',
    ],
  },
];

// Modal scope sentences (Logic Unit 8): the box governs the whole conditional, or only the consequent.
export const MODAL: { sentence: string; wide: boolean; p: string; q: string; key: string[] }[] = [
  { sentence: 'Necessarily, if Ali is a bachelor, then Ali is unmarried.', wide: true, p: 'B', q: 'U', key: ['B: Ali is a bachelor', 'U: Ali is unmarried'] },
  { sentence: 'If Ali is a bachelor, then Ali is necessarily unmarried, so he could not have married.', wide: false, p: 'B', q: 'U', key: ['B: Ali is a bachelor', 'U: Ali is unmarried'] },
  { sentence: 'Necessarily, if a number is even, then it is divisible by two.', wide: true, p: 'E', q: 'D', key: ['E: the number is even', 'D: the number is divisible by two'] },
  { sentence: 'If you know the train left, then the train necessarily left and could not have stayed.', wide: false, p: 'K', q: 'L', key: ['K: you know the train left', 'L: the train left'] },
  { sentence: 'Necessarily, if you know the train left, then the train left.', wide: true, p: 'K', q: 'L', key: ['K: you know the train left', 'L: the train left'] },
  { sentence: 'If the meeting is on Monday, then it necessarily is on Monday and could not have been moved.', wide: false, p: 'M', q: 'M', key: ['M: the meeting is on Monday'] },
];
