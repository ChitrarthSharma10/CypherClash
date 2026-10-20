(() => {
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const state = {
    role: null,
    clues: new Set(),
    activity: [],
    decrypted: false,
  };
  const items = {
    ev1: {
      id: "EV-001",
      title: "Server room access log",
      detail: "Badge H-204 opened the archive corridor at 02:11:48.",
    },
    ev2: {
      id: "EV-002",
      title: "Night technician statement",
      detail: "Witness heard the archive door release near 02:20.",
    },
    ev3: {
      id: "EV-003",
      title: "East corridor still",
      detail: "Motion detected at 02:12:51; face not identifiable.",
    },
    ev4: {
      id: "EV-004",
      title: "Decrypted network token",
      detail: "Recovered token: HELIX. Packet accepted at 02:13:02.",
    },
  };
  const titles = {
    overview: ["MISSION CONTROL / 01", "Investigation overview"],
    evidence: ["FIELD EVIDENCE / 02", "Evidence ledger"],
    suspects: ["PERSONS OF INTEREST / 03", "Suspect dossiers"],
    forensics: ["NETWORK FORENSICS / 04", "Forensic terminal"],
    accusation: ["CASE RESOLUTION / 05", "Final accusation"],
  };
  function toast(t) {
    const n = $("#toast");
    n.textContent = t;
    n.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => n.classList.remove("show"), 2600);
  }
  function activity(title, detail) {
    state.activity.unshift({
      title,
      detail,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    state.activity = state.activity.slice(0, 5);
    renderActivity();
  }
  function add(key) {
    if (state.clues.has(key)) {
      toast("This item is already in the evidence ledger.");
      return;
    }
    state.clues.add(key);
    activity("Evidence added: " + items[key].id, items[key].title);
    renderLedger();
    stats();
    toast(items[key].id + " added to the local ledger.");
  }
  function renderActivity() {
    $("#activity").innerHTML = state.activity.length
      ? state.activity
          .map(
            (x) =>
              `<div class="activity-item"><b>${x.title}</b><small>${x.time} · ${x.detail}</small></div>`,
          )
          .join("")
      : "No evidence submitted yet.";
  }
  function renderLedger() {
    const keys = [...state.clues];
    $("#count").textContent = keys.length;
    $("#ledger").innerHTML = keys.length
      ? keys
          .map(
            (k) =>
              `<div class="activity-item"><b>${items[k].id} — ${items[k].title}</b><small>${items[k].detail}</small><button class="outline remove" data-remove="${k}">REMOVE</button></div>`,
          )
          .join("")
      : "The evidence ledger is empty.";
    $$(".add").forEach((b) => {
      let done = state.clues.has(b.dataset.evidence);
      b.disabled = done;
      b.textContent = done ? "ADDED TO LEDGER ✓" : "ADD TO LEDGER ＋";
    });
  }
  function stats() {
    $("#clues").textContent = String(state.clues.size).padStart(2, "0");
    $("#confidence").textContent =
      Math.min(12 + state.clues.size * 17 + (state.decrypted ? 22 : 0), 94) +
      "%";
  }
  function panel(p) {
    Object.keys(titles).forEach((k) =>
      $("#panel-" + k).classList.toggle("hidden", k !== p),
    );
    $$("nav button").forEach((b) =>
      b.classList.toggle("active", b.dataset.panel === p),
    );
    $("#kicker").textContent = titles[p][0];
    $("#title").textContent = titles[p][1];
  }
  function role(r) {
    state.role = r;
    $("#picker").classList.add("hidden");
    $("#workspace").classList.remove("hidden");
    $("#roleName").textContent =
      r === "detective" ? "Lead Detective" : "Forensic Analyst";
    $("#roleName").style.color =
      r === "detective" ? "var(--cyan)" : "var(--purple)";
    $("#status").textContent =
      r === "detective" ? "FIELD STATION ACTIVE" : "FORENSICS ACTIVE";
    panel(r === "detective" ? "overview" : "forensics");
    toast("Station selected. This is local demo state only.");
  }
  $$(".roles button").forEach((b) =>
    b.addEventListener("click", () => role(b.dataset.role)),
  );
  $("#switch").addEventListener("click", () => {
    $("#workspace").classList.add("hidden");
    $("#picker").classList.remove("hidden");
    $("#status").textContent = "AWAITING ROLE";
  });
  $$("nav button").forEach((b) =>
    b.addEventListener("click", () => panel(b.dataset.panel)),
  );
  $$(".lead").forEach((b) =>
    b.addEventListener("click", () => panel(b.dataset.go)),
  );
  $$(".add").forEach((b) =>
    b.addEventListener("click", () => add(b.dataset.evidence)),
  );
  $("#ledger").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    state.clues.delete(b.dataset.remove);
    activity("Evidence removed", items[b.dataset.remove].title);
    renderLedger();
    stats();
  });
  $$(".dossier").forEach((b) =>
    b.addEventListener("click", () => {
      activity("Dossier reviewed", b.dataset.name);
      toast(
        "Reviewed " + b.dataset.name + ". Compare this profile with evidence.",
      );
    }),
  );
  $("#decrypt").addEventListener("click", () => {
    const f = $("#decryptFeedback");
    if ($("#token").value.trim().toUpperCase() === "HELIX") {
      state.decrypted = true;
      f.textContent = "TOKEN VERIFIED — ACCESS TRACE CORROBORATED";
      $("#decrypt").disabled = true;
      add("ev4");
      stats();
      activity("Forensic token decrypted", "Access trace corroborated");
    } else {
      f.className = "feedback error";
      f.textContent = "TOKEN REJECTED — RECHECK THE THREE-STEP SHIFT.";
    }
  });
  $("#token").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#decrypt").click();
  });
  $("#submit").addEventListener("click", () => {
    const suspect = $("#suspect").value,
      key = $("#support").value,
      reason = $("#reason").value.trim(),
      f = $("#accuseFeedback");
    if (!suspect || !key || reason.length < 20) {
      f.className = "feedback error";
      f.textContent =
        "Select a suspect, cite evidence, and enter at least 20 characters of reasoning.";
      return;
    }
    f.className = "feedback";
    f.textContent = `LOCAL DRAFT RECORDED — ${suspect.toUpperCase()} / NOT SENT TO A SERVER`;
    activity("Accusation draft prepared", suspect + " · " + items[key].id);
    toast("Saved in this browser only; no team concurrence recorded.");
  });
  renderLedger();
  renderActivity();
  stats();
})();
