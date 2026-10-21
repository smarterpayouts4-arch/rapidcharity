# RAPID application form - field spec

Compiled 2026-10-21 (America/New_York). This is the spec for building the form in Firebase. The full detail is in `Form Field Spec.xlsx`. The seed data is in `lists/*.json` and `fields.json`. A reference matcher is in `typeahead.js`.

## Principles

- **Keep it short.** 12 short steps. A field appears only when it is needed. Labels are in plain language.
- **Store ids, not text.** Every dropdown and typeahead saves a stable list id, such as `inst_king_edward_medical_university` or `prog_bsn_generic`.
- **"Other" everywhere.** Every list-backed select and typeahead has an "Other (please type it)" option. The only exceptions are plain Yes/No questions. Picking Other shows `<key>Other` ("Please type it here", 2-120 characters). The application is then flagged `needsReview` and the value is queued in `otherSubmissions` for an admin to map. In the Fields sheet these fields have **Allow Other = Y** and an **Other field key**.
- **No duplicates.** CNIC and email must each be unique per cycle. The Firestore doc id is `{cycle}_{cnicDigits}`, so a second submission is blocked and the applicant is told to log in and edit instead.

## 1. About you

Who is applying. Name split into first/last; CNIC is the duplicate check.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| First name | `firstName` | text | Y |  |  |
| Last name (family name) | `lastName` | text | Y |  |  |
| CNIC / B-Form number | `cnic` | text | Y |  |  |
| Gender | `gender` | select | Y | gender | Y -> `genderOther` |
| Religion | `religion` | select | Y | religion | Y -> `religionOther` |
| Are you applying in the special-needs (e.g. visually impaired) category? | `specialNeeds` | select | Y | yesNo |  |
| Have you received a RAPID scholarship before? | `previousRapid` | select | Y | yesNo |  |

## 2. Contact

One mobile number, one email (both validated; email unique).

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Mobile number | `mobile` | phone | Y |  |  |
| Email | `email` | email | Y |  |  |
| Home address (house, street, area) | `addressLine` | text | Y |  |  |
| City | `homeCity` | typeahead | Y | cities | Y -> `homeCityOther` |
| Province / region | `homeProvince` | select | Y | provinces | Y -> `homeProvinceOther` |

## 3. Family & income

Parents' occupation and income (category + number) for need assessment.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Father's name | `fatherName` | text | Y |  |  |
| Father's occupation | `fatherOccupation` | select | Y | occupations | Y -> `fatherOccupationOther` |
| Father's monthly income (PKR) | `fatherIncome` | number | C: hidden if occupation = Deceased; 0 allowed |  |  |
| Mother's name | `motherName` | text | Y |  |  |
| Mother's occupation | `motherOccupation` | select | Y | occupations | Y -> `motherOccupationOther` |
| Mother's monthly income (PKR) | `motherIncome` | number | C: hidden if occupation = Deceased; 0 allowed |  |  |
| Number of brothers and sisters | `siblingsCount` | number | Y |  |  |
| How many of them are studying? | `siblingsStudying` | number | N |  |  |
| Are you employed? | `employment` | select | Y | employmentStatus | Y -> `employmentOther` |

## 4. Church

Church / worship place and pastor or priest (for the recommendation letter).

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Church / worship place | `churchName` | text | Y |  |  |
| Pastor / priest name | `pastorName` | text | Y |  |  |

## 5. What you are studying now

Level -> institution -> programme (typeaheads), start and end term, current semester/year.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Level of study | `currentLevel` | select | Y | degreeLevels | Y -> `currentLevelOther` |
| Institution (university / college / school) | `institutionId` | typeahead | Y | institutions | Y -> `institutionIdOther` |
| Campus | `campus` | select | C: shown only if the chosen institution has more than one campus | institutions.campuses | Y -> `campusOther` |
| Programme / degree | `programId` | typeahead | Y | programs | Y -> `programIdOther` |
| Specialisation / subjects (only if not in the programme name) | `specialisation` | text | C: shown for legacy BA/BSc/MA/MSc, Post-Basic diploma, MBA/MS majors, or programme = Other |  |  |
| Study system | `studySystem` | select | Y | studySystems | Y -> `studySystemOther` |
| Started in (term) | `admissionTerm` | select | Y | terms | Y -> `admissionTermOther` |
| Expected to finish in (term) | `expectedCompletionTerm` | select | Y | terms | Y -> `expectedCompletionTermOther` |
| Current semester | `currentSemester` | number | C: studySystem = Semester |  |  |
| Current year / professional | `currentYear` | select | C: studySystem = Annual | yearOfStudy | Y -> `currentYearOther` |
| Status | `enrolmentStatus` | select | Y | enrolmentStatus | Y -> `enrolmentStatusOther` |

## 6. University results (one entry per term)

Shown only if you have finished at least one term. Each entry is tied to a real term, never "Semester 1".

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| University results (add one per completed term) | `termResults` | repeatable group | C: required (>=1) unless enrolmentStatus = Newly admitted; max 14 |  |  |
| Term | `termResults.term` | select | Y | terms | Y -> `termResults.termOther` |
| How are your results shown? | `termResults.resultFormat` | select | Y | resultFormats | Y -> `termResults.resultFormatOther` |
| GPA scale | `termResults.gpaScale` | select | C: resultFormat in (SGPA, CGPA, Both) | gpaScales | Y -> `termResults.gpaScaleOther` |
| Semester GPA (SGPA) | `termResults.sgpa` | number | C: resultFormat in (SGPA, Both) |  |  |
| Cumulative GPA (CGPA) | `termResults.cgpa` | number | C: resultFormat in (CGPA, Both) |  |  |
| Percentage | `termResults.percentage` | number | C: resultFormat = Percentage |  |  |
| Marks obtained | `termResults.marksObtained` | number | C: resultFormat = Marks |  |  |
| Total marks | `termResults.marksTotal` | number | C: resultFormat = Marks |  |  |
| Percentage (calculated) | `termResults.marksPercent` | computed | auto |  |  |
| Which grade list is on your card? | `termResults.gradeScheme` | select | C: resultFormat = Letter grade AND more than one scheme fits the level (e.g. Matric/Inter exam year 2026-2028; O-Level: A*-E vs 9-1) | gradeSchemes | Y -> `termResults.gradeSchemeOther` |
| Grade | `termResults.letterGrade` | select | C: resultFormat = Letter grade | letterGrades | Y -> `termResults.letterGradeOther` |
| Division | `termResults.division` | select | C: resultFormat = Division | divisions | Y -> `termResults.divisionOther` |
| Result | `termResults.passFail` | select | C: resultFormat = Pass/Fail only | passFail | Y -> `termResults.passFailOther` |
| Upload result document (optional) | `termResults.resultDoc` | file | N |  |  |
| [admin] Estimated % | `termResults.estPct` | computed | auto |  |  |
| [admin] Estimated GPA on 4.0 | `termResults.estGpa4` | computed | auto |  |  |

## 7. Earlier education

Matric / O-Level and Intermediate / A-Level (plus any earlier degree). Results go here, not in Section 6.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Earlier education (add Matric/O-Level and Inter/A-Level; add a previous degree if you have one) | `priorEducation` | repeatable group | Y: Matric/O-Level (or equivalent) required for everyone; Inter/A-Level required if currentLevel is university-level; max 6 |  |  |
| Level | `priorEducation.level` | select | Y | degreeLevels | Y -> `priorEducation.levelOther` |
| Group / programme | `priorEducation.programId` | typeahead | Y | programs | Y -> `priorEducation.programIdOther` |
| Board | `priorEducation.board` | select | C: level in (Matric, Intermediate, DAE) | examBoards | Y -> `priorEducation.boardOther` |
| School / college / university | `priorEducation.institutionId` | typeahead | C: level is a degree (ADP and above), O/A-Level | institutions | Y -> `priorEducation.institutionIdOther` |
| Year passed (or expected) | `priorEducation.examYear` | number | Y |  |  |
| Result status | `priorEducation.resultStatus` | select | Y | resultStatus | Y -> `priorEducation.resultStatusOther` |
| How are your results shown? | `priorEducation.resultFormat` | select | C: resultStatus != Awaited | resultFormats | Y -> `priorEducation.resultFormatOther` |
| GPA scale | `priorEducation.gpaScale` | select | C: resultFormat in (SGPA, CGPA, Both) | gpaScales | Y -> `priorEducation.gpaScaleOther` |
| Semester GPA (SGPA) | `priorEducation.sgpa` | number | C: resultFormat in (SGPA, Both) |  |  |
| Cumulative GPA (CGPA) | `priorEducation.cgpa` | number | C: resultFormat in (CGPA, Both) |  |  |
| Percentage | `priorEducation.percentage` | number | C: resultFormat = Percentage |  |  |
| Marks obtained | `priorEducation.marksObtained` | number | C: resultFormat = Marks |  |  |
| Total marks | `priorEducation.marksTotal` | number | C: resultFormat = Marks |  |  |
| Percentage (calculated) | `priorEducation.marksPercent` | computed | auto |  |  |
| Which grade list is on your card? | `priorEducation.gradeScheme` | select | C: resultFormat = Letter grade AND more than one scheme fits the level (e.g. Matric/Inter exam year 2026-2028; O-Level: A*-E vs 9-1) | gradeSchemes | Y -> `priorEducation.gradeSchemeOther` |
| Grade | `priorEducation.letterGrade` | select | C: resultFormat = Letter grade | letterGrades | Y -> `priorEducation.letterGradeOther` |
| Division | `priorEducation.division` | select | C: resultFormat = Division | divisions | Y -> `priorEducation.divisionOther` |
| Result | `priorEducation.passFail` | select | C: resultFormat = Pass/Fail only | passFail | Y -> `priorEducation.passFailOther` |
| Upload result document (optional) | `priorEducation.resultDoc` | file | N |  |  |
| [admin] Estimated % | `priorEducation.estPct` | computed | auto |  |  |
| [admin] Estimated GPA on 4.0 | `priorEducation.estGpa4` | computed | auto |  |  |

## 8. Fees & other scholarships

Fee for the term you are applying for, and other support.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Fee for the term you are applying for (PKR) | `feeAmount` | number | Y |  |  |
| Fee is for | `feeTerm` | select | Y | terms | Y -> `feeTermOther` |
| Do you receive any other scholarship? | `otherScholarship` | select | Y | yesNoPending |  |
| Which scholarship and how much? | `otherScholarshipDetail` | text | C: otherScholarship in (Yes, Applied - pending) |  |  |

## 9. Your goals

Two short answers.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| What is your goal / dream in life? | `goal` | textarea | Y |  |  |
| How can you support our community? | `communitySupport` | textarea | Y |  |  |

## 10. References & how you heard about RAPID

One faculty reference and one family reference.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Faculty reference - name | `facultyRefName` | text | Y |  |  |
| Family reference - name | `familyRefName` | text | Y |  |  |
| Family reference - relationship | `familyRefRelation` | select | Y | relationships | Y -> `familyRefRelationOther` |
| How did you hear about RAPID? | `howHeard` | select | Y | howHeard | Y -> `howHeardOther` |

## 11. Documents

One upload slot per document type; files are renamed automatically. Result documents are uploaded inside Sections 6 and 7.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| Your CNIC / B-Form (front & back) | `docApplicantId` | file | Y | documentTypes |  |
| Recent photo | `docPhoto` | file | Y | documentTypes |  |
| Admission letter or student card | `docAdmissionProof` | file | Y | documentTypes |  |
| Fee voucher for the term | `docFeeVoucher` | file | Y | documentTypes |  |
| Recommendation letter from your pastor / priest | `docRecommendation` | file | Y | documentTypes |  |
| Father / mother / guardian CNIC | `docGuardianId` | file | Y | documentTypes |  |
| Income proof (salary slip / affidavit) | `docIncomeProof` | file | N | documentTypes |  |
| Death certificate | `docDeathCert` | file | C: fatherOccupation or motherOccupation = Deceased | documentTypes |  |
| Disability certificate | `docDisabilityCert` | file | C: specialNeeds = Yes | documentTypes |  |
| Anything else? (optional) | `docOther` | file | N | documentTypes |  |
| Label for the extra document | `docOtherLabel` | text | C: docOther uploaded |  |  |

## 12. Review & submit

Declaration and submit.

| Field | Key | Type | Required | List | Other |
|---|---|---|---|---|---|
| I confirm the information is true and I agree RAPID may verify it | `declaration` | checkbox | Y |  |  |
| [system] Application ID | `applicationId` | computed | auto |  |  |
| [system] Applicant category | `category` | computed | auto |  |  |
| [system] Needs review | `needsReview` | computed | auto |  |  |

## Results: how the format question works

Each university term entry (Section 6) and each earlier-education entry (Section 7) starts with **"How are your results shown?"**. The options are: Semester GPA (SGPA), Cumulative GPA (CGPA), Both SGPA and CGPA, Percentage, Marks obtained / total marks, Letter grade, Division, Pass / Fail only, or Other. Only the matching inputs appear:

| Choice | Fields shown | Validation |
|---|---|---|
| SGPA | GPA scale (4.0 / 5.0 / 10.0 / Other) + SGPA | 0 <= SGPA <= scale, 2 decimals. A number above the scale (e.g. 85) gets the prompt "did you mean Percentage?" |
| CGPA | GPA scale + CGPA | 0 <= CGPA <= scale |
| Both | GPA scale + SGPA + CGPA | both <= scale |
| Percentage | Percentage | 0-100. Values from 0 to 1 are rejected ("type 75, not 0.75") |
| Marks | Marks obtained + Total marks, with the percentage calculated live (read-only) | obtained >= 0, total > 0, obtained <= total, total <= 5000 |
| Letter grade | Grade list (asked only when ambiguous) + Grade | the grade must belong to the grade list. The list is chosen automatically: university = HEC; A-Level = Cambridge; Matric/Inter up to 2025 = BISE old list. "Which grade list is on your card?" appears only for Matric/Inter exams from 2026-2028 (IBCC phase-in) and for O-Level (A*-E or 9-1) |
| Division | Division (1st / 2nd / 3rd / Fail) |  |
| Pass / Fail | Pass / Fail / Passed in supplementary |  |

Every entry also has an optional **"Upload result document"**. Rules across entries: terms must be unique and fall between the admission term and now. Matric year < Inter year < degree years. Matric/Inter results cannot be entered as university terms; they go in Section 7. Two admin-only computed fields, `estPct` and `estGpa4`, hold an **estimate** for comparison only. Applicants never see them.

## Grading tables used (sources)

- **BISE, old 7-point list (exams up to 2025):** A-1/A+ 80%+, A 70-79, B 60-69, C 50-59, D 40-49, E 33-39 (pass mark 33%), F below 33. Divisions: 1st 60%+, 2nd 45-59.99, 3rd 33-44.99. Source: BISE Sahiwal, Gujranwala and Bahawalpur grading pages.
- **IBCC, new 10-point list (from the 1st Annual Exam 2026, fully adopted by 2028):** A++ 95-100 (5.0), A+ 90-94 (4.7), A 85-89 (4.3), B++ 80-84 (4.0), B+ 75-79 (3.7), B 70-74 (3.3), C 60-69 (3.0), D 50-59 (2.0), E 40-49 (1.0), U below 40. The pass mark is 40%, and cards show only grades and grade points. Source: IBCC FAQ; Nuffic table.
- **HEC 4.0 semester scale:** A 3.67-4.00 / 85%+, A- 3.34-3.66 / 80-84, B+ 3.01-3.33 / 75-79, B 2.67-3.00 / 71-74, B- 2.34-2.66 / 68-70, C+ 2.01-2.33 / 64-67, C 1.67-2.00 / 61-63, C- 1.31-1.66 / 58-60, D+ 1.01-1.30 / 54-57, D 0.10-1.00 / 50-53, F below 50. A CGPA converts to the **minimum** percentage of its band (3.00 -> 71%). HEC also gives an annual-system table: 85+ A 4.0, 70-84 A-, 55-69 B, 45-54 C, 33-44 D. Source: HEC *Policy Guidelines for Uniform Semester System*, sections 13.1-13.2.
- **Cambridge O/A Level (IBCC equivalence):** A* above 90 (set per subject each session; 2026: 93-95), A 85, B 75, C 65, D 55, E 45. F and G are not accepted. GCSE 9-1: 9 above 90, 8 87, 7 82, 6 77, 5 70, 4 60, 3 50, 2 40. Source: IBCC *Conversion for Equivalence*; Cambridge International Pakistan page; IBCC A-Level 2026 A* table.
- **UHS:** MBBS/BDS professional exams need 50% in written, 50% in oral/practical and 50% aggregate at the same sitting. "Distinction" means 85%+ in a subject. Post-RN B.Sc Nursing pass mark is 50%. Form: marks or percentage per professional year. Source: UHS statutes.
- **KMU:** professional exams need 50% in theory and 50% in practical (KMU rules as published by KGMC). For KMU semester programmes I found only a third-party scale (A 85+ = 4.00 ... F below 45), which I have marked **unverified**. Applicants enter their GPA, and letter grades use the HEC list.
- **PNMC:** has no letter scale of its own; BSN results come on the awarding university's HEC-style transcript. PNMC's 2021 regulations say each course must be passed with at least 60% and CGPA must stay at 2.5+ to progress. This came from a search summary, so check the wording in the PDF. Diplomas (LHV, CMW, CNA, Midwifery) are reported as marks/percentage by the provincial nursing boards.

Full tables, the estimates and every citation URL are in the **Grading Scales** sheet and `lists/gradingScales.json`.

## Canonical naming rules

**Institutions**
- One entry per HEC-recognised university. Its campuses and its own constituent schools are folded into `campuses[]` (for example "College of Nursing, KEMU", "Iqra University H-9 Campus", "KMU Institute of Medical Sciences, Kohat"). The Campus select appears only when there is more than one campus.
- Separately named colleges are separate entries even when they are affiliated to a university. This covers PM&DC medical/dental colleges, PNMC nursing schools and affiliated colleges. A dental section of a medical college is folded into that college, which becomes type "medical & dental college".
- When two different colleges have the same name, each canonical name gets the format **"Name - City"**.
- Each canonical name keeps the official spelling and drops the abbreviation in brackets; the abbreviation becomes `shortName` (e.g. AUST, BUITEMS). Obvious typos and abbreviations in regulator lists are expanded in the label (CON -> College of Nursing, Collage -> College), and the original spelling is kept as an alias. Two names follow the institutions' own styling: "Forman Christian College (A Chartered University)" and "Kinnaird College for Women University".
- `type` is one of: university, medical college, dental college, medical & dental college, nursing college, other college (degree/affiliated), school-college. `recognisedBy` is HEC / PMDC / PNMC, or "none found (from applicant data - verify)".

**Programmes**
- Named as **`<Award> <Major>`**: BS Computer Science, MPhil Chemistry, MS Clinical Psychology, BE Civil Engineering (BE and BSc Engineering are one entry), BSc (Hons) Agronomy, Associate Degree in Computer Science.
- Single-name degrees stand alone: MBBS, BDS, Pharm-D, DPT, DVM, BEMS, LLB (5-year), B.Arch, BBA, BS Business Studies (BSB, FCCU), MBA, Executive MBA, CA, ACCA, CMA, CIMA.
- Nursing is split into one entry per track: **BSN Generic (4-year)**, **Post-RN BSN (2-year)**, BS Midwifery - Generic, Post-RM BS Midwifery, MSN, PhD Nursing, Diploma in General Nursing (3-year, RN; closed 2018), Diploma in Midwifery (1-year), Community Midwife (CMW), Lady Health Visitor (LHV), Certified Nursing Assistant (CNA, formerly LPN), Family Welfare Worker, and Post-Basic Specialty Diploma. A bare "BSN" or "BS Nursing" resolves to the 4-year Generic BSN, which is PNMC's naming. Post-RN BSN is always the second suggestion.
- Old 2-year BA/BSc/MA/MSc/B.Com are generic entries plus a Specialisation box. A plain "BSc <subject>" typed today resolves to the 4-year BS.
- Each entry has a `code` (BSCS, BSN, PRBSN, MBBS, BBA ...), a `levelCode` that drives the level filter, a `fieldGroup`, a `durationYears`, and pipe-separated `aliases`.

## Typeahead (summary)

Normalisation: lower-case; & -> and; dots and apostrophes are dropped; other punctuation becomes a space. Stop-words are removed (institutions: the/of/and/university; programmes: the/of/in/and/hons/programme), and programmes also lose semester/year noise. Results are ranked: exact short name/code > exact alias > prefix > word prefix > contains > all words. Every normalised alias belongs to exactly **one** entry. A generic key that is shared, such as "rti" or "cmw school", shows every candidate with its city. Tested with `typeahead.js`: FCCU/forman -> FCCU; KEMU -> King Edward Medical University; KC/kinnaird -> Kinnaird; BSN or "bachelor nursing" -> BSN Generic; "post rn" -> Post-RN BSN; "bs cs" -> BS Computer Science.

## "Other" review workflow

1. The applicant picks Other and types the value. The form saves `{key: "other", keyOther: "..."}` and sets `needsReview`.
2. A Cloud Function writes `otherSubmissions/{id}` with `{listId, fieldKey, rawValue, normalisedKey, applicationId, status: "pending"}`. Submissions with the same normalised key are grouped.
3. The admin either **maps** it to an existing id (the raw text becomes an alias and the application is updated), **adds** a new item (institutions need an HEC/PM&DC/PNMC source, otherwise the source is "from applicant data"), or **rejects** it.
4. Each decision is also written to the normalizer (ProgramAliases / InstitutionAliases), so old sheets and new forms resolve the same way.

## Current workbook -> form fields

| Workbook column | Form field(s) | Note |
|---|---|---|
| S. No. | applicationId (system) | Generated; not asked |
| Full Name | firstName + lastName | Split |
| Contact | mobile + email | Split, validated |
| Gender / Religion | gender + religion | Split |
| Address | addressLine + homeCity + homeProvince | City from list |
| Employment | employment |  |
| Father's Occupation & Income | fatherName + fatherOccupation + fatherIncome | Category + number |
| Mother's Occupation & Salary | motherName + motherOccupation + motherIncome |  |
| Siblings | siblingsCount + siblingsStudying | Free-text "activities" cut |
| Church / Worship Place | churchName |  |
| Pastor / Priest | pastorName |  |
| Degree Programme | currentLevel + programId (+ specialisation) | Typeahead, canonical id |
| College / University | institutionId (+ campus) | Typeahead, canonical id |
| College / University Address | institution city/province come from the list; campus select | Not typed by applicant |
| Spring 2025 Semester GPA | termResults[term=Spring 2025] | Per-term repeatable entry |
| Fall 2025 Semester | termResults[term=Fall 2025] |  |
| Spring 2026 | termResults[term=Spring 2026] |  |
| Fall 2026 | termResults[term=Fall 2026] |  |
| Spring 2027 | termResults[term=Spring 2027] (normally empty - term applied for) |  |
| Period of Study | admissionTerm + expectedCompletionTerm (+ programme duration from list) | No free-typed ranges |
| Last Semester to Study | expectedCompletionTerm |  |
| Total Fee for Spring 2027 | feeAmount + feeTerm |  |
| 50% Fee for Spring 2027 Semester | computed admin-side (feeAmount x RAPID share) | Not asked |
| How Did You Come to Know RAPID? | howHeard |  |
| Have You Received a Scholarship from RAPID Before? | previousRapid |  |
| Have You Received Any Other Scholarship? | otherScholarship + otherScholarshipDetail |  |
| What Is Your Goal and Dream in Life? | goal |  |
| How Can You Support Our Community? | communitySupport |  |
| Reference from Your Institution's Faculty — Name | facultyRefName |  |
| Reference from Your Family | familyRefName + familyRefRelation |  |
| Remarks If Any | admin-only (not on the form); results notes now live in priorEducation / termResults | Matric/Inter results typed here move to Section 7 |
| Status | admin-only (duplicate status is prevented by unique CNIC + email) |  |
| Documents Folder | Section 11 uploads + resultDoc per result entry (Cloud Storage path {cycle}/{applicationId}/) | Auto-renamed |
| (sheet name: Medical / Nursing / Pre-Grads / Grads / Post-Grads / KC / FCCU / BBA / Blind) | category (computed) + specialNeeds | Derived, not asked |

## Fields cut or kept optional

- **Date of birth**: Not in the current workbook; CNIC already identifies the applicant.
- **Christian denomination**: Church name is enough for the recommendation.
- **Marital status**: Not used in decisions today.
- **Landline / second phone**: One validated mobile is enough.
- **Parent CNIC numbers (typed)**: Guardian CNIC is uploaded instead.
- **Siblings' activities (free text)**: Replaced by two numbers.
- **Reference phone numbers**: Add later only if RAPID actually calls references.
- **College / University address**: Comes from the institution list.
- **50% fee amount**: Calculated by RAPID.
- **Separate "Period of Study"**: Derived from start/end terms.
- **Income proof upload**: Kept optional; could be cut entirely.
- **Siblings studying count**: Optional; cut if not used in scoring.
- **Campus select**: Only appears when the institution has several campuses.

## Applicant spellings

- I checked 128 programme spellings and 183 institution spellings: everything in the clean workbook plus the earlier normalizer raws. **117 programme and 177 institution spellings resolve to exactly one entry** through an alias.
- Calls to confirm: **"BS Nursing"-type spellings with no track** go to BSN Generic by naming convention, so check any Post-RN students. **"Bachelor in Business Administration BSB"** goes to BSB because the explicit code wins. **"Superior"** goes to The Superior University, but the earlier normalizer filed it under Superior Group of Colleges. **"Islamia University"** goes to Bahawalpur, based on the applicant's address. **New International College of Nursing** has two PNMC campuses, so the campus needs confirming.
- **Unresolved (17)**: these spellings have no major or level, are placeholders, or are in the wrong field.
  - Programme: "1st year" (unresolved: level only (Intermediate Part-I?) - group/subject missing)
  - Programme: "Bachelor in 23 majors" (unresolved: major missing)
  - Programme: "Bachelor of Science" (unresolved: major missing)
  - Programme: "Bachelor of Studies" (unresolved: major missing)
  - Programme: "Bachelors in Studies" (unresolved: major missing)
  - Programme: "Bachelors of Studies" (unresolved: major missing)
  - Programme: "Bsc. honor" (unresolved: major missing)
  - Programme: "Bsc.Hons" (unresolved: major missing)
  - Programme: "BST(Bachelors of studies)" (unresolved: major missing)
  - Programme: "dfsdfsdf" (unresolved: placeholder)
  - Programme: "dfwer" (unresolved: placeholder)
  - Institution: "BS English Literature" (unresolved: placeholder / wrong field)
  - Institution: "fsldljfsdf" (unresolved: placeholder / wrong field)
  - Institution: "Kainat Pervaiz" (unresolved: placeholder / wrong field)
  - Institution: "sdfdf" (unresolved: placeholder / wrong field)
  - Institution: "ulkj" (unresolved: placeholder / wrong field)
  - Institution: "y5656" (unresolved: placeholder / wrong field)

## List sizes

| List (JSON id) | Items incl. Other | Source |
|---|---|---|
| degreeLevels | 29 | HEC National Qualification Framework (levels/nomenclature); PNMC programme list; RAPID curated for this form (design choice), 2026-10-21 |
| programs | 753 | HEC NQF / HEC Revised Curricula; PNMC Nursing Curriculum page; PM&DC; professional bodies (ICAP, ACCA, ICMAP, CIMA); applicant spellings fro |
| institutions | 1249 | HEC Recognised Universities (hec.gov.pk) + PASTIC Universities Directory (city/sector); PM&DC college lists (pmdc.pk); PNMC Recognized Insti |
| examBoards | 46 | IBCC member boards list (ibcc.edu.pk); Cambridge International; AKU-EB; RAPID curated for this form (design choice), 2026-10-21 |
| cities | 148 | PBS Census 2023 district list; cities of HEC/PM&DC/PNMC institutions; applicant addresses (Working Sp 2027 - Clean.xlsx) |
| provinces | 9 | Constitution of Pakistan / PBS Census 2023 |
| terms | 40 | RAPID curated for this form (design choice), 2026-10-21; HEC semester system (Spring/Fall, optional Summer) |
| resultFormats | 9 | RAPID curated for this form (design choice), 2026-10-21 |
| gpaScales | 4 | RAPID curated for this form (design choice), 2026-10-21; HEC (4.0 standard), IBCC new SSC/HSSC (5.0), some foreign/private (10.0) |
| gradeSchemes | 7 | see per-row source |
| letterGrades | 54 | see Grading Scales sheet |
| divisions | 5 | BISE Sahiwal grading page (bisesahiwal.edu.pk/grading.php); BISE Gujranwala (bisegrw.edu.pk/grading.html); BISE Bahawalpur (bisebwp.pk/Gradi |
| passFail | 4 | RAPID curated for this form (design choice), 2026-10-21 |
| resultStatus | 4 | RAPID curated for this form (design choice), 2026-10-21 |
| documentTypes | 12 | RAPID document checklist (audit of Working Sp 2027 documents folders); RAPID curated for this form (design choice), 2026-10-21 |
| studyDuration | 9 | HEC NQF / PNMC / PM&DC durations |
| studySystems | 4 | RAPID curated for this form (design choice), 2026-10-21 |
| yearOfStudy | 13 | RAPID curated for this form (design choice), 2026-10-21 |
| enrolmentStatus | 4 | RAPID curated for this form (design choice), 2026-10-21; audit (students with documents but no results) |
| howHeard | 8 | from applicant data (Working Sp 2027 - Clean.xlsx) ("How Did You Come to Know RAPID?" answers) |
| relationships | 6 | RAPID curated for this form (convention / design choice), 2026-10-21 |
| occupations | 13 | RAPID normalizer (Scholarship-Normalization-Map.xlsx), 2026-10-15 FieldRules (homemaker / unemployed / retired / deceased must stay distinct |
| employmentStatus | 5 | RAPID normalizer (Scholarship-Normalization-Map.xlsx), 2026-10-15 FieldRules |
| gender | 4 | RAPID normalizer (Scholarship-Normalization-Map.xlsx), 2026-10-15 FieldRules |
| religion | 6 | RAPID normalizer (Scholarship-Normalization-Map.xlsx), 2026-10-15 FieldRules |
| yesNo | 2 | RAPID curated for this form (design choice), 2026-10-21 |
| yesNoPending | 3 | RAPID curated for this form (design choice), 2026-10-21 |
| gradingScales | 57 | see each row |