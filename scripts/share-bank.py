# Share copy bank: data + lint + markdown render (+ --og-json for the guide preview hooks)
import re, sys
A = "approved in chat"
D = [
("Relationships", [
("Red flags in a man", "guide", "/relationships/guides/red-flags-in-a-man",
 ("How do you know if your man is a walking red flag?", "If you're a single lady dating with marriage in mind, this guide covers the early signs worth taking seriously, and the ones no amount of love or prayer will fix.", "genuine question", A),
 ("A man who uses money to control you is not a provider.", "If you're a Nigerian woman dating to marry, this guide covers the red flags we've been taught to excuse, and how to tell one from a bad day.", "gentle provocation, Nigerian texture", A)),
("Green flags that matter", "guide", "/relationships/guides/green-flags-that-matter",
 ("Watch how he treats the gateman. It tells you more than the flowers do.", "If you're talking to someone new, this guide covers the quiet green flags that predict a good relationship, and the traps to watch for in African dating.", "Nigerian texture", ""),
 ("Sweet words are cheap. Doing what he said he'd do, week after week, is not.", "If you're dating with marriage in mind, this guide covers the green flags that predict a good relationship, starting with the strongest one: consistency.", "contrarian", "")),
("Non-negotiables", "guide", "/relationships/guides/non-negotiables",
 ("If you'd stay anyway, it was never a non-negotiable.", "If you're single and serious about marriage, this guide shows how to tell a preference from a real dealbreaker, and how to settle your three to five before you're attached.", "gentle provocation", ""),
 ("\"He must be responsible\" is a wish. \"He keeps his word without being chased\" is a standard.", "If you're dating to marry, this guide shows how to write non-negotiables you can check, and what to do when one is crossed.", "contrarian", "")),
("Dating on purpose", "guide", "/relationships/guides/dating-on-purpose",
 ("We were taught to wait, look nice and hope he finds us. That's not a plan.", "If you're single and tired of drifting, this guide shows how to work out what you want, set your standards, and choose from clarity instead of pressure.", "identity, felt moment", ""),
 ("Months pass, sometimes years, and you still don't know what this is.", "If you're a single woman who wants marriage, this guide explains the difference between drifting and dating on purpose, and how to start doing the second one.", "felt moment", "")),
("Situationship", "guide", "/relationships/guides/situationship",
 ("You talk every day, he knows your friends, and you still can't call him your man.", "If you're not sure whether it's a relationship or a situationship, this guide explains the difference, the red flags, and how to get a straight answer.", "scenario", ""),
 ("Everything a relationship gives you, and no claim on any of it. That's a situationship.", "If you're in something with no name, this guide covers how to know for sure, how long they last, and how to get out or make it official.", "curiosity gap", "")),
("Talking stage", "guide", "/relationships/guides/talking-stage",
 ("Five months of good morning texts is not a talking stage anymore. It's a waiting room.", "If you're talking to someone with no label yet, this guide covers how long the talking stage should last, and how to bring it to a decision.", "gentle provocation", ""),
 ("Dating had an ending. Courtship had an ending. The talking stage has none built in.", "If you've been talking to someone for months, this guide explains what the talking stage is for, how long it should run, and who has to end it.", "curiosity gap", "")),
("Talking stage questions", "guide", "/relationships/guides/talking-stage-questions",
 ("Would his family have a problem with where you're from? Find out before you're attached.", "If you're in a talking stage, this guide lists the questions to ask about money, family, faith and children, plus the three that can save you a year.", "Nigerian texture, genuine question", ""),
 ("Ask \"what are we?\" once, plainly, somewhere around week eight to twelve.", "If you're talking to someone new, this guide has the questions worth asking early, what vague answers tell you, and the three that can save you a year.", "curiosity gap", "")),
("Green and red flags checker", "tool", "/relationships/tools/green-red-flags-checker",
 ("Your friends have opinions about him. What are you seeing with your own eyes?", "If you're dating someone new, this checker lets you tick what he does, then gives a straight read on his green flags, his red flags, and what to do next.", "genuine question", ""),
 ("Is he consistent, or only sweet when he wants something?", "If you're unsure about a man you're seeing, this checker turns what you've noticed into a clear read on his green and red flags.", "genuine question", "")),
("Meet marriage-minded men checklist", "tool", "/relationships/tools/meet-marriage-minded-men-checklist",
 ("Good men are not only at weddings and in your DMs.", "If you're single and ready to meet serious men, this checklist has practical, safe places to look, and ways to filter out the time-wasters early.", "contrarian", ""),
 ("If you only go to church, work and weddings, you'll keep meeting the same men.", "If you're single and want marriage, this checklist shows where the odds are better, how to say what you're looking for, and what changes for women abroad.", "gentle provocation, Nigerian texture", "")),
("Ready for love quiz", "tool", "/relationships/tools/ready-for-love-quiz",
 ("Your aunty asked \"when is it your turn?\" at the last three weddings.", "If you're single, this quiz has eight questions on what you want, your standards and your healing, so you can tell if you're dating from clarity or from pressure.", "Nigerian texture, felt moment", ""),
 ("Being single is fine. Choosing a man to stop the questions is not.", "If you're single and wondering if you're ready, this quiz has eight short questions on clarity, standards and healing. There's no pass or fail.", "gentle provocation", "")),
("Situationship checker", "tool", "/relationships/tools/situationship-checker",
 ("Six months in and you still introduce him as \"my friend\".", "If he keeps you guessing, this checker asks six questions about labels, consistency and future plans, then gives you a clear read and the words to ask him straight.", "felt moment", ""),
 ("Asking \"what are we?\" is not desperate. It's self-respect.", "If you're not sure where you stand with him, this checker gives you a clear read in six questions, plus the words to ask for what you want.", "contrarian", "")),
("Standards and non-negotiables worksheet", "tool", "/relationships/tools/standards-non-negotiables-worksheet",
 ("Every woman has a list. Most of us drop it the moment he's sweet.", "Single ladies: this worksheet helps you write down your real standards and dealbreakers before the next talking stage, while your head is still clear.", "felt moment", "line 2 kept from the line you liked"),
 ("If your list has twenty items, you're mixing standards with preferences.", "If you're dating to marry, this worksheet helps you sort the real standards from the preferences, and keep them where you can see them.", "gentle provocation", "")),
("The talk planner", "tool", "/relationships/tools/the-talk-planner",
 ("\"So what are we?\" doesn't have to be a fight or a trap.", "If you're ready to ask him where this is going, this planner helps you decide what to say, what to ask, and what his answer means, before you walk in.", "felt moment", ""),
 ("Decide what you'll do with his answer before you ask the question.", "If you're about to have the talk with a man you're seeing, this planner gives you the words, the timing, and what each answer means.", "gentle provocation", "")),
]),
("Trying to conceive", [
("Fertile window explained", "guide", "/fertility/guides/fertile-window-explained",
 ("Day 14 is wrong for most women.", "If you're trying for a baby, or someone close to you is, this guide explains the six fertile days, why most of them come before ovulation, and how to find yours.", "myth-busting", ""),
 ("There are about six days a month when you can conceive. The rest is waiting.", "For women trying for a baby, this guide explains where the fertile window falls, why day 14 misleads most women, and how to time it without turning it into a job.", "curiosity gap", "")),
("Goron tula and fertility", "guide", "/fertility/guides/goron-tula-and-fertility",
 ("No study has tested goron tula for fertility in human beings. Not one.", "If someone has told you goron tula, cloves or tiger nut will help you conceive, this guide shows what the research has tested, and what the evidence does support.", "myth-busting", ""),
 ("Goron tula has been chewed for generations. The fertility claims on the packet are new.", "If you're trying for a baby and the herbal advice has started, this guide covers what goron tula, tiger nut and cloves can and can't do.", "Nigerian texture, curiosity gap", "")),
("Male fertility supplements", "guide", "/fertility/guides/male-fertility-supplements",
 ("In a trial of 2,370 men, folic acid and zinc made no difference to live births.", "For couples trying for a baby, this guide covers what the big trials found, why a semen analysis comes first, and what NAFDAC says about manpower herbs.", "myth-busting", ""),
 ("Up to half of the picture is on his side. The family still asks her.", "For couples trying to conceive, this guide covers which male fertility supplements have evidence, which don't, and the test he should do first.", "gentle provocation, Nigerian texture", "")),
("Preparing to conceive", "guide", "/fertility/guides/preparing-to-conceive",
 ("By the time a test shows two lines, the folic acid window has mostly passed.", "If you're planning a baby, this guide explains why folic acid starts three months before you try, who needs the higher dose, and what else helps.", "gentle cost of inaction", ""),
 ("Folic acid won't make you conceive faster. It protects the baby before you know you're pregnant.", "For women planning a pregnancy, this guide covers the dose, the timing, and the short list of other things worth doing first.", "myth-busting", "")),
("Fertility appointment questions", "tool", "/fertility/tools/fertility-appointment-questions",
 ("You wait months for the appointment, then forget everything in the room.", "If you or someone close to you has a fertility appointment coming, this question list helps you ask well. Tick the ones you want, add your own, print it.", "felt moment", ""),
 ("Appointments go fast. Walk in with your questions written down.", "For women seeing a doctor about fertility, this question list lets you tick what to ask, add your own, and take it with you on paper or on your phone.", "felt moment", "")),
("His fertility checklist", "tool", "/fertility/tools/his-fertility-checklist",
 ("Up to half of the picture is on his side. So why is she the only one with a plan?", "For couples trying for a baby, this checklist has simple, evidence-based steps that support sperm health. Send it to him so it's his to act on.", "gentle provocation", ""),
 ("A semen analysis is a normal, routine test. It is not a judgement of him.", "If you're trying for a baby together, this checklist gives him his own steps for sperm health, and says when to see a doctor as a couple.", "contrarian", "")),
("Ovulation calculator", "tool", "/fertility/tools/ovulation-calculator",
 ("Most of the fertile window comes before ovulation. Waiting to be sure means missing it.", "If you're trying for a baby, this calculator takes your last period and cycle length and shows your likely fertile days and ovulation date.", "curiosity gap", ""),
 ("Not every cycle is 28 days, so not every woman ovulates on day 14.", "For women trying to conceive, this calculator estimates your fertile window from your own cycle length, with plain answers on irregular cycles.", "myth-busting", "")),
("Period tracker", "tool", "/fertility/tools/period-tracker",
 ("Do you count 28 days from the start of your period or the end?", "For any woman who wants to know when her next period is due, this calculator estimates your next three from one date, with plain answers on late periods.", "genuine question", ""),
 ("Your period app is doing simple arithmetic. It helps to know which arithmetic.", "For any woman tracking her cycle, this calculator predicts your next three periods and explains where period apps can get it wrong.", "curiosity gap", "")),
("The wait check-in", "tool", "/fertility/tools/the-wait-check-in",
 ("Trying for a baby can be lonely, and nobody asks how you're doing.", "For any woman in the wait, this check-in is a quiet, private space to notice how you're feeling, with real help when you need it. There's no test and no score.", "felt moment (gentle)", "sensitive page: soft prompt stays"),
 ("The waiting is heavy, and most women carry it quietly.", "If you're trying to conceive, or love someone who is, this private check-in helps you notice how you're doing and points to real support.", "felt moment (gentle)", "")),
("TTC checklist", "tool", "/fertility/tools/ttc-checklist",
 ("Planning a baby starts a few months before you start trying.", "If you're thinking about trying for a baby, this checklist covers the practical steps that prepare your body and your life, and saves your progress as you tick.", "gentle cost of inaction", ""),
 ("Thinking about a baby next year? The best time to prepare is now.", "For women planning a pregnancy, this checklist lists the simple steps, from folic acid to a check-up, to tick off at your own pace.", "genuine question", "")),
]),
("Pregnancy", [
("Chemical miscarriage", "guide", "/pregnancy/guides/chemical-miscarriage",
 ("For anyone who saw a positive test and then a period, this guide explains chemical miscarriage, why it happens, why it is not her fault, and what comes next.", "", "loss page: one gentle line", "soft prompt stays"),
 ("A positive test, then a period. If that happened to you or someone you love, this guide explains what a chemical pregnancy is, and when to try again.", "", "loss page: one gentle line", "")),
("Nigerian foods in pregnancy", "guide", "/pregnancy/guides/nigerian-foods-in-pregnancy",
 ("Tiger nut will not make the baby fairer. Neither will most of the list your aunty sent.", "For pregnant women and the people feeding them, this guide has straight answers on tiger nut, bitter kola, garden egg, cloves and Lipton.", "myth-busting, Nigerian texture", A),
 ("Is Lipton good for a pregnant woman? Everybody has an answer. Few have the evidence.", "If you're pregnant, or cooking for someone who is, this guide gives short answers on tiger nut, bitter kola, garden egg, cloves and Lipton, then the reasons.", "genuine question", "")),
("Trimester by trimester", "guide", "/pregnancy/guides/trimester-by-trimester",
 ("Foreign pregnancy guides barely mention malaria. In Nigeria, it matters.", "If you're pregnant for the first time, this guide covers what happens in each trimester, which scans belong where, and why antenatal visits matter.", "Nigerian texture, contrarian", ""),
 ("Feeling almost nothing in the first trimester is normal too.", "For first-time mums, this guide walks through the three trimesters, what's normal in each, and the checks and scans that belong where.", "contrarian", "")),
("Antenatal appointment questions", "tool", "/pregnancy/tools/antenatal-appointment-questions",
 ("The antenatal queue takes hours. The appointment takes minutes.", "If you're pregnant, this question list helps you use those minutes well. Tick what you want to ask, add your own, and take it with you.", "Nigerian texture", ""),
 ("Ever left a check-up and remembered your question in the car?", "For pregnant women, this question list lets you tick what to ask at your next antenatal visit, add your own, and print it or keep it on your phone.", "felt moment", "")),
("Baby essentials checklist", "tool", "/pregnancy/tools/baby-essentials-checklist",
 ("The baby shop will tell you to buy everything. A newborn needs about ten things.", "If there's a baby on the way, this checklist covers what a newborn needs for the first weeks, so the money goes where it matters. Tick it, print it, take it shopping.", "contrarian", ""),
 ("Do you need a mosquito net for a newborn in Nigeria? Yes, and it's on the list.", "For anyone expecting a baby, this checklist covers the real essentials for the first weeks, and what you can skip.", "genuine question, Nigerian texture", "")),
("Birth plan builder", "tool", "/pregnancy/tools/birth-plan-builder",
 ("Your care team can't respect what they don't know you want.", "If you're pregnant, this birth plan builder turns your labour and pain relief choices into one page you can hand to your midwife or doctor. Nothing is fixed, and plans can change.", "gentle provocation", ""),
 ("A birth plan is your preferences, written down. That's all it is.", "For pregnant women, this builder walks you through the choices that matter to you and gives you a one-page plan to print.", "myth-busting", "")),
("Due date calculator", "tool", "/pregnancy/tools/due-date-calculator",
 ("Is a due date 40 weeks or 42? And is 36 weeks nine months?", "If you've just found out you're pregnant, this calculator gives your due date, how many weeks along you are, and your trimester, from one date.", "genuine question", ""),
 ("Your due date is an estimate. It helps to know how it's worked out.", "For newly pregnant women, this calculator turns the first day of your last period into a due date, weeks pregnant and trimester, and explains the maths.", "curiosity gap", "")),
("Hospital bag checklist", "tool", "/pregnancy/tools/hospital-bag-checklist",
 ("Labour doesn't wait while you look for the baby's cap.", "If you're due in the next few months, this checklist covers what to pack for you, the baby and whoever comes with you. Start packing from about 36 weeks.", "scenario", ""),
 ("Nobody wants to pack a hospital bag between contractions.", "For pregnant women and their partners, this hospital bag checklist lists everything for labour, birth and the first day or two.", "scenario", "")),
("Safe foods checklist", "tool", "/pregnancy/tools/safe-foods-checklist",
 ("Everybody has an opinion on what a pregnant woman should eat. Not everybody has the evidence.", "If you're pregnant, this checklist lists everyday Nigerian foods that are generally safe, and what to limit or avoid. Print it for the fridge.", "Nigerian texture", ""),
 ("Moi moi, beans, plantain, ugu. What's fine in pregnancy, and what should you limit?", "For pregnant women and the people cooking for them, this checklist covers everyday Nigerian foods that are generally safe, plus a clear note on what to limit.", "genuine question, Nigerian texture", "")),
("Week by week tracker", "tool", "/pregnancy/tools/week-by-week-tracker",
 ("Pregnancy is counted in weeks, and nobody explains the counting.", "If you're pregnant, this tracker shows how many weeks along you are, your trimester, and what is often happening around now, from one date.", "curiosity gap", ""),
 ("What is often happening with the baby this week?", "For pregnant women, this week-by-week tracker gives your weeks, trimester and a short note on what's often happening now. Your scan gives the most accurate dates.", "genuine question", "")),
]),
("Postpartum", [
("Omugwo", "guide", "/postpartum/guides/omugwo",
 ("A grandmother sleeping on the sofa for three months is a fight waiting to happen.", "If there's a baby on the way in your family, this guide covers who comes for omugwo, how long they stay, who pays, and the conversation to have first.", "scenario, Nigerian texture", A),
 ("Your mum or his mum? The omugwo question starts long before the baby arrives.", "If you or someone close to you is expecting, this guide covers what omugwo involves, how long it lasts, and how to plan it without palava.", "genuine question, Nigerian texture", "")),
("Postpartum recovery timeline", "guide", "/postpartum/guides/postpartum-recovery-timeline",
 ("After the birth, the baby gets all the appointments. You get one check at six weeks.", "If you've just had a baby, or someone close to you has, this guide walks through recovery week by week, including caesarean recovery and what nobody warns you about.", "gentle provocation", ""),
 ("Weeks two and three after birth have a name: the fog.", "For new mums, this guide covers what's normal in each week after birth, what to eat after a C-section, and the six-week check that is about you.", "curiosity gap", "")),
("Postpartum warning signs", "guide", "/postpartum/guides/postpartum-warning-signs",
 ("Most of what happens after birth is normal. Every family should know the few things that aren't.", "If there's a new mum in your family, this guide lists the signs that mean get help today, for mum and baby, with clear numbers in place of vague words.", "gentle cost of inaction", "warning symptoms kept out of the hook"),
 ("Knowing when to go to the hospital after birth shouldn't depend on guesswork.", "For new mums and the people around them, this guide gives countable signs that mean get help today, and how to be taken seriously when you go.", "gentle provocation", "")),
("Check-up questions", "tool", "/postpartum/tools/check-up-questions",
 ("At the six-week check, everyone asks about the baby. Who asks about you?", "If you've just had a baby, this question list helps your own recovery get attention too. Tick what to ask, add your own, and take it to the appointment.", "genuine question", ""),
 ("It's hard to remember your questions when you're tired and holding a baby.", "For new mums with a check-up coming, this list lets you tick the questions that matter, add your own, and keep them on your phone or on paper.", "felt moment", "")),
("Mind check-in", "tool", "/postpartum/tools/mind-check-in",
 ("Everyone asks how the baby is. Fewer people ask how mum is.", "For new mums, this check-in is a quiet, private space to notice how you're doing, with real help when you need it. There's no test and no score.", "felt moment (gentle)", "sensitive page: soft prompt stays"),
 ("After a birth, a lot of feelings arrive at once. It helps to check in.", "If you've had a baby, or love someone who has, this private check-in helps you notice how you're feeling and points to real help.", "felt moment (gentle)", "")),
("Night feed rota", "tool", "/postpartum/tools/night-feed-rota",
 ("If nobody agrees who does the 3am feed, it's mum.", "If there's a new baby at home, this rota helps you agree who does which part of the night, so it isn't silently all on one person. Fill it in together.", "gentle provocation", ""),
 ("Broken sleep is one of the hardest parts of the early weeks.", "For new parents and helpers, this night feed rota splits the nights between you, your partner and your helper. Print it and put it on the wall.", "felt moment", "")),
("Partner support planner", "tool", "/postpartum/tools/partner-support-planner",
 ("\"Just tell me what you need\" is hard to answer at 3am.", "For new mums, this planner lets you tick what would help most right now and turns it into a clear note to send your partner or family.", "felt moment", ""),
 ("He wants to help. He doesn't know how. You're too tired to explain.", "If you've just had a baby, this planner turns what you need into a short note your partner or family can act on today.", "scenario", "")),
("Recovery checklist", "tool", "/postpartum/tools/recovery-checklist",
 ("The first six weeks after birth are about your healing too.", "If you've just had a baby, or someone close to you has, this checklist covers body, feeding and mind in the first six weeks, to tick off at your own pace.", "identity", ""),
 ("Healing after birth doesn't come with a to-do list, so we wrote one.", "For new mums, this checklist covers the first six weeks of recovery: your body, feeding your baby, and looking after your mind.", "curiosity gap", "")),
("Recovery timeline calculator", "tool", "/postpartum/tools/recovery-timeline-calculator",
 ("A caesarean recovery runs on a different clock.", "If you've just had a baby, this calculator takes your delivery date and how you delivered, and shows what many women experience week by week.", "curiosity gap", ""),
 ("Three weeks after birth and wondering if this is normal?", "For new mums, this calculator maps out week-by-week recovery from your delivery date and type, with what to rest from. Every body is different.", "genuine question", "")),
]),
("Parenting", [
("Starting solids", "guide", "/parenting/guides/starting-solids",
 ("Waking more at night doesn't mean a baby is ready for solids.", "If there's a baby around six months in your life, this guide covers the three signs of real readiness, the four that fool everybody, and first foods from the market.", "myth-busting", ""),
 ("A baby's first foods can come from the market you already use.", "For parents of babies around six months, this guide covers when to start solids, what to try first, what to skip, and why allergy foods go in early.", "Nigerian texture", "")),
("Baby name explorer", "tool", "/parenting/tools/baby-name-explorer",
 ("Your mum has a name. His mum has a name. Your pastor has a name too.", "If you're expecting, this name finder lets you search Nigerian, pan-African and international names by meaning, gender or origin.", "Nigerian texture, scenario", ""),
 ("Every Nigerian name carries a meaning. Do you know what yours means?", "For anyone choosing a baby name, this name finder searches Nigerian, pan-African and international names by what they mean.", "genuine question, identity", "")),
("Baby routine planner", "tool", "/parenting/tools/baby-routine-planner",
 ("Babies are not clocks. A rough rhythm still helps.", "For new parents, this planner shows a sample day of feeds, naps and play for your baby's age, to shape around your own baby.", "contrarian", ""),
 ("What should a day with a three-month-old look like?", "If there's a new baby at home, this planner gives a sample day of feeds, naps and play by age. Use it as a starting point, never a rule.", "genuine question", "")),
("Babyproofing safety checklist", "tool", "/parenting/tools/babyproofing-safety-checklist",
 ("The day they start crawling, the whole house changes.", "For parents of babies on the move, this checklist goes room by room, plus the safe sleep basics from day one. Tick as you go and print it.", "felt moment", ""),
 ("Babies find every socket, stair and table corner in the house.", "If there's a baby in your house, this room-by-room checklist helps you keep the home safe as they grow.", "scenario", "")),
("Feeding and sleep tracker", "tool", "/parenting/tools/feeding-sleep-tracker",
 ("\"When did baby last feed?\" is the hardest question at 4am.", "For new parents, this tracker logs feeds and sleeps with one tap, so you see your baby's rhythm and have a clean summary for the doctor.", "felt moment", ""),
 ("The doctor asks how often the baby feeds, and you're too tired to remember.", "If there's a new baby at home, this tracker logs every feed and nap with one tap. Everything saves on your phone.", "scenario", "")),
("First foods planner", "tool", "/parenting/tools/first-foods-planner",
 ("Starting solids is exciting and a little scary.", "For parents of babies around six months, this planner lists first foods to try once baby is ready, with local options. Tick each one as you introduce it.", "felt moment", ""),
 ("Should baby start with pap, sweet potato or egg? Every aunty has a different answer.", "If your baby is nearly ready for solids, this planner lists first foods with local options like pap and sweet potato, and how to introduce them.", "genuine question, Nigerian texture", "")),
("Milestone tracker", "tool", "/parenting/tools/milestone-tracker",
 ("Every baby gets there at their own pace. It still helps to know what's coming.", "For parents of babies and toddlers, this tracker shows the milestones many babies reach at each age. It's a guide, never a test.", "curiosity gap", ""),
 ("Your sister's baby walked at ten months. Every baby moves at their own pace.", "For parents comparing notes, this milestone tracker shows what many babies do around each age, and when it's worth mentioning at a check-up.", "Nigerian texture, felt moment", "")),
("Paediatric visit questions", "tool", "/parenting/tools/paediatric-visit-questions",
 ("You get to the doctor with a worry and forget half of it.", "For parents with a clinic visit coming, this question list lets you tick what to ask, add your own, and take it with you.", "felt moment", ""),
 ("The baby cried through the whole appointment and you forgot what you came to ask.", "If your baby has a doctor's visit coming, this question list keeps your questions written down so nothing gets missed.", "scenario", "")),
("Vaccination tracker", "tool", "/parenting/tools/vaccination-tracker",
 ("Lost the clinic card? Keep a copy of the schedule on your phone.", "For parents of young children in Nigeria, this tracker lists every vaccine visit by age and shows the date each one falls due from your baby's date of birth.", "felt moment, Nigerian texture", ""),
 ("How many injections will a two-month-old get?", "If there's a new baby in your family, this tracker shows Nigeria's immunisation schedule visit by visit, and what to do if a visit is missed.", "genuine question", "")),
]),
("Program thank-you hubs (link goes to the public program page)", [
("The Trying-to-Conceive Blueprint", "program", "/programs/trying-to-conceive-blueprint",
 ("Trying for a baby comes with plenty of advice and not much of a plan.", "If you're trying for a first baby, this program walks you through understanding your cycle, preparing your body, and knowing what to ask the doctor.", "felt moment", ""),
 ("Everyone has advice for a woman trying to conceive. Few people have a plan.", "For women trying for a first baby, The Trying-to-Conceive Blueprint is a step-by-step plan, with a community of women in the same season.", "Nigerian texture", "")),
("The First Pregnancy Plan", "program", "/programs/first-pregnancy-plan",
 ("First pregnancy, and every week brings a new question.", "If you're expecting your first baby, this program explains what's normal each week, what's safe to eat, what your scans mean, and when to call the doctor.", "felt moment", ""),
 ("Searching symptoms at 2am is not a pregnancy plan.", "For first-time mums, The First Pregnancy Plan is a week-by-week guide through pregnancy, with a community of mums at the same stage.", "gentle provocation", "")),
("The 6-Week Postpartum Reset", "program", "/programs/postpartum-reset",
 ("After the birth, everyone checks on the baby. This one is for mum.", "If you've just had a baby, or someone close to you has, this program covers recovering your body, your marriage and your mind, with no pressure and no shame.", "identity", ""),
 ("300+ first-time mums have used this six-week plan after birth.", "For new mums, The 6-Week Postpartum Reset covers your body, your marriage and your mind in one plan, with a community of mums beside you.", "proof-led (count allowed)", "")),
("The First Baby Playbook", "program", "/programs/first-baby-playbook",
 ("\"Is this normal?\" is the question every first-time mum keeps asking.", "If there's a new baby in your life, this program covers sleep, feeding, milestones and safety month by month, with a lot less second-guessing.", "felt moment", ""),
 ("The baby years come with sleepless nights, feeding worries and a family group chat full of opinions.", "For first-time mums, The First Baby Playbook is a month-by-month guide to the baby years, with a community of parents at your stage.", "Nigerian texture", "")),
("The Wife Material Blueprint", "program", "/programs/wife-material-blueprint",
 ("Waiting to be chosen is not a dating strategy.", "If you're single and ready for marriage, this program covers healing, meeting marriage-minded men, reading a man early, and moving a good one forward.", "gentle provocation", ""),
 ("300+ Nigerian women have used this blueprint to date with marriage in mind.", "For single women who want marriage, The Wife Material Blueprint shows how to meet serious men, read them early, and move a good one forward.", "proof-led (count allowed)", "")),
("The Complete Motherhood Journey", "program", "/programs/complete-motherhood-journey",
 ("Motherhood comes in seasons, and each one has its own scary moments.", "If you're planning a family, this program covers trying to conceive, pregnancy, postpartum and the baby years in one roadmap, ready before you need it.", "identity", ""),
 ("Most women start looking for answers in the middle of the hard moment.", "For women planning a family, The Complete Motherhood Journey puts four programs in one: trying to conceive, pregnancy, postpartum and the baby years.", "gentle cost of inaction", "")),
]),
]

BANS = [r"get pregnant fast", r"boost fertility", r"bounce.back", r"get your body back", r"sleep through the night",
        r"make him (marry|choose) you", r"\bcure", r"\btreat\b", r"\bfix\b(?! for you)", r"guarantee", r"\bfree\b", r"\bbot\b",
        r"you need to", r"you must", r"\bactually\b", r"\breally\b", r"\bvery\b", r"\bhonest", r"\bcalm", r"\bgentl", r"—", r"–", r" - ",
        r", which (is|means|makes)", r"essential\b(?!s)", r"\bsimply\b", r"\bfounding\b"]
COUNT_OK = ("The 6-Week Postpartum Reset", "The Wife Material Blueprint")
def text(v): return v[0] + ("\n" + v[1] if v[1] else "")
probs = []
n = 0
for stage, pages in D:
    for name, kind, path, w, a in pages:
        n += 1
        for tag, v in (("W", w), ("A", a)):
            t = text(v); L = len(t)
            if L > 250: probs.append(f"{name} {tag}: {L} chars")
            for b in BANS:
                if re.search(b, t, re.I) and not (b == r"\bfix\b(?! for you)" and "will fix" in t and v[3] == A):
                    probs.append(f"{name} {tag}: banned /{b}/")
            if re.search(r"\b300\+", t) and name not in COUNT_OK: probs.append(f"{name} {tag}: count")
            if v[1] and not re.search(r"\bthis ([\w-]+ )?(guide|checklist|worksheet|calculator|quiz|tracker|planner|checker|check-in|question list|list|rota|builder|name finder|birth plan builder|hospital bag checklist|night feed rota|milestone tracker|week-by-week tracker|program)\b", v[1]) and not re.search(r"^For .*?, The ", v[1]):
                probs.append(f"{name} {tag}: line 2 names no resource type")
print("pages:", n); print("\n".join(probs) or "lint clean")

if len(sys.argv) > 1 and sys.argv[1] == "--og-json":
    # guide hooks for the link preview cards (scripts/make-og.js reads scripts/og-hooks.json)
    import json
    hooks = {path: w[0] for _, pages in D for name, kind, path, w, a in pages if kind == "guide" and w[1]}
    json.dump(hooks, open("scripts/og-hooks.json", "w"), indent=1, ensure_ascii=False)
    print("wrote scripts/og-hooks.json:", len(hooks))
elif len(sys.argv) > 1:
    out = []
    for stage, pages in D:
        out.append(f"## {stage}\n")
        for name, kind, path, w, a in pages:
            out.append(f"### {name} ({kind})\n")
            out.append(f"`{path}`\n")
            for label, v in (("Winner", w), ("Alternate", a)):
                note = f" · {v[3]}" if v[3] else ""
                out.append(f"**{label}:** {v[2]} · {len(text(v))} characters{note}\n")
                out.append(v[0] + "\n")
                if v[1]: out.append(v[1] + "\n")
            out.append("**Your call:** \n")
    open(sys.argv[1], "w").write("\n".join(out))
