/**
 * seed-test.ts — données de test cohérentes
 * Usage : ts-node seed-test.ts (ou coller dans la console)
 * Génère articles, tickets et lignes de vente simulés pour 3 mois.
 */

// ── Articles de test ──────────────────────────────────────────────────────────
export const ARTICLES_TEST = [
  { code_article:'00142', nom:'Huile végétale 1L',     description:'Huile de palme raffinée',  prix_achat:700,  prix_detail:1200, prix_grossiste:950,  qte_min_grossiste:12, stock_actuel:84,  stock_maximum:200, seuil_alerte:20  },
  { code_article:'00089', nom:'Riz parfumé 25kg',      description:'Riz long grain importé',   prix_achat:8500, prix_detail:14500,prix_grossiste:12000,qte_min_grossiste:5,  stock_actuel:3,   stock_maximum:50,  seuil_alerte:5   },
  { code_article:'00201', nom:'Sucre cristallisé 1kg', description:'Sucre blanc raffiné',      prix_achat:350,  prix_detail:650,  prix_grossiste:500,  qte_min_grossiste:24, stock_actuel:47,  stock_maximum:300, seuil_alerte:15  },
  { code_article:'00512', nom:'Eau minérale 1,5L',     description:'Source Tangui',            prix_achat:150,  prix_detail:300,  prix_grossiste:220,  qte_min_grossiste:24, stock_actuel:120, stock_maximum:500, seuil_alerte:30  },
  { code_article:'00198', nom:'Lait en poudre 400g',   description:'Lait entier en poudre',    prix_achat:1200, prix_detail:1800, prix_grossiste:1500, qte_min_grossiste:6,  stock_actuel:12,  stock_maximum:100, seuil_alerte:15  },
  { code_article:'00410', nom:'Savon de toilette',     description:'Palmolive 100g',           prix_achat:300,  prix_detail:550,  prix_grossiste:450,  qte_min_grossiste:12, stock_actuel:65,  stock_maximum:200, seuil_alerte:10  },
  { code_article:'00302', nom:'Farine de blé 1kg',     description:'Farine tout usage',        prix_achat:450,  prix_detail:750,  prix_grossiste:600,  qte_min_grossiste:10, stock_actuel:80,  stock_maximum:200, seuil_alerte:15  },
  { code_article:'00315', nom:'Tomate concentrée 400g',description:'Double concentré',         prix_achat:200,  prix_detail:450,  prix_grossiste:350,  qte_min_grossiste:12, stock_actuel:8,   stock_maximum:150, seuil_alerte:20  },
  { code_article:'00621', nom:'Mayonnaise 500g',       description:'Marque Thomy',             prix_achat:900,  prix_detail:1500, prix_grossiste:1200, qte_min_grossiste:6,  stock_actuel:35,  stock_maximum:80,  seuil_alerte:10  },
  { code_article:'00788', nom:'Sardines à l\'huile',   description:'Boîte 125g King Olive',    prix_achat:350,  prix_detail:600,  prix_grossiste:480,  qte_min_grossiste:12, stock_actuel:55,  stock_maximum:150, seuil_alerte:15  },
];

// ── Utilisateurs de test ──────────────────────────────────────────────────────
export const USERS_TEST = [
  { id:'USR-ADMIN-TEST', username:'admin',      mot_de_passe:'admin123',  nom:'Administrateur',  role:'ADMIN'    },
  { id:'USR-002',        username:'marie.ngo',  mot_de_passe:'gerant456', nom:'Marie Ngo',       role:'GERANT'   },
  { id:'USR-003',        username:'jean.kamga', mot_de_passe:'caisse789', nom:'Jean Kamga',      role:'CAISSIER' },
];

// ── Générateur de tickets + lignes ────────────────────────────────────────────
function rand(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min; }
function pick<T>(arr: T[]): T { return arr[rand(0,arr.length-1)]; }

function genTickets(annee: number, mois: number, nbTickets = 30) {
  const tickets: any[] = [];
  const lignes:  any[] = [];

  for (let i = 0; i < nbTickets; i++) {
    const jour   = rand(1, 28);
    const heure  = `${String(rand(7,19)).padStart(2,'0')}:${String(rand(0,59)).padStart(2,'0')}`;
    const date   = `${annee}-${String(mois).padStart(2,'0')}-${String(jour).padStart(2,'0')}T${heure}:00`;
    const type   = Math.random() > 0.65 ? 'GROSSISTE' : 'DETAIL';
    const idTicket = `TK-${annee}${String(mois).padStart(2,'0')}${String(jour).padStart(2,'0')}-${String(i+1).padStart(3,'0')}`;

    // Entre 1 et 5 articles par ticket
    const nbLignes = rand(1, 5);
    let total = 0;
    const lignesTicket: any[] = [];

    for (let j = 0; j < nbLignes; j++) {
      const art  = pick(ARTICLES_TEST);
      const qte  = type === 'GROSSISTE' ? rand(3, 20) : rand(1, 5);
      const gros = type === 'GROSSISTE' && qte >= art.qte_min_grossiste;
      const prix = gros ? art.prix_grossiste : art.prix_detail;
      const tarif = gros ? 'GROSSISTE' : 'DETAIL';
      const sous  = prix * qte;
      total += sous;
      lignesTicket.push({
        id_ligne: `LG-${idTicket}-${j+1}`, id_ticket: idTicket,
        code_article: art.code_article, nom_article: art.nom,
        quantite: qte, prix_unitaire_applique: prix, tarif_applique: tarif, sous_total: sous,
      });
    }

    const recu   = total + rand(0, 5000);
    const caissier = pick(USERS_TEST.filter(u => u.role !== 'ADMIN'));

    tickets.push({
      id_ticket: idTicket, date_heure: date, type_vente: type,
      montant_total: total, montant_recu: recu, monnaie_rendue: recu - total,
      id_caissier: caissier.id, nom_caissier: caissier.nom,
    });
    lignes.push(...lignesTicket);
  }
  return { tickets, lignes };
}

// ── Génération pour 3 mois ────────────────────────────────────────────────────
const now = new Date();
export const SEED_DATA = {
  articles: ARTICLES_TEST,
  users:    USERS_TEST,
  mois: [
    { label: `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}`,  ...genTickets(now.getFullYear(), now.getMonth()+1,  45) },
    { label: `${now.getFullYear()}_${String(now.getMonth()).padStart(2,'0')}`,     ...genTickets(now.getFullYear(), now.getMonth(),     38) },
    { label: `${now.getFullYear()}_${String(now.getMonth()-1||12).padStart(2,'0')}`,...genTickets(now.getFullYear(), now.getMonth()-1||12,32) },
  ],
};

console.log('=== SEED SUPERMARCHÉ ===');
console.log(`Articles : ${SEED_DATA.articles.length}`);
SEED_DATA.mois.forEach(m => console.log(`Mois ${m.label} : ${m.tickets.length} tickets, ${m.lignes.length} lignes`));
console.log('========================');
