// The six-section picker. Prevents a surprise jump: only a click on a section other than the current one moves
// Kompas; Escape, a click between sections or on the current one just closes.
const NAMES = ["Top left", "Top centre", "Top right", "Bottom left", "Bottom centre", "Bottom right"];
const current = Number(new URLSearchParams(location.search).get("current"));
const grid = document.getElementById("grid");

NAMES.forEach((name, i) => {
  const cell = document.createElement("button");
  cell.className = "cell" + (i === current ? " current" : "");
  cell.dataset.section = String(i);
  cell.innerHTML = `<b>${name}</b><span>${i === current ? "Kompas is here" : "Place Kompas here"}</span>`;
  cell.addEventListener("click", (e) => { e.stopPropagation(); i === current ? window.picker.cancel() : window.picker.pick(i); });
  grid.append(cell);
});

document.body.addEventListener("click", () => window.picker.cancel());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.picker.cancel(); });
window.addEventListener("blur", () => window.picker.cancel());
