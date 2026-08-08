"""
Script de seed — crée un compte (ou se connecte s'il existe déjà), un programme
"L'homme complet", et les 10 axes avec leur pilier + jours_actifs.

Aucune dépendance externe (urllib de la stdlib) — pas besoin d'installer quoi
que ce soit en plus du backend lui-même.

Usage :
    python scripts/seed.py
    python scripts/seed.py --base-url http://localhost:8000 --email moi@exemple.com

Le mot de passe n'est jamais codé en dur ni loggé — demandé de façon masquée
via getpass, exactement comme un vrai script d'admin le ferait.
"""
import argparse
import getpass
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date


def appel(base_url: str, method: str, path: str, body: dict | None = None, token: str | None = None, form: bool = False):
    url = f"{base_url}{path}"
    headers = {}
    data = None

    if body is not None:
        if form:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            data = urllib.parse.urlencode(body).encode()
        else:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    def _parse(raw: bytes):
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Le serveur a renvoyé quelque chose de non-JSON (page d'erreur HTML,
            # texte brut...) — on ne plante pas, on renvoie le texte brut tel quel
            # pour qu'on puisse voir ce qui a vraiment été reçu.
            return {"_reponse_brute_non_json": raw.decode(errors="replace")[:2000]}

    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, _parse(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, _parse(e.read())


# (nom, phase_deverrouillage, pilier, jours_actifs)
# jours_actifs=None -> actif tous les jours (RG-11). Les valeurs ci-dessous
# reprennent ton PDF d'origine là où la nuance était explicite.
AXES = [
    ("Réveil 4h",               1, "corps",     None),
    ("Sport",                   1, "corps",     None),
    ("Tech",                    1, "impact",    None),
    ("Anglais",                 2, "esprit",    None),
    ("Lecture",                 2, "esprit",    None),
    ("Expression écrite/orale", 3, "caractere", "2,4"),   # Mardi (dissertation) + Jeudi (art oratoire)
    ("Business Dev GreenGrow",  3, "impact",    None),
    ("Portfolio",               4, "impact",    "1,6"),   # Lundi + Samedi
    ("Méditation biblique",     4, "esprit",    None),
    ("Sujet libre",             4, "caractere", "5,7"),   # Vendredi + Dimanche
]


def main():
    parser = argparse.ArgumentParser(description="Seed L'homme complet")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--email", default=None, help="Si omis, demandé de façon interactive")
    parser.add_argument("--nom", default="Kouadio")
    parser.add_argument("--programme-nom", default="L'homme complet")
    parser.add_argument("--date-debut", default=str(date.today()))
    args = parser.parse_args()

    email = args.email or input("Email : ").strip()
    mot_de_passe = getpass.getpass("Mot de passe : ")

    # 1. Register — si le compte existe déjà (409), on passe direct au login
    status, _ = appel(args.base_url, "POST", "/auth/register", {
        "email": email, "mot_de_passe": mot_de_passe, "nom": args.nom,
    })
    if status == 201:
        print(f"✅ Compte créé : {email}")
    elif status == 409:
        print(f"ℹ️  Compte déjà existant, connexion directe : {email}")
    else:
        print(f"❌ Erreur register ({status})")
        return

    # 2. Login
    status, data = appel(args.base_url, "POST", "/auth/login", {
        "grant_type": "password", "username": email, "password": mot_de_passe,
    }, form=True)
    if status != 200:
        print(f"❌ Login échoué ({status}) — mot de passe correct ?")
        return
    token = data["access_token"]
    print("✅ Connecté")

    # 3. Programme
    status, prog = appel(args.base_url, "POST", "/programmes", {
        "nom": args.programme_nom,
        "date_debut": args.date_debut,
        "mode_progression": "manuel",
        "mode_deverrouillage": "progressif",
    }, token=token)
    if status != 201:
        print(f"❌ Erreur création programme ({status}): {prog}")
        return
    prog_id = prog["id_programme"]
    print(f"✅ Programme créé : id={prog_id}, nom={prog['nom']}")

    # 4. Axes
    for nom, phase, pilier, jours in AXES:
        status, axe = appel(args.base_url, "POST", f"/programmes/{prog_id}/axes", {
            "nom": nom, "phase_deverrouillage": phase, "pilier": pilier,
            "jours_actifs": jours, "ordre_affichage": 0,
        }, token=token)
        if status == 201:
            print(f"  ✅ Axe '{nom}' créé (id={axe['id_axe']})")
        else:
            print(f"  ❌ Erreur création axe '{nom}' ({status}): {axe}")

    print(f"\nTerminé. Programme id={prog_id} prêt à l'usage.")


if __name__ == "__main__":
    main()
