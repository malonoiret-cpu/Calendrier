// ---------- Réglages : nombre de jours avant la prochaine révision ----------
const INTERVALLES = { rouge: 2, jaune: 5, vert: 14 };
const COULEURS = { rouge: '#e5484d', jaune: '#e5a400', vert: '#30a46c', neutre: '#9aa0a6' };

// ---------- Couche de stockage (seul endroit à changer pour passer à une base en ligne) ----------
const Stockage = {
  cle: 'revisions-v1',
  charger() {
    try { return JSON.parse(localStorage.getItem(this.cle)) || null; } catch (e) { return null; }
  },
  sauvegarder(donnees) {
    try { localStorage.setItem(this.cle, JSON.stringify(donnees)); }
    catch (e) { alert("Sauvegarde impossible dans ce navigateur."); }
  }
};

// ---------- Données ----------
// lessons : [{id, nom, niveau}]   plan : [{id, date, leconId, fait}]
let data = Stockage.charger() || { lessons: [], plan: [] };
let mois = new Date(); mois.setDate(1);
let jourSel = iso(new Date());

// ---------- Outils ----------
function pad(n) { return String(n).padStart(2, '0'); }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function ajouterJours(s, n) { const [y, m, j] = s.split('-').map(Number); return iso(new Date(y, m - 1, j + n)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function lecon(id) { return data.lessons.find(l => l.id === id); }
function sauver() { Stockage.sauvegarder(data); afficher(); }

// ---------- Actions ----------
function changerMois(n) { mois.setMonth(mois.getMonth() + n); afficher(); }
function choisirJour(d) { jourSel = d; afficher(); }

function ajouterLecons() {
  const zone = document.getElementById('nouvelles');
  zone.value.split('\n').map(s => s.trim()).filter(Boolean)
    .forEach(nom => data.lessons.push({ id: uid(), nom, niveau: 'neutre' }));
  zone.value = '';
  sauver();
}
function supprimerLecon(id) {
  if (!confirm('Supprimer cette leçon et ses révisions planifiées ?')) return;
  data.lessons = data.lessons.filter(l => l.id !== id);
  data.plan = data.plan.filter(p => p.leconId !== id);
  sauver();
}
function definirNiveau(id, niveau) { lecon(id).niveau = niveau; sauver(); }

function planifier() {
  document.querySelectorAll('.cocher:checked').forEach(c => {
    data.plan.push({ id: uid(), date: jourSel, leconId: c.value, fait: false });
  });
  sauver();
}
function retirer(idPlan) { data.plan = data.plan.filter(p => p.id !== idPlan); sauver(); }

// L'utilisateur indique comment la révision s'est passée : on met à jour le niveau
// et on planifie la prochaine révision selon ce niveau.
function evaluer(idPlan, niveau) {
  const p = data.plan.find(x => x.id === idPlan);
  p.fait = true;
  lecon(p.leconId).niveau = niveau;
  const aujourdhui = iso(new Date());
  // on remplace les anciennes révisions futures non faites de cette leçon
  data.plan = data.plan.filter(x => !(x.leconId === p.leconId && !x.fait && x.date > aujourdhui));
  data.plan.push({ id: uid(), date: ajouterJours(aujourdhui, INTERVALLES[niveau]), leconId: p.leconId, fait: false });
  sauver();
}

function exporter() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'revisions-sauvegarde-' + iso(new Date()) + '.json';
  a.click();
}
function importer(input) {
  const f = input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.lessons) || !Array.isArray(d.plan)) throw 0;
      if (confirm('Remplacer vos données actuelles par ce fichier ?')) { data = d; sauver(); }
    } catch (e) { alert('Fichier invalide.'); }
    input.value = '';
  };
  r.readAsText(f);
}

// ---------- Affichage ----------
function afficher() {
  afficherCalendrier(); afficherJour(); afficherLecons();
}

function afficherCalendrier() {
  document.getElementById('titreMois').textContent =
    mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const g = document.getElementById('grille');
  g.innerHTML = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(j => `<div class="entete">${j}</div>`).join('');
  const decalage = (mois.getDay() + 6) % 7;            // lundi = 0
  const debut = new Date(mois.getFullYear(), mois.getMonth(), 1 - decalage);
  const aujourdhui = iso(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i);
    const s = iso(d);
    const chips = data.plan.filter(p => p.date === s).map(p => {
      const l = lecon(p.leconId); if (!l) return '';
      return `<span class="chip ${p.fait ? 'done' : ''}" style="background:${COULEURS[l.niveau]}">${esc(l.nom)}</span>`;
    }).join('');
    const cls = 'jour' + (d.getMonth() !== mois.getMonth() ? ' autre' : '') +
                (s === aujourdhui ? ' today' : '') + (s === jourSel ? ' sel' : '');
    g.innerHTML += `<div class="${cls}" onclick="choisirJour('${s}')"><div class="n">${d.getDate()}</div>${chips}</div>`;
  }
}

function afficherJour() {
  const [y, m, j] = jourSel.split('-').map(Number);
  const titre = new Date(y, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const entrees = data.plan.filter(p => p.date === jourSel && lecon(p.leconId));
  const dejaLa = entrees.map(p => p.leconId);
  let html = `<h2>${titre}</h2>`;
  html += entrees.map(p => {
    const l = lecon(p.leconId);
    return `<div class="ligne"><span class="pt" style="background:${COULEURS[l.niveau]}"></span>
      <span class="nom" style="${p.fait ? 'text-decoration:line-through;opacity:.5' : ''}">${esc(l.nom)}</span>
      <span class="niv">${p.fait ? '✓' : `<button title="Pas connu" onclick="evaluer('${p.id}','rouge')">🔴</button><button title="Moyennement connu" onclick="evaluer('${p.id}','jaune')">🟡</button><button title="Bien connu" onclick="evaluer('${p.id}','vert')">🟢</button>`}</span>
      <button title="Retirer" onclick="retirer('${p.id}')">✕</button></div>`;
  }).join('') || '<div class="legende">Rien de prévu ce jour.</div>';
  const dispo = data.lessons.filter(l => !dejaLa.includes(l.id));
  if (dispo.length) {
    html += `<h2 style="margin-top:12px">Ajouter ce jour-là</h2>` +
      dispo.map(l => `<label class="ligne"><input type="checkbox" class="cocher" value="${l.id}">
        <span class="pt" style="background:${COULEURS[l.niveau]}"></span>${esc(l.nom)}</label>`).join('') +
      `<button style="margin-top:6px" onclick="planifier()">Planifier</button>`;
  }
  html += `<div class="legende">Après une révision, cliquez sur 🔴/🟡/🟢 : la leçon reviendra dans ${INTERVALLES.rouge}, ${INTERVALLES.jaune} ou ${INTERVALLES.vert} jours.</div>`;
  document.getElementById('panneauJour').innerHTML = html;
}

function afficherLecons() {
  document.getElementById('listeLecons').innerHTML = data.lessons.map(l =>
    `<div class="ligne"><span class="pt" style="background:${COULEURS[l.niveau]}"></span>
      <span class="nom">${esc(l.nom)}</span>
      <span class="niv"><button title="Pas encore évalué" onclick="definirNiveau('${l.id}','neutre')">⚪</button><button onclick="definirNiveau('${l.id}','rouge')">🔴</button><button onclick="definirNiveau('${l.id}','jaune')">🟡</button><button onclick="definirNiveau('${l.id}','vert')">🟢</button></span>
      <button title="Supprimer" onclick="supprimerLecon('${l.id}')">🗑</button></div>`
  ).join('') || '<div class="legende">Aucune leçon pour l’instant.</div>';
}

afficher();