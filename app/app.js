const CLIENT_ID = "client1";
const API_URL = "http://localhost:3001";

const currentFilters = new Map();
const currentUpdates = new Map();
const stagedGroups = [];

function createDeleteIcon(parentElement, clickCallback) {
  const deleteIcon = document.createElement("span");
  deleteIcon.className = "delete-icon";
  deleteIcon.textContent = "×";
  deleteIcon.addEventListener("click", clickCallback);
  parentElement.appendChild(deleteIcon);
}

function renderCurrentFilters() {
  const filtersDiv = document.getElementById("currentFilters");
  filtersDiv.innerHTML = "";
  currentFilters.forEach((value, key) => {
    const div = document.createElement("div");
    div.className = "filter-item";
    div.textContent = `${key}: ${value}`;
    createDeleteIcon(div, function () {
      currentFilters.delete(key);
      renderCurrentFilters();
    });
    filtersDiv.appendChild(div);
  });
}

function renderCurrentUpdates() {
  const updatesDiv = document.getElementById("currentUpdates");
  updatesDiv.innerHTML = "";
  currentUpdates.forEach((value, key) => {
    const div = document.createElement("div");
    div.className = "update-item";
    div.textContent = `${key}: ${value}`;
    createDeleteIcon(div, function () {
      currentUpdates.delete(key);
      renderCurrentUpdates();
    });
    updatesDiv.appendChild(div);
  });
}

function renderStagedGroups() {
  const groupsDiv = document.getElementById("stagedGroups");
  groupsDiv.innerHTML = "";
  stagedGroups.forEach((group, index) => {
    const div = document.createElement("div");
    div.className = "staged-group";

    const filtersText = Array.from(group.filters.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const updatesText = Array.from(group.updates.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.innerHTML = `<strong>Filters:</strong> ${
      filtersText || "None"
    } <br> <strong>Updates:</strong> ${updatesText}`;

    const deleteIcon = document.createElement("span");
    deleteIcon.className = "delete-icon";
    deleteIcon.textContent = "x";
    deleteIcon.addEventListener("click", function (e) {
      e.stopPropagation(); // prevent the parent event handler from firing
      stagedGroups.splice(index, 1);
      renderStagedGroups();
    });

    div.textContent = `Group ${index + 1}: ${group.filters.size} Filters, ${
      group.updates.size
    } Updates`;

    div.appendChild(deleteIcon);
    div.appendChild(tooltip);
    groupsDiv.appendChild(div);
  });
}

document.getElementById("addFilterBtn").addEventListener("click", function (e) {
  e.preventDefault();
  const key = document.getElementById("filterKey").value;
  const value = document.getElementById("filterValue").value;

  if (!key.trim()) {
    alert("Filter key cannot be empty.");
    return;
  }

  currentFilters.set(key, value);
  renderCurrentFilters();
  document.getElementById("filterKey").value = "";
  document.getElementById("filterValue").value = "";
});

document.getElementById("addUpdateBtn").addEventListener("click", function (e) {
  e.preventDefault();
  const key = document.getElementById("updateKey").value;
  const value = document.getElementById("updateValue").value;

  if (!key.trim()) {
    alert("Update key cannot be empty.");
    return;
  }

  currentUpdates.set(key, value);
  renderCurrentUpdates();
  document.getElementById("updateKey").value = "";
  document.getElementById("updateValue").value = "";
});

document
  .getElementById("stageGroupBtn")
  .addEventListener("click", function (e) {
    e.preventDefault();
    if (currentUpdates.size === 0) {
      alert("At least one update is required to stage a group.");
      return;
    }
    const group = {
      filters: new Map(currentFilters),
      updates: new Map(currentUpdates),
    };
    stagedGroups.push(group);
    currentFilters.clear();
    currentUpdates.clear();
    renderCurrentFilters();
    renderCurrentUpdates();
    renderStagedGroups();
  });

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

document
  .getElementById("commitChangesBtn")
  .addEventListener("click", function (e) {
    e.preventDefault();
    if (stagedGroups.length === 0) {
      alert("No staged groups to commit.");
      return;
    }
    const controlMessage = {
      id: generateUUID(),
      type: "control",
      senderId: CLIENT_ID,
      timestamp: new Date().toISOString(),
      commands: stagedGroups.map((group) => ({
        filterCriteria: Object.fromEntries(group.filters),
        updateDetails: Object.fromEntries(group.updates),
      })),
    };

    const url = `${API_URL}/control`;
    console.log("Sending control message:", controlMessage);
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(controlMessage),
    })
      .then((response) => {
        if (response.ok) {
          alert("Changes committed successfully.");
        } else {
          alert("Failed to commit changes.");
        }
      })
      .catch((error) => {
        alert(`Failed to commit changes due to error: ${error}`);
      });

    stagedGroups.length = 0;
    renderStagedGroups();
  });
