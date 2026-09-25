-- =============================================
-- 02_create_group_invites.sql
-- Tabela de convites por código para grupos
-- Executar no Supabase SQL Editor
-- =============================================

-- Criar tabela de convites
CREATE TABLE IF NOT EXISTS public.group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- Índice para busca por código
CREATE INDEX IF NOT EXISTS idx_group_invites_code ON public.group_invites(code);
CREATE INDEX IF NOT EXISTS idx_group_invites_group ON public.group_invites(group_id);

-- Habilitar RLS
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- Política: membros do grupo podem ver convites do grupo
CREATE POLICY "Group members can view invites"
    ON public.group_invites FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_invites.group_id
            AND gm.user_id = auth.uid()
        )
        OR
        -- Qualquer usuário pode verificar se um código existe (para usar o convite)
        true
    );

-- Política: criador do grupo pode gerar convites
CREATE POLICY "Group creator can create invites"
    ON public.group_invites FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_invites.group_id
            AND g.created_by = auth.uid()
        )
    );

-- Política: criador do grupo pode desativar convites
CREATE POLICY "Group creator can update invites"
    ON public.group_invites FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.groups g
            WHERE g.id = group_invites.group_id
            AND g.created_by = auth.uid()
        )
    );
