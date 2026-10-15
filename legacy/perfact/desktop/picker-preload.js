// Bridge for the six-section picker. Prevents the picker page from doing more than answering: a section, or cancel.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("picker", {
  pick: (i) => ipcRenderer.send("kompas:place-pick", Number(i)),
  cancel: () => ipcRenderer.send("kompas:place-cancel"),
});
