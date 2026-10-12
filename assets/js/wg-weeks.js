/* Wholesome Girlies: pregnancy weeks and the bands behind "This week" (CLAUDE.md section 10, "This week").
 *
 * One place for the Week-by-Week Tracker's note for each week and for the app home's "This week" card, so the two
 * never drift apart. The tracker (pregnancy/tools/week-by-week-tracker) takes its note from WGWeeks.noteFor, and the app
 * home card (wg-ideas.js) takes its week from WGWeeks.weekFromDue, counted the way the tracker counts it: the start
 * date is the due date minus 280 days, and the week is the whole days since then divided by 7, rounded down.
 * scripts/check-pages.py checks that the tracker loads this file and has no note function of its own.
 * Nothing here reads or writes her storage.
 */
(function (w) {
  'use strict';
  var DAY = 864e5;

  // The tracker's note for each week of pregnancy.
  function noteFor(wk) {
    if (wk < 5) return 'Very early. A test may only just be positive. Start folic acid if you have not.';
    if (wk < 9) return 'The baby’s major organs are forming. Nausea and tiredness are common. Register at an antenatal clinic if you have not (this first visit is called booking).';
    if (wk < 13) return 'Ending the first trimester. Your first scan is often around now. Sickness often begins to ease.';
    if (wk < 19) return 'The second trimester. Many women feel more energy. You may start to show.';
    if (wk < 25) return 'Around now many women feel the first movements. The detailed scan that checks how your baby is growing (the anomaly scan) usually happens near week 20.';
    if (wk < 29) return 'Entering the third trimester. Baby is growing fast. Start thinking about your hospital bag and birth plan.';
    if (wk < 37) return 'Getting closer. Rest when you can, watch baby’s movements, and pack your hospital bag by about week 36.';
    if (wk <= 42) return 'Full term. Baby could arrive any time. Know the signs of labour and when to go in.';
    return 'That is beyond a typical pregnancy length, please check the date with your midwife.';
  }

  // Her week from a saved due date (YYYY-MM-DD): the tracker's own count. Null when the date is not a date.
  function weekFromDue(due, now) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due || '');
    if (!m) return null;
    var lmp = new Date(+m[1], +m[2] - 1, +m[3] - 280), n = now || new Date();
    return Math.floor((n - lmp) / DAY / 7);
  }

  // The bands of "This week": tools, guides (path and title) and the program for each stretch.
  var BANDS = {
    t1: { tools: ['/pregnancy/tools/due-date-calculator', '/pregnancy/tools/week-by-week-tracker', '/pregnancy/tools/antenatal-appointment-questions'],
      guides: [['/pregnancy/guides/trimester-by-trimester', 'Pregnancy, trimester by trimester']], stage: 'pregnancy' },
    t2: { tools: ['/pregnancy/tools/week-by-week-tracker', '/pregnancy/tools/safe-foods-checklist', '/pregnancy/tools/antenatal-appointment-questions'],
      guides: [['/pregnancy/guides/nigerian-foods-in-pregnancy', 'Are tiger nut, bitter kola, garden egg, cloves and Lipton safe in pregnancy?']], stage: 'pregnancy' },
    t3: { tools: ['/pregnancy/tools/hospital-bag-checklist', '/pregnancy/tools/birth-plan-builder', '/pregnancy/tools/baby-essentials-checklist'],
      guides: [['/pregnancy/guides/trimester-by-trimester', 'Pregnancy, trimester by trimester']], stage: 'pregnancy' },
    pp: { tools: ['/postpartum/tools/recovery-checklist', '/postpartum/tools/night-feed-rota', '/postpartum/tools/check-up-questions'],
      guides: [['/postpartum/guides/postpartum-recovery-timeline', 'Your postpartum recovery timeline, week by week']], stage: 'postpartum' },
    b1: { tools: ['/parenting/tools/milestone-tracker', '/parenting/tools/vaccination-tracker', '/parenting/tools/feeding-sleep-tracker'],
      guides: [['/parenting/guides/safe-sleep-for-newborns', 'Newborn sleep position and safe sleep'], ['/parenting/guides/when-to-take-your-baby-to-hospital', 'When to take your baby to the hospital']], stage: 'parenting' },
    b2: { tools: ['/parenting/tools/milestone-tracker', '/parenting/tools/baby-routine-planner', '/parenting/tools/feeding-sleep-tracker'],
      guides: [['/parenting/guides/babyproofing-your-home', 'Babyproofing your home in Nigeria'], ['/parenting/guides/when-to-take-your-baby-to-hospital', 'When to take your baby to the hospital']], stage: 'parenting' },
    b3: { tools: ['/parenting/tools/first-foods-planner', '/parenting/tools/milestone-tracker', '/parenting/tools/vaccination-tracker'],
      guides: [['/parenting/guides/starting-solids', 'Starting solids: first foods, made simple'], ['/parenting/guides/babyproofing-your-home', 'Babyproofing your home in Nigeria']], stage: 'parenting' }
  };
  // Pregnancy week to band, and a baby's age in days to band (birth to 3 months, 4 to 6 months, 7 to 12 months; nothing after).
  function pregnancyBand(wk) { return wk < 13 ? 't1' : wk < 28 ? 't2' : 't3'; }
  function babyBand(days) { return days < 122 ? 'b1' : days < 213 ? 'b2' : days < 396 ? 'b3' : ''; }

  w.WGWeeks = { noteFor: noteFor, weekFromDue: weekFromDue, bands: BANDS, pregnancyBand: pregnancyBand, babyBand: babyBand };
})(window);
