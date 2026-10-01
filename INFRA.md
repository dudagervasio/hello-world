# Infraestrutura: api.hidratapharma.com.br

Esquema da configuração do servidor (Ubuntu + OpenLiteSpeed + Node).

## Caminho de uma requisição

```
Cliente (https://api.hidratapharma.com.br)
  │
  ▼
DNS (cPanel / Editor de Zona)
  └─ registro A: api → IP do servidor Ubuntu
  │
  ▼
Firewall (ufw) ── libera 80 e 443
  │
  ▼
OpenLiteSpeed
  ├─ Listener Default    (porta 80,  Secure = No)
  │     └─ mapeia api.hidratapharma.com.br → virtual host
  │     └─ Rewrite: redireciona para HTTPS (301)
  │
  └─ Listener Defaultssl (porta 443, Secure = Yes)
        └─ mapeia api.hidratapharma.com.br → virtual host
              │
              ▼
        Virtual Host api.hidratapharma.com.br
              ├─ Context /.well-known/acme-challenge/  (Static)
              │     └─ pasta local, usada pelo certbot
              │
              └─ Context /  (Proxy)
                    └─ handler: node_hidrata_api
                          └─ External App → 127.0.0.1:3000
                                └─ Node (Express, gerenciado pelo PM2)
```

## Onde cada coisa está configurada

```
Server Configuration
  ├─ External App
  │     └─ node_hidrata_api   (Web Server, 127.0.0.1:3000)
  │           ├─ Max Connections: 100
  │           ├─ Keep-Alive Timeout: 60
  │           └─ Response Buffering: No
  │
  └─ Listeners
        ├─ Default      → porta 80
        └─ Defaultssl   → porta 443

Virtual Hosts → api.hidratapharma.com.br
  ├─ General
  │     ├─ Virtual Host Root: /usr/local/lsws/api.hidratapharma.com.br/
  │     ├─ Config File: .../conf/vhosts/api.hidratapharma.com.br/vhconf.conf
  │     └─ Document Root: $VH_ROOT/html/        ← obrigatório
  ├─ Context
  │     ├─ /.well-known/acme-challenge/  (Static, Accessible = Yes)
  │     └─ /                             (Proxy → node_hidrata_api)
  ├─ Rewrite
  │     └─ HTTP → HTTPS, exceto o caminho do desafio
  └─ SSL
        ├─ Private Key: /etc/letsencrypt/live/api.hidratapharma.com.br/privkey.pem
        └─ Certificate: /etc/letsencrypt/live/api.hidratapharma.com.br/fullchain.pem
```

Regras do Rewrite:

```
RewriteCond %{HTTPS} !on
RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
RewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
```

## Certificado e renovação

```
certbot (webroot, porta 80)
  ├─ Validação: arquivo em .../html/.well-known/acme-challenge/
  ├─ Timer systemd: roda 2x por dia, renova com menos de 30 dias
  └─ Hook: /etc/letsencrypt/renewal-hooks/deploy/ols-reload.sh
        └─ systemctl restart lsws   (OLS lê o certificado novo)
```

Comandos úteis:

```bash
sudo certbot certificates          # validade do certificado
sudo certbot renew --dry-run       # testa a renovação sem gastar limite
systemctl list-timers | grep certbot
```

## Aplicação

```
Node (hello-world)
  ├─ Repositório: github.com/dudagervasio/hello-world (branch main)
  ├─ Escuta em 127.0.0.1:3000   (não exposta na internet)
  ├─ trust proxy = 1
  ├─ keepAliveTimeout = 65s     (maior que os 60s do OLS)
  └─ PM2 (pm2 save + pm2-root.service sobe no boot)
```

## Pontos que mais deram trabalho

- **`docRoot`** no virtual host: sem ele o OLS ignorava o domínio e respondia com o virtual host `Example`.
- **Pasta do `location`** do contexto Static: precisa existir **antes** de o OLS carregar a configuração, senão o contexto é descartado em silêncio e a requisição cai no proxy `/`.
- **Rewrite** com exceção do `/.well-known/acme-challenge/`: sem ela a renovação do certificado quebra.
- **Porta 80** precisa estar liberada no `ufw` (e no firewall do provedor) para o certbot validar.
- **`keepAliveTimeout` do Node** maior que o do OLS, para evitar 502 esporádicos.
