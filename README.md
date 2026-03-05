# Agenda Front

Front-end React + Vite para o backend `agendalogo` (NestJS + Prisma), com interface moderna em SCSS e cobertura completa das rotas por papel:

- Publico
- Usuario (`USUARIO`)
- Dono de tenant (`DONO_TENANT`)
- Admin da plataforma (`ADMIN_PLATAFORMA`)

## Requisitos

- Node.js 20+
- Backend rodando em `http://localhost:3000` (ou outra URL configurada)

## Configuracao

Crie um arquivo `.env` na raiz do front:

```bash
VITE_API_URL=http://localhost:3000
```

Se nao definir, o front usa `http://localhost:3000` como padrao.

## Rodar

```bash
npm install
npm run dev
```

Build de producao:

```bash
npm run build
npm run preview
```

## Cobertura de API implementada

### Autenticacao

- `POST /autenticacao/registrar`
- `POST /autenticacao/entrar`

### Publico

- `GET /publico/tenants`
- `GET /publico/tenants/:tenantId`
- `GET /publico/tenants/:tenantId/quadras`
- `GET /publico/tenants/:tenantId/quadras/:quadraId/slots?data=YYYY-MM-DD`
- `GET /publico/tenants/:tenantId/avaliacoes`
- `POST /publico/tenants/:tenantId/quadras/:quadraId/reservas` (usuario autenticado)

### Usuario

- `GET /usuario/minhas-reservas`
- `PATCH /usuario/minhas-reservas/:reservaId/cancelar`
- `POST /usuario/avaliacoes`

### Dono do tenant

- `GET /tenant/quadras`
- `POST /tenant/quadras`
- `PATCH /tenant/quadras/:quadraId`
- `DELETE /tenant/quadras/:quadraId`
- `POST /tenant/quadras/:quadraId/slots`
- `POST /tenant/quadras/:quadraId/slots/bloquear`
- `DELETE /tenant/slots/:slotId`
- `GET /tenant/reservas`
- `PATCH /tenant/reservas/:reservaId/cancelar`
- `PATCH /tenant/reservas/:reservaId/confirmar`
- `GET /tenant/avaliacoes`

Observacao: para dono com multiplos tenants, o front envia `x-tenant-id` automaticamente nas chamadas `/tenant/*` usando o tenant ativo selecionado no header.

### Admin

- `GET /admin/tenants`
- `POST /admin/tenants`
- `PATCH /admin/tenants/:tenantId`
- `GET /admin/usuarios`
- `POST /admin/usuarios`

## Arquitetura do front

- `src/lib/api.js`: cliente HTTP, erro tipado e tratamento do envelope `{ sucesso, dados }`
- `src/lib/formatters.js`: formatadores de data e moeda
- `src/styles/*.scss`: tema SASS (tokens, mixins e layout)
- `src/App.jsx`: orquestracao de telas e fluxos por papel

## Tema visual

Paleta criada para produto de agenda com identidade moderna:

- Primaria verde jade (`--primary`)
- Secundaria dourada (`--secondary`)
- Acento coral (`--accent`)
- Superficies claras com gradientes e cards elevados
