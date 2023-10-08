const updateConfig = () => {
  fetch("/config")
    .then((response) => response.json())
    .then((data) => {
      const configData = document.getElementById("configData");
      configData.textContent = JSON.stringify(data, null, 2);
    })
    .catch((error) => {
      console.error("Error fetching config:", error);
    });
};

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

const createDeviceCard = (device) => {
  const card = document.createElement("div");
  card.className = "device-card";

  const title = document.createElement("h4");
  title.textContent = `${device.manufacturer} (${device.model})`;
  card.appendChild(title);

  const lastUpdated = document.createElement("p");
  lastUpdated.textContent = `Last Updated: ${new Date(
    device.lastUpdated
  ).toLocaleString()}`;
  card.appendChild(lastUpdated);

  if (device.data) {
    for (let key in device.data) {
      const dataItem = document.createElement("p");
      dataItem.textContent = `${key}: ${device.data[key]}`;
      card.appendChild(dataItem);
    }
  }

  if (device.type === "light" && device.colour) {
    const lightStatus = document.createElement("div");
    lightStatus.className = "light-status-container";

    const lightIndicator = document.createElement("div");
    lightIndicator.className = "light-indicator";

    const brightness = device.brightness || 100;
    const statusDim = device.on ? 1 : 0.3; // dim if off

    const rgb = hexToRgb(device.colour);
    if (rgb) {
      lightIndicator.style.background = `rgba(${rgb.r},${rgb.g},${rgb.b},${
        (brightness / 100) * statusDim
      })`;
    }

    lightStatus.appendChild(lightIndicator);

    const status = document.createElement("p");
    status.textContent = `Status: ${device.on ? "On" : "Off"}`;
    lightStatus.appendChild(status);

    card.appendChild(lightStatus);
  }

  return card;
};

const updateDevices = () => {
  fetch("/devices")
    .then((response) => response.json())
    .then((data) => {
      const hubList = document.getElementById("hubList");
      hubList.innerHTML = "";
      data.hubs.forEach((hub) => {
        hubList.appendChild(createDeviceCard(hub));
      });

      const lightList = document.getElementById("lightList");
      lightList.innerHTML = "";
      data.lights.forEach((light) => {
        lightList.appendChild(createDeviceCard(light));
      });
    })
    .catch((error) => {
      console.error("Error fetching devices:", error);
    });
};

const updateLogs = () => {
  fetch("/logs")
    .then((response) => response.json())
    .then((data) => {
      const logTextarea = document.getElementById("logList");
      logTextarea.value = data.join("\n");
    })
    .catch((error) => {
      console.error("Error fetching logs:", error);
    });
};

const updateAllData = () => {
  updateConfig();
  updateDevices();
  updateLogs();
};

updateAllData();
setInterval(updateAllData, 1000);
