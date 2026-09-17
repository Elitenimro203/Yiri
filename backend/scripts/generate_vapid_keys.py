"""
Génère une paire de clés VAPID pour les notifications push web (RG-13).

Usage :
    python scripts/generate_vapid_keys.py

Colle le résultat dans ton .env (dev) ou tes variables d'environnement Railway (prod) :
    VAPID_PUBLIC_KEY=...
    VAPID_PRIVATE_KEY=...

La clé publique n'est PAS un secret (elle est envoyée au navigateur). La clé
privée, elle, ne doit jamais être commitée ni partagée — exactement comme SECRET_KEY.
"""
import base64

from py_vapid import Vapid


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def main():
    v = Vapid()
    v.generate_keys()

    priv_num = v.private_key.private_numbers().private_value
    priv_str = b64url(priv_num.to_bytes(32, "big"))

    pub_num = v.public_key.public_numbers()
    pub_raw = b"\x04" + pub_num.x.to_bytes(32, "big") + pub_num.y.to_bytes(32, "big")
    pub_str = b64url(pub_raw)

    print("Ajoute ces lignes à ton .env (ou variables Railway) :\n")
    print(f"VAPID_PUBLIC_KEY={pub_str}")
    print(f"VAPID_PRIVATE_KEY={priv_str}")
    print(f"VAPID_CLAIMS_EMAIL=mailto:ton-email@exemple.com")
    print("\n⚠️  VAPID_PRIVATE_KEY est un secret — ne jamais le commiter dans Git.")


if __name__ == "__main__":
    main()
