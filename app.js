(function () {
  const API_BASE =
    "https://api.mailmoose.app/lists/noorderlichtjagers/contest-grade";
  const HANDOFF =
    "https://nlj.mailmoose.app/contest-grade/handoff?return=" +
    encodeURIComponent(location.origin + "/");
  const TOKEN_KEY = "mmGradeToken";

  const statusEl = document.getElementById("status");
  const photo = document.getElementById("photo");
  const empty = document.getElementById("empty");
  const meta = document.getElementById("meta");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const filterEl = document.getElementById("filter");
  const userEl = document.getElementById("user");
  const loginBtn = document.getElementById("login");
  const logoutBtn = document.getElementById("logout");

  let allItems = [];
  let items = [];
  let index = 0;
  let saving = false;
  /** @type {'all'|'none'|1|2|3|4|5} */
  let gradeFilter = "all";
  let gradeToken = "";

  function current() {
    return items[index] || null;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function readTokenFromHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return null;
    const params = new URLSearchParams(raw);
    const t = (params.get("gradeToken") || params.get("token") || "").trim();
    if (!t) return null;
    history.replaceState(null, "", location.pathname + location.search);
    return t;
  }

  function getToken() {
    const fromHash = readTokenFromHash();
    if (fromHash) {
      try {
        sessionStorage.setItem(TOKEN_KEY, fromHash);
      } catch (_) {
        /* ignore */
      }
      return fromHash;
    }
    try {
      return (sessionStorage.getItem(TOKEN_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function clearToken() {
    gradeToken = "";
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function goLogin() {
    location.href = HANDOFF;
  }

  function authHeaders(extra) {
    const h = Object.assign({ accept: "application/json" }, extra || {});
    if (gradeToken) h.authorization = "Bearer " + gradeToken;
    return h;
  }

  async function api(path, opts) {
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearToken();
      const err = new Error(data.message || data.error || "Niet ingelogd");
      err.login = true;
      throw err;
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || data.error || "HTTP " + res.status);
    }
    return data;
  }

  function imageUrl(key) {
    return (
      API_BASE +
      "/image?key=" +
      encodeURIComponent(key) +
      "&gradeToken=" +
      encodeURIComponent(gradeToken)
    );
  }

  function matchesFilter(item) {
    if (gradeFilter === "all") return true;
    if (gradeFilter === "none") return !item.grade;
    // Numeric filter N = grade N and higher.
    return typeof item.grade === "number" && item.grade >= gradeFilter;
  }

  function applyFilter(preferId) {
    const oldIndex = index;
    items = allItems.filter(matchesFilter);
    if (preferId) {
      const found = items.findIndex((i) => i.id === preferId);
      index =
        found >= 0
          ? found
          : Math.min(oldIndex, Math.max(0, items.length - 1));
    } else {
      index = Math.min(oldIndex, Math.max(0, items.length - 1));
    }
    updateFilterButtons();
    updateChrome();
  }

  function updateFilterButtons() {
    filterEl.querySelectorAll("button[data-filter]").forEach((btn) => {
      const val = btn.dataset.filter;
      const active =
        val === "all"
          ? gradeFilter === "all"
          : val === "none"
            ? gradeFilter === "none"
            : gradeFilter === Number(val);
      btn.classList.toggle("active", active);
    });
  }

  function filterLabel() {
    if (gradeFilter === "all") return "alle";
    if (gradeFilter === "none") return "geen cijfer";
    if (gradeFilter === 5) return "cijfer 5";
    return "cijfer ≥" + gradeFilter;
  }

  function updateChrome() {
    const item = current();
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= items.length - 1;
    const gradedAll = allItems.filter((i) => i.grade).length;
    if (!item) {
      photo.hidden = true;
      empty.hidden = false;
      meta.hidden = true;
      empty.textContent =
        allItems.length === 0
          ? "Geen inzendingen gevonden."
          : "Geen foto’s in filter “" + filterLabel() + "”.";
      setStatus(
        gradedAll +
          "/" +
          allItems.length +
          " beoordeeld · filter: " +
          filterLabel() +
          " (0)"
      );
      return;
    }
    empty.hidden = true;
    meta.hidden = false;
    photo.hidden = false;
    photo.src = imageUrl(item.s3Key);
    photo.alt = item.filename || "Inzending";

    document.getElementById("m-name").textContent = item.fromName || "—";
    document.getElementById("m-email").textContent = item.fromEmail || "";
    document.getElementById("m-place").textContent = item.location || "—";
    document.getElementById("m-date").textContent = item.date || "";
    document.getElementById("m-file").textContent = item.filename || "—";
    document.getElementById("m-index").textContent =
      "Foto " +
      item.photoIndex +
      "/" +
      item.photoCount +
      " · " +
      (index + 1) +
      "/" +
      items.length +
      " in filter";

    const notes = document.getElementById("m-notes");
    if (item.notes) {
      notes.hidden = false;
      notes.textContent = item.notes;
    } else {
      notes.hidden = true;
      notes.textContent = "";
    }

    document.querySelectorAll("#grades button").forEach((btn) => {
      const g = Number(btn.dataset.g);
      btn.classList.toggle("active", item.grade === g);
    });
    const saved = document.getElementById("m-saved");
    saved.textContent = item.grade
      ? "Opgeslagen: " + item.grade + "/5"
      : "Nog niet beoordeeld";

    setStatus(
      gradedAll +
        "/" +
        allItems.length +
        " beoordeeld · filter: " +
        filterLabel() +
        " · " +
        (index + 1) +
        " van " +
        items.length
    );
  }

  function go(delta) {
    if (!items.length) return;
    index = Math.max(0, Math.min(items.length - 1, index + delta));
    updateChrome();
  }

  async function load(refresh) {
    setStatus(refresh ? "Vernieuwen…" : "Laden…");
    const data = await api("/entries" + (refresh ? "?refresh=1" : ""), {
      headers: authHeaders(),
    });
    const prevId = current() && current().id;
    allItems = data.items || [];
    applyFilter(prevId);
  }

  async function setGrade(grade) {
    const item = current();
    if (!item || saving) return;
    if (grade < 1 || grade > 5) return;
    saving = true;
    try {
      await api("/grade", {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          ticketId: item.ticketId,
          attachmentId: item.attachmentId,
          grade: grade,
        }),
      });
      item.grade = grade;
      const keepId = matchesFilter(item) ? item.id : null;
      applyFilter(keepId);
      document.querySelector(".frame").classList.add("flash");
      setTimeout(
        () => document.querySelector(".frame").classList.remove("flash"),
        180
      );
    } catch (err) {
      if (err.login) {
        setStatus("Sessie verlopen — opnieuw inloggen…");
        setTimeout(goLogin, 600);
        return;
      }
      setStatus(err.message || String(err));
    } finally {
      saving = false;
    }
  }

  function setFilter(raw) {
    if (raw === "all" || raw === "none") {
      gradeFilter = raw;
    } else {
      const n = Number(raw);
      if (!(n >= 1 && n <= 5)) return;
      gradeFilter = n;
    }
    const prevId = current() && current().id;
    applyFilter(prevId);
  }

  function setAuthUi(username) {
    if (username) {
      userEl.hidden = false;
      userEl.textContent = username;
      loginBtn.hidden = true;
      logoutBtn.hidden = false;
    } else {
      userEl.hidden = true;
      userEl.textContent = "";
      loginBtn.hidden = false;
      logoutBtn.hidden = true;
    }
  }

  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));
  document.getElementById("grades").addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-g]");
    if (!btn) return;
    setGrade(Number(btn.dataset.g));
  });
  filterEl.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-filter]");
    if (!btn) return;
    setFilter(btn.dataset.filter);
  });
  loginBtn.addEventListener("click", goLogin);
  logoutBtn.addEventListener("click", () => {
    clearToken();
    setAuthUi("");
    allItems = [];
    items = [];
    updateChrome();
    setStatus("Uitgelogd. Log opnieuw in als NLJ-admin.");
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.target && /input|textarea|select/i.test(ev.target.tagName)) return;
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      go(-1);
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      go(1);
    } else if (ev.key >= "1" && ev.key <= "5" && !ev.altKey && !ev.metaKey) {
      ev.preventDefault();
      setGrade(Number(ev.key));
    } else if (ev.key === "r" || ev.key === "R") {
      ev.preventDefault();
      load(true).catch((err) => {
        if (err.login) goLogin();
        else setStatus(err.message || String(err));
      });
    }
  });

  async function boot() {
    gradeToken = getToken();
    if (!gradeToken) {
      setAuthUi("");
      setStatus("Inloggen als NLJ-admin…");
      goLogin();
      return;
    }
    try {
      const me = await api("/me", { headers: authHeaders() });
      setAuthUi(me.username || "admin");
      await load(false);
    } catch (err) {
      if (err.login) {
        setStatus("Inloggen als NLJ-admin…");
        goLogin();
        return;
      }
      setAuthUi("");
      setStatus(err.message || String(err));
    }
  }

  boot();
})();
