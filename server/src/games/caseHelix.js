export const CASE_SUSPECTS = [
  {
    id: "mara",
    name: "Mara Chen",
    role: "Research Team Leader",
    badge: "H-204",
    bio: "Leads the HELIX research team and can request access to its research files.",
    statement:
      "I left before the night shift began. I did not ask anyone to move research files.",
    alibi: "She says she left the complex before 9:00 p.m.",
    access: "She can request research files and enter laboratory areas.",
    motive:
      "Her badge appears in a real access extract, but a credential event does not identify the operator.",
    privateSecret:
      "She concealed a private meeting and left her badge at the shared sign-out desk.",
    actualTimeline:
      "Left the laboratory before the overnight window. Her badge remained at the shared sign-out desk; the 02:04 credential event does not place her at the export.",
    topics: [
      {
        id: "departure",
        label: "When did you leave, and who did you meet?",
        response:
          "I left before the night shift, but I did not mention the meeting in my first account. I met a colleague privately and did not want that personal matter included in an incident report.",
        unlock: "EV01",
      },
      {
        id: "badge",
        label: "Show Mara the badge log",
        evidence: "EV01",
        response:
          "H-204 is my badge number. The log shows that someone presented the badge, not who was holding it. I left it at the shared sign-out desk after my meeting and later reported it missing. I should have told you that sooner.",
        unlock: "EV10",
        resolves: "mara-badge",
      },
      {
        id: "package",
        label: "Did you ask anyone to move research files?",
        response:
          "I can request research files, but I cannot grant the temporary computer access needed to move them. The request records should show whether I asked for a transfer.",
        unlock: "EV16",
      },
    ],
  },
  {
    id: "idris",
    name: "Idris Khan",
    role: "Computer Access Specialist",
    badge: "SEC-09",
    bio: "Maintains the systems that control staff access and reviews special maintenance requests.",
    statement:
      "My work that night was routine maintenance. I did not move any research files.",
    alibi: "He says his work was part of an approved maintenance period.",
    access:
      "He can maintain access-control systems and review special access requests.",
    motive:
      "The scheduled rules review would compare temporary maintenance access with activity involving restricted files.",
    privateSecret:
      "He knew the scheduled review could expose the unauthorized export and later altered the derived summary view.",
    actualTimeline:
      "Prepared the exception at 01:36; the service exchange occurred at 02:09; the system kept the context active at 02:11; the export was accepted at 02:13; the summary was altered at 02:15.",
    topics: [
      {
        id: "maintenance",
        label: "Show Idris Gabriel’s repair work order",
        evidence: "EV14",
        response:
          "Gabriel’s repair job was signed off at 9:14 p.m. The temporary computer access requested later was separate from his work. It was only meant to be used for maintenance.",
        unlock: "EV17",
      },
      {
        id: "authorization",
        label: "Ask how the system could allow the transfer",
        evidence: "EV07",
        response:
          "During maintenance, the system can temporarily allow access that would normally be blocked. The original record should show whether that access was active. I can see that the later summary leaves out that detail.",
        unlock: "EV19",
      },
      {
        id: "audit",
        label: "Show Idris the changed summary",
        evidence: "EV08",
        response:
          "The summary leaves out a detail that is still in the original record: temporary maintenance access. I can tell you what is missing, but the comparison alone does not show who changed the summary.",
        unlock: "EV24",
      },
      {
        id: "motive",
        label: "Ask what the 3:00 a.m. review might uncover",
        evidence: "EV09",
        response:
          "The review was due at 3:00 a.m. It would compare temporary maintenance access with activity involving restricted files. If the two were connected, the reviewer would ask why.",
        unlock: "EV26",
      },
    ],
  },
  {
    id: "sofia",
    name: "Sofia Laurent",
    role: "Database Manager",
    badge: "DB-88",
    bio: "Maintains the research databases and checks copies of records for mistakes.",
    statement:
      "I searched a copy of the database that night. I did not open or send the research files.",
    alibi:
      "She says she searched a copy of the database that could not change the original records, not the live research files.",
    access:
      "She can maintain the databases and search a copy that cannot change the original records.",
    motive:
      "Her late audit query broke an internal rule that required a reviewed diagnostic ticket.",
    privateSecret:
      "She hid a search that broke the rules; it returned no research files.",
    actualTimeline:
      "At 23:18 she checked the read-only audit mirror, whose clock reported 23:20; she was not involved in the 02:13 export.",
    topics: [
      {
        id: "query",
        label: "Show Sofia her late-night search",
        evidence: "EV03",
        response:
          "Yes, that search was mine. I was checking a separate warning. I should have asked permission first, and I kept quiet because I knew that. But I searched system records; I did not open or send the research files.",
        unlock: "EV11",
        resolves: "sofia-query",
      },
      {
        id: "mirror",
        label: "Ask which database she searched",
        response:
          "I used a read-only copy. It lets us check records without changing the research database. My search showed system information, not the contents of research files.",
        unlock: "EV11",
      },
      {
        id: "time",
        label: "Ask why the recorded times differ",
        evidence: "EV05",
        response:
          "The clock on that copy was two minutes fast. Its times look later than they really were, so subtract two minutes before comparing them with the other records.",
        unlock: "EV20",
      },
    ],
  },
  {
    id: "evan",
    name: "Evan Walsh",
    role: "Network Support Technician",
    badge: "NET-12",
    bio: "Supports the computer network and shared workstations across the complex.",
    statement:
      "One record names a shared computer used by my team. It does not say I was the person using it.",
    alibi: "He says he was doing routine checks in the west building.",
    access:
      "He can enter network rooms, work on connection panels, and help with shared computers.",
    motive: "The shared console record falls during his team’s shift handoff.",
    privateSecret:
      "He left a shared support console unattended during handoff, so its operator cannot be inferred from the workstation ID.",
    actualTimeline:
      "Worked a west-building shift; the shared workstation was left unattended during the handoff, and the log does not identify the person using it.",
    topics: [
      {
        id: "workstation",
        label: "Ask who was using the shared computer",
        response:
          "Everyone on the on-call team uses that computer. The record names the machine, not the person sitting at it, so I cannot tell you who was there.",
        unlock: "EV12",
      },
      {
        id: "trace",
        label: "Show Evan the messages between the systems",
        evidence: "EV06",
        response:
          "Those messages passed between two computers inside the complex. They did not come from my work laptop, and the record does not say who sent the first one.",
        unlock: "EV13",
      },
      {
        id: "handoff",
        label: "Ask who had the computer during the shift change",
        evidence: "EV12",
        response:
          "No one was assigned to that computer for part of the shift change. The notes do not say who used it while it was unattended.",
        unlock: "EV23",
      },
    ],
  },
  {
    id: "nisha",
    name: "Dr. Nisha Rao",
    role: "Laboratory Director",
    badge: "LAB-01",
    bio: "Oversees laboratory work and how the program is presented to the public.",
    statement:
      "I was preparing for the morning review. I did not tell anyone to move the research files.",
    alibi:
      "She says she stayed in the administration suite to prepare for the morning review.",
    access:
      "She can schedule laboratory work and approve research projects, but cannot grant computer-system access.",
    motive:
      "A separate sample-quality issue threatened the laboratory’s reputation.",
    privateSecret:
      "She delayed circulation of a quality-review note to protect a grant milestone.",
    actualTimeline:
      "Prepared the morning review in the administration suite; the separate project-quality issue did not grant infrastructure authorization.",
    topics: [
      {
        id: "review",
        label: "Ask about the missing project note",
        response:
          "That note was about a different problem with sample quality. I delayed sharing it because it could hurt the program’s reputation. It had nothing to do with these files being moved.",
        unlock: "EV15",
      },
      {
        id: "pressure",
        label: "Ask why the review mattered to her",
        response:
          "The review could have delayed our grant, and I wanted to avoid bad publicity. But I could not give anyone temporary access to the computer systems used in this transfer.",
        unlock: "EV21",
      },
      {
        id: "approval",
        label: "Ask whether she approved the file transfer",
        evidence: "EV16",
        response:
          "I did not approve this transfer. Approving a research project is not the same as granting temporary access to the computers that move files.",
        unlock: "EV22",
      },
    ],
  },
  {
    id: "victor",
    name: "Victor Hale",
    role: "Night Security Supervisor",
    badge: "SEC-02",
    bio: "Coordinates overnight patrols and checks building alarms.",
    statement:
      "One patrol check is missing from my sheet. I stayed at the security desk for most of the shift.",
    alibi: "He says he spent most of the shift at the security desk.",
    access:
      "He can use the security desk, assign patrols, and review incident records.",
    motive: "A missing checkpoint happened during a genuine recorder reset.",
    privateSecret:
      "He failed to record a skipped checkpoint caused by the reset.",
    actualTimeline:
      "The patrol recorder reset created the gap; normal security operation continued, and the gap did not enable the export.",
    topics: [
      {
        id: "patrol",
        label: "Show Victor the blank patrol check",
        evidence: "EV02",
        response:
          "The recorder was being reset, so I missed that checkpoint. I should have written down the interruption. The blank line is real, but it does not show that anyone opened a door.",
        unlock: "EV18",
      },
      {
        id: "camera",
        label: "Compare the camera time with the patrol sheet",
        evidence: "EV04",
        response:
          "The camera clock was fast. Once we correct its time, the missing check lines up with the recorder reset, not with the later file transfer.",
        unlock: "EV25",
        resolves: "victor-patrol",
      },
      {
        id: "alarm",
        label: "Ask when he heard the door latch",
        response:
          "I heard it during a routine latch test earlier in the shift. I cannot place the sound more precisely or connect it to the alarm.",
        unlock: "EV04",
      },
    ],
  },
  {
    id: "anika",
    name: "Anika Bose",
    role: "Research Intern",
    badge: "R-117",
    bio: "Helps the HELIX team prepare samples and keep its records.",
    statement: "I did not enter the restricted laboratory.",
    alibi: "She says she left after finishing a task in the study area.",
    access:
      "She can enter her assigned research areas and shared study spaces.",
    motive:
      "She walked through a restricted-adjacent corridor without approval before midnight.",
    privateSecret:
      "She concealed a 00:42 notebook retrieval because interns were discouraged from using the adjacent route.",
    actualTimeline:
      "Entered the adjacent corridor at 00:42 to retrieve a notebook, well before the exception and export took place.",
    topics: [
      {
        id: "corridor",
        label: "Show Anika the hallway image",
        evidence: "EV04",
        response:
          "I went through the nearby corridor at 12:42 a.m. to get my notebook. I did not enter the laboratory, but I should have told you about the corridor. Interns are not supposed to use that route.",
        unlock: "EV13",
        resolves: "anika-corridor",
      },
      {
        id: "notebook",
        label: "Ask where the notebook was",
        evidence: "EV13",
        response:
          "It was in the shared study room. The sign-out record places me there at 12:42 a.m., well before the temporary access and file transfer.",
        unlock: "EV18",
      },
      {
        id: "equipment",
        label: "Ask about the service case near the hall",
        response:
          "I saw a service case near the corridor earlier. I could not tell who had handled it or when it was moved.",
        unlock: "EV12",
      },
    ],
  },
  {
    id: "gabriel",
    name: "Gabriel Price",
    role: "Outside Repair Contractor",
    badge: "EXT-31",
    bio: "Repairs equipment under work orders approved and supervised by staff.",
    statement:
      "My signed repair job ended at 9:14 p.m. I was not working here later that night.",
    alibi: "His work order says the job ended at 9:14 p.m.",
    access:
      "He can enter approved work areas while a staff member supervises him.",
    motive:
      "His legitimate maintenance overlapped with the same infrastructure area.",
    privateSecret:
      "His returned service-device receipt confirms the handoff only, not the device’s condition; the signed change record closes his work at 21:14.",
    actualTimeline:
      "Completed supervised relay maintenance at 21:14 and returned the device; the later authorization exception was separate work.",
    topics: [
      {
        id: "workorder",
        label: "Show Gabriel his signed work order",
        evidence: "EV14",
        response:
          "I replaced a relay under that approved job and returned the service device. My work order did not include the later request for temporary computer access.",
        unlock: "EV18",
        resolves: "gabriel-maintenance",
      },
      {
        id: "device",
        label: "Show Gabriel the device return receipt",
        evidence: "EV18",
        response:
          "That receipt proves I handed the device back. It does not say what happened to it afterward. The signed work order is the better record of what I was hired to do.",
        unlock: "EV22",
      },
      {
        id: "exception",
        label: "Ask about the later access request",
        evidence: "EV17",
        response:
          "That request was not part of my job. It was made after my signed work period had ended.",
        unlock: "EV24",
      },
    ],
  },
  {
    id: "leena",
    name: "Leena Kapoor",
    role: "Records Auditor",
    badge: "AUD-06",
    bio: "Checks whether access rules are followed and whether saved records are complete.",
    statement:
      "I wrote down my concern about the summary before the incident was reported.",
    alibi:
      "She says she wrote the note during the review the previous evening.",
    access:
      "She can read records used to check whether rules were followed and review saved copies, but cannot change the original access records.",
    motive:
      "Her note warned that the short summary might leave out important details from the original access record.",
    privateSecret:
      "The archive ingested her 22:06 note at 08:40; ingestion is not the same as creation time.",
    actualTimeline:
      "Created the audit-integrity note at 22:06; its archive copy was ingested at 08:40.",
    topics: [
      {
        id: "note",
        label: "Show Leena the complete message thread",
        evidence: "EV16",
        response:
          "This is Tomas’s request to share research with the university’s approved storage site. It is separate from my note. I wrote my note at 10:06 p.m. The 8:40 a.m. time only tells you when the archive received its copy.",
        unlock: "EV09",
        resolves: "leena-report",
      },
      {
        id: "integrity",
        label: "Ask what problem she warned about",
        response:
          "I warned that the summary might leave out details from the original record. That is a weakness in how the summary is made; it does not prove that I changed anything.",
        unlock: "EV08",
      },
      {
        id: "archive",
        label: "Ask when the note was written and filed",
        evidence: "EV09",
        response:
          "Keep the times separate: I wrote the note at 10:06 p.m., the summary was changed at 2:15 a.m., and the archive received the note at 8:40 a.m. The filing time is not the time I wrote it.",
        unlock: "EV20",
      },
    ],
  },
  {
    id: "tomas",
    name: "Tomas Varga",
    role: "Research Fellow",
    badge: "R-083",
    bio: "Works with the HELIX group and has asked for wider access to its research files.",
    statement:
      "I asked about sharing research with a university collaborator. The request was not approved yet.",
    alibi: "He says he was in the shared research area.",
    access: "He can use approved research files and collaboration records.",
    motive:
      "He wanted broader access to research materials to support his fellowship work.",
    privateSecret:
      "His partial transfer discussion left out the approved university repository and the compliance review.",
    actualTimeline:
      "Discussed a legitimate university repository transfer; the full thread retained the approved recipient and compliance context.",
    topics: [
      {
        id: "transfer",
        label: "Show Tomas the partial message",
        evidence: "EV15",
        response:
          "That was a request to share research for academic work. The recipient was the university’s approved repository, not a buyer outside the university.",
        unlock: "EV16",
        resolves: "tomas-transfer",
      },
      {
        id: "thread",
        label: "Read the complete message thread with Tomas",
        evidence: "EV16",
        response:
          "The last message names the university’s approved storage site for the research files and says the request would be checked against the rules. The partial copy left both details out.",
        unlock: "EV21",
      },
      {
        id: "access",
        label: "Ask why he wanted wider access",
        response:
          "I wanted to use more research files for my fellowship. My request was still waiting for approval, and it did not let me change the computer access rules.",
        unlock: "EV16",
      },
    ],
  },
];

const records = [
  [
    "EV01",
    "Badge H-204 Appears in Two Log Entries",
    "Physical",
    "Copy of the door badge-reader log",
    "This is a copy of the log kept by the door badge reader. It lists badge H-204 twice: once in a full entry and once in the shorter format the reader uses. The different formats leave open whether these were two events or two records of one event.",
    "Detective",
    [],
    "The log shows that badge H-204 was presented, but it cannot identify who was carrying it. Compare the entries with Mara’s account and the other records before drawing a conclusion.",
  ],
  [
    "EV02",
    "One Patrol Check Was Missed",
    "Physical",
    "Security desk patrol sheet",
    "This is the handwritten sheet used to track Victor’s patrol checks. One space is blank, but the next check appears in its usual place. The sheet does not record a door being opened during the gap.",
    "Detective",
    [],
    "The missing check is real, and Victor admits he should have recorded the interruption. By itself, the blank space does not show that anyone helped move the files.",
  ],
  [
    "EV03",
    "Sofia Searched the Database After Hours",
    "Digital",
    "Database search log",
    "This log records a late-night search under Sofia’s account. It confirms that she looked something up, but this entry does not show what the search returned or whether any files were opened.",
    "Analyst",
    [],
    "The search explains why Sofia needs to be questioned. This entry alone does not connect her to the later movement of the HELIX files.",
  ],
  [
    "EV04",
    "A Person Appears at the Edge of the Hallway Image",
    "Physical",
    "Still image from a security camera",
    "This is one still image from a hallway camera. A person is visible at the edge of the picture, but the image is too blurry to make out their face or tell which way they went.",
    "Detective",
    [],
    "The image confirms that someone was there, but it cannot identify them or show that they entered the restricted area.",
  ],
  [
    "EV05",
    "One Computer Clock Was Two Minutes Fast",
    "Digital",
    "Comparison of two computer clocks",
    "This comparison checks the times recorded by two computer systems for the same event. One system was two minutes ahead of the other, so its timestamps appear later than the real time.",
    "Analyst",
    [],
    "Correcting the two-minute difference helps put events in order. The clock being wrong does not, by itself, show that anyone did anything wrong.",
  ],
  [
    "EV06",
    "Two Computers Exchanged Messages Before Access",
    "Digital",
    "Log of messages between internal systems",
    "This log records messages exchanged by two computers shortly before the access token was accepted. It shows that the systems communicated, but it does not name the person who started the exchange or was using a computer.",
    "Analyst",
    [],
    "The messages help connect the computer records to the later access. They do not identify a person or prove what that person intended.",
  ],
  [
    "EV07",
    "The Access System Accepted a HELIX Digital Pass",
    "Digital",
    "Access system log",
    "This is the access system’s record of a temporary digital pass, called a HELIX token, being accepted at 2:13 a.m. The surviving entry does not show all the steps that led the system to accept it.",
    "Analyst",
    ["EV06"],
    "The system accepted the digital pass, but this entry does not say who arranged the access or who was at the computer.",
  ],
  [
    "EV08",
    "The Later Summary Leaves Out Maintenance Access",
    "Digital",
    "Original access record and later summary",
    "This comparison shows that the original access record includes temporary maintenance access, while the later summary leaves that detail out. The difference tells us the summary is incomplete, but not who changed it or why.",
    "Analyst",
    ["EV07"],
    "The missing detail could explain how the system allowed the later transfer. Other records are needed to show who changed the summary and why.",
  ],
  [
    "EV09",
    "Leena’s Note Was Written Before It Reached the Archive",
    "Documents",
    "Leena’s signed note and archive receipt",
    "This record pairs Leena’s signed note with the archive’s receipt. She wrote the note at 10:06 p.m.; the archive received its copy at 8:40 a.m. The later receipt time is not when she wrote it.",
    "Detective",
    [],
    "The signed note shows that Leena raised her concern before the incident. The archive time only tells you when a copy was filed, not when the note was created.",
  ],
  [
    "EV10",
    "Mara Says Her Badge Was Left at the Sign-Out Desk",
    "Interviews",
    "Mara’s follow-up interview",
    "This is Mara’s answer after she is shown the badge log. She says she left badge H-204 at the shared sign-out desk after a private meeting and later reported it missing. Her first account did not mention the meeting or the badge.",
    "Detective",
    ["EV01"],
    "This is Mara’s account, not an independent record of who held the badge. The log identifies the badge, while her explanation still needs to be weighed against the rest of the evidence.",
  ],
  [
    "EV11",
    "Sofia’s Search Found System Information, Not Research Files",
    "Digital",
    "Result of Sofia’s database search",
    "This is the result of Sofia’s late-night search. It contains information about the computer system, not the contents of HELIX research files, and it did not start the later file transfer.",
    "Analyst",
    ["EV03"],
    "The result supports Sofia’s explanation of what she searched. It separates her rule-breaking search from the later movement of the research files.",
  ],
  [
    "EV12",
    "The Shared Computer’s Log Does Not Name Its User",
    "Digital",
    "Network team shift-change notes",
    "These notes identify the shared network-team computer and show a period during the shift change when nobody was assigned to it. They do not record who sat down at the computer during that time.",
    "Analyst",
    ["EV06"],
    "The notes confirm which computer was involved, but not who used it. The person at the keyboard remains unknown.",
  ],
  [
    "EV13",
    "Anika Went Through the Nearby Hall at 12:42 a.m.",
    "Physical",
    "Notebook sign-out record and nearby camera log",
    "The notebook sign-out record and nearby camera log place Anika in the adjoining hall at 12:42 a.m. She says she went there to collect her notebook. This was well before the temporary access and file transfer later in the night.",
    "Detective",
    ["EV04"],
    "Anika used a route interns were not supposed to take, but the record places her there well before the file transfer. It explains why she kept the visit quiet without linking her to the later event.",
  ],
  [
    "EV14",
    "Gabriel’s Approved Repair Job Ended at 9:14 p.m.",
    "Documents",
    "Gabriel’s signed maintenance work order",
    "This signed work order records Gabriel’s relay repair and closes the job at 9:14 p.m. A separate request for temporary computer access was made later, after his approved repair work had ended.",
    "Detective",
    [],
    "The paperwork separates Gabriel’s supervised repair from the later access request. It does not, on its own, identify who made that later request.",
  ],
  [
    "EV15",
    "A Partial Message Mentions Sending Research",
    "Documents",
    "Partial copy of a message conversation",
    "This fragment of a message conversation discusses sending research material. The copy leaves out who would receive it and whether the request had been reviewed, so its purpose is unclear on its own.",
    "Detective",
    [],
    "The wording can sound like an unauthorized sale, but the missing part of the conversation matters. Do not decide what Tomas meant until you read the complete thread.",
  ],
  [
    "EV16",
    "The Complete Message Names an Approved University Repository",
    "Documents",
    "Complete copy of the message conversation",
    "The complete conversation names the university’s approved storage site for research files and says the request would be checked against the rules. Those details are missing from the fragment shown earlier.",
    "Detective",
    ["EV15"],
    "The full conversation shows Tomas was discussing a reviewed academic transfer, not an outside buyer. It does not connect his request to the separate file movement at 2:13 a.m.",
  ],
  [
    "EV17",
    "Temporary Repair Access Was Added, Then Removed",
    "Digital",
    "History of temporary computer-access settings",
    "This history shows that the system briefly allowed access normally blocked during repair work, then removed that permission. It confirms that the special access existed, but does not show who used it or whether it was active when the files moved.",
    "Analyst",
    ["EV14"],
    "This special permission could explain how the system accepted an action that would normally be blocked. The matching request and event records are needed to work out when it was used and by whom.",
  ],
  [
    "EV18",
    "Gabriel Returned the Service Device",
    "Documents",
    "Receipt for the returned repair device",
    "This receipt records Gabriel handing the service device back after his repair job. It confirms the handoff, but says nothing about what happened to the device after it was returned.",
    "Detective",
    ["EV14"],
    "The receipt supports the end of Gabriel’s work period. It does not link him to the later temporary-access request or file transfer.",
  ],
  [
    "EV19",
    "The Same Request Number Appears in the Access Records",
    "Digital",
    "Repair request and access system log",
    "The repair request and access log carry the same reference number. That match connects the request to the access recorded by the system, but neither entry names the person who used it.",
    "Analyst",
    ["EV06", "EV17"],
    "The matching number links the repair request to the access event. It still does not tell us who was using the computer.",
  ],
  [
    "EV20",
    "Correcting the Clock Difference Puts the Events in Order",
    "Correlation",
    "Timeline compared with the original records",
    "This timeline moves the fast computer’s timestamps back by two minutes and compares them with the original records. It puts the maintenance request before the digital pass was accepted and the summary change after the files moved. Leena’s archive receipt at 8:40 a.m. is when her note was filed, not when she wrote it.",
    "Analyst",
    ["EV05", "EV09"],
    "The corrected times show which events came first and which came later. They also prevent the archive’s morning filing time from being mistaken for the time Leena wrote her note.",
  ],
  [
    "EV21",
    "Three Possible Explanations Do Not Fit Equally Well",
    "Correlation",
    "Comparison of the case’s competing explanations",
    "This comparison asks whether a computer fault, misuse of a badge or digital pass, or temporary maintenance access best fits the records. Each explanation accounts for some details, but each must also explain the file movement and the later change to the summary.",
    "Shared",
    ["EV08", "EV16"],
    "Compare each possibility with the same records. The strongest explanation should account for the accepted digital pass, the files being moved, and the missing detail in the later summary.",
  ],
  [
    "EV22",
    "Staff Made a Separate Access Request After Gabriel’s Job Ended",
    "Documents",
    "Record of a later system change request",
    "This record shows that staff made a separate request for temporary computer access after Gabriel’s signed repair job ended at 9:14 p.m. It was not part of his approved work order.",
    "Analyst",
    ["EV14", "EV17"],
    "This distinguishes the later access request from Gabriel’s repair. The record points to a staff request but does not, by itself, show who used the access.",
  ],
  [
    "EV23",
    "The Computer Records Still Do Not Identify a Person",
    "Correlation",
    "Comparison of the badge and computer records",
    "The corrected computer times fit the other records, but the shared-computer log names only the machine. A badge number identifies a badge, and a computer name identifies a computer; neither tells you who was using it.",
    "Shared",
    ["EV12", "EV20"],
    "These records help put events in time, but do not name the person using the computer. Look for separate evidence that connects someone to the access.",
  ],
  [
    "EV24",
    "The Original Record Explains What the Summary Left Out",
    "Correlation",
    "Original access record compared with the later summary",
    "The original record connects the request for temporary repair access to the accepted digital pass and file movement. The later summary leaves out the repair-access detail that would show that connection. This explains the difference between the two records, but not who changed the summary.",
    "Analyst",
    ["EV08", "EV19", "EV20"],
    "The matching request number and corrected timeline connect the access to the transfer. The missing detail in the summary makes the later change important, but it does not name who made it.",
  ],
  [
    "EV25",
    "Separate Records Agree on the Order of Events",
    "Correlation",
    "Cross-check of the access, repair, and timeline records",
    "The access log, Gabriel’s signed work order, and the corrected timeline tell a consistent story once the two-minute clock error is fixed. These records come from separate sources and agree about when the repair and later access took place.",
    "Shared",
    ["EV19", "EV20", "EV24"],
    "Agreement between separate records makes the timeline more dependable. The records still need to be combined with evidence that identifies who arranged or used the access.",
  ],
  [
    "EV26",
    "A Review Was Scheduled for 3:00 a.m.",
    "Documents",
    "Schedule for the rules review",
    "The schedule shows that a review was planned for 3:00 a.m. It would compare temporary maintenance access with activity involving restricted files, and someone acknowledged the plan before the incident.",
    "Detective",
    ["EV09"],
    "Idris knew about the review, which could have drawn attention to a link between the access and the file movement. That gives you a possible motive to examine, not proof by itself.",
  ],
  [
    "EV27",
    "A Restricted HELIX Package Was Moved at 2:13 a.m.",
    "Digital",
    "Receipt from the file-transfer system",
    "This receipt says a restricted set of HELIX files was moved to a temporary holding area inside the complex at 2:13 a.m. It lists no approved project number for the move. The receipt does not show that the files were sent outside the complex.",
    "Analyst",
    ["EV07"],
    "The files were moved without the usual project approval. This is evidence of an unauthorized transfer, but it does not identify the person who arranged it or prove the files left the building.",
  ],
  [
    "EV28",
    "Idris Is Named as Reviewer on the Access Request",
    "Documents",
    "Signed request for temporary computer access",
    "This signed request names Idris as the staff member who reviewed it. It also says the short-term permission should end before the files were moved at 2:13 a.m.; the other access records will show whether it did.",
    "Analyst",
    ["EV17"],
    "The request directly connects Idris to the temporary access process. Its stated end time is earlier than the transfer, so compare it with the access history before deciding what the request proves.",
  ],
];

export const CASE_EVIDENCE = records.map(
  ([id, title, branch, source, detail, role, requires, reliability]) => ({
    id,
    title,
    branch,
    source,
    detail,
    role,
    requires,
    reliability,
  }),
);

export const CASE_PAGES = [
  {
    id: "board",
    title: "Case Board",
    branch: "Shared",
    role: "both",
    description:
      "Review the records your team has found, the questions you have answered, and your partner’s latest work.",
  },
  {
    id: "scene",
    title: "Physical Records",
    branch: "Physical",
    role: "both",
    description:
      "Check the hallway image, badge entries, and patrol sheet. These records can show where activity happened, but may not identify a person.",
  },
  {
    id: "forensics",
    title: "Computer Records",
    branch: "Digital",
    role: "both",
    description:
      "Complete the clock and summary questions. The identity question is an optional extra.",
  },
  {
    id: "archives",
    title: "Documents",
    branch: "Documents",
    role: "both",
    description:
      "Read the signed work orders, access requests, message conversations, and Leena’s note.",
  },
  {
    id: "interviews",
    title: "Interviews",
    branch: "Interviews",
    role: "both",
    description:
      "Choose a suspect for at least one follow-up interview. You do not have to interview everyone.",
  },
  {
    id: "timeline",
    title: "Put the Events in Order",
    branch: "Correlation",
    role: "both",
    description:
      "One computer clock was two minutes fast. Correct its times and put the events in order. The separate sequence question is optional.",
  },
  {
    id: "hypotheses",
    title: "Compare Explanations",
    branch: "Correlation",
    role: "both",
    description:
      "Assess the explanations you choose. The final report asks you to rule out two alternatives with relevant records.",
  },
  {
    id: "report",
    title: "Final Case Report",
    branch: "Conclusion",
    role: "both",
    description:
      "Explain who arranged the file transfer, how it happened, and why. Support your account with records and ask your partner to review it.",
  },
];

export const CASE_PUZZLES = [
  {
    id: "clocks",
    required: true,
    title: "Correct the Clock and Order the Events",
    role: "both",
    evidence: ["EV05", "EV06"],
    prompt:
      "One computer clock was two minutes fast. Enter how many minutes it was ahead, then place the six events in the order they really happened.",
    fields: {
      offsetMinutes: "Minutes the clock was fast",
      eventOrder: "Put the events in order",
    },
  },
  {
    id: "identity",
    required: false,
    title: "What Does Each Record Identify?",
    role: "both",
    evidence: ["EV01", "EV12"],
    prompt:
      "For each record, choose whether it identifies a badge or temporary digital pass, a person, a computer, a system account, or an event. A computer’s name does not tell you who was using it.",
    fields: {
      credential: "What the badge identifies",
      operator: "Whether the person is known",
      workstation: "What the shared computer identifies",
      serviceAccount: "What the relay account identifies",
      acceptedEvent: "What the 2:13 record identifies",
    },
  },
  {
    id: "audit",
    required: true,
    title: "What Did the Summary Leave Out?",
    role: "both",
    evidence: ["EV08", "EV09"],
    prompt:
      "Compare the short summary with the original access record. Find the missing detail about temporary maintenance access. Then separate the time Leena wrote her note (10:06 p.m.), the time the summary changed (2:15 a.m.), and the time the archive received her note (8:40 a.m.).",
    fields: {
      missingField: "Missing detail",
      sourceRecord: "Record that contains the detail",
      noteCreatedAt: "When Leena wrote the note",
      noteIngestedAt: "When the archive received the note",
      viewModifiedAt: "When the summary changed",
    },
  },
  {
    id: "witness",
    required: false,
    title: "What Does the Badge Record Prove?",
    role: "both",
    evidence: ["EV01", "EV10"],
    prompt:
      "Show Mara the badge record. Decide what it proves, and what it cannot tell you about the person who carried the badge.",
    fields: {
      suspectId: "Person to question",
      evidenceId: "Record to show",
      finding: "What the record establishes",
    },
  },
  {
    id: "sequence",
    required: false,
    title: "Put the Events in Order",
    role: "both",
    evidence: ["EV20", "EV22"],
    prompt:
      "Place the events in the order they happened. The short-term repair permission had to be set up before the system could accept the digital pass and move the files.",
    fields: { eventOrder: "Put the events in order" },
  },
  {
    id: "theories",
    required: false,
    title: "Choose the Best-Supported Explanation",
    role: "shared",
    evidence: ["EV21", "EV24"],
    prompt:
      "Choose the explanation that accounts for the accepted digital pass, the file transfer, and the later change to the summary. Support your choice with at least three different records.",
    fields: {
      explanation: "Explanation",
      evidenceIds: "Records that support your choice",
    },
  },
];

export const CASE_THEORIES = [
  {
    id: "credential",
    title: "Mara used her badge to approve the transfer",
    description:
      "Badge H-204 appears in the access records, but a badge entry does not tell you who was carrying it. Look for evidence that identifies the person at the computer.",
  },
  {
    id: "database",
    title: "Sofia’s database search moved the files",
    description:
      "Sofia searched the database after hours. Check what her search returned and whether its time and result match the separate file-transfer record.",
  },
  {
    id: "security",
    title: "Victor used the missed patrol check to help",
    description:
      "A patrol check is missing, but Victor says the recorder was being reset. Compare that account with the camera time and the other records before linking him to the transfer.",
  },
  {
    id: "contractor",
    title: "Gabriel’s repair work created the access",
    description:
      "Gabriel worked on equipment in the same area. Compare when his signed job ended with when the later access request was made.",
  },
  {
    id: "malfunction",
    title: "A computer fault accepted the digital pass by mistake",
    description:
      "A fault could explain an unexpected access, but check whether it also explains the matching maintenance request and the later change to the summary.",
  },
];

export const CASE_THEORY_CORROBORATION = {
  credential: ["EV01", "EV10", "EV23"],
  database: ["EV03", "EV11"],
  security: ["EV02", "EV04"],
  contractor: ["EV14", "EV18", "EV22"],
  malfunction: ["EV08", "EV19", "EV24"],
};
export const CASE_REPORT_REQUIRED_EVIDENCE = [
  "EV01",
  "EV07",
  "EV14",
  "EV17",
  "EV24",
  "EV26",
  "EV27",
  "EV28",
];

export const CASE_HYPOTHESES = [
  {
    id: "mara-badge",
    title: "Did Mara use her badge?",
    resolvedBy: ["EV01", "EV10", "EV23"],
  },
  {
    id: "sofia-query",
    title: "Did Sofia’s search move the files?",
    resolvedBy: ["EV03", "EV11"],
  },
  {
    id: "victor-patrol",
    title: "Does the missed patrol check implicate Victor?",
    resolvedBy: ["EV02", "EV04"],
  },
  {
    id: "gabriel-maintenance",
    title: "Was Gabriel involved after his repair job ended?",
    resolvedBy: ["EV14", "EV18", "EV22"],
  },
  {
    id: "tomas-transfer",
    title: "Was Tomas’s planned research transfer approved?",
    resolvedBy: ["EV15", "EV16"],
  },
  {
    id: "leena-report",
    title: "When did Leena write and file her note?",
    resolvedBy: ["EV09", "EV20"],
  },
];

export const CANONICAL_EVENT_ORDER = [
  "maintenance-prepared",
  "credential-event",
  "service-relay",
  "exception-active",
  "token-accepted-export",
  "audit-view-changed",
];

export function getPublicCaseState(state, role) {
  const evidence = new Set(state.discoveredEvidence || []);
  return {
    title: "CASE HELIX — Who Moved the Files, and Why Was the Record Changed?",
    location: "Veyra Research Complex",
    role,
    suspects: CASE_SUSPECTS.map(
      ({
        id,
        name,
        role: occupation,
        badge,
        bio,
        statement,
        alibi,
        access,
        topics,
      }) => ({
        id,
        name,
        role: occupation,
        badge,
        bio,
        statement,
        alibi,
        access,
        topics: topics.map(
          ({ id: topicId, label, evidence: requiredEvidence }) => ({
            id: topicId,
            label,
            available: !requiredEvidence || evidence.has(requiredEvidence),
            requiresEvidence: requiredEvidence || null,
          }),
        ),
      }),
    ),
    pages: CASE_PAGES,
    evidence: CASE_EVIDENCE.map(({ meaning, ...item }) => ({
      ...item,
      discovered: evidence.has(item.id),
      detail: evidence.has(item.id) ? item.detail : null,
      available: item.requires.every((id) => evidence.has(id)),
    })),
    puzzles: CASE_PUZZLES.filter(({ id }) => id !== "theories").map(
      ({
        id,
        title,
        role: puzzleRole,
        evidence: required,
        prompt,
        required: isRequired,
      }) => ({
        id,
        title,
        role: puzzleRole,
        required: isRequired,
        prompt,
        available: required.every((id) => evidence.has(id)),
        solved: (state.solvedPuzzles || []).includes(id),
        materials:
          id === "clocks" || id === "sequence"
            ? [
                {
                  event: "maintenance-prepared",
                  source: "Maintenance request",
                  time: "01:36",
                },
                {
                  event: "credential-event",
                  source: "Badge reader",
                  time: "02:06",
                },
                {
                  event: "service-relay",
                  source: "System message log",
                  time: "02:09",
                },
                {
                  event: "exception-active",
                  source: "Access system",
                  time: "02:13",
                },
                {
                  event: "token-accepted-export",
                  source: "Access and file log",
                  time: "02:13",
                },
                {
                  event: "audit-view-changed",
                  source: "Summary change record",
                  time: "02:15",
                },
              ]
            : [],
      }),
    ),
    theories: CASE_THEORIES,
    reportRequirements: {
      requiredEvidenceIds: CASE_REPORT_REQUIRED_EVIDENCE,
      minimumRejectedTheories: 2,
      theoryEvidence: CASE_THEORY_CORROBORATION,
    },
    hypotheses: CASE_HYPOTHESES.map((hypothesis) => ({
      ...hypothesis,
      resolved: (state.resolvedHypotheses || []).includes(hypothesis.id),
    })),
  };
}

export function validatePuzzleAnswer(puzzleId, answer, discovered) {
  if (!answer || typeof answer !== "object" || Array.isArray(answer))
    return false;
  const exactKeys = (keys) =>
    Object.keys(answer).length === keys.length &&
    keys.every((key) => Object.hasOwn(answer, key));
  const orderIsCanonical = (value) =>
    Array.isArray(value) &&
    value.length === CANONICAL_EVENT_ORDER.length &&
    value.every((item, index) => item === CANONICAL_EVENT_ORDER[index]);
  switch (puzzleId) {
    case "clocks":
      return (
        exactKeys(["offsetMinutes", "eventOrder"]) &&
        answer.offsetMinutes === 2 &&
        orderIsCanonical(answer.eventOrder)
      );
    case "identity":
      return (
        exactKeys([
          "credential",
          "operator",
          "workstation",
          "serviceAccount",
          "acceptedEvent",
        ]) &&
        answer.credential === "credential" &&
        answer.operator === "unresolved" &&
        answer.workstation === "device" &&
        answer.serviceAccount === "service" &&
        answer.acceptedEvent === "event"
      );
    case "audit":
      return (
        exactKeys([
          "missingField",
          "sourceRecord",
          "noteCreatedAt",
          "noteIngestedAt",
          "viewModifiedAt",
        ]) &&
        answer.missingField === "maintenanceContext" &&
        answer.sourceRecord === "authorization-source-ledger" &&
        answer.noteCreatedAt === "22:06" &&
        answer.noteIngestedAt === "08:40" &&
        answer.viewModifiedAt === "02:15"
      );
    case "witness":
      return (
        exactKeys(["suspectId", "evidenceId", "finding"]) &&
        answer.suspectId === "mara" &&
        answer.evidenceId === "EV01" &&
        answer.finding === "credential-not-person"
      );
    case "sequence":
      return exactKeys(["eventOrder"]) && orderIsCanonical(answer.eventOrder);
    case "theories":
      return (
        exactKeys(["explanation", "evidenceIds"]) &&
        answer.explanation === "maintenance-context" &&
        Array.isArray(answer.evidenceIds) &&
        answer.evidenceIds.length >= 3 &&
        answer.evidenceIds.length === new Set(answer.evidenceIds).size &&
        answer.evidenceIds.every((id) => discovered.has(id)) &&
        ["EV17", "EV19", "EV24", "EV25", "EV27", "EV28"].filter((id) =>
          answer.evidenceIds.includes(id),
        ).length >= 2 &&
        answer.evidenceIds.some((id) =>
          ["EV14", "EV17", "EV19"].includes(id),
        ) &&
        answer.evidenceIds.some((id) => ["EV08", "EV24", "EV25"].includes(id))
      );
    default:
      return false;
  }
}

export const CASE_INTERVIEW_BY_KEY = new Map(
  CASE_SUSPECTS.flatMap((suspect) =>
    suspect.topics.map((topic) => [
      `${suspect.id}:${topic.id}`,
      { suspect, topic },
    ]),
  ),
);
