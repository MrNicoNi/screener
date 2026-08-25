#!/usr/bin/env python3
"""
Adiciona URLs de redirect na allow-list de Auth do Supabase (uri_allow_list),
via Management API, de forma CIRÚRGICA (só mexe nesse campo — não sobrescreve
o restante da config de auth como faria um `supabase config push`).

Uso (PowerShell):
    $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"     # Personal Access Token
    python scripts/add_redirect_urls.py [url_extra_1] [url_extra_2] ...

Gere o token em: https://supabase.com/dashboard/account/tokens

Por padrão garante as URLs de dev e produção definidas em DEFAULT_URLS.
URLs passadas como argumento são adicionadas às padrão.
"""
import json
import os
import sys
import urllib.request
import urllib.error

PROJECT_REF = "gyktdmahkifnsrbaxodl"
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth"

# URLs que sempre queremos garantir na allow-list
DEFAULT_URLS = [
    "http://localhost:5173/reset-password",
    "https://screenerqa.vercel.app/reset-password",
    "https://screener-2-0.vercel.app/reset-password",
]


def get_token():
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if tok:
        return tok.strip()
    # fallback: token salvo pelo `supabase login`
    path = os.path.expanduser("~/.supabase/access-token")
    if os.path.exists(path):
        raw = open(path, encoding="utf-8").read().strip()
        try:
            return json.loads(raw).get("access_token", raw)
        except json.JSONDecodeError:
            return raw
    sys.exit("ERRO: defina SUPABASE_ACCESS_TOKEN (ou rode `supabase login`).\n"
             "Crie um token em https://supabase.com/dashboard/account/tokens")


def req(method, token, data=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(API, data=body, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        # Cloudflare (à frente da Management API) bloqueia o UA padrão do
        # urllib com 403/1010. Um UA normal resolve.
        "User-Agent": "screener-admin-script/1.0",
    })
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"ERRO {e.code}: {e.read().decode()}")


def main():
    token = get_token()
    to_add = DEFAULT_URLS + sys.argv[1:]

    cfg = req("GET", token)
    current = cfg.get("uri_allow_list", "") or ""
    site_url = cfg.get("site_url", "")
    existing = [u for u in current.split(",") if u.strip()]

    print(f"site_url atual:        {site_url or '(vazio)'}")
    print(f"uri_allow_list atual:  {existing or '(vazia)'}\n")

    merged = list(dict.fromkeys([u.strip() for u in existing + to_add if u.strip()]))
    added = [u for u in to_add if u not in existing]

    if not added:
        print("Nada a fazer — todas as URLs já estão na allow-list.")
        return

    print("Adicionando:")
    for u in added:
        print(f"  + {u}")

    req("PATCH", token, {"uri_allow_list": ",".join(merged)})

    after = req("GET", token).get("uri_allow_list", "")
    print("\nuri_allow_list agora:")
    for u in after.split(","):
        print(f"  - {u.strip()}")
    print("\n✅ Concluído.")


if __name__ == "__main__":
    main()
