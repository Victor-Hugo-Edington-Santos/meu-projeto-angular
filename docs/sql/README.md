# SQL da Comunidade — ordem de execução

Copiados verbatim de `Amor-neuro-Divergente-main/sql/`. **NÃO executar ainda.**
Quando o Supabase real estiver ligado, rodar nesta ordem no SQL Editor
(ou via `supabase db push`, conforme `supabase/config.toml`):

| # | Arquivo | O que faz |
|---|---------|-----------|
| 1 | `01_create_friendships.sql` | Tabela `friendships` + RLS (ver/enviar/atualizar/excluir) + trigger `updated_at` |
| 2 | `02_create_group_invites.sql` | Tabela `group_invites` + RLS (membros veem, criador gerencia) |
| 3 | `03_create_rpcs.sql` | RPCs usadas pelo app: `search_users`, `send_friend_request`, `respond_friend_request`, `get_friends`, `get_pending_requests` (+ criar conversas) |
| 4 | `04_insert_system_message.sql` | Função `insert_system_message` (mensagens de sistema no chat) |
| 5 | `05_fix_group_invites_columns.sql` | Colunas `active`, `code` (único), `created_by`, `expires_at` + RLS |
| 6 | `06_enable_realtime.sql` | Habilita realtime nas tabelas (posts/mensagens/atendimentos) |

Os componentes `comunidade`/`perfil`/`loja`/`explorar` estão em MOCK até lá —
cada ponto de troca está marcado com `// TODO SUPABASE:` no TS.
