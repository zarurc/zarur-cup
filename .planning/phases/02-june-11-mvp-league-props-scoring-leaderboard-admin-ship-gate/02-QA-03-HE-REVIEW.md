# QA-03 — Hebrew copy review

All user-visible Hebrew strings from `messages/he.json` + live `prop_questions.prompt_he` rows.
Open this file in any editor with proper RTL/UTF-8 handling (VS Code, browser, etc.).

Sources:
- `messages/he.json` (committed, 217 lines)
- Supabase prod table `prop_questions` (live query 2026-05-27)

---

## messages/he.json

### common / wordmark / locale

- `common.loading` → טוען...
- `common.errorGeneric` → ⚠ משהו השתבש. נסו שוב בעוד רגע.
- `common.required` → ⚠ שדה חובה.
- `common.backToApp` → ← חזרה לאפליקציה
- `wordmark.primary` → ליגת זערור
- `wordmark.secondary` → Zarur Cup
- `localePill.switchTo` → EN
- `localePill.ariaLabel` → עברו לאנגלית

### tabs (bottom nav)

- `tabs.matches` → משחקים
- `tabs.bracket` → בראקט
- `tabs.leaderboard` → לוח
- `tabs.me` → אני

### home

- `home.placeholder` → ליגת זערור
- `home.redirectToMatches` → מעבר למשחקים...

### join

- `join.pageHeading` → הצטרפו לליגת זערור
- `join.subheading` → בחרו שם שיופיע בלוח התוצאות, והכניסו את הקוד המשפחתי.
- `join.nameLabel` → שם
- `join.nameHelper` → 2 עד 24 תווים — אותיות עברית, אנגלית, ספרות ורווחים.
- `join.namePlaceholder` → למשל: דני
- `join.codeLabel` → קוד הזמנה
- `join.codeHelper` → קוד משפחתי שקיבלתם בוואטסאפ.
- `join.submitIdle` → הצטרפו
- `join.submitLoading` → מצטרפים...
- `join.errors.invalid_code` → ⚠ הקוד שגוי. בדקו שוב בוואטסאפ המשפחתי.
- `join.errors.display_name_taken` → ⚠ השם הזה כבר תפוס — נסו שם אחר.
- `join.errors.name_length` → ⚠ השם חייב להיות בין 2 ל־24 תווים.
- `join.errors.name_chars` → ⚠ השם יכול להכיל רק אותיות עברית/אנגלית, ספרות ורווחים.
- `join.errors.auth_failed` → ⚠ משהו השתבש. נסו שוב בעוד רגע.

### empty states

- `empty.matches.heading` → המשחקים נפתחים ב-11 ביוני
- `empty.matches.body` → חזרו ביום הפתיחה כדי להגיש את הניחושים שלכם.
- `empty.bracket.heading` → הבראקט יפתח לקראת שלב הנוקאאוט
- `empty.bracket.body` → תוכלו לסמן את ההמשך החל מ-27 ביוני.
- `empty.leaderboard.heading` → לוח התוצאות נפתח עם הפתיחה
- `empty.leaderboard.body` → הניקוד יופיע אוטומטית אחרי המשחק הראשון.

### bracket — round labels

- `bracket.round32` → שלב ה-32
- `bracket.round16` → שלב ה-16
- `bracket.quarter` → רבע גמר
- `bracket.semi` → חצי גמר
- `bracket.final` → גמר
- `bracket.third` → משחק על המקום השלישי
- `bracket.champion` → גמר
- `bracket.winnerLabel` → מנצח
- `bracket.championTbdLabel` → טרם נקבע
- `bracket.tieAtNinetyLabel` → תיקו ב-90' (הארכה ממתינה)
- `bracket.emptyHeading` → העץ עוד לא הוזן
- `bracket.emptyBody` → ברגע שיתוכנן שלב הנוקאאוט, העץ יופיע כאן.

### bracket placeholders — group winners (A–L)

- `key_winner_group_a` → מנצחת בית A
- `key_winner_group_b` → מנצחת בית B
- `key_winner_group_c` → מנצחת בית C
- `key_winner_group_d` → מנצחת בית D
- `key_winner_group_e` → מנצחת בית E
- `key_winner_group_f` → מנצחת בית F
- `key_winner_group_g` → מנצחת בית G
- `key_winner_group_h` → מנצחת בית H
- `key_winner_group_i` → מנצחת בית I
- `key_winner_group_j` → מנצחת בית J
- `key_winner_group_k` → מנצחת בית K
- `key_winner_group_l` → מנצחת בית L

### bracket placeholders — group runners-up (A–L)

- `key_runner_up_group_a` → סגנית בית A
- `key_runner_up_group_b` → סגנית בית B
- `key_runner_up_group_c` → סגנית בית C
- `key_runner_up_group_d` → סגנית בית D
- `key_runner_up_group_e` → סגנית בית E
- `key_runner_up_group_f` → סגנית בית F
- `key_runner_up_group_g` → סגנית בית G
- `key_runner_up_group_h` → סגנית בית H
- `key_runner_up_group_i` → סגנית בית I
- `key_runner_up_group_j` → סגנית בית J
- `key_runner_up_group_k` → סגנית בית K
- `key_runner_up_group_l` → סגנית בית L

### bracket placeholders — 3rd-place qualifiers (1–8)

- `key_third_place_1` → שלישית 1
- `key_third_place_2` → שלישית 2
- `key_third_place_3` → שלישית 3
- `key_third_place_4` → שלישית 4
- `key_third_place_5` → שלישית 5
- `key_third_place_6` → שלישית 6
- `key_third_place_7` → שלישית 7
- `key_third_place_8` → שלישית 8

### bracket placeholders — R32 winners (1–16)

- `key_r32_m1_w` → מנצחת R32 משחק 1
- `key_r32_m2_w` → מנצחת R32 משחק 2
- `key_r32_m3_w` → מנצחת R32 משחק 3
- `key_r32_m4_w` → מנצחת R32 משחק 4
- `key_r32_m5_w` → מנצחת R32 משחק 5
- `key_r32_m6_w` → מנצחת R32 משחק 6
- `key_r32_m7_w` → מנצחת R32 משחק 7
- `key_r32_m8_w` → מנצחת R32 משחק 8
- `key_r32_m9_w` → מנצחת R32 משחק 9
- `key_r32_m10_w` → מנצחת R32 משחק 10
- `key_r32_m11_w` → מנצחת R32 משחק 11
- `key_r32_m12_w` → מנצחת R32 משחק 12
- `key_r32_m13_w` → מנצחת R32 משחק 13
- `key_r32_m14_w` → מנצחת R32 משחק 14
- `key_r32_m15_w` → מנצחת R32 משחק 15
- `key_r32_m16_w` → מנצחת R32 משחק 16

### bracket placeholders — R16 winners (1–8)

- `key_r16_m1_w` → מנצחת R16 משחק 1
- `key_r16_m2_w` → מנצחת R16 משחק 2
- `key_r16_m3_w` → מנצחת R16 משחק 3
- `key_r16_m4_w` → מנצחת R16 משחק 4
- `key_r16_m5_w` → מנצחת R16 משחק 5
- `key_r16_m6_w` → מנצחת R16 משחק 6
- `key_r16_m7_w` → מנצחת R16 משחק 7
- `key_r16_m8_w` → מנצחת R16 משחק 8

### bracket placeholders — QF winners (1–4)

- `key_qf_m1_w` → מנצחת רבע גמר 1
- `key_qf_m2_w` → מנצחת רבע גמר 2
- `key_qf_m3_w` → מנצחת רבע גמר 3
- `key_qf_m4_w` → מנצחת רבע גמר 4

### bracket placeholders — SF winners + losers

- `key_sf_m1_w` → מנצחת חצי גמר 1
- `key_sf_m2_w` → מנצחת חצי גמר 2
- `key_sf_m1_l` → מפסידת חצי גמר 1
- `key_sf_m2_l` → מפסידת חצי גמר 2

### matches / countdown

- `matches.cta` → הגישו את הניחושים לפני השריקה
- `countdown.next` → הקרוב:
- `countdown.kicksOffIn` → · בעוד

### props (page + ME card preamble)

- `props.cta` → נעלו את הניחושים לפני שריקת הפתיחה
- `props.lockedNote` → נעול — נפתח עם המשחק הראשון
- `props.saved` → נשמר
- `props.saveFailed` → הניחוש לא נשמר — הקישו לנסות שוב
- `props.lockedSaveFailed` → הניחושים נעולים. רעננו את הדף לראות את כולם.
- `props.empty.heading` → שאלות הטורניר יופיעו בקרוב
- `props.empty.body` → כאן יופיעו שאלות הטורניר לפני שריקת הפתיחה.
- `props.yourAnswerLabel` → הבחירה שלך
- `props.correctAnswerLabel` → התשובה הנכונה
- `props.headingPrivate` → השאלות שלך
- `props.ctaPrivate` → שאלות לפני הטורניר — ניתנות לעריכה עד 11 ביוני 19:00 UTC.רק אתם רואים את הבחירות שלכם.
- `props.lockedNotePrivate` → השאלות נעולות. רק אתם רואים את הבחירות שלכם.
- `props.notAnsweredLabel` → — (לא נענה)
- `props.awaitingGradeLabel` → ממתין לציון מנהל
- `props.ptsMaxSuffix` → נקודות מקסימום

### prediction / match cell

- `prediction.saved` → נשמר
- `prediction.saveFailed` → הניחוש לא נשמר — הקישו לנסות שוב
- `prediction.lockedSaveFailed` → המשחק ננעל בשריקת הפתיחה. הניחוש לא נשמר.
- `match.kickoffSrLabel` → שריקת פתיחה
- `match.lockedAria` → נעול בשריקת הפתיחה
- `match.actual` → סיום · תוצאה

### points badge

- `pts.exact` → מדויק
- `pts.goalDiff` → הפרש
- `pts.winner` → מנצח
- `pts.miss` → (לא קלע)
- `pts.correct` → מדויק

### matchesEmpty (post-tournament + loading)

- `matchesEmpty.post.heading` → הטורניר הסתיים
- `matchesEmpty.post.body` → תודה ששיחקתם. הטבלה הסופית סגורה.
- `matchesEmpty.loading.heading` → המשחקים נטענים
- `matchesEmpty.loading.body` → רק רגע ואנחנו טוענים את הלוח.

### leaderboard

- `leaderboard.heading` → טבלה
- `leaderboard.rankLabel` → דירוג
- `leaderboard.totalLabel` → סך הכל
- `leaderboard.league` → ליגה: {n}
- `leaderboard.bracketPlaceholder` → נוקאאוט: 0 — נפתח 27 ביוני
- `leaderboard.props` → שאלות: {n}
- `leaderboard.expandAriaOpen` → הצג פירוט
- `leaderboard.expandAriaClose` → הסתר פירוט
- `leaderboard.empty.heading` → הטבלה נפתחת עם התוצאה הראשונה
- `leaderboard.empty.body` → הדירוג יופיע ברגע שהמנהל יזין תוצאה.

### me (profile page)

- `me.joinedAt` → הצטרפת ב־{joined_at_local}
- `me.localeLabel` → שפה
- `me.logout` → יציאה
- `me.logoutAria` → התנתקות מהחשבון הנוכחי
- `me.totalLabel` → הסך שלך
- `me.propsCardHeading` → שאלות לפני הטורניר
- `me.propsCardBody` → הבחירות הפרטיות שלך — ענה לפני 11 ביוני 19:00 UTC
- `me.propsStatusEditable` → ניתן לעריכה
- `me.propsStatusLocked` → נעול
- `me.propsStatusEditableAria` → השאלות ניתנות לעריכה עד הבעיטה הראשונה
- `me.propsStatusLockedAria` → השאלות נעולות

### notFound

- `notFound.heading` → הדף לא נמצא
- `notFound.body` → אולי שגיאת הקלדה בקישור?
- `notFound.backLink` → חזרה למשחקים

---

## prop_questions.prompt_he (live in Supabase prod)

7 rows, ordered as inserted (no display_order column; rendering order on `/me/props` follows `created_at`).

### 1. WINNER (10 pts, single_team)
EN: Who will win the World Cup?
HE: מי תזכה בגביע העולם?

### 2. RUNNER_UP (5 pts, single_team)
EN: Who will be the runner-up?
HE: מי תהיה הסגנית הראשונה?

### 3. TOP_SCORER (10 pts, single_player)
EN: Who will be the tournament top scorer?
HE: מי יהיה הכובש המוביל בטורניר?

### 4. GOLDEN_BOOT (5 pts, single_player)
EN: Who will win the Golden Boot (Top Scorer trophy)?
HE: מי יזכה בנעל הזהב?

### 5. GOLDEN_BALL (5 pts, single_player)
EN: Who will win the Golden Ball (Best Player)?
HE: מי יזכה בכדור הזהב (השחקן הטוב ביותר)?

### 6. BIGGEST_UPSET (3 pts, single_team)
EN: Which team will provide the biggest upset?
HE: איזו נבחרת תספק את ההפתעה הגדולה ביותר?

### 7. DARK_HORSE_SF (4 pts, single_team)
EN: Which non-favourite will reach the semi-finals?
HE: איזו נבחרת לא-מועדפת תגיע לחצי הגמר?

---

## Notes / things to scrutinize

1. **Gender consistency on team-shaped slots.** All bracket placeholders use feminine (`מנצחת`, `סגנית`, `מפסידת`, `שלישית`, `נבחרת`) since נבחרת is feminine — good. But `bracket.champion = אלוף` (masculine). Consider `אלופה` for consistency, or leave `אלוף` if you read it as the team's title rather than agreeing with נבחרת's gender.

2. **TOP_SCORER vs GOLDEN_BOOT** are nearly the same question in English; in HE the distinction is `הכובש המוביל בטורניר` (descriptive) vs `נעל הזהב` (trophy name). Make sure the family won't read them as duplicates and answer the same way.

3. **`props.ctaPrivate` and `me.propsCardBody`** use singular masculine: `אתה רואה`, `ענה`. The rest of the app uses plural `אתם / הגישו / נסו / בחרו`. Should the props copy switch to plural too?

4. **`bracket.tieAtNinetyLabel` = תיקו ב-90' (הארכה ממתינה)** — check the bidi when `90'` sits inside an HE paragraph.

5. **`leaderboard.bracketPlaceholder` = נוקאאוט: 0 — נפתח 27 ביוני** — explicitly called out in the QA-03 checklist; confirm it reads naturally.

6. **`empty.matches.heading` = המשחקים פותחים ב-11 ביוני** vs **`me.propsCardBody` = ענה לפני 11 ביוני 19:00 UTC**. Numbers + Hebrew bidi here matters — confirm both render readably.

7. **`localePill.ariaLabel` = עברו לאנגלית** is plural ("you (pl.) switch") — consistent with the rest of the app's plural register.

8. **Bracket placeholders use `R32` / `R16`** as ASCII abbreviations inside HE. Family-friendly? Or prefer `שלב ה-32` / `שלב ה-16` (which already exists as `bracket.round32` / `bracket.round16`)?

Flag any of these (or anything else you spot) and I'll patch `messages/he.json` + UPDATE `prop_questions.prompt_he` rows.
