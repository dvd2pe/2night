# 2Night completo su Oracle Cloud Always Free

Questa configurazione pubblica **Next.js 16 + API /api/inspect (Python/OpenCV)
+ /api/reskin + entrambi i giochi**, non solo la preview GitHub Pages.

## Requisiti

- Account Oracle Cloud con risorse *Always Free* disponibili (serve verifica con carta).
- Una VM **VM.Standard.A1.Flex (Arm64)**, Ubuntu 24.04, **2 OCPU e 12 GB di RAM**,
  50+ GB di boot volume, dentro i limiti Always Free della tenancy.
- Un indirizzo IP pubblico e regole di rete Oracle per TCP 80,443; limita SSH
  TCP 22 al tuo IP. Aprire le porte sul VCN e sul firewall della VM.
- Docker Engine e Compose plugin installati nella VM.
- DNS che punti all'IP (un dominio tuo, o `<IP>.sslip.io` per test).

Nota: Oracle può recuperare VM Always Free considerate inattive e in alcune
regioni la capacità A1 non è disponibile. Controlla sempre la dicitura
Always Free durante la creazione; altri servizi possono costare.

## Installazione sulla VM

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
# Installa Docker dal repository ufficiale per Ubuntu:
# https://docs.docker.com/engine/install/ubuntu/
git clone https://github.com/dvd2pe/2night.git
cd 2night
```

Calcola l'hash della password di accesso al sito (Caddy):

```bash
docker run --rm -it caddy:2 caddy hash-password
```

Crea `.env` in root (non va su GitHub). L'hash bcrypt contiene caratteri
`$`, quindi **usa gli apici singoli** per conservare la stringa senza
interpolazione nel file .env:

```dotenv
APP_DOMAIN=example.com
AUTH_USER=inspector
AUTH_HASH='$2a$14$SOSTITUISCI_CON_HASH_CADDY_REALE'
```

Se non hai un dominio, per test puoi usare
`APP_DOMAIN=123.45.67.89.sslip.io` sostituendo l'IPv4 pubblico.

Avvia:

```bash
sudo docker compose --env-file .env -f compose.oracle.yml up -d --build
sudo docker compose --env-file .env -f compose.oracle.yml ps
sudo docker compose --env-file .env -f compose.oracle.yml logs -f app
```

Visita `https://<APP_DOMAIN>/`, inserendo l'utente e la password scelti.
Le due applicazioni HTML5 sono servite da `/games/<id>/index.html`.

### Aggiornare

```bash
git pull --ff-only
sudo docker compose --env-file .env -f compose.oracle.yml up -d --build
```

Le sostituzioni degli asset e i backup salvati sotto `public/games`
rimangono persistenti perché la cartella è montata dalla VM nel container.
**Fai periodicamente backup dell'intera cartella**: quando aggiorni il repo,
Git può segnalare conflitti se hai modificato file versionati con il reskin.
Per un prodotto multiutente si dovrà isolare per-utente lo storage degli asset.

## Sicurezza

- Non esporre la porta 3000 al pubblico: solo Caddy (80/443).
- Non disattivare la protezione Basic Auth. L'API reskin **scrive file**.
- Non inserire token GitHub in .env o nei file pubblicati.
- Usa credenziali forti e limita SSH. Configura backup regolari.
- Verifica la sintassi della configurazione e i permessi di scrittura.
- Il build Docker/avvio del progetto non sono stati verificati su una VM
  Oracle reale; dopo il primo deployment controlla i log e i due giochi.
