(() => {
  "use strict";

  const items = window.GRAVITY_GOONS_GALLERY || [];
  const config = window.GRAVITY_GOONS_GALLERY_CONFIG || {};
  const total = config.total || items.length;
  const storageKey = config.storageKey || "gravity-goons-review-v1";
  const state = JSON.parse(localStorage.getItem(storageKey) || "{}");
  const remainingResetKey = `${storageKey}:remaining-reset-2026-07-28`;
  if (localStorage.getItem(remainingResetKey) !== "done") {
    Object.keys(state).forEach((id) => {
      if (state[id]?.status !== "good") delete state[id];
    });
    localStorage.setItem(storageKey, JSON.stringify(state));
    localStorage.setItem(remainingResetKey, "done");
  }
  (config.resetBatches || []).forEach((batch) => {
    if (localStorage.getItem(batch.key) === "done") return;
    (batch.ids || []).forEach((id) => delete state[id]);
    localStorage.setItem(storageKey, JSON.stringify(state));
    localStorage.setItem(batch.key, "done");
  });
  let visible = items;
  let currentIndex = -1;
  let toastTimer;

  const $ = (id) => document.getElementById(id);
  const gallery = $("gallery");
  const viewer = $("viewer");
  const controls = {
    search: $("search"), batch: $("batch"), status: $("status"),
    discipline: $("discipline"), species: $("species")
  };

  const pad = (id) => String(id).padStart(4, "0");
  const review = (id) => state[id] || { status: "unreviewed", note: "" };

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function toast(message) {
    const element = $("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 1800);
  }

  function fillSelect(select, values) {
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  function initializeFilters() {
    for (let start = 1; start <= 1000; start += 100) {
      const option = document.createElement("option");
      option.value = String(start);
      option.textContent = `#${pad(start)}–#${pad(start + 99)}`;
      controls.batch.append(option);
    }
    fillSelect(controls.discipline, [...new Set(items.map((item) => item.discipline))].sort());
    fillSelect(controls.species, [...new Set(items.map((item) => item.species))].sort());
  }

  function updateCounts() {
    const values = items.map((item) => review(item.id).status);
    const good = values.filter((value) => value === "good").length;
    const flagged = values.filter((value) => value === "flagged").length;
    const unreviewed = total - good - flagged;
    const queue = total - good;
    $("summary").textContent = `${queue.toLocaleString()} still in review · ${good.toLocaleString()} approved and removed`;
    $("good-count").textContent = good.toLocaleString();
    $("flagged-count").textContent = flagged.toLocaleString();
    $("remaining-count").textContent = unreviewed.toLocaleString();
    $("visible-count").textContent = `${visible.length.toLocaleString()} visible`;
    $("progress-fill").style.width = `${total ? ((good + flagged) / total) * 100 : 0}%`;
  }

  function card(item) {
    const record = review(item.id);
    const element = document.createElement("button");
    element.type = "button";
    element.className = `card ${record.status}`;
    element.dataset.id = item.id;
    const note = record.note ? `<p class="flag-note">${escapeHtml(record.note)}</p>` : "";
    element.innerHTML = `
      <img src="${item.thumb}" alt="Gravity Goons #${pad(item.id)}" loading="lazy" decoding="async" />
      <div class="card-body">
        <div class="card-title"><span>#${pad(item.id)} · ${escapeHtml(item.species)}</span><i class="status-dot"></i></div>
        <p class="card-meta">${escapeHtml(item.discipline)} · ${escapeHtml(item.sponsor)}<br>${escapeHtml(item.pose)}</p>
        ${note}
      </div>`;
    element.addEventListener("click", () => openItem(item.id));
    return element;
  }

  function escapeHtml(value) {
    const span = document.createElement("span");
    span.textContent = value || "";
    return span.innerHTML;
  }

  function applyFilters() {
    const query = controls.search.value.trim().toLowerCase().replace(/^#/, "");
    const batchStart = controls.batch.value === "all" ? null : Number(controls.batch.value);
    visible = items.filter((item) => {
      const record = review(item.id);
      const haystack = `${pad(item.id)} ${item.id} ${item.species} ${item.discipline} ${item.sponsor} ${item.pose}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!batchStart || (item.id >= batchStart && item.id < batchStart + 100))
        && (controls.status.value === "all" ? record.status !== "good" : record.status === controls.status.value)
        && (controls.discipline.value === "all" || item.discipline === controls.discipline.value)
        && (controls.species.value === "all" || item.species === controls.species.value);
    });
    gallery.replaceChildren(...visible.map(card));
    $("empty").hidden = visible.length > 0;
    updateCounts();
  }

  function openItem(id) {
    currentIndex = visible.findIndex((item) => item.id === id);
    if (currentIndex < 0) return;
    renderModal();
    if (!viewer.open) viewer.showModal();
  }

  function renderModal() {
    const item = visible[currentIndex];
    const record = review(item.id);
    $("full-image").src = item.full;
    $("full-image").alt = `Gravity Goons #${pad(item.id)}`;
    $("modal-number").textContent = `GOON #${pad(item.id)}`;
    $("modal-title").textContent = item.species;
    $("modal-subtitle").textContent = `${item.discipline} · ${item.sponsor} · ${item.rarity}`;
    $("issue-note").value = record.note || "";
    $("open-original").href = item.full;
    $("traits").innerHTML = [
      ...(item.review_note ? [["Correction requested", item.review_note]] : []),
      ["Build", item.body_build], ["Complexion", item.complexion], ["Stance", item.stance],
      ["Expression", item.expression], ["Eyes", item.eyes], ["Headwear", item.headwear],
      ["Eyewear", item.eyewear], ["Apparel", item.apparel], ["Bottom", item.bottom],
      ["Footwear", item.footwear], ["Equipment", item.equipment], ["Pose", item.pose],
      ["Accessory", item.accessory], ["Background", item.background], ["Source", item.source]
    ].map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("");
    $("mark-good").classList.toggle("selected", record.status === "good");
    $("mark-flagged").classList.toggle("selected", record.status === "flagged");
  }

  function setReview(status, note = "") {
    const item = visible[currentIndex];
    if (!item) return;
    if (status === "unreviewed") delete state[item.id];
    else state[item.id] = { status, note: note.trim(), updatedAt: new Date().toISOString() };
    saveState();
    applyFilters();
    const stillVisible = visible.findIndex((entry) => entry.id === item.id);
    if (stillVisible >= 0) {
      currentIndex = stillVisible;
      renderModal();
    } else if (visible.length) {
      currentIndex = Math.min(currentIndex, visible.length - 1);
      renderModal();
    } else {
      viewer.close();
    }
    toast(status === "good" ? `#${pad(item.id)} marked good` : status === "flagged" ? `#${pad(item.id)} flagged` : `#${pad(item.id)} cleared`);
  }

  function move(step) {
    if (!visible.length) return;
    currentIndex = (currentIndex + step + visible.length) % visible.length;
    renderModal();
  }

  function correctionRows() {
    return items
      .filter((item) => review(item.id).status === "flagged")
      .map((item) => ({ ...item, note: review(item.id).note || "Needs visual correction" }));
  }

  function correctionText() {
    const rows = correctionRows();
    if (!rows.length) return "No Gravity Goons are currently flagged.";
    return rows.map((item) => `#${pad(item.id)} — ${item.note}`).join("\n");
  }

  async function copyIssues() {
    const text = correctionText();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast("Flagged correction list copied");
  }

  function downloadIssues() {
    const rows = correctionRows();
    const payload = {
      schema: "gravity-goons-review-corrections-v1",
      exported_at: new Date().toISOString(),
      flagged_count: rows.length,
      corrections: rows.map((item) => ({ token_id: item.id, note: item.note, species: item.species, discipline: item.discipline, sponsor: item.sponsor }))
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "gravity-goons-corrections.json";
    link.click();
    URL.revokeObjectURL(url);
    toast("Correction list downloaded");
  }

  Object.values(controls).forEach((control) => control.addEventListener("input", applyFilters));
  $("clear-filters").addEventListener("click", () => {
    controls.search.value = "";
    controls.batch.value = controls.status.value = controls.discipline.value = controls.species.value = "all";
    applyFilters();
  });
  $("close-viewer").addEventListener("click", () => viewer.close());
  $("previous").addEventListener("click", () => move(-1));
  $("next").addEventListener("click", () => move(1));
  $("mark-good").addEventListener("click", () => setReview("good"));
  $("mark-flagged").addEventListener("click", () => {
    $("issue-note").focus();
    if (!$("issue-note").value.trim()) toast("Describe the issue, then save it");
  });
  $("save-note").addEventListener("click", () => setReview("flagged", $("issue-note").value));
  $("clear-review").addEventListener("click", () => setReview("unreviewed"));
  $("copy-issues").addEventListener("click", copyIssues);
  $("download-issues").addEventListener("click", downloadIssues);
  viewer.addEventListener("click", (event) => { if (event.target === viewer) viewer.close(); });
  document.addEventListener("keydown", (event) => {
    if (!viewer.open || event.target === $("issue-note")) return;
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
    if (event.key.toLowerCase() === "g") setReview("good");
    if (event.key.toLowerCase() === "f") $("issue-note").focus();
  });

  initializeFilters();
  applyFilters();
})();
