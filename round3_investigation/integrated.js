(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const apiUrl =
    new URLSearchParams(location.search).get("api") || "http://localhost:4000";
  const state = {
    role: null,
    clues: [],
    activity: [],
    decrypted: false,
    accusation: null,
    deadline: null,
    serverOffset: 0,
    roundStatus: "not_started",
    invite: "",
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

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 3200);
  }

  async function api(path, body) {
    const response = await fetch(`${apiUrl}/api/investigation${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function applyEnvelope(envelope) {
    const current = envelope.state;
    state.role = current.role;
    state.clues = current.clues || [];
    state.activity = current.activity || [];
    state.decrypted = Boolean(current.decrypted);
    state.accusation = current.accusation || null;
    state.deadline = envelope.deadline
      ? new Date(envelope.deadline).getTime()
      : null;
    state.serverOffset = envelope.serverNow
      ? new Date(envelope.serverNow).getTime() - Date.now()
      : 0;
    state.roundStatus = envelope.roundStatus || "running";
    render();
  }

  async function refresh() {
    try {
      applyEnvelope(await api("/state"));
    } catch (error) {
      if (
        state.role &&
        !["Round 3 is not running", "Round 3 has not started"].includes(
          error.message,
        )
      ) {
        toast(error.message);
      }
      if (
        !state.role &&
        ![
          "No investigation role assigned",
          "Join the investigation first",
          "Investigation authentication required",
        ].includes(error.message)
      ) {
        $("#status").textContent = error.message.toUpperCase();
      }
    }
  }

  function evidenceKeys() {
    return new Set(state.clues.map((clue) => clue.key));
  }

  function renderActivity() {
    const entries = [...state.activity].reverse();
    $("#activity").innerHTML = entries.length
      ? entries
          .map(
            (item) =>
              `<div class="activity-item"><b>${escapeHtml(item.message)}</b><small>${new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${escapeHtml(item.role)}</small></div>`,
          )
          .join("")
      : "No evidence submitted yet.";
  }

  function renderLedger() {
    const keys = evidenceKeys();
    $("#count").textContent = String(keys.size);
    $("#clues").textContent = String(keys.size).padStart(2, "0");
    $("#ledger").innerHTML = keys.size
      ? state.clues
          .map(
            ({ key, addedBy }) =>
              `<div class="activity-item"><b>${items[key].id} — ${items[key].title}</b><small>${items[key].detail} · Added by ${escapeHtml(addedBy)}</small></div>`,
          )
          .join("")
      : "The evidence ledger is empty.";
    $$(".add").forEach((button) => {
      const key = button.dataset.evidence;
      const added = keys.has(key);
      button.disabled =
        locked() || added || (key === "ev1" && state.role !== "detective");
      button.textContent = added ? "ADDED TO LEDGER" : "ADD TO LEDGER";
    });
    const support = $("#support");
    const previous = support.value;
    support.innerHTML =
      '<option value="">Select evidence…</option>' +
      state.clues
        .map(
          ({ key }) =>
            `<option value="${key}">${items[key].id} — ${items[key].title}</option>`,
        )
        .join("");
    if (keys.has(previous)) support.value = previous;
  }

  function locked() {
    return (
      state.roundStatus !== "running" ||
      state.deadline === null ||
      state.deadline <= Date.now() + state.serverOffset
    );
  }

  function renderAccusation() {
    const accusation = state.accusation;
    const cards = $$(".concur");
    const approvals = accusation?.approvals || [];
    cards.forEach((card, index) => {
      const role = index === 0 ? "detective" : "analyst";
      const status = card.querySelector("span");
      status.textContent = approvals.includes(role) ? "APPROVED" : "PENDING";
      status.classList.toggle("approved", approvals.includes(role));
    });
    const submit = $("#submit");
    const feedback = $("#accuseFeedback");
    submit.disabled =
      locked() || Boolean(accusation) || state.clues.length === 0;
    if (accusation) {
      $("#panel-accusation").querySelector(".eyebrow").textContent =
        "FINAL DECISION / SERVER RECORDED";
      feedback.textContent = `${accusation.suspect} · ${accusation.evidenceKey.toUpperCase()} · ${accusation.reasoning}`;
      feedback.className = "feedback";
      submit.textContent = accusation.agreed
        ? "BOTH ROLES APPROVED"
        : "PENDING OTHER ROLE APPROVAL";
    } else {
      submit.textContent = "RECORD TEAM ACCUSATION";
    }
    let approve = $("#approveAccusation");
    if (!approve) {
      approve = document.createElement("button");
      approve.id = "approveAccusation";
      approve.className = "primary";
      approve.type = "button";
      approve.textContent = "APPROVE ACCUSATION";
      $("#panel-accusation .columns > article:last-child").append(approve);
      approve.addEventListener(
        "click",
        () => void mutate("/accusation/approve", {}),
      );
    }
    approve.hidden =
      !accusation || accusation.agreed || accusation.submittedBy === state.role;
    approve.disabled = locked();
    const warning = $("#panel-accusation .warning");
    warning.textContent = accusation
      ? accusation.agreed
        ? "Both investigation roles approved this accusation."
        : "PENDING — the other role must approve before the case is agreed."
      : "The submitter counts as the first approval; the other role must approve the same accusation.";
  }

  function render() {
    const hasRole = Boolean(state.role);
    $("#picker").classList.toggle("hidden", hasRole);
    $("#workspace").classList.toggle("hidden", !hasRole);
    $("#status").textContent = hasRole
      ? `${state.role === "detective" ? "FIELD" : "FORENSICS"} STATION · ${locked() ? "LOCKED" : "ACTIVE"}`
      : "AWAITING ROLE";
    if (!hasRole) return;
    $("#roleName").textContent =
      state.role === "detective" ? "Lead Detective" : "Forensic Analyst";
    $("#roleName").style.color =
      state.role === "detective" ? "var(--cyan)" : "var(--purple)";
    $("#switch").hidden = true;
    $(".disclaimer").textContent = "SHARED CASE STATE · SAVED ON SERVER";
    $(".pill").textContent =
      `● ${locked() ? "EVIDENCE LOCKED" : "SHARED SERVER STATE"}`;
    $("#decrypt").disabled =
      state.role !== "analyst" || state.decrypted || locked();
    $("#decryptFeedback").textContent = state.decrypted
      ? "TOKEN VERIFIED — FORENSIC EVIDENCE ADDED"
      : "";
    $("#submit").disabled =
      locked() || Boolean(state.accusation) || state.clues.length === 0;
    $("#reason").disabled = locked() || Boolean(state.accusation);
    $("#suspect").disabled = locked() || Boolean(state.accusation);
    $("#support").disabled =
      locked() || Boolean(state.accusation) || state.clues.length === 0;
    const keys = evidenceKeys();
    $("#confidence").textContent =
      `${Math.min(12 + keys.size * 17 + (state.decrypted ? 22 : 0), 94)}%`;
    renderActivity();
    renderLedger();
    renderAccusation();
    if (state.role === "detective" && state.invite) renderInvite();
  }

  function renderInvite() {
    let panel = $("#inviteShare");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "inviteShare";
      panel.className = "invite-share";
      panel.innerHTML =
        '<label for="inviteValue">ONE-USE ANALYST INVITATION</label><div><input id="inviteValue" readonly><button class="outline" id="copyInvite" type="button">COPY</button></div><small>Share privately with the analyst. This invitation expires after ten minutes.</small>';
      $("#workspace").prepend(panel);
      $("#copyInvite").addEventListener("click", async () => {
        await navigator.clipboard.writeText(state.invite);
        toast("Invitation copied. Share it privately.");
      });
    }
    panel.hidden = false;
    $("#inviteValue").value = state.invite;
  }

  function ensureAnalystForm() {
    const roles = $(".roles");
    let form = $("#analystInviteForm");
    if (!form) {
      form = document.createElement("form");
      form.id = "analystInviteForm";
      form.className = "invite-form";
      form.innerHTML =
        '<label for="analystInvite">ANALYST INVITATION</label><div><input id="analystInvite" autocomplete="off" required minlength="32" maxlength="128" placeholder="Paste the one-use invitation"><button class="primary" type="submit">JOIN ANALYST STATION</button></div>';
      roles.after(form);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void mutate("/join/analyst", {
          invite: $("#analystInvite").value.trim(),
        });
      });
    }
    form.hidden = false;
  }

  async function mutate(path, body) {
    try {
      const response = await api(path, body);
      if (response.analystInvite) state.invite = response.analystInvite;
      if (response.state) applyEnvelope({ state: response.state });
      await refresh();
      toast("Saved to the shared investigation.");
    } catch (error) {
      toast(error.message);
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.matches('.roles button[data-role="detective"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void mutate("/join", {});
      } else if (button.matches('.roles button[data-role="analyst"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        ensureAnalystForm();
      } else if (button.matches(".add[data-evidence]")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        void mutate("/evidence", { key: button.dataset.evidence });
      } else if (button.id === "decrypt") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const feedback = $("#decryptFeedback");
        if ($("#token").value.trim().toUpperCase() !== "HELIX") {
          feedback.className = "feedback error";
          feedback.textContent =
            "TOKEN REJECTED — RECHECK THE THREE-STEP SHIFT.";
        } else {
          void mutate("/decrypt", { token: $("#token").value.trim() });
        }
      } else if (button.id === "submit") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void mutate("/accusation", {
          suspect: $("#suspect").value,
          evidenceKey: $("#support").value,
          reasoning: $("#reason").value.trim(),
        });
      } else if (button.id === "switch") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  function updateTimer() {
    if (state.deadline === null) {
      $("#timer").textContent = "--:--";
      return;
    }
    const seconds = Math.max(
      0,
      Math.ceil((state.deadline - (Date.now() + state.serverOffset)) / 1000),
    );
    $("#timer").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    if (seconds === 0 && state.role) render();
  }

  $('.roles button[data-role="analyst"]').addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      ensureAnalystForm();
    },
    true,
  );
  $("#ledger").addEventListener(
    "click",
    (event) => {
      if (event.target.closest("[data-remove]"))
        event.stopImmediatePropagation();
    },
    true,
  );
  $("#decrypt").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("#decrypt").click();
  });

  void refresh();
  setInterval(() => {
    if (state.role) void refresh();
  }, 1500);
  setInterval(updateTimer, 1000);
})();
