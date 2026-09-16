const $ = id => document.getElementById(id);

const fields = [
  "weight","length","width","height","cg","loadId","surface","mu","antislip",
  "method","stf","lc","angle","available","stable","anchors","condition",
  "vehicle","responsible","notes"
];

const surfaceMu = {
  custom: 0.30,
  steel: 0.20,
  wood: 0.40,
  woodsteel: 0.30,
  rubber: 0.60
};

function n(id){ return Number($(id).value) || 0; }

function ceilSafe(x){
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.ceil(x);
}

function frictionCount(c, mu, mass, factor, stf, alphaRad){
  const demand = Math.max(0, (c - mu) * mass * factor);
  const capacityPerElement = 2 * mu * stf * Math.sin(alphaRad);
  if (capacityPerElement <= 0) return null;
  return Math.max(2, ceilSafe(demand / capacityPerElement));
}

function calculate(){
  const method = $("method").value;
  const mass = n("weight");
  const stf = n("stf");
  const lc = n("lc");
  const angle = n("angle");
  const available = Math.floor(n("available"));
  const width = n("width");
  const cg = n("cg");
  let mu = n("mu");

  if ($("antislip").checked) mu = Math.max(mu, 0.60);

  const alerts = [];
  let required = null, fwd = null, back = null, lat = null;
  let state = "review";
  let title = "Revisar antes de transportar";
  let badge = "REVISAR";

  if (method === "direct"){
    alerts.push("El amarre directo/diagonal necesita cálculo específico con LC, geometría y ángulos del sistema.");
  } else if (mass <= 0 || stf <= 0 || mu <= 0 || angle <= 0){
    alerts.push("Completa peso, STF, coeficiente de fricción y ángulo.");
  } else {
    const a = angle * Math.PI / 180;
    fwd = frictionCount(0.8, mu, mass, 1.25, stf, a);
    back = frictionCount(0.5, mu, mass, 1.10, stf, a);
    lat = frictionCount(0.5, mu, mass, 1.10, stf, a);
    required = Math.max(fwd, back, lat);

    if (angle < 30) alerts.push("Ángulo menor a 30°: configuración no apta en esta herramienta.");
    else if (angle < 45) alerts.push("Ángulo bajo: revisar la configuración y la eficacia real del amarre.");

    if (stf > lc * 0.5) alerts.push("Revisar etiqueta: el STF ingresado es alto respecto de la LC.");
    if (!$("stable").checked) alerts.push("La carga no está confirmada como rígida y estable.");
    if (!$("anchors").checked) alerts.push("Puntos de anclaje no confirmados como aptos.");
    if (!$("condition").checked) alerts.push("Elementos de sujeción sin condición/etiqueta confirmada.");
    if (width > 0 && cg > 0 && cg / width > 0.5) alerts.push("Centro de gravedad relativamente alto: requiere verificación específica de vuelco.");

    const hardStop =
      angle < 30 ||
      !$("stable").checked ||
      !$("anchors").checked ||
      !$("condition").checked;

    if (hardStop){
      state = "stop";
      badge = "NO APTO";
      title = "No liberar transporte";
    } else if (available >= required){
      state = "ok";
      badge = "APTO*";
      title = "Configuración preliminar suficiente";
    } else {
      state = "stop";
      badge = "INSUFICIENTE";
      title = `Faltan ${required - available} elemento(s)`;
    }
  }

  $("required").textContent = required ?? "—";
  $("forward").textContent = fwd ?? "—";
  $("backward").textContent = back ?? "—";
  $("lateral").textContent = lat ?? "—";
  $("resultTitle").textContent = title;
  $("statusBadge").textContent = badge;

  const card = $("resultCard");
  card.className = `result-card ${state}`;

  if (required !== null){
    $("availabilityMessage").textContent =
      available >= required
        ? `Disponibles: ${available}. Mínimo calculado: ${required}.`
        : `Disponibles: ${available}. Debes aumentar a ${required}.`;
  } else {
    $("availabilityMessage").textContent = "La app no entrega cantidad para esta configuración.";
  }

  if (state === "ok") alerts.unshift("Resultado sujeto a inspección real, capacidad de anclajes y procedimiento aplicable.");
  $("alerts").innerHTML = alerts.map(x => `<li>${x}</li>`).join("");

  document.title = required ? `Estiba Segura · ${required} elementos` : "Estiba Segura · Calculadora HSE";
}

function saveLocal(showMessage=true){
  const data = {};
  fields.forEach(id => {
    const el = $(id);
    data[id] = el.type === "checkbox" ? el.checked : el.value;
  });
  localStorage.setItem("estibaSeguraData", JSON.stringify(data));
  if (showMessage) {
    $("saveBtn").textContent = "Guardado ✓";
    setTimeout(()=> $("saveBtn").textContent = "Guardar en este equipo", 1300);
  }
}

function loadLocal(){
  const raw = localStorage.getItem("estibaSeguraData");
  if (!raw) return;
  try{
    const data = JSON.parse(raw);
    fields.forEach(id => {
      if (!(id in data)) return;
      const el = $(id);
      if (el.type === "checkbox") el.checked = Boolean(data[id]);
      else el.value = data[id];
    });
  }catch(e){}
}

function resetAll(){
  if (!confirm("¿Limpiar todos los datos guardados de esta verificación?")) return;
  localStorage.removeItem("estibaSeguraData");
  location.reload();
}

$("surface").addEventListener("change", e => {
  const val = e.target.value;
  if (val !== "custom") $("mu").value = surfaceMu[val].toFixed(2);
  calculate();
});

document.querySelectorAll("input,select,textarea").forEach(el => {
  el.addEventListener("input", calculate);
  el.addEventListener("change", calculate);
});

$("saveBtn").addEventListener("click", ()=> saveLocal(true));
$("printBtn").addEventListener("click", ()=>{
  saveLocal(false);
  window.print();
});
$("resetBtn").addEventListener("click", resetAll);

loadLocal();
calculate();

if ("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("./sw.js"));
}

let deferredPrompt;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  $("installBtn").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async ()=>{
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("installBtn").classList.add("hidden");
});
